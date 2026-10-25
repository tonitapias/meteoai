// src/utils/lunarPhases.ts
// Fase i edat lunars reals, a partir dels instants de les quatre fases principals (Meeus,
// "Astronomical Algorithms", cap. 49, termes periòdics fins a 0,00017 dies; sense les correccions
// planetàries, que sumen menys d'un minut). Contra les taules de l'USNO de 2026-2027 l'error és
// d'1-2 min (vegeu lunarPhases.test.ts).
//
// Substitueix la fórmula antiga de weatherMath.ts, que suposava una lunació de durada fixa
// (29,53 d) i, mesurada contra les mateixes taules, s'equivocava fins a 14 h: la il·luminació
// es desviava fins a 8 punts i el nom de la fase sortia diferent unes 16 nits l'any.

const SYNODIC_DAYS = 29.530588861;
const DAY_MS = 86400000;
const DEG = Math.PI / 180;
// Meeus dona els instants en Temps Terrestre: TT − UTC ≈ 69 s en aquesta dècada (varia ~1 s l'any).
const DELTA_T_MS = 69000;

// Els 7 primers termes són els únics que canvien entre lluna nova i plena; la resta és comuna.
const NEW_TERMS = [-0.40720, 0.17241, 0.01608, 0.01039, 0.00739, -0.00514, 0.00208];
const FULL_TERMS = [-0.40614, 0.17302, 0.01614, 0.01043, 0.00734, -0.00515, 0.00209];

/**
 * Instant (ms UTC) de la fase principal k: k enter = lluna nova, +0.25 = quart creixent,
 * +0.5 = lluna plena, +0.75 = quart minvant. k = 0 és la lluna nova del 6-1-2000.
 */
export function principalPhaseMs(k: number): number {
  const T = k / 1236.85;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const M = (2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T ** 3) * DEG;
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4) * DEG;
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4) * DEG;
  const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3) * DEG;
  const s = Math.sin;
  const c = Math.cos;

  let jde = 2451550.09766 + SYNODIC_DAYS * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  const quarter = ((k % 1) + 1) % 1;
  if (quarter === 0 || quarter === 0.5) {
    const t = quarter === 0 ? NEW_TERMS : FULL_TERMS;
    jde += t[0] * s(Mp) + t[1] * E * s(M) + t[2] * s(2 * Mp) + t[3] * s(2 * F) + t[4] * E * s(Mp - M)
      + t[5] * E * s(Mp + M) + t[6] * E * E * s(2 * M)
      - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F) + 0.00056 * E * s(2 * Mp + M) - 0.00042 * s(3 * Mp)
      + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F) - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(Om);
  } else {
    jde += -0.62801 * s(Mp) + 0.17172 * E * s(M) - 0.01183 * E * s(Mp + M) + 0.00862 * s(2 * Mp) + 0.00804 * s(2 * F)
      + 0.00454 * E * s(Mp - M) + 0.00204 * E * E * s(2 * M) - 0.0018 * s(Mp - 2 * F) - 0.0007 * s(Mp + 2 * F)
      - 0.0004 * s(3 * Mp) - 0.00034 * E * s(2 * Mp - M) + 0.00032 * E * s(M + 2 * F) + 0.00032 * E * s(M - 2 * F)
      - 0.00028 * E * E * s(Mp + 2 * M) + 0.00027 * E * s(2 * Mp + M) - 0.00017 * s(Om);
    const W = 0.00306 - 0.00038 * E * c(M) + 0.00026 * c(Mp) - 0.00002 * c(Mp - M) + 0.00002 * c(Mp + M) + 0.00002 * c(2 * F);
    jde += quarter === 0.25 ? W : -W;
  }
  return (jde - 2440587.5) * DAY_MS - DELTA_T_MS;
}

/** k de la lluna nova real que obre la lunació en curs a `ms` (principalPhaseMs(k) <= ms < principalPhaseMs(k + 1)). */
function lunationIndexAt(ms: number): number {
  const jd = ms / DAY_MS + 2440587.5;
  const k = Math.floor((jd - 2451550.09766) / SYNODIC_DAYS);
  // La lluna nova real s'aparta de la mitjana menys de 15 h: com a molt cal moure's una lunació.
  if (ms < principalPhaseMs(k)) return k - 1;
  if (ms >= principalPhaseMs(k + 1)) return k + 1;
  return k;
}

/**
 * Fase lunar 0..1 (0 nova, 0.25 quart creixent, 0.5 plena, 0.75 quart minvant) en un instant.
 * Exacta als quatre instants principals i interpolada en el temps entre ells. NaN si la data no és vàlida.
 */
export const getMoonPhase = (date: Date): number => {
  const ms = date.getTime();
  if (!Number.isFinite(ms)) return NaN;
  const k = lunationIndexAt(ms);
  let prev = principalPhaseMs(k);
  for (let q = 1; q <= 4; q++) {
    const next = principalPhaseMs(k + q / 4);
    if (ms < next) return (q - 1 + (ms - prev) / (next - prev)) / 4;
    prev = next;
  }
  return 0; // inabastable: lunationIndexAt garanteix ms < lluna nova k + 1
};

/** Edat lunar en dies sencers (arrodonida): temps des de la darrera lluna nova real. NaN si la data no és vàlida. */
export const getMoonAgeDays = (date: Date): number => {
  const ms = date.getTime();
  if (!Number.isFinite(ms)) return NaN;
  return Math.round((ms - principalPhaseMs(lunationIndexAt(ms))) / DAY_MS);
};

// DOCTRINA RISC ZERO: Motor de traducció local aïllat i amb tipatge estricte (mateixos llindars que el modal).
// El fan servir la targeta Fase lunar i la targeta "Vols més detall?", perquè totes dues diguin la mateixa fase.
export const getMoonPhaseName = (phase: number, lang: string): string => {
  const safePhase = typeof phase === 'number' && !isNaN(phase) ? Math.max(0, Math.min(1, phase)) : 0;

  // Mapatge astronòmic rigorós (8 fases)
  let phaseIndex = 0;
  if (safePhase < 0.02 || safePhase > 0.98) phaseIndex = 0; // Nova
  else if (safePhase < 0.23) phaseIndex = 1; // Creixent
  else if (safePhase < 0.27) phaseIndex = 2; // Quart Creixent
  else if (safePhase < 0.48) phaseIndex = 3; // Gibosa Creixent
  else if (safePhase <= 0.52) phaseIndex = 4; // Plena
  else if (safePhase < 0.73) phaseIndex = 5; // Gibosa Minvant
  else if (safePhase < 0.77) phaseIndex = 6; // Quart Minvant
  else phaseIndex = 7; // Minvant

  const dict: Record<string, string[]> = {
    ca: ['Lluna Nova', 'Creixent', 'Quart Creixent', 'Gibosa Creixent', 'Lluna Plena', 'Gibosa Minvant', 'Quart Minvant', 'Minvant'],
    es: ['Luna Nueva', 'Creciente', 'Cuarto Creciente', 'Gibosa Creciente', 'Luna Llena', 'Gibosa Menguante', 'Cuarto Menguante', 'Menguante'],
    en: ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'],
    fr: ['Nouvelle Lune', 'Premier Croissant', 'Premier Quartier', 'Lune Gibbeuse Crois.', 'Pleine Lune', 'Lune Gibbeuse Décrois.', 'Dernier Quartier', 'Dernier Croissant']
  };

  const safeLang = typeof lang === 'string' ? lang.toLowerCase() : 'ca';
  const activeLang = dict[safeLang] ? safeLang : 'ca';

  return dict[activeLang][phaseIndex] || '--';
};
