// src/components/sky/skyI18n.ts
// Textos de la pestanya Cel (plafons «Aquesta nit» i «El sol») en els 4 idiomes. Els de la targeta del sol d'abans
// (SunArcWidget) hi són tal qual, perquè el compte enrere i les etiquetes diguin el mateix que el modal Cicle solar.
import type { Language } from '../../translations';
import type { NightSkyClass, NightTitle } from '../../utils/sky/nightVerdict';

export interface SkyStrings {
  // --- El sol ---
  sunTitle: string;
  sunriseIn: string; sunsetIn: string; setsInHero: string;
  noData: string; sunrise: string; sunset: string; daylight: string;
  polarDay: string; polarNight: string; longer: string; shorter: string; same: string;
  goldenFrom: string; goldenUntil: string; nowAt: string; below: string;
  golden: string; tomorrow: string; fullDark: string; firstLight: string;
  // --- Aquesta nit ---
  nightTitle: string; polarNightTag: string;
  clouds: string; darkness: string; darkRange: string; noFullDark: string;
  seen: string; hidden: string; sunHidden: string; now: string;
  titles: Record<NightTitle, string>;
  opens: string; closes: string;
  moonAllNight: string; moonRises: string; moonSets: string; moonBetween: string; moonAbsent: string;
  midnightSun: string;
  roseAt: string; roseYesterdayAt: string; risesAt: string; risesTomorrowAt: string;
  setsAt: string; setsTomorrowAt: string;
  full: string; today: string; days: string;
  tomorrowNight: string; tomorrowOpens: string; tomorrowCloses: string;
  tomorrowSky: Record<NightSkyClass, string>;
}

