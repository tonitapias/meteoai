// src/components/planet/planetRecordsI18n.ts
// Textos de les fitxes dels rècords d'«Extrems del planeta»: què és cada dada, per què passa aquí ara i què hi té
// a veure l'escalfament. L'etiqueta de l'escalfament diu el que se'n sap i el que no (IPCC AR6): un sol dia no és
// cap senyal del clima, i no tots els extrems en són conseqüència. {x} es substitueix amb fill().
import type { Language } from '../../translations';
import type { RecordKey } from '../../utils/planetExtremes';

interface LeadText { lead: string; text: string }

export interface RecordStrings {
  podium: Record<RecordKey, string>;
  tie: string;
  tieExplain: string;
  measured: string;
  whatTitle: string;
  whyTitle: string;
  bodyTitle: string;
  what: Record<RecordKey, string[]>;
  // Les quatre zones de la calor humida, de menys a més: per sota de 27\u00a0°C, 27-31, 31-35 i 35 o més.
  zones: [string, string, string, string];
  zonesNow: string;
  zonesSource: string;
  why: {
    wetBulbHour: Record<'morning' | 'afternoon' | 'night', LeadText>;
    wetBulbDew: LeadText;
    polarDay: LeadText;
    high: LeadText;
    continental: LeadText;
    circumpolar: LeadText;
    gustCyclone: LeadText;
    gustStorm: LeadText;
  };
  warming: Record<RecordKey, { badge: string; text: string; source: string }>;
}

