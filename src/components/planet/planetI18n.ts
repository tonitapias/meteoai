// src/components/planet/planetI18n.ts
// Textos de la secció «Extrems del planeta» (targeta i detall), en un fitxer propi perquè només es
// carreguin amb la Vista completa. {x} es substitueix amb fill().
import type { Language } from '../../translations';
import type { CycloneBasin, CycloneKind } from '../../utils/planetExtremes';

export interface PlanetStrings {
  eyebrow: string;
  title: string;
  now: string;
  wetBulbTop: string;
  tempDew: string;
  danger: string;
  limit: string;
  marginBelow: string;
  marginAbove: string;
  marginLimit: string;
  hottest: string;
  coldest: string;
  gust: string;
  lowPressure: string;
  activeNow: string;
  cyclonesOne: string;
  cyclonesMany: string;
  firesOne: string;
  firesMany: string;
  floodsOne: string;
  floodsMany: string;
  volcanoesOne: string;
  volcanoesMany: string;
  stations: string;
  sources: string;
  detail: string;
  loading: string;
  unavailable: string;
  tabRecords: string;
  tabEvents: string;
  tabsLabel: string;
  close: string;
  wetBulb: string;
  top3: string;
  wetBulbExplain: string;
  whyHere: string;
  whyHottestLead: string;
  // Segons l'hora solar del lloc més calent (vegeu solarPeriod).
  whyHottest: Record<'morning' | 'afternoon' | 'night', string>;
  whyPolarLead: string;
  whyPolar: string;
  whyLowCycloneLead: string;
  whyLowCyclone: string;
  whyLowDeepLead: string;
  whyLowDeep: string;
  whyGustLead: string;
  whyGust: string;
  qcLead: string;
  qc: string;
  sourceMetar: string;
  cyclonesTitle: string;
  firesTitle: string;
  floodsTitle: string;
  volcanoesTitle: string;
  noCyclones: string;
  noFires: string;
  noFloods: string;
  others: string;
  largestFire: string;
  andMore: string;
  dataAge: string;
  sourceEvents: string;
  back: string;
  category: string;
  windNow: string;
  gain24: string;
  speed: string;
  stationary: string;
  motionDirs: [string, string, string, string, string, string, string, string];
  intensity: string;
  peak: string;
  nowShort: string;
  why: string;
  physics: string;
  rapid: string;
  tenMinute: string;
  official: string;
  distance: string;
  sourceCyclone: string;
  kinds: Record<CycloneKind, string>;
  // Amb la preposició i l'article que toquen ("de l'huracà", "del tifó", "de la tempesta tropical").
  ofKinds: Record<CycloneKind, string>;
  basins: Record<CycloneBasin, string>;
}