export const SKY_TEXT: Readonly<Record<Language, SkyStrings>> = {
  ca: {
    sunTitle: 'El sol',
    sunriseIn: 'Sortida en', sunsetIn: 'Posta de sol en', setsInHero: "Es pon d'aquí a",
    noData: 'Sense dades', sunrise: 'Sortida', sunset: 'Posta', daylight: 'Llum',
    polarDay: 'Sol de mitjanit', polarNight: 'Nit polar', longer: 'més que ahir', shorter: 'menys que ahir', same: 'Igual que ahir',
    goldenFrom: 'Hora daurada des de les {t}.', goldenUntil: 'Hora daurada fins a les {t}.', nowAt: 'Ara, a {alt} · {az}.', below: "sota l'horitzó",
    golden: 'Hora daurada', tomorrow: 'demà', fullDark: 'Nit fosca', firstLight: 'Clareja',
    nightTitle: 'Aquesta nit', polarNightTag: 'nit polar',
    clouds: 'Núvols', darkness: 'Foscor', darkRange: 'nit fosca {a} – {b}', noFullDark: 'no es fa fosc del tot',
    seen: 'es veu', hidden: 'tapada', sunHidden: 'tapat', now: 'ara',
    titles: {
      clearMoon: 'Cel serè i lluna ben visible', clearDark: "Cel serè i fosc: bona nit d'estrelles", clear: 'Cel serè',
      mixedMoon: 'Clarianes, i la lluna a estones', mixed: 'Clarianes a estones',
      cloudyMoon: 'La lluna, darrere dels núvols', cloudy: 'Nit tapada',
      rain: 'Nit de pluja', snow: 'Nit de neu', storm: 'Nit de tempestes', unknown: 'La nit al cel',
    },
    opens: "S'obre a partir de les {t}.", closes: 'Es tapa a partir de les {t}.',
    moonAllNight: 'La lluna, al {p}%, hi és tota la nit.', moonRises: 'La lluna surt a les {t}.', moonSets: 'La lluna es pon a les {t}.',
    moonBetween: 'La lluna hi és de {a} a {b}.', moonAbsent: 'Sense lluna.',
    midnightSun: 'Sol de mitjanit: avui no es fa fosc.',
    roseAt: 'Va sortir a les {t}', roseYesterdayAt: 'Va sortir ahir a les {t}', risesAt: 'Surt a les {t}', risesTomorrowAt: 'Surt demà a les {t}',
    setsAt: 'es pon a les {t}', setsTomorrowAt: 'es pon demà a les {t}',
    full: 'Plena', today: 'avui', days: 'dies',
    tomorrowNight: 'Demà a la nit', tomorrowOpens: "s'obre a les {t}", tomorrowCloses: 'es tapa a les {t}',
    tomorrowSky: { clear: 'serè', mixed: 'clarianes', cloudy: 'tapat', rain: 'pluja', snow: 'neu', storm: 'tempestes', unknown: '—' },
  },
  es: {
    sunTitle: 'El sol',
    sunriseIn: 'Salida del sol en', sunsetIn: 'Puesta de sol en', setsInHero: 'Se pone dentro de',
    noData: 'Sin datos', sunrise: 'Salida', sunset: 'Puesta', daylight: 'Luz',
    polarDay: 'Sol de medianoche', polarNight: 'Noche polar', longer: 'más que ayer', shorter: 'menos que ayer', same: 'Igual que ayer',
    goldenFrom: 'Hora dorada desde las {t}.', goldenUntil: 'Hora dorada hasta las {t}.', nowAt: 'Ahora, a {alt} · {az}.', below: 'bajo el horizonte',
    golden: 'Hora dorada', tomorrow: 'mañana', fullDark: 'Noche cerrada', firstLight: 'Clarea',
    nightTitle: 'Esta noche', polarNightTag: 'noche polar',
    clouds: 'Nubes', darkness: 'Oscuridad', darkRange: 'noche cerrada {a} – {b}', noFullDark: 'no llega a ser noche cerrada',
    seen: 'se ve', hidden: 'tapada', sunHidden: 'tapado', now: 'ahora',
    titles: {
      clearMoon: 'Cielo despejado y luna bien visible', clearDark: 'Cielo despejado y oscuro: buena noche de estrellas', clear: 'Cielo despejado',
      mixedMoon: 'Claros, y la luna a ratos', mixed: 'Claros a ratos',
      cloudyMoon: 'La luna, tras las nubes', cloudy: 'Noche cubierta',
      rain: 'Noche de lluvia', snow: 'Noche de nieve', storm: 'Noche de tormentas', unknown: 'La noche en el cielo',
    },
    opens: 'Se abre a partir de las {t}.', closes: 'Se cubre a partir de las {t}.',
    moonAllNight: 'La luna, al {p}%, está toda la noche.', moonRises: 'La luna sale a las {t}.', moonSets: 'La luna se pone a las {t}.',
    moonBetween: 'La luna está de {a} a {b}.', moonAbsent: 'Sin luna.',
    midnightSun: 'Sol de medianoche: hoy no oscurece.',
    roseAt: 'Salió a las {t}', roseYesterdayAt: 'Salió ayer a las {t}', risesAt: 'Sale a las {t}', risesTomorrowAt: 'Sale mañana a las {t}',
    setsAt: 'se pone a las {t}', setsTomorrowAt: 'se pone mañana a las {t}',
    full: 'Llena', today: 'hoy', days: 'días',
    tomorrowNight: 'Mañana por la noche', tomorrowOpens: 'se abre a las {t}', tomorrowCloses: 'se cubre a las {t}',
    tomorrowSky: { clear: 'despejado', mixed: 'claros', cloudy: 'cubierto', rain: 'lluvia', snow: 'nieve', storm: 'tormentas', unknown: '—' },
  },
  en: {
    sunTitle: 'The sun',
    sunriseIn: 'Sunrise in', sunsetIn: 'Sunset in', setsInHero: 'Sets in',
    noData: 'No data', sunrise: 'Sunrise', sunset: 'Sunset', daylight: 'Daylight',
    polarDay: 'Midnight sun', polarNight: 'Polar night', longer: 'longer than yesterday', shorter: 'shorter than yesterday', same: 'Same as yesterday',
    goldenFrom: 'Golden hour from {t}.', goldenUntil: 'Golden hour until {t}.', nowAt: 'Now at {alt} · {az}.', below: 'below the horizon',
    golden: 'Golden hour', tomorrow: 'tomorrow', fullDark: 'Full dark', firstLight: 'First light',
    nightTitle: 'Tonight', polarNightTag: 'polar night',
    clouds: 'Clouds', darkness: 'Darkness', darkRange: 'full dark {a} – {b}', noFullDark: 'never fully dark',
    seen: 'visible', hidden: 'hidden', sunHidden: 'hidden', now: 'now',
    titles: {
      clearMoon: 'Clear sky and a bright moon', clearDark: 'Clear and dark: a good night for stars', clear: 'Clear sky',
      mixedMoon: 'Clear spells, the moon at times', mixed: 'Clear spells at times',
      cloudyMoon: 'The moon, behind the clouds', cloudy: 'Overcast night',
      rain: 'Rainy night', snow: 'Snowy night', storm: 'Stormy night', unknown: "Tonight's sky",
    },
    opens: 'Clearing from {t}.', closes: 'Clouding over from {t}.',
    moonAllNight: 'The moon, {p}% lit, is up all night.', moonRises: 'Moonrise at {t}.', moonSets: 'Moonset at {t}.',
    moonBetween: 'The moon is up from {a} to {b}.', moonAbsent: 'No moon.',
    midnightSun: 'Midnight sun: no darkness today.',
    roseAt: 'Rose at {t}', roseYesterdayAt: 'Rose yesterday at {t}', risesAt: 'Rises at {t}', risesTomorrowAt: 'Rises tomorrow at {t}',
    setsAt: 'sets at {t}', setsTomorrowAt: 'sets tomorrow at {t}',
    full: 'Full', today: 'today', days: 'days',
    tomorrowNight: 'Tomorrow night', tomorrowOpens: 'clearing from {t}', tomorrowCloses: 'clouding over from {t}',
    tomorrowSky: { clear: 'clear', mixed: 'clear spells', cloudy: 'overcast', rain: 'rain', snow: 'snow', storm: 'storms', unknown: '—' },
  },
  fr: {
    sunTitle: 'Le soleil',
    sunriseIn: 'Lever du soleil dans', sunsetIn: 'Coucher du soleil dans', setsInHero: 'Se couche dans',
    noData: 'Pas de données', sunrise: 'Lever', sunset: 'Coucher', daylight: 'Jour',
    polarDay: 'Soleil de minuit', polarNight: 'Nuit polaire', longer: "de plus qu'hier", shorter: "de moins qu'hier", same: 'Identique à hier',
    goldenFrom: 'Heure dorée dès {t}.', goldenUntil: "Heure dorée jusqu'à {t}.", nowAt: 'Maintenant à {alt} · {az}.', below: "sous l'horizon",
    golden: 'Heure dorée', tomorrow: 'demain', fullDark: 'Nuit noire', firstLight: 'Premières lueurs',
    nightTitle: 'Cette nuit', polarNightTag: 'nuit polaire',
    clouds: 'Nuages', darkness: 'Obscurité', darkRange: 'nuit noire {a} – {b}', noFullDark: 'jamais nuit noire',
    seen: 'visible', hidden: 'cachée', sunHidden: 'caché', now: 'maintenant',
    titles: {
      clearMoon: 'Ciel dégagé et lune bien visible', clearDark: "Ciel dégagé et sombre : belle nuit d'étoiles", clear: 'Ciel dégagé',
      mixedMoon: 'Éclaircies, et la lune par moments', mixed: 'Éclaircies par moments',
      cloudyMoon: 'La lune, derrière les nuages', cloudy: 'Nuit couverte',
      rain: 'Nuit pluvieuse', snow: 'Nuit neigeuse', storm: 'Nuit orageuse', unknown: 'Le ciel de la nuit',
    },
    opens: 'Dégagement à partir de {t}.', closes: 'Se couvre à partir de {t}.',
    moonAllNight: 'La lune, éclairée à {p}%, est là toute la nuit.', moonRises: 'Lever de la lune à {t}.', moonSets: 'Coucher de la lune à {t}.',
    moonBetween: 'La lune est là de {a} à {b}.', moonAbsent: 'Pas de lune.',
    midnightSun: "Soleil de minuit : pas de nuit aujourd'hui.",
    roseAt: 'Levée à {t}', roseYesterdayAt: 'Levée hier à {t}', risesAt: 'Se lève à {t}', risesTomorrowAt: 'Se lève demain à {t}',
    setsAt: 'se couche à {t}', setsTomorrowAt: 'se couche demain à {t}',
    full: 'Pleine', today: "aujourd'hui", days: 'jours',
    tomorrowNight: 'Demain soir', tomorrowOpens: 'dégagement dès {t}', tomorrowCloses: 'se couvre dès {t}',
    tomorrowSky: { clear: 'dégagé', mixed: 'éclaircies', cloudy: 'couvert', rain: 'pluie', snow: 'neige', storm: 'orages', unknown: '—' },
  },
};

export const LOCALE: Readonly<Record<Language, string>> = { ca: 'ca-ES', es: 'es-ES', en: 'en-GB', fr: 'fr-FR' };

/** Omple els forats {x} d'una plantilla. */
export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => (k in values ? String(values[k]) : `{${k}}`));