export const RECORD_STRINGS: Record<Language, RecordStrings> = {
  ca: {
    podium: { wetBulb: 'Els tres més alts', hottest: 'Els tres més calents', coldest: 'Els tres més freds', gust: 'Les tres més fortes', lowPressure: 'Les tres més baixes' },
    tie: 'empat tècnic',
    tieExplain: 'Empat tècnic. Les estacions donen graus sencers, i això ja fa un marge de ±{m} a cada valor, més que la diferència entre els primers.',
    measured: 'Mesura de les {time} UTC, fa {min} min',
    whatTitle: 'Què és',
    whyTitle: 'Per què aquí ara',
    bodyTitle: 'Com ho viu el cos',
    what: {
      wetBulb: [
        "El cos es refreda suant: la suor s'evapora i s'endú calor. La calor humida és la temperatura més baixa a què pot arribar una pell mullada, i es mesura amb un termòmetre embolicat amb un drap moll. El seu nom tècnic és temperatura de bulb humit.",
        "Per dins som a 37\u00a0°C. Si la pell no pot baixar de 35\u00a0°C, la calor ja no surt. Per això el número és més baix que la temperatura de l'aire i, tot i així, és el que compta per al cos.",
      ],
      hottest: ["La temperatura de l'aire a l'ombra, a 1,5 o 2 metres de terra, com la mesuren les estacions dels aeroports. A ple sol, l'asfalt o la sorra poden ser molt més calents: aquí es mesura l'aire."],
      coldest: ["La temperatura de l'aire a l'ombra, a 1,5 o 2 metres de terra. Els llocs més freds de la Terra, a l'altiplà de l'Antàrtida oriental, no tenen cap estació que n'informi cada hora: el més fred que surt aquí és el més fred que es mesura."],
      gust: ['El cop de vent més fort dels últims 10 minuts, de pocs segons. El vent sostingut, el que dona una previsió, n\'és la mitjana i és força més baix.'],
      lowPressure: ["El pes de l'aire que hi ha a sobre, reduït al nivell del mar perquè es pugui comparar entre llocs. La mitjana és de 1.013 hPa: com més baixa, més profunda és la borrasca i més fort bufa el vent al seu voltant."],
    },
    zones: [
      'El cos encara es refreda suant.',
      "Costa refredar-se: compte amb la gent gran i amb l'esforç.",
      "Perill per a tothom, fins i tot a l'ombra i amb aigua.",
      'Límit de supervivència: suar ja no refreda.',
    ],
    zonesNow: 'Ara som aquí.',
    zonesSource: '{a}: Vecellio et al. (2022), persones joves i sanes. {b}: Sherwood i Huber (2010). Amb calor seca o en gent gran, el perill comença abans.',
    why: {
      wetBulbHour: {
        morning: { lead: 'Són les {time}, hora solar.', text: 'Encara escalfarà més fins a mitja tarda.' },
        afternoon: { lead: 'Són les {time}, hora solar.', text: 'La calor del dia és al màxim.' },
        night: { lead: 'Són les {time}, hora solar.', text: "És de nit, però amb tanta humitat l'aire gairebé no es refreda." },
      },
      wetBulbDew: { lead: "L'aire porta molta aigua.", text: "Amb {td} de punt de rosada, la suor gairebé no s'evapora." },
      polarDay: { lead: 'Fa sol tot el dia, i tot i així fa fred.', text: "És a {elev} m d'altitud, sobre neu que reflecteix gairebé tota la llum, i el sol hi és molt baix." },
      high: { lead: 'Altitud.', text: "És a {elev} m: l'aire es refreda uns 6,5\u00a0°C per cada 1.000 m que puja." },
      continental: { lead: 'Lluny del mar.', text: "A l'interior dels continents, la terra perd la calor de pressa, sobretot de nit i a l'hivern. El mar, que la guarda, queda lluny." },
      circumpolar: { lead: "El cinturó de borrasques de l'Antàrtida.", text: "Al voltant de l'Antàrtida hi ha la franja de pressions més baixes del planeta: {p} hi és força habitual." },
      gustCyclone: { lead: "Prop d'un cicló.", text: "És a {d} km de l'ull {ofCyclone}." },
      gustStorm: { lead: 'Tempesta o borrasca.', text: 'Ratxes així vénen de les tempestes o de les borrasques fortes.' },
    },
    warming: {
      wetBulb: { badge: 'Cada cop més freqüent', text: "Els episodis de calor humida extrema s'han més que doblat des del 1979. Un sol dia no diu res del clima: el canvi es veu en quantes vegades passa.", source: 'IPCC AR6 · Raymond et al. 2020' },
      hottest: { badge: 'Cada cop més freqüent', text: "Les onades de calor són més freqüents i més intenses que fa 50 anys, i l'IPCC ho dona per pràcticament segur. Un sol dia calorós, però, no és cap prova: el canvi es veu en la tendència.", source: 'IPCC AR6' },
      coldest: { badge: 'Al revés', text: "Amb l'escalfament, el fred extrem és cada cop més rar. Un rècord de fred no el desmenteix: el clima és la tendència, no un dia.", source: 'IPCC AR6' },
      gust: { badge: 'No es pot dir', text: 'No hi ha prou dades per saber si les ratxes extremes augmenten. Les tempestes fortes, en canvi, sí que deixen més pluja.', source: 'IPCC AR6' },
      lowPressure: { badge: 'No es pot dir', text: 'Encara no se sap si les borrasques seran més profundes: els estudis no coincideixen. El que sí que és clar és que, amb el mar més alt, els temporals arriben més lluny terra endins.', source: 'IPCC AR6' },
    },
  },
  es: {
    podium: { wetBulb: 'Los tres más altos', hottest: 'Los tres más calurosos', coldest: 'Los tres más fríos', gust: 'Las tres más fuertes', lowPressure: 'Las tres más bajas' },
    tie: 'empate técnico',
    tieExplain: 'Empate técnico. Las estaciones dan grados enteros, y eso ya supone un margen de ±{m} en cada valor, más que la diferencia entre los primeros.',
    measured: 'Medida de las {time} UTC, hace {min} min',
    whatTitle: 'Qué es',
    whyTitle: 'Por qué aquí ahora',
    bodyTitle: 'Cómo lo vive el cuerpo',
    what: {
      wetBulb: [
        'El cuerpo se enfría sudando: el sudor se evapora y se lleva calor. La calor húmeda es la temperatura más baja a la que puede llegar una piel mojada, y se mide con un termómetro envuelto en un paño húmedo. Su nombre técnico es temperatura de bulbo húmedo.',
        'Por dentro estamos a 37\u00a0°C. Si la piel no puede bajar de 35\u00a0°C, el calor ya no sale. Por eso el número es más bajo que la temperatura del aire y, aun así, es el que cuenta para el cuerpo.',
      ],
      hottest: ['La temperatura del aire a la sombra, a 1,5 o 2 metros del suelo, como la miden las estaciones de los aeropuertos. A pleno sol, el asfalto o la arena pueden estar mucho más calientes: aquí se mide el aire.'],
      coldest: ['La temperatura del aire a la sombra, a 1,5 o 2 metros del suelo. Los lugares más fríos de la Tierra, en la meseta de la Antártida oriental, no tienen ninguna estación que informe cada hora: lo más frío que sale aquí es lo más frío que se mide.'],
      gust: ['El golpe de viento más fuerte de los últimos 10 minutos, de pocos segundos. El viento sostenido, el que da una previsión, es su media y es bastante más bajo.'],
      lowPressure: ['El peso del aire que hay encima, reducido al nivel del mar para poder compararlo entre lugares. La media es de 1.013 hPa: cuanto más baja, más profunda es la borrasca y más fuerte sopla el viento a su alrededor.'],
    },
    zones: [
      'El cuerpo aún se enfría sudando.',
      'Cuesta enfriarse: cuidado con la gente mayor y con el esfuerzo.',
      'Peligro para todo el mundo, incluso a la sombra y con agua.',
      'Límite de supervivencia: sudar ya no enfría.',
    ],
    zonesNow: 'Ahora estamos aquí.',
    zonesSource: '{a}: Vecellio et al. (2022), personas jóvenes y sanas. {b}: Sherwood y Huber (2010). Con calor seco o en gente mayor, el peligro empieza antes.',
    why: {
      wetBulbHour: {
        morning: { lead: 'Son las {time}, hora solar.', text: 'Aún calentará más hasta media tarde.' },
        afternoon: { lead: 'Son las {time}, hora solar.', text: 'El calor del día está en su máximo.' },
        night: { lead: 'Son las {time}, hora solar.', text: 'Es de noche, pero con tanta humedad el aire casi no se enfría.' },
      },
      wetBulbDew: { lead: 'El aire lleva mucha agua.', text: 'Con {td} de punto de rocío, el sudor casi no se evapora.' },
      polarDay: { lead: 'Hace sol todo el día, y aun así hace frío.', text: 'Está a {elev} m de altitud, sobre nieve que refleja casi toda la luz, y el sol está muy bajo.' },
      high: { lead: 'Altitud.', text: 'Está a {elev} m: el aire se enfría unos 6,5\u00a0°C por cada 1.000 m que sube.' },
      continental: { lead: 'Lejos del mar.', text: 'En el interior de los continentes, la tierra pierde el calor deprisa, sobre todo de noche y en invierno. El mar, que lo guarda, queda lejos.' },
      circumpolar: { lead: 'El cinturón de borrascas de la Antártida.', text: 'Alrededor de la Antártida está la franja de presiones más bajas del planeta: {p} es bastante habitual allí.' },
      gustCyclone: { lead: 'Cerca de un ciclón.', text: 'Está a {d} km del ojo {ofCyclone}.' },
      gustStorm: { lead: 'Tormenta o borrasca.', text: 'Rachas así vienen de las tormentas o de las borrascas fuertes.' },
    },
    warming: {
      wetBulb: { badge: 'Cada vez más frecuente', text: 'Los episodios de calor húmeda extrema se han más que duplicado desde 1979. Un solo día no dice nada del clima: el cambio se ve en cuántas veces pasa.', source: 'IPCC AR6 · Raymond et al. 2020' },
      hottest: { badge: 'Cada vez más frecuente', text: 'Las olas de calor son más frecuentes e intensas que hace 50 años, y el IPCC lo da por prácticamente seguro. Un solo día caluroso, sin embargo, no es ninguna prueba: el cambio se ve en la tendencia.', source: 'IPCC AR6' },
      coldest: { badge: 'Al revés', text: 'Con el calentamiento, el frío extremo es cada vez más raro. Un récord de frío no lo desmiente: el clima es la tendencia, no un día.', source: 'IPCC AR6' },
      gust: { badge: 'No se puede decir', text: 'No hay datos suficientes para saber si las rachas extremas aumentan. Las tormentas fuertes, en cambio, sí dejan más lluvia.', source: 'IPCC AR6' },
      lowPressure: { badge: 'No se puede decir', text: 'Aún no se sabe si las borrascas serán más profundas: los estudios no coinciden. Lo que sí está claro es que, con el mar más alto, los temporales llegan más lejos tierra adentro.', source: 'IPCC AR6' },
    },
  },
  en: {
    podium: { wetBulb: 'Three highest', hottest: 'Three hottest', coldest: 'Three coldest', gust: 'Three strongest', lowPressure: 'Three lowest' },
    tie: 'statistical tie',
    tieExplain: 'Statistical tie. Stations report whole degrees, which already means a ±{m} margin on each value, more than the gap between the leaders.',
    measured: 'Measured at {time} UTC, {min} min ago',
    whatTitle: 'What it is',
    whyTitle: 'Why here, why now',
    bodyTitle: 'What it means for the body',
    what: {
      wetBulb: [
        'The body cools down by sweating: sweat evaporates and carries heat away. The wet-bulb temperature is the lowest temperature wet skin can reach, measured with a thermometer wrapped in a damp cloth.',
        'Inside, we are at 37\u00a0°C. If the skin cannot get below 35\u00a0°C, the heat no longer escapes. That is why the number is lower than the air temperature and still the one that matters for the body.',
      ],
      hottest: ['The air temperature in the shade, 1.5 to 2 metres above the ground, as airport weather stations measure it. In full sun, asphalt or sand can be much hotter: this is the air.'],
      coldest: ['The air temperature in the shade, 1.5 to 2 metres above the ground. The coldest places on Earth, on the East Antarctic plateau, have no station reporting every hour: the coldest shown here is the coldest that is measured.'],
      gust: ['The strongest burst of wind in the last 10 minutes, lasting a few seconds. The sustained wind, the one in a forecast, is its average and quite a bit lower.'],
      lowPressure: ['The weight of the air above, reduced to sea level so places can be compared. The average is 1,013 hPa: the lower it is, the deeper the low and the stronger the wind around it.'],
    },
    zones: [
      'The body can still cool itself by sweating.',
      'Cooling down gets hard: take care with older people and with exertion.',
      'Dangerous for everyone, even in the shade with water.',
      'Survival limit: sweating no longer cools.',
    ],
    zonesNow: 'We are here now.',
    zonesSource: '{a}: Vecellio et al. (2022), young healthy people. {b}: Sherwood and Huber (2010). In dry heat or for older people, danger starts sooner.',
    why: {
      wetBulbHour: {
        morning: { lead: 'It is {time}, solar time.', text: 'It will keep warming until mid-afternoon.' },
        afternoon: { lead: 'It is {time}, solar time.', text: 'The heat of the day is at its peak.' },
        night: { lead: 'It is {time}, solar time.', text: 'It is night, but with so much moisture the air hardly cools.' },
      },
      wetBulbDew: { lead: 'The air holds a lot of water.', text: 'With a {td} dew point, sweat barely evaporates.' },
      polarDay: { lead: 'Sun all day, and still cold.', text: 'It sits at {elev} m, on snow that reflects almost all the light, and the sun stays very low.' },
      high: { lead: 'Altitude.', text: 'It is at {elev} m: air cools by about 6.5\u00a0°C for every 1,000 m it rises.' },
      continental: { lead: 'Far from the sea.', text: 'Deep inside continents, the ground loses heat quickly, especially at night and in winter. The sea, which stores heat, is far away.' },
      circumpolar: { lead: "Antarctica's belt of lows.", text: 'The band of lowest pressure on the planet circles Antarctica: {p} is quite common there.' },
      gustCyclone: { lead: 'Near a cyclone.', text: '{d} km from the eye {ofCyclone}.' },
      gustStorm: { lead: 'Storm or deep low.', text: 'Gusts like this come from thunderstorms or strong lows.' },
    },
    warming: {
      wetBulb: { badge: 'More frequent', text: 'Episodes of extreme humid heat have more than doubled since 1979. A single day says nothing about the climate: the change shows in how often it happens.', source: 'IPCC AR6 · Raymond et al. 2020' },
      hottest: { badge: 'More frequent', text: 'Heatwaves are more frequent and more intense than 50 years ago, which the IPCC considers virtually certain. A single hot day, though, proves nothing: the change shows in the trend.', source: 'IPCC AR6' },
      coldest: { badge: 'The opposite', text: 'With warming, extreme cold is becoming rarer. A cold record does not disprove it: climate is the trend, not one day.', source: 'IPCC AR6' },
      gust: { badge: 'Not known', text: 'There is not enough data to tell whether extreme gusts are increasing. Strong storms, however, do bring more rain.', source: 'IPCC AR6' },
      lowPressure: { badge: 'Not known', text: 'It is not yet known whether lows will get deeper: studies disagree. What is clear is that, with higher seas, storms reach further inland.', source: 'IPCC AR6' },
    },
  },
  fr: {
    podium: { wetBulb: 'Les trois plus élevées', hottest: 'Les trois plus chauds', coldest: 'Les trois plus froids', gust: 'Les trois plus fortes', lowPressure: 'Les trois plus basses' },
    tie: 'égalité technique',
    tieExplain: 'Égalité technique. Les stations donnent des degrés entiers, ce qui fait déjà une marge de ±{m} sur chaque valeur, plus que l’écart entre les premiers.',
    measured: 'Mesure de {time} UTC, il y a {min} min',
    whatTitle: "Qu'est-ce que c'est",
    whyTitle: 'Pourquoi ici, maintenant',
    bodyTitle: 'Ce que vit le corps',
    what: {
      wetBulb: [
        "Le corps se refroidit en transpirant : la sueur s'évapore et emporte de la chaleur. La chaleur humide est la température la plus basse que peut atteindre une peau mouillée ; on la mesure avec un thermomètre enveloppé d'un linge humide. Son nom technique est température du thermomètre mouillé.",
        "À l'intérieur, nous sommes à 37\u00a0°C. Si la peau ne peut pas descendre sous 35\u00a0°C, la chaleur ne sort plus. C'est pourquoi ce chiffre est plus bas que la température de l'air et, pourtant, c'est celui qui compte pour le corps.",
      ],
      hottest: ["La température de l'air à l'ombre, à 1,5 ou 2 mètres du sol, telle que la mesurent les stations des aéroports. En plein soleil, l'asphalte ou le sable peuvent être bien plus chauds : ici, on mesure l'air."],
      coldest: ["La température de l'air à l'ombre, à 1,5 ou 2 mètres du sol. Les endroits les plus froids de la Terre, sur le plateau de l'Antarctique de l'Est, n'ont aucune station qui transmette chaque heure : le plus froid affiché ici est le plus froid mesuré."],
      gust: ["Le coup de vent le plus fort des 10 dernières minutes, de quelques secondes. Le vent moyen, celui d'une prévision, en est la moyenne et il est bien plus faible."],
      lowPressure: ["Le poids de l'air au-dessus, ramené au niveau de la mer pour comparer les lieux. La moyenne est de 1 013 hPa : plus elle est basse, plus la dépression est creuse et plus le vent souffle fort autour."],
    },
    zones: [
      'Le corps se refroidit encore en transpirant.',
      'Se refroidir devient difficile : attention aux personnes âgées et à l’effort.',
      'Danger pour tous, même à l’ombre et avec de l’eau.',
      'Limite de survie : transpirer ne refroidit plus.',
    ],
    zonesNow: 'Nous sommes ici.',
    zonesSource: '{a} : Vecellio et al. (2022), personnes jeunes et en bonne santé. {b} : Sherwood et Huber (2010). Par chaleur sèche ou chez les personnes âgées, le danger commence plus tôt.',
    why: {
      wetBulbHour: {
        morning: { lead: 'Il est {time}, heure solaire.', text: 'Il fera encore plus chaud jusqu’au milieu de l’après-midi.' },
        afternoon: { lead: 'Il est {time}, heure solaire.', text: 'La chaleur du jour est à son maximum.' },
        night: { lead: 'Il est {time}, heure solaire.', text: 'Il fait nuit, mais avec tant d’humidité l’air ne se refroidit presque pas.' },
      },
      wetBulbDew: { lead: "L'air est chargé d'eau.", text: "Avec un point de rosée de {td}, la sueur ne s'évapore presque pas." },
      polarDay: { lead: 'Du soleil toute la journée, et pourtant il fait froid.', text: "La station est à {elev} m d'altitude, sur une neige qui renvoie presque toute la lumière, et le soleil reste très bas." },
      high: { lead: 'Altitude.', text: "La station est à {elev} m : l'air se refroidit d'environ 6,5\u00a0°C tous les 1 000 m." },
      continental: { lead: 'Loin de la mer.', text: "À l'intérieur des continents, le sol perd vite sa chaleur, surtout la nuit et en hiver. La mer, qui la garde, est loin." },
      circumpolar: { lead: "La ceinture de dépressions de l'Antarctique.", text: "Autour de l'Antarctique se trouve la bande des pressions les plus basses de la planète : {p} y est assez courant." },
      gustCyclone: { lead: "Près d'un cyclone.", text: 'La station est à {d} km de l’œil {ofCyclone}.' },
      gustStorm: { lead: 'Orage ou dépression.', text: 'Des rafales pareilles viennent des orages ou des dépressions fortes.' },
    },
    warming: {
      wetBulb: { badge: 'De plus en plus fréquent', text: 'Les épisodes de chaleur humide extrême ont plus que doublé depuis 1979. Un seul jour ne dit rien du climat : le changement se voit dans leur fréquence.', source: 'GIEC AR6 · Raymond et al. 2020' },
      hottest: { badge: 'De plus en plus fréquent', text: "Les vagues de chaleur sont plus fréquentes et plus intenses qu'il y a 50 ans, ce que le GIEC juge pratiquement certain. Une seule journée chaude n'est pourtant pas une preuve : le changement se voit dans la tendance.", source: 'GIEC AR6' },
      coldest: { badge: "À l'inverse", text: "Avec le réchauffement, le froid extrême devient de plus en plus rare. Un record de froid ne le dément pas : le climat, c'est la tendance, pas un jour.", source: 'GIEC AR6' },
      gust: { badge: 'On ne peut pas le dire', text: 'Les données ne suffisent pas pour savoir si les rafales extrêmes augmentent. Les orages violents, eux, apportent davantage de pluie.', source: 'GIEC AR6' },
      lowPressure: { badge: 'On ne peut pas le dire', text: "On ne sait pas encore si les dépressions seront plus creuses : les études divergent. Ce qui est clair, c'est qu'avec une mer plus haute, les tempêtes vont plus loin à l'intérieur des terres.", source: 'GIEC AR6' },
    },
  },
};