export const PLANET_STRINGS: Record<Language, PlanetStrings> = {
  ca: {
    eyebrow: 'Més enllà del teu cel',
    title: 'Extrems del planeta',
    now: 'Ara',
    wetBulbTop: 'Bulb humit més alt del món',
    tempDew: '{t} de temperatura i {td} de punt de rosada',
    danger: 'perill',
    limit: 'límit',
    marginBelow: 'Avui el planeta és a {d} del llindar de perill per al cos humà.',
    marginAbove: 'Avui el planeta ha passat el llindar de perill per al cos humà.',
    marginLimit: 'Avui el planeta ha arribat al límit teòric de supervivència.',
    hottest: 'Més calent',
    coldest: 'Més fred',
    gust: 'Ratxa',
    lowPressure: 'Pressió mín.',
    activeNow: 'Actius ara al món',
    cyclonesOne: '1 cicló',
    cyclonesMany: '{n} ciclons',
    firesOne: '1 incendi gran',
    firesMany: '{n} incendis grans',
    floodsOne: '1 inundació',
    floodsMany: '{n} inundacions',
    volcanoesOne: '1 volcà',
    volcanoesMany: '{n} volcans',
    stations: '{n} estacions',
    sources: 'METAR · GDACS · NASA EONET',
    detail: 'Detall',
    loading: 'Carregant els extrems del planeta…',
    unavailable: 'Ara no es poden carregar les dades del planeta.',
    tabRecords: "Rècords d'ara",
    tabEvents: 'Fenòmens actius',
    tabsLabel: 'Què vols veure',
    close: 'Tanca',
    wetBulb: 'Bulb humit',
    top3: 'Els 3 més alts',
    wetBulbExplain: "Combina calor i humitat. A partir de {danger}, fins i tot una persona sana, a l'ombra i amb aigua, ja no es pot refredar suant.",
    whyHere: 'Per què aquí?',
    whyHottestLead: 'El més calent segueix el sol.',
    whyHottest: {
      morning: 'A {place} només són les {time}, hora solar, i encara hi escalfarà més fins a mitja tarda.',
      afternoon: 'A {place} són les {time}, hora solar: la calor màxima arriba a mitja tarda, quan el terra ja ha acumulat el sol de tot el dia.',
      night: "A {place} són les {time}, hora solar: és de nit, però l'aire encara conserva la calor del dia.",
    },
    whyPolarLead: 'Nit polar.',
    whyPolar: 'A {place} el sol ja no surt: sense cap aportació de calor, la superfície es refreda dia i nit.',
    whyLowCycloneLead: "La pressió més baixa de debò és a l'ull {ofCyclone},",
    whyLowCyclone: 'on no hi ha cap estació. Les estacions només en veuen {p}, a {place}.',
    whyLowDeepLead: '{p} a {place}:',
    whyLowDeep: "és el centre d'una borrasca profunda.",
    whyGustLead: 'La ratxa de {v} és en un cim de {elev} m,',
    whyGust: "no en un aeroport: allà dalt el vent s'accelera.",
    qcLead: 'Control de qualitat:',
    qc: "{n} estacions de les últimes 3 hores · {d} descartades (coordenades o valors impossibles, o massa diferents dels veïns) · la pressió, només per sota de 500 m. Són estacions meteorològiques i d'aeroport: el punt més extrem de la Terra pot no tenir-ne cap.",
    sourceMetar: 'Font: METAR (NOAA Aviation Weather Center).',
    cyclonesTitle: 'Ciclons tropicals',
    firesTitle: 'Incendis grans',
    floodsTitle: 'Inundacions',
    volcanoesTitle: 'Volcans',
    noCyclones: 'Ara mateix no hi ha cap cicló tropical actiu.',
    noFires: 'Cap incendi gran actiu.',
    noFloods: 'Cap inundació activa.',
    others: 'Altres',
    largestFire: 'El més extens: {ha} ha a {place}.',
    andMore: '{list} i {n} més',
    dataAge: 'dada de fa {h} h',
    sourceEvents: 'Fonts: GDACS (Comissió Europea i Nacions Unides) i NASA EONET.',
    back: 'Fenòmens actius',
    category: 'Categoria {n}',
    windNow: "vent sostingut d'1 minut",
    gain24: 'en 24 h, des del {date}',
    speed: 'avança {dir}',
    stationary: 'gairebé aturat',
    motionDirs: ['cap al nord', 'cap al nord-est', "cap a l'est", 'cap al sud-est', 'cap al sud', 'cap al sud-oest', "cap a l'oest", 'cap al nord-oest'],
    intensity: 'Intensitat',
    peak: 'pic',
    nowShort: 'ara',
    why: 'Per què passa',
    physics: "Un cicló tropical és un motor tèrmic: treu calor de l'oceà tropical i la torna en vent.",
    rapid: "{name} va guanyar {gain} en 24 hores: per parlar d'intensificació ràpida, n'hi ha prou amb {threshold}.",
    tenMinute: "El centre oficial d'aquesta zona ({centre}) dona el vent mitjà de 10 minuts i, per tant, xifres més baixes. No és cap contradicció.",
    official: 'Avís oficial ({centre})',
    distance: 'A {d} km de {place}.',
    sourceCyclone: '{source} via NASA EONET · dada de les {time} UTC',
    kinds: { hurricane: 'Huracà', typhoon: 'Tifó', cyclone: 'Cicló', storm: 'Tempesta tropical', depression: 'Depressió tropical', medicane: 'Medicà' },
    ofKinds: { hurricane: "de l'huracà", typhoon: 'del tifó', cyclone: 'del cicló', storm: 'de la tempesta tropical', depression: 'de la depressió tropical', medicane: 'del medicà' },
    basins: {
      atlantic: 'Atlàntic nord', eastPacific: 'Pacífic oriental', centralPacific: 'Pacífic central', westPacific: 'Pacífic nord-oest',
      northIndian: 'Índic nord', southIndian: 'Índic sud', australian: 'Regió australiana', southPacific: 'Pacífic sud',
      southAtlantic: 'Atlàntic sud', mediterranean: 'Mediterrani',
    },
  },
  es: {
    eyebrow: 'Más allá de tu cielo',
    title: 'Extremos del planeta',
    now: 'Ahora',
    wetBulbTop: 'Bulbo húmedo más alto del mundo',
    tempDew: '{t} de temperatura y {td} de punto de rocío',
    danger: 'peligro',
    limit: 'límite',
    marginBelow: 'Hoy el planeta está a {d} del umbral de peligro para el cuerpo humano.',
    marginAbove: 'Hoy el planeta ha superado el umbral de peligro para el cuerpo humano.',
    marginLimit: 'Hoy el planeta ha llegado al límite teórico de supervivencia.',
    hottest: 'Más calor',
    coldest: 'Más frío',
    gust: 'Racha',
    lowPressure: 'Presión mín.',
    activeNow: 'Activos ahora en el mundo',
    cyclonesOne: '1 ciclón',
    cyclonesMany: '{n} ciclones',
    firesOne: '1 incendio grande',
    firesMany: '{n} incendios grandes',
    floodsOne: '1 inundación',
    floodsMany: '{n} inundaciones',
    volcanoesOne: '1 volcán',
    volcanoesMany: '{n} volcanes',
    stations: '{n} estaciones',
    sources: 'METAR · GDACS · NASA EONET',
    detail: 'Detalle',
    loading: 'Cargando los extremos del planeta…',
    unavailable: 'Ahora no se pueden cargar los datos del planeta.',
    tabRecords: 'Récords de ahora',
    tabEvents: 'Fenómenos activos',
    tabsLabel: 'Qué quieres ver',
    close: 'Cerrar',
    wetBulb: 'Bulbo húmedo',
    top3: 'Los 3 más altos',
    wetBulbExplain: 'Combina calor y humedad. A partir de {danger}, incluso una persona sana, a la sombra y con agua, ya no puede refrescarse sudando.',
    whyHere: '¿Por qué aquí?',
    whyHottestLead: 'El calor sigue al sol.',
    whyHottest: {
      morning: 'En {place} solo son las {time}, hora solar, y aún se calentará más hasta media tarde.',
      afternoon: 'En {place} son las {time}, hora solar: el calor máximo llega a media tarde, cuando el suelo ya ha acumulado el sol de todo el día.',
      night: 'En {place} son las {time}, hora solar: es de noche, pero el aire aún conserva el calor del día.',
    },
    whyPolarLead: 'Noche polar.',
    whyPolar: 'En {place} el sol ya no sale: sin ningún aporte de calor, la superficie se enfría día y noche.',
    whyLowCycloneLead: 'La presión más baja de verdad está en el ojo {ofCyclone},',
    whyLowCyclone: 'donde no hay ninguna estación. Las estaciones solo ven {p}, en {place}.',
    whyLowDeepLead: '{p} en {place}:',
    whyLowDeep: 'es el centro de una borrasca profunda.',
    whyGustLead: 'La racha de {v} está en una cumbre de {elev} m,',
    whyGust: 'no en un aeropuerto: allí arriba el viento se acelera.',
    qcLead: 'Control de calidad:',
    qc: '{n} estaciones de las últimas 3 horas · {d} descartadas (coordenadas o valores imposibles, o demasiado distintos de los vecinos) · la presión, solo por debajo de 500 m. Son estaciones meteorológicas y de aeropuerto: el punto más extremo de la Tierra puede no tener ninguna.',
    sourceMetar: 'Fuente: METAR (NOAA Aviation Weather Center).',
    cyclonesTitle: 'Ciclones tropicales',
    firesTitle: 'Incendios grandes',
    floodsTitle: 'Inundaciones',
    volcanoesTitle: 'Volcanes',
    noCyclones: 'Ahora mismo no hay ningún ciclón tropical activo.',
    noFires: 'Ningún incendio grande activo.',
    noFloods: 'Ninguna inundación activa.',
    others: 'Otros',
    largestFire: 'El más extenso: {ha} ha en {place}.',
    andMore: '{list} y {n} más',
    dataAge: 'dato de hace {h} h',
    sourceEvents: 'Fuentes: GDACS (Comisión Europea y Naciones Unidas) y NASA EONET.',
    back: 'Fenómenos activos',
    category: 'Categoría {n}',
    windNow: 'viento sostenido de 1 minuto',
    gain24: 'en 24 h, desde el {date}',
    speed: 'avanza {dir}',
    stationary: 'casi parado',
    motionDirs: ['hacia el norte', 'hacia el noreste', 'hacia el este', 'hacia el sureste', 'hacia el sur', 'hacia el suroeste', 'hacia el oeste', 'hacia el noroeste'],
    intensity: 'Intensidad',
    peak: 'pico',
    nowShort: 'ahora',
    why: 'Por qué pasa',
    physics: 'Un ciclón tropical es un motor térmico: saca calor del océano tropical y lo convierte en viento.',
    rapid: '{name} ganó {gain} en 24 horas: para hablar de intensificación rápida, basta con {threshold}.',
    tenMinute: 'El centro oficial de esta zona ({centre}) da el viento medio de 10 minutos y, por tanto, cifras más bajas. No es ninguna contradicción.',
    official: 'Aviso oficial ({centre})',
    distance: 'A {d} km de {place}.',
    sourceCyclone: '{source} vía NASA EONET · dato de las {time} UTC',
    kinds: { hurricane: 'Huracán', typhoon: 'Tifón', cyclone: 'Ciclón', storm: 'Tormenta tropical', depression: 'Depresión tropical', medicane: 'Medicán' },
    ofKinds: { hurricane: 'del huracán', typhoon: 'del tifón', cyclone: 'del ciclón', storm: 'de la tormenta tropical', depression: 'de la depresión tropical', medicane: 'del medicán' },
    basins: {
      atlantic: 'Atlántico norte', eastPacific: 'Pacífico oriental', centralPacific: 'Pacífico central', westPacific: 'Pacífico noroeste',
      northIndian: 'Índico norte', southIndian: 'Índico sur', australian: 'Región australiana', southPacific: 'Pacífico sur',
      southAtlantic: 'Atlántico sur', mediterranean: 'Mediterráneo',
    },
  },
  en: {
    eyebrow: 'Beyond your sky',
    title: 'Planet extremes',
    now: 'Now',
    wetBulbTop: "World's highest wet-bulb temperature",
    tempDew: '{t} air temperature, {td} dew point',
    danger: 'danger',
    limit: 'limit',
    marginBelow: 'Today the planet is {d} below the danger threshold for the human body.',
    marginAbove: 'Today the planet has passed the danger threshold for the human body.',
    marginLimit: 'Today the planet has reached the theoretical survival limit.',
    hottest: 'Hottest',
    coldest: 'Coldest',
    gust: 'Gust',
    lowPressure: 'Lowest pressure',
    activeNow: 'Active around the world',
    cyclonesOne: '1 cyclone',
    cyclonesMany: '{n} cyclones',
    firesOne: '1 large wildfire',
    firesMany: '{n} large wildfires',
    floodsOne: '1 flood',
    floodsMany: '{n} floods',
    volcanoesOne: '1 volcano',
    volcanoesMany: '{n} volcanoes',
    stations: '{n} stations',
    sources: 'METAR · GDACS · NASA EONET',
    detail: 'Details',
    loading: 'Loading planet extremes…',
    unavailable: "The planet data can't be loaded right now.",
    tabRecords: 'Records now',
    tabEvents: 'Active events',
    tabsLabel: 'What do you want to see',
    close: 'Close',
    wetBulb: 'Wet bulb',
    top3: 'Top 3',
    wetBulbExplain: "It combines heat and humidity. From {danger} up, even a healthy person in the shade with water can no longer cool down by sweating.",
    whyHere: 'Why here?',
    whyHottestLead: 'The heat follows the sun.',
    whyHottest: {
      morning: "It's only {time} solar time in {place}, and it will keep warming until mid-afternoon.",
      afternoon: "It's {time} solar time in {place}: the peak heat comes in mid-afternoon, once the ground has soaked up a whole day of sun.",
      night: "It's {time} solar time in {place}: night has fallen, but the air still holds the day's heat.",
    },
    whyPolarLead: 'Polar night.',
    whyPolar: 'The sun no longer rises in {place}: with no heat coming in, the surface cools day and night.',
    whyLowCycloneLead: 'The truly lowest pressure is in the eye {ofCyclone},',
    whyLowCyclone: 'where there are no stations. The stations only see {p}, in {place}.',
    whyLowDeepLead: '{p} in {place}:',
    whyLowDeep: 'the centre of a deep low.',
    whyGustLead: 'The {v} gust is on a {elev} m summit,',
    whyGust: 'not at an airport: up there the wind speeds up.',
    qcLead: 'Quality control:',
    qc: '{n} stations from the last 3 hours · {d} discarded (impossible coordinates or values, or too far from their neighbours) · pressure only below 500 m. These are weather and airport stations: the most extreme spot on Earth may have none.',
    sourceMetar: 'Source: METAR (NOAA Aviation Weather Center).',
    cyclonesTitle: 'Tropical cyclones',
    firesTitle: 'Large wildfires',
    floodsTitle: 'Floods',
    volcanoesTitle: 'Volcanoes',
    noCyclones: 'There are no active tropical cyclones right now.',
    noFires: 'No large active wildfires.',
    noFloods: 'No active floods.',
    others: 'Others',
    largestFire: 'The largest: {ha} ha in {place}.',
    andMore: '{list} and {n} more',
    dataAge: 'data from {h} h ago',
    sourceEvents: 'Sources: GDACS (European Commission and United Nations) and NASA EONET.',
    back: 'Active events',
    category: 'Category {n}',
    windNow: '1-minute sustained wind',
    gain24: 'in 24 h, from {date}',
    speed: 'heading {dir}',
    stationary: 'almost stationary',
    motionDirs: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
    intensity: 'Intensity',
    peak: 'peak',
    nowShort: 'now',
    why: 'Why it happens',
    physics: 'A tropical cyclone is a heat engine: it draws heat from the tropical ocean and turns it into wind.',
    rapid: '{name} gained {gain} in 24 hours: {threshold} is already rapid intensification.',
    tenMinute: "This area's official centre ({centre}) gives 10-minute mean winds, so its figures are lower. It isn't a contradiction.",
    official: 'Official advisory ({centre})',
    distance: '{d} km from {place}.',
    sourceCyclone: '{source} via NASA EONET · data from {time} UTC',
    kinds: { hurricane: 'Hurricane', typhoon: 'Typhoon', cyclone: 'Cyclone', storm: 'Tropical storm', depression: 'Tropical depression', medicane: 'Medicane' },
    ofKinds: { hurricane: 'of Hurricane', typhoon: 'of Typhoon', cyclone: 'of Cyclone', storm: 'of Tropical Storm', depression: 'of Tropical Depression', medicane: 'of Medicane' },
    basins: {
      atlantic: 'North Atlantic', eastPacific: 'Eastern Pacific', centralPacific: 'Central Pacific', westPacific: 'Western Pacific',
      northIndian: 'North Indian Ocean', southIndian: 'South Indian Ocean', australian: 'Australian region', southPacific: 'South Pacific',
      southAtlantic: 'South Atlantic', mediterranean: 'Mediterranean',
    },
  },
  fr: {
    eyebrow: 'Au-delà de ton ciel',
    title: 'Extrêmes de la planète',
    now: 'Maintenant',
    wetBulbTop: 'Thermomètre mouillé le plus élevé du monde',
    tempDew: "{t} de température et {td} de point de rosée",
    danger: 'danger',
    limit: 'limite',
    marginBelow: 'Aujourd’hui la planète est à {d} du seuil de danger pour le corps humain.',
    marginAbove: 'Aujourd’hui la planète a dépassé le seuil de danger pour le corps humain.',
    marginLimit: 'Aujourd’hui la planète a atteint la limite théorique de survie.',
    hottest: 'Plus chaud',
    coldest: 'Plus froid',
    gust: 'Rafale',
    lowPressure: 'Pression min.',
    activeNow: 'Actifs en ce moment dans le monde',
    cyclonesOne: '1 cyclone',
    cyclonesMany: '{n} cyclones',
    firesOne: '1 grand incendie',
    firesMany: '{n} grands incendies',
    floodsOne: '1 inondation',
    floodsMany: '{n} inondations',
    volcanoesOne: '1 volcan',
    volcanoesMany: '{n} volcans',
    stations: '{n} stations',
    sources: 'METAR · GDACS · NASA EONET',
    detail: 'Détail',
    loading: 'Chargement des extrêmes de la planète…',
    unavailable: 'Les données de la planète ne peuvent pas être chargées pour le moment.',
    tabRecords: 'Records du moment',
    tabEvents: 'Phénomènes actifs',
    tabsLabel: 'Que veux-tu voir',
    close: 'Fermer',
    wetBulb: 'Thermomètre mouillé',
    top3: 'Les 3 plus élevés',
    wetBulbExplain: "Il combine chaleur et humidité. À partir de {danger}, même une personne en bonne santé, à l'ombre et avec de l'eau, ne peut plus se refroidir en transpirant.",
    whyHere: 'Pourquoi ici ?',
    whyHottestLead: 'La chaleur suit le soleil.',
    whyHottest: {
      morning: "À {place}, il n'est que {time}, heure solaire, et il fera encore plus chaud jusqu'au milieu de l'après-midi.",
      afternoon: "À {place}, il est {time}, heure solaire : la chaleur maximale arrive en milieu d'après-midi, quand le sol a accumulé le soleil de toute la journée.",
      night: "À {place}, il est {time}, heure solaire : il fait nuit, mais l'air garde encore la chaleur du jour.",
    },
    whyPolarLead: 'Nuit polaire.',
    whyPolar: 'À {place}, le soleil ne se lève plus : sans aucun apport de chaleur, la surface se refroidit jour et nuit.',
    whyLowCycloneLead: "La pression vraiment la plus basse est dans l'œil {ofCyclone},",
    whyLowCyclone: "où il n'y a aucune station. Les stations ne voient que {p}, à {place}.",
    whyLowDeepLead: '{p} à {place} :',
    whyLowDeep: "c'est le centre d'une dépression profonde.",
    whyGustLead: 'La rafale de {v} est sur un sommet de {elev} m,',
    whyGust: "pas dans un aéroport : là-haut, le vent s'accélère.",
    qcLead: 'Contrôle de qualité :',
    qc: "{n} stations des 3 dernières heures · {d} écartées (coordonnées ou valeurs impossibles, ou trop éloignées des voisines) · la pression, seulement en dessous de 500 m. Ce sont des stations météo et d'aéroport : le point le plus extrême de la Terre peut n'en avoir aucune.",
    sourceMetar: 'Source : METAR (NOAA Aviation Weather Center).',
    cyclonesTitle: 'Cyclones tropicaux',
    firesTitle: 'Grands incendies',
    floodsTitle: 'Inondations',
    volcanoesTitle: 'Volcans',
    noCyclones: "Il n'y a aucun cyclone tropical actif en ce moment.",
    noFires: 'Aucun grand incendie actif.',
    noFloods: 'Aucune inondation active.',
    others: 'Autres',
    largestFire: 'Le plus étendu : {ha} ha ({place}).',
    andMore: '{list} et {n} de plus',
    dataAge: 'donnée d’il y a {h} h',
    sourceEvents: 'Sources : GDACS (Commission européenne et Nations unies) et NASA EONET.',
    back: 'Phénomènes actifs',
    category: 'Catégorie {n}',
    windNow: 'vent soutenu sur 1 minute',
    gain24: 'en 24 h, depuis le {date}',
    speed: 'se déplace {dir}',
    stationary: 'presque immobile',
    motionDirs: ['vers le nord', 'vers le nord-est', "vers l'est", 'vers le sud-est', 'vers le sud', 'vers le sud-ouest', "vers l'ouest", 'vers le nord-ouest'],
    intensity: 'Intensité',
    peak: 'pic',
    nowShort: 'maint.',
    why: 'Pourquoi cela arrive',
    physics: "Un cyclone tropical est une machine thermique : il puise la chaleur de l'océan tropical et la transforme en vent.",
    rapid: '{name} a gagné {gain} en 24 heures : on parle d’intensification rapide dès {threshold}.',
    tenMinute: "Le centre officiel de cette zone ({centre}) donne le vent moyen sur 10 minutes, donc des chiffres plus bas. Ce n'est pas une contradiction.",
    official: 'Avis officiel ({centre})',
    distance: 'À {d} km de {place}.',
    sourceCyclone: '{source} via NASA EONET · donnée de {time} UTC',
    kinds: { hurricane: 'Ouragan', typhoon: 'Typhon', cyclone: 'Cyclone', storm: 'Tempête tropicale', depression: 'Dépression tropicale', medicane: 'Médicane' },
    ofKinds: { hurricane: "de l'ouragan", typhoon: 'du typhon', cyclone: 'du cyclone', storm: 'de la tempête tropicale', depression: 'de la dépression tropicale', medicane: 'du médicane' },
    basins: {
      atlantic: 'Atlantique nord', eastPacific: 'Pacifique est', centralPacific: 'Pacifique central', westPacific: 'Pacifique nord-ouest',
      northIndian: 'Océan Indien nord', southIndian: 'Océan Indien sud', australian: 'Région australienne', southPacific: 'Pacifique sud',
      southAtlantic: 'Atlantique sud', mediterranean: 'Méditerranée',
    },
  },
};

export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

export const plural = (n: number, one: string, many: string): string => fill(n === 1 ? one : many, { n });
