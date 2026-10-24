// src/utils/welcome/welcomeEyebrow.ts
// La línia de dalt de la benvinguda: el dia i l'hora del dispositiu i el moment del dia. Les hores del sol, només
// amb la posició real (si ja hi havia permís d'ubicació): amb la ciutat de la zona horària (Madrid per a tot
// Espanya) anirien fins a mitja hora desviades. De nit, la fase de la lluna en paraules de cada dia (la pantalla hi
// posa al davant la lluna dibuixada). Separat de welcomeSky.ts perquè no carregui suncalc al paquet inicial.
import type { TranslationType } from '../../translations';
import type { WelcomePhase, WelcomeSky } from './welcomeSky';
import { welcomeMoonKey } from './moonPhaseKey';

type WelcomeTexts = TranslationType['welcome'];

export interface WelcomeEyebrow {
  /** "Dissabte, 13:30". */
  head: string;
  /** El moment del dia; null fins que arriba el cel. */
  moment: string | null;
  /** De nit amb la lluna sobre l'horitzó: el moment és la fase i va amb la lluna dibuixada. */
  moon: boolean;
}

/** De dia, sense hores del sol, "migdia" és fins a una hora abans o després del migdia solar. */
const MIDDAY_HALF_MS = 60 * 60000;

const capitalize = (s: string) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

export function welcomeEyebrow(sky: WelcomeSky | null, now: Date, locale: string, w: WelcomeTexts): WelcomeEyebrow {
  const day = capitalize(new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(now));
  const clock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const head = `${day}, ${clock.format(now)}`;
  if (!sky) return { head, moment: null, moon: false };

  const exact = sky.place.source === 'gps';
  const { rise, set, noon } = sky.sunTimes;
  const nowMs = now.getTime();
  const PHASE: Record<WelcomePhase, string> = { alba: w.phaseDawn, dia: w.phaseMorning, posta: w.phaseDusk, nit: w.phaseNight };
  let moment = PHASE[sky.phase];
  let moon = false;
  if (sky.phase === 'dia') {
    if (exact && rise !== null && set !== null) moment = w.sunDay.replace('{rise}', clock.format(rise)).replace('{set}', clock.format(set));
    else if (noon !== null && Math.abs(nowMs - noon) <= MIDDAY_HALF_MS) moment = w.phaseMidday;
    else moment = sky.sunEast ? w.phaseMorning : w.phaseAfternoon;
  } else if (sky.phase === 'alba') {
    if (exact && rise !== null && nowMs < rise) moment = w.sunriseAt.replace('{time}', clock.format(rise));
  } else if (sky.phase === 'posta') {
    if (exact && set !== null && nowMs < set) moment = w.sunsetAt.replace('{time}', clock.format(set));
  } else if (sky.moon.angle !== null) {
    moment = w[welcomeMoonKey(sky.moon.phase, sky.moon.illumination)];
    moon = true;
  }
  return { head, moment, moon };
}
