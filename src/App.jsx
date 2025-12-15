import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Wind, Droplets, MapPin, Sun, Cloud, CloudRain, 
  CloudLightning, Snowflake, CloudFog, CloudSun, CloudMoon, BrainCircuit, 
  Activity, AlertTriangle, X, Sunrise, Sunset, Umbrella, Eye,
  LocateFixed, Shirt, Leaf, Star, RefreshCw, Trash2, Navigation,
  ThermometerSun, Gauge, ArrowRight, AlertOctagon, TrendingUp, Calendar, Clock,
  Layers, ThermometerSnowflake, AlertCircle, CloudSnow, Moon, Compass, Globe, Flower2,
  LayoutTemplate, LayoutDashboard, GitGraph
} from 'lucide-react';

// --- SISTEMA DE TRADUCCIONS MILLORAT ---
const TRANSLATIONS = {
  ca: {
    searchPlaceholder: "Cerca ciutat...",
    favorites: "Llocs Preferits",
    now: "Ara",
    updatedNow: "Actualitzat ara",
    feelsLike: "Sensació",
    aiAnalysis: "Anàlisi Meteo IA",
    aiConfidence: "Consens Models",
    aiConfidenceMod: "Divergència Models",
    aiConfidenceLow: "Incertesa Alta",
    generatingTips: "Analitzant dades dels models (ECMWF, GFS, ICON)...",
    trend24h: "Tendència 24h",
    temp: "Temperatura",
    rain: "Pluja",
    wind: "Vent",
    cloud: "Cobertura",
    humidity: "Humitat",
    forecast7days: "Previsió 7 Dies",
    today: "Avui",
    detailedForecast: "Previsió detallada",
    hourlyEvolution: "Evolució Horària",
    snowAccumulated: "Neu Acumulada",
    totalPrecipitation: "Precipitació Total",
    rainProb: "Prob. Pluja",
    windMax: "Vent Màx",
    uvIndex: "Índex UV",
    tempMin: "Temp Mín",
    sunrise: "Sortida Sol",
    sunset: "Posta Sol",
    moon: "Lluna",
    pressure: "Pressió",
    aqi: "Qualitat Aire",
    index: "Index",
    moonPhase: "Fase Lunar",
    illumination: "Il·luminada",
    calc: "Calc",
    est: "Est.",
    sunRiseIn: "Surt en",
    sunSetIn: "Posta en",
    sunSetDone: "Ja s'ha post",
    localTime: "Hora local",
    day: "Dia",
    night: "Nit",
    sun: "Sol",
    clear: "Serè",
    cloudy: "Ennuvolat",
    snow: "Nevada",
    rainy: "Pluja",
    storm: "Tempesta",
    uvLow: "Baix",
    uvMod: "Moderat",
    uvHigh: "Alt",
    uvVeryHigh: "Molt Alt",
    uvExtreme: "Extrem",
    alertDanger: "ALERTA PERILL",
    alertWarning: "AVÍS PRECAUCIÓ",
    subtitle: "Previsió multi-model interpretada per Intel·ligència Artificial.",
    aqiLevels: ["Excel·lent", "Bona", "Acceptable", "Moderada", "Dolenta", "Molt Dolenta"],
    pollen: "Nivells de Pol·len",
    pollenTypes: {
      alder: "Vern",
      birch: "Bedoll",
      grass: "Gramínies",
      mugwort: "Artemísia",
      olive: "Olivera",
      ragweed: "Ambròsia"
    },
    modeBasic: "Bàsic",
    modeExpert: "Extens", 
    directions: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
    preciseRain: "Previsió Immediata (1h)",
    modelsLegend: "Comparativa Models",
    modelBest: "Consens",
    modelGfs: "GFS (EUA)",
    modelIcon: "ICON (Alemanya)",
    
    // AI Advanced Texts (Data-Driven - HUMANITZATS)
    aiIntroMorning: "Bon dia! Comencem la jornada amb els mapes actualitzats. ",
    aiIntroAfternoon: "Bona tarda. Mirem com evoluciona la situació. ",
    aiIntroEvening: "Bon vespre. Així es presenta el final del dia. ",
    aiIntroNight: "Bona nit. Previsió per a les pròximes hores nocturnes. ",
    
    aiSummaryClear: "Cel serè. Els models confirmen un dia radiant i perfecte per estar a l'aire lliure. ",
    aiSummaryCloudy: "El cel es mantindrà variable amb força núvols, tot i que no esperem complicacions. ",
    aiSummaryRain: "Paraigua a mà. Tenim una situació de precipitacions actives a la zona. ",
    aiSummaryStorm: "Precaució. La inestabilitat és acusada i hi ha risc de tempestes que poden ser intenses. ",
    aiSummarySnow: "Ambient plenament hivernal. Les condicions són de fred rigorós i neu. ",
    
    // Noves claus de temperatura més naturals
    aiTempFreezing: "Ambient gèlid. Abrigueu-vos molt bé si sortiu. ",
    aiTempCold: "Fa fred. Caldrà roba d'abric per estar confortable. ",
    aiTempMild: "Temperatures suaus i agradables, sense extrems. ",
    aiTempWarm: "Ambient càlid, es nota la pujada de temperatura. ",
    aiTempHot: "Calor intensa. Eviteu els esforços a les hores centrals. ",
    
    aiWindLight: "El vent està en calma, dia plàcid. ",
    aiWindMod: "El vent bufa amb ganes i accentua la sensació de fred. ",
    aiWindStrong: "Compte amb les ratxes de vent, que poden ser fortes avui. ",
    
    aiRainNone: "Podeu estar tranquils, no es veu pluja a l'horitzó immediat. ",
    aiRainExp: "Atenció al radar: s'acosta una taca de pluja imminentment. ",
    
    // WMO Codes Descriptions
    wmo: {
      0: "cel serè", 1: "cel majoritàriament serè", 2: "parcialment ennuvolat", 3: "cel cobert",
      45: "bancs de boira", 48: "boira gebradora",
      51: "plugim feble", 53: "plugim moderat", 55: "plugim persistent",
      56: "plugim gèlid", 57: "plugim gèlid intens",
      61: "pluja feble", 63: "pluja moderada", 65: "pluja forta",
      66: "pluja gelada", 67: "pluja gelada forta",
      71: "nevada feble", 73: "nevada moderada", 75: "nevada forta",
      77: "ruixats de neu",
      80: "ruixats", 81: "xàfecs moderats", 82: "aiguats violents",
      85: "ruixats de neu", 86: "ruixats de neu forts",
      95: "tempesta elèctrica", 96: "tempesta amb calamarsa", 99: "tempesta severa amb calamarsa"
    },

    alertStorm: "Risc elèctric elevat i pluges intenses.",
    alertSnow: "Precaució: Neu acumulada prevista.",
    alertWindExtreme: "Vent huracanat. Perill extrem a l'exterior.",
    alertWindHigh: "Ràfegues fortes. Compte objectes.",
    alertHeatExtreme: "Calor extrema. Evita el sol.",
    alertHeatHigh: "Temperatures altes. Hidrata't.",
    alertColdExtreme: "Fred sever. Risc congelació.",
    alertColdHigh: "Glaçades. Calçades relliscoses.",
    alertRain: "Precipitacions abundants.",
    alertAir: "Qualitat de l'aire deficient.",
    
    tipHydration: "Beu aigua",
    tipThermal: "Roba tèrmica",
    tipWindbreaker: "Tallavents",
    tipMugginess: "Roba fresca",
    tipUmbrella: "Agafa paraigua",
    tipSunscreen: "Crema solar",
    tipCalm: "Gaudeix del dia",
    tipCoat: "Abric gruixut",
    tipLayers: "Vesteix per capes",
    
    moonPhases: {
      new: "Lluna Nova",
      waxingCrescent: "Creixent",
      firstQuarter: "Quart Creixent",
      waxingGibbous: "Gibbosa Creixent",
      full: "Lluna Plena",
      waningGibbous: "Gibbosa Minvant",
      lastQuarter: "Quart Minvant",
      waningCrescent: "Minvant"
    }
  },
  es: {
    searchPlaceholder: "Buscar ciudad...",
    favorites: "Lugares Favoritos",
    now: "Ahora",
    updatedNow: "Actualizado ahora",
    feelsLike: "Sensación",
    aiAnalysis: "Análisis Meteo IA",
    aiConfidence: "Consenso Modelos",
    aiConfidenceMod: "Divergencia Modelos",
    aiConfidenceLow: "Incertidumbre Alta",
    generatingTips: "Analizando modelos meteorológicos (ECMWF, GFS, ICON)...",
    trend24h: "Tendencia 24h",
    temp: "Temperatura",
    rain: "Lluvia",
    wind: "Viento",
    cloud: "Cobertura",
    humidity: "Humedad",
    forecast7days: "Previsión 7 Días",
    today: "Hoy",
    detailedForecast: "Previsión detallada",
    hourlyEvolution: "Evolución Horaria",
    snowAccumulated: "Nieve Acumulada",
    totalPrecipitation: "Precipitación Total",
    rainProb: "Prob. Lluvia",
    windMax: "Viento Máx",
    uvIndex: "Índice UV",
    tempMin: "Temp Mín",
    sunrise: "Salida Sol",
    sunset: "Puesta Sol",
    moon: "Luna",
    pressure: "Presión",
    aqi: "Calidad Aire",
    index: "Índice",
    moonPhase: "Fase Lunar",
    illumination: "Iluminada",
    calc: "Calc",
    est: "Est.",
    sunRiseIn: "Sale en",
    sunSetIn: "Puesta en",
    sunSetDone: "Ya se puso",
    localTime: "Hora local",
    day: "Día",
    night: "Noche",
    sun: "Sol",
    clear: "Despejado",
    cloudy: "Nublado",
    snow: "Nevada",
    rainy: "Lluvia",
    storm: "Tormenta",
    uvLow: "Bajo",
    uvMod: "Moderado",
    uvHigh: "Alto",
    uvVeryHigh: "Muy Alto",
    uvExtreme: "Extremo",
    alertDanger: "ALERTA PELIGRO",
    alertWarning: "AVISO PRECAUCIÓN",
    subtitle: "Previsión multi-modelo interpretada por Inteligencia Artificial.",
    aqiLevels: ["Excelente", "Buena", "Aceptable", "Moderada", "Mala", "Muy Mala"],
    pollen: "Niveles de Polen",
    pollenTypes: {
      alder: "Aliso",
      birch: "Abedul",
      grass: "Gramíneas",
      mugwort: "Artemisa",
      olive: "Olivo",
      ragweed: "Ambrosía"
    },
    modeBasic: "Básico",
    modeExpert: "Extendido", 
    directions: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
    preciseRain: "Previsión Inmediata (1h)",
    modelsLegend: "Comparativa Modelos",
    modelBest: "Consenso",
    modelGfs: "GFS (EEUU)",
    modelIcon: "ICON (Alemania)",
    
    aiIntroMorning: "Buenos días. Empezamos la jornada con los mapas actualizados. ",
    aiIntroAfternoon: "Buenas tardes. Vemos cómo evoluciona la situación. ",
    aiIntroEvening: "Buenas noches. Así se presenta el final del día. ",
    aiIntroNight: "Buenas noches. Previsión para las próximas horas nocturnas. ",
    
    aiSummaryClear: "Cielo despejado. Los modelos confirman un día radiante, perfecto para estar al aire libre. ",
    aiSummaryCloudy: "Tendremos bastantes nubes, aunque por ahora no esperamos complicaciones. ",
    aiSummaryRain: "Paraguas a mano. Tenemos precipitaciones activas cruzando la zona. ",
    aiSummaryStorm: "Precaución. La inestabilidad es acusada y hay riesgo de tormentas fuertes. ",
    aiSummarySnow: "Paisaje invernal. Las condiciones son de frío riguroso y nieve. ",
    
    aiTempFreezing: "Ambiente gélido. Abrígate muy bien si sales. ",
    aiTempCold: "Hace frío. Necesitarás ropa de abrigo para estar confortable. ",
    aiTempMild: "Temperaturas suaves y agradables, sin extremos. ",
    aiTempWarm: "Ambiente cálido, se nota la subida de temperatura. ",
    aiTempHot: "Calor intenso. Evita los esfuerzos en las horas centrales. ",
    
    aiWindLight: "El viento está en calma, día plácido. ",
    aiWindMod: "El viento sopla con ganas y acentúa la sensación de frío. ",
    aiWindStrong: "Cuidado con las rachas de viento, que pueden ser fuertes hoy. ",
    
    aiRainNone: "Podéis estar tranquilos, no se ve lluvia en el horizonte inmediato. ",
    aiRainExp: "Atención al radar: se acerca una mancha de lluvia inminentemente. ",

    wmo: {
      0: "cielo despejado", 1: "cielo mayormente despejado", 2: "parcialmente nublado", 3: "cielo cubierto",
      45: "bancos de niebla", 48: "niebla helada",
      51: "llovizna ligera", 53: "llovizna moderada", 55: "llovizna persistente",
      56: "llovizna helada", 57: "llovizna helada intensa",
      61: "lluvia ligera", 63: "lluvia moderada", 65: "lluvia fuerte",
      66: "lluvia helada", 67: "lluvia helada fuerte",
      71: "nevada ligera", 73: "nevada moderada", 75: "nevada fuerte",
      77: "chubascos de nieve",
      80: "chubascos", 81: "chubascos moderados", 82: "aguaceros violentos",
      85: "chubascos de nieve", 86: "chubascos de nieve fuertes",
      95: "tormenta eléctrica", 96: "tormenta con granizo", 99: "tormenta severa con granizo"
    },
    
    alertStorm: "Riesgo eléctrico elevado y lluvias intensas.",
    alertSnow: "Precaución: Nieve acumulada prevista.",
    alertWindExtreme: "Viento huracanado. Peligro exterior.",
    alertWindHigh: "Ráfagas fuertes. Cuidado objetos.",
    alertHeatExtreme: "Calor extremo. Evita el sol.",
    alertHeatHigh: "Temperaturas altas. Hidrátate.",
    alertColdExtreme: "Frío severo. Riesgo congelación.",
    alertColdHigh: "Heladas. Calzadas resbaladizas.",
    alertRain: "Precipitaciones abundantes.",
    alertAir: "Calidad del aire deficiente.",
    tipHydration: "Bebe agua",
    tipThermal: "Ropa térmica",
    tipWindbreaker: "Cortavientos",
    tipMugginess: "Ropa fresca",
    tipUmbrella: "Coge paraguas",
    tipSunscreen: "Protector solar",
    tipCalm: "Disfruta",
    tipCoat: "Abrigo grueso",
    tipLayers: "Viste por capas",

    moonPhases: {
      new: "Luna Nueva",
      waxingCrescent: "Creciente",
      firstQuarter: "Cuarto Creciente",
      waxingGibbous: "Gibosa Creciente",
      full: "Luna Llena",
      waningGibbous: "Gibosa Menguante",
      lastQuarter: "Cuarto Menguante",
      waningCrescent: "Menguante"
    }
  },
  en: {
    searchPlaceholder: "Search city...",
    favorites: "Favorite Places",
    now: "Now",
    updatedNow: "Updated now",
    feelsLike: "Feels like",
    aiAnalysis: "AI Meteo Analysis",
    aiConfidence: "Model Consensus",
    aiConfidenceMod: "Model Divergence",
    aiConfidenceLow: "High Uncertainty",
    generatingTips: "Analyzing meteorological models (ECMWF, GFS, ICON)...",
    trend24h: "24h Trend",
    temp: "Temperature",
    rain: "Rain",
    wind: "Wind",
    cloud: "Cloud Cover",
    humidity: "Humidity",
    forecast7days: "7-Day Forecast",
    today: "Today",
    detailedForecast: "Detailed Forecast",
    hourlyEvolution: "Hourly Evolution",
    snowAccumulated: "Accumulated Snow",
    totalPrecipitation: "Total Precipitation",
    rainProb: "Rain Prob.",
    windMax: "Max Wind",
    uvIndex: "UV Index",
    tempMin: "Min Temp",
    sunrise: "Sunrise",
    sunset: "Sunset",
    moon: "Moon",
    pressure: "Pressure",
    aqi: "Air Quality",
    index: "Index",
    moonPhase: "Moon Phase",
    illumination: "Illuminated",
    calc: "Calc",
    est: "Est.",
    sunRiseIn: "Rise in",
    sunSetIn: "Set in",
    sunSetDone: "Set already",
    localTime: "Local time",
    day: "Day",
    night: "Night",
    sun: "Sun",
    clear: "Clear",
    cloudy: "Cloudy",
    snow: "Snow",
    rainy: "Rain",
    storm: "Storm",
    uvLow: "Low",
    uvMod: "Moderate",
    uvHigh: "High",
    uvVeryHigh: "Very High",
    uvExtreme: "Extreme",
    alertDanger: "DANGER ALERT",
    alertWarning: "WARNING NOTICE",
    subtitle: "Multi-model forecast interpreted by Artificial Intelligence.",
    aqiLevels: ["Excellent", "Good", "Fair", "Moderate", "Poor", "Very Poor"],
    pollen: "Pollen Levels",
    pollenTypes: {
      alder: "Alder",
      birch: "Birch",
      grass: "Grass",
      mugwort: "Mugwort",
      olive: "Olive",
      ragweed: "Ragweed"
    },
    modeBasic: "Basic",
    modeExpert: "Extended",
    directions: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
    preciseRain: "Minute-by-Minute Forecast (1h)",
    modelsLegend: "Model Comparison",
    modelBest: "Consensus",
    modelGfs: "GFS (USA)",
    modelIcon: "ICON (Germany)",
    
    aiIntroMorning: "Good morning. Starting the day with updated maps. ",
    aiIntroAfternoon: "Good afternoon. Checking the latest developments. ",
    aiIntroEvening: "Good evening. Here is the outlook for the end of the day. ",
    aiIntroNight: "Good night. Forecast for the coming night hours. ",
    
    aiSummaryClear: "Clear skies. Models confirm a radiant day, perfect for being outdoors. ",
    aiSummaryCloudy: "Skies will be variable with clouds, though no major issues are expected. ",
    aiSummaryRain: "Keep an umbrella handy. Active precipitation is passing through the area. ",
    aiSummaryStorm: "Caution. Instability is high and there is a risk of strong thunderstorms. ",
    aiSummarySnow: "Winter landscape. Conditions are set for rigorous cold and snow. ",
    
    aiTempFreezing: "Freezing conditions. Bundle up well if you go out. ",
    aiTempCold: "It's cold. You'll need warm clothing to stay comfortable. ",
    aiTempMild: "Mild and pleasant temperatures, no extremes. ",
    aiTempWarm: "Warm atmosphere, temperatures are noticeably rising. ",
    aiTempHot: "Intense heat. Avoid strenuous activity during midday hours. ",
    
    aiWindLight: "Winds are calm, a placid day. ",
    aiWindMod: "The wind is blowing steadily, increasing the wind chill factor. ",
    aiWindStrong: "Watch out for strong wind gusts today. ",
    
    aiRainNone: "You can relax, no rain is seen on the immediate horizon. ",
    aiRainExp: "Radar alert: rain is approaching imminently. ",

    wmo: {
      0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
      45: "fog", 48: "depositing rime fog",
      51: "light drizzle", 53: "moderate drizzle", 55: "dense drizzle",
      56: "light freezing drizzle", 57: "dense freezing drizzle",
      61: "slight rain", 63: "moderate rain", 65: "heavy rain",
      66: "light freezing rain", 67: "heavy freezing rain",
      71: "slight snow fall", 73: "moderate snow fall", 75: "heavy snow fall",
      77: "snow grains",
      80: "slight rain showers", 81: "moderate rain showers", 82: "violent rain showers",
      85: "slight snow showers", 86: "heavy snow showers",
      95: "thunderstorm", 96: "thunderstorm with slight hail", 99: "thunderstorm with heavy hail"
    },

    alertStorm: "High electrical risk and heavy rain.",
    alertSnow: "Caution: Accumulated snow forecast.",
    alertWindExtreme: "Hurricane-force winds. Danger.",
    alertWindHigh: "Strong gusts. Watch objects.",
    alertHeatExtreme: "Extreme heat. Avoid sun.",
    alertHeatHigh: "High temperatures. Stay hydrated.",
    alertColdExtreme: "Severe cold. Frostbite risk.",
    alertColdHigh: "Frost. Slippery roads.",
    alertRain: "Heavy rainfall.",
    alertAir: "Poor air quality.",
    tipHydration: "Drink water",
    tipThermal: "Thermal wear",
    tipWindbreaker: "Windbreaker",
    tipMugginess: "Light clothes",
    tipUmbrella: "Take umbrella",
    tipSunscreen: "Sunscreen",
    tipCalm: "Enjoy",
    tipCoat: "Heavy coat",
    tipLayers: "Wear layers",

    moonPhases: {
      new: "New Moon",
      waxingCrescent: "Waxing Crescent",
      firstQuarter: "First Quarter",
      waxingGibbous: "Waxing Gibbous",
      full: "Full Moon",
      waningGibbous: "Waning Gibbous",
      lastQuarter: "Last Quarter",
      waningCrescent: "Waning Crescent"
    }
  },
  fr: {
    searchPlaceholder: "Rechercher une ville...",
    favorites: "Lieux favoris",
    now: "Maintenant",
    updatedNow: "Mis à jour",
    feelsLike: "Ressenti",
    aiAnalysis: "Analyse Météo IA",
    aiConfidence: "Consensus Modèles",
    aiConfidenceMod: "Divergence Modèles",
    aiConfidenceLow: "Incertitude Élevée",
    generatingTips: "Analyse des modèles (ECMWF, GFS, ICON)...",
    trend24h: "Tendance 24h",
    temp: "Température",
    rain: "Pluie",
    wind: "Vent",
    cloud: "Couverture",
    humidity: "Humidité",
    forecast7days: "Prévisions 7 Jours",
    today: "Aujourd'hui",
    detailedForecast: "Prévisions détaillées",
    hourlyEvolution: "Évolution horaire",
    snowAccumulated: "Neige accumulée",
    totalPrecipitation: "Précipitations totales",
    rainProb: "Prob. Pluie",
    windMax: "Vent Max",
    uvIndex: "Indice UV",
    tempMin: "Temp Min",
    sunrise: "Lever soleil",
    sunset: "Coucher soleil",
    moon: "Lune",
    pressure: "Pression",
    aqi: "Qualité Air",
    index: "Indice",
    moonPhase: "Phase Lunaire",
    illumination: "Éclairée",
    calc: "Calc",
    est: "Est.",
    sunRiseIn: "Lever dans",
    sunSetIn: "Coucher dans",
    sunSetDone: "Déjà couché",
    localTime: "Heure locale",
    day: "Jour",
    night: "Nuit",
    sun: "Soleil",
    clear: "Clair",
    cloudy: "Nuageux",
    snow: "Neige",
    rainy: "Pluvieux",
    storm: "Orage",
    uvLow: "Faible",
    uvMod: "Modéré",
    uvHigh: "Élevé",
    uvVeryHigh: "Très élevé",
    uvExtreme: "Extrême",
    alertDanger: "ALERTE DANGER",
    alertWarning: "AVIS PRUDENCE",
    subtitle: "Prévision multi-modèle interprétée par Intelligence Artificielle.",
    aqiLevels: ["Excellent", "Bon", "Acceptable", "Modéré", "Mauvais", "Très Mauvais"],
    pollen: "Niveaux de Pollen",
    pollenTypes: {
      alder: "Aulne",
      birch: "Bouleau",
      grass: "Graminées",
      mugwort: "Armoise",
      olive: "Olivier",
      ragweed: "Ambroisie"
    },
    modeBasic: "Basique",
    modeExpert: "Étendu", 
    directions: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
    preciseRain: "Prévisions Minute par Minute (1h)",
    modelsLegend: "Comparaison Modèles",
    modelBest: "Consensus",
    modelGfs: "GFS (USA)",
    modelIcon: "ICON (Allemagne)",
    
    aiIntroMorning: "Bonjour. Commençons la journée avec les cartes mises à jour. ",
    aiIntroAfternoon: "Bonne après-midi. Voyons comment la situation évolue. ",
    aiIntroEvening: "Bonsoir. Voici les perspectives pour la fin de la journée. ",
    aiIntroNight: "Bonne nuit. Prévisions pour les heures nocturnes à venir. ",
    
    aiSummaryClear: "Ciel dégagé. Les modèles confirment une journée radieuse, parfaite pour être dehors. ",
    aiSummaryCloudy: "Le ciel restera variable avec des nuages, mais aucun problème majeur n'est attendu. ",
    aiSummaryRain: "Gardez un parapluie à portée de main. Des précipitations actives traversent la zone. ",
    aiSummaryStorm: "Prudence. L'instabilité est marquée et il y a un risque d'orages violents. ",
    aiSummarySnow: "Paysage hivernal. Les conditions sont propices au froid rigoureux et à la neige. ",
    
    aiTempFreezing: "Ambiance glaciale. Couvrez-vous bien si vous sortez. ",
    aiTempCold: "Il fait froid. Vous aurez besoin de vêtements chauds pour être à l'aise. ",
    aiTempMild: "Températures douces et agréables, sans extrêmes. ",
    aiTempWarm: "Atmosphère chaude, la hausse des températures est perceptible. ",
    aiTempHot: "Chaleur intense. Évitez les efforts aux heures les plus chaudes. ",
    
    aiWindLight: "Le vent est calme, une journée paisible. ",
    aiWindMod: "Le vent souffle, accentuant la sensation de froid. ",
    aiWindStrong: "Attention aux rafales de vent qui peuvent être fortes aujourd'hui. ",
    
    aiRainNone: "Vous pouvez être tranquille, aucune pluie n'est visible à l'horizon immédiat. ",
    aiRainExp: "Alerte radar : la pluie approche de façon imminente. ",

    wmo: {
      0: "ciel dégagé", 1: "ciel peu nuageux", 2: "partiellement nuageux", 3: "ciel couvert",
      45: "brouillard", 48: "brouillard givrant",
      51: "bruine légère", 53: "bruine modérée", 55: "bruine dense",
      56: "bruine verglaçante légère", 57: "bruine verglaçante dense",
      61: "pluie faible", 63: "pluie modérée", 65: "pluie forte",
      66: "pluie verglaçante légère", 67: "pluie verglaçante forte",
      71: "chute de neige faible", 73: "chute de neige modérée", 75: "chute de neige forte",
      77: "grains de neige",
      80: "averses", 81: "averses modérées", 82: "averses violentes",
      85: "averses de neige", 86: "averses de neige fortes",
      95: "orage", 96: "orage avec grêle", 99: "orage violent avec grêle"
    },

    alertStorm: "Risque électrique élevé et fortes pluies.",
    alertSnow: "Attention : Neige accumulée prévue.",
    alertWindExtreme: "Vent d'ouragan. Danger extrême.",
    alertWindHigh: "Rafales fortes. Attention aux objets.",
    alertHeatExtreme: "Chaleur extrême. Danger de coup de chaleur.",
    alertHeatHigh: "Températures élevées. Hydratez-vous.",
    alertColdExtreme: "Froid extrême. Risque d'hypothermie.",
    alertColdHigh: "Gelées. Prudence sur la route.",
    alertRain: "Précipitations abondantes.",
    alertAir: "Qualité de l'air médiocre.",
    tipHydration: "Hydratation",
    tipThermal: "Vêtements thermiques",
    tipWindbreaker: "Coupe-vent",
    tipMugginess: "Lourd",
    tipUmbrella: "Prenez parapluie",
    tipSunscreen: "Écran solaire",
    tipCalm: "Profitez",
    tipCoat: "Manteau épais",
    tipLayers: "Couches",

    moonPhases: {
      new: "Nouvelle Lune",
      waxingCrescent: "Premier Croissant",
      firstQuarter: "Premier Quartier",
      waxingGibbous: "Gibbeuse Croissante",
      full: "Pleine Lune",
      waningGibbous: "Gibbeuse Décroissante",
      lastQuarter: "Dernier Quartier",
      waningCrescent: "Dernier Croissant"
    }
  }
};

// --- COMPONENT: ANIMACIÓ DE PARTÍCULES ---
const WeatherParticles = ({ code }) => {
  const isSnow = (code >= 71 && code <= 77) || code === 85 || code === 86;
  const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95);
  if (!isSnow && !isRain) return null;
  const type = isSnow ? 'snow' : 'rain';
  const count = 30; 

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {[...Array(count)].map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 5;
        const duration = Math.random() * 2 + (isSnow ? 5 : 1); 
        const opacity = Math.random() * 0.5 + 0.1;
        return (
          <div 
            key={i}
            className={`absolute top-[-20px] ${type === 'rain' ? 'w-0.5 h-6 bg-blue-300/40' : 'w-1.5 h-1.5 bg-white/60 rounded-full blur-[1px]'}`}
            style={{ left: `${left}%`, animation: `fall ${duration}s linear ${delay}s infinite`, opacity: opacity }}
          />
        );
      })}
      <style>{`@keyframes fall { to { transform: translateY(110vh); } }`}</style>
    </div>
  );
};

// --- ICONA VARIABLE: SOL/LLUNA + NÚVOL + LLAMP ---
const VariableWeatherIcon = ({ isDay, className, ...props }) => {
  return (
    <div className={`${className} relative flex items-center justify-center`} {...props}>
      {/* Sun/Moon Layer - Offset to Top Right */}
      <div className="absolute top-[-10%] right-[-10%] w-[55%] h-[55%] z-0">
         {isDay ? (
           <Sun className="w-full h-full text-yellow-400 fill-yellow-400/30 animate-[spin_12s_linear_infinite]" strokeWidth={2} />
         ) : (
           <Moon className="w-full h-full text-slate-300 fill-slate-300/30" strokeWidth={2} />
         )}
      </div>
      
      {/* Main Cloud Layer with Lightning */}
      <CloudLightning className="w-full h-full text-purple-400 fill-purple-400/20 animate-pulse relative z-10" strokeWidth={2} />
    </div>
  );
};

// --- Subcomponent Efecte Escriptura Corregit ---
const TypewriterText = ({ text }) => {
  const [displayedText, setDisplayedText] = useState('');
  useEffect(() => {
    setDisplayedText(''); 
    if (!text) return;
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else { clearInterval(timer); }
    }, 15); 
    return () => clearInterval(timer);
  }, [text]);
  return <p className="text-slate-200 font-medium leading-relaxed text-sm md:text-base min-h-[3em]">{displayedText}</p>;
};

// --- HELPERS DATES I HORES ---

// Modificat: Ara accepta una data base (now) per calcular el desplaçament real
const getShiftedDate = (baseDate, timezone) => {
  const targetTimeStr = baseDate.toLocaleString("en-US", { timeZone: timezone });
  return new Date(targetTimeStr);
};

const getMoonPhase = (date) => {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();
  if (month < 3) { year--; month += 12; }
  const c = 365.25 * year;
  const e = 30.6 * month;
  const jd = c + e + day - 694039.09; 
  let phase = jd / 29.5305882; 
  phase -= Math.floor(phase); 
  return phase; 
};

const getMoonPhaseText = (phase, lang = 'ca') => {
  const t = TRANSLATIONS[lang].moonPhases;
  if (phase < 0.03 || phase > 0.97) return t.new;
  if (phase < 0.22) return t.waxingCrescent;
  if (phase < 0.28) return t.firstQuarter;
  if (phase < 0.47) return t.waxingGibbous;
  if (phase < 0.53) return t.full;
  if (phase < 0.72) return t.waningGibbous;
  if (phase < 0.78) return t.lastQuarter;
  return t.waningCrescent;
};

// --- BANDERES ---
const FlagIcon = ({ lang, className = "w-5 h-5 rounded-sm object-cover" }) => {
  if (lang === 'ca') { return <svg viewBox="0 0 640 480" className={className}><path fill="#FFED00" d="M0 0h640v480H0z"/><path fill="#D50032" d="M0 48h640v48H0zM0 144h640v48H0zM0 240h640v48H0zM0 336h640v48H0z"/></svg>; }
  if (lang === 'es') { return <svg viewBox="0 0 640 480" className={className}><path fill="#AA151B" d="M0 0h640v480H0z"/><path fill="#F1BF00" d="M0 120h640v240H0z"/></svg>; }
  if (lang === 'fr') { return <svg viewBox="0 0 640 480" className={className}><path fill="#fff" d="M0 0h640v480H0z"/><path fill="#002395" d="M0 0h213.3v480H0z"/><path fill="#ED2939" d="M426.7 0H640v480H426.7z"/></svg>; }
  if (lang === 'en') { return <svg viewBox="0 0 640 480" className={className}><path fill="#012169" d="M0 0h640v480H0z"/><path fill="#FFF" d="M75 0l244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z"/><path fill="#C8102E" d="M424 294l216 163v23H506L312 336 118 480H0v-23l214-163L0 129V106h6l206 153L418 106h8l214 160v28H506L424 294z"/><path fill="#FFF" d="M250 0h140v480H250zM0 170h640v140H0z"/><path fill="#C8102E" d="M280 0h80v480h-80zM0 200h640v80H0z"/></svg>; }
  return null;
};

// --- ICONA MOON ---
const MoonPhaseIcon = ({ phase, lat = 41, className = "w-4 h-4", lang = 'ca' }) => {
  const p = phase % 1;
  const r = 9; const cx = 12; const cy = 12; const theta = p * 2 * Math.PI;
  const rx = Math.abs(r * Math.cos(theta));
  const isWaxing = p <= 0.5; const isCrescent = (p < 0.25) || (p > 0.75); 
  const outerD = isWaxing ? `M ${cx},${cy-r} A ${r},${r} 0 0 1 ${cx},${cy+r}` : `M ${cx},${cy-r} A ${r},${r} 0 0 0 ${cx},${cy+r}`;
  let sweep = 0; if (isWaxing) { sweep = isCrescent ? 0 : 1; } else { sweep = !isCrescent ? 0 : 1; }
  const innerD = `A ${rx},${r} 0 0 ${sweep} ${cx},${cy-r}`;
  const d = `${outerD} ${innerD} Z`;
  const transform = lat < 0 ? "scale(-1, 1)" : "";

  return (
    <svg viewBox="0 0 24 24" className={`${className} filter drop-shadow-md`} style={{transform}} stroke="none">
       <title>{getMoonPhaseText(phase, lang)}</title>
       <defs>
         <radialGradient id="moonGradient" cx="50%" cy="50%" r="80%" fx="30%" fy="30%"> <stop offset="0%" stopColor="#f1f5f9" /> <stop offset="90%" stopColor="#cbd5e1" /> </radialGradient>
         <filter id="moonGlow" x="-20%" y="-20%" width="140%" height="140%"> <feGaussianBlur stdDeviation="0.8" result="blur" /> <feComposite in="SourceGraphic" in2="blur" operator="over" /> </filter>
       </defs>
       <circle cx={cx} cy={cy} r={r} fill="#1e293b" stroke="#334155" strokeWidth="0.5" />
       <path d={d} fill="url(#moonGradient)" className="" />
    </svg>
  );
};

// --- SUN WIDGET ---
const SunArcWidget = ({ sunrise, sunset, lang = 'ca', shiftedNow }) => {
  const t = TRANSLATIONS[lang];
  // Parse strings directly - we assume they represent local time as intended by API
  const sunriseTime = new Date(sunrise).getTime();
  const sunsetTime = new Date(sunset).getTime();
  const now = shiftedNow.getTime();

  // Compare day parts using date strings to be safe against shift logic quirks
  const isToday = shiftedNow.toDateString() === new Date(sunrise).toDateString();
  
  let progress = 0;
  let nextEventText = "";
  
  if (isToday) {
     const totalDayLength = sunsetTime - sunriseTime;
     const elapsed = now - sunriseTime;
     progress = Math.max(0, Math.min(1, elapsed / totalDayLength));
     
     if (now < sunriseTime) {
        const diff = sunriseTime - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        nextEventText = `${t.sunRiseIn} ${h}h ${m}m`;
     } else if (now < sunsetTime) {
        const diff = sunsetTime - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        nextEventText = `${t.sunSetIn} ${h}h ${m}m`;
     } else { nextEventText = t.sunSetDone; }
  } else if (now > sunsetTime) { progress = 1; nextEventText = t.sunSetDone; }
  
  const r = 35; const cx = 50; const cy = 50;
  const angle = Math.PI - (progress * Math.PI);
  const sunX = cx + r * Math.cos(angle);
  const sunY = cy - r * Math.sin(angle); 

  return (
    <div className="bg-slate-900/60 border border-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm relative h-full min-h-[140px]">
       <div className="w-full flex justify-between items-center text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
          <span className="flex items-center gap-1"><Sunrise className="w-3 h-3 text-orange-400" strokeWidth={2.5}/> {t.sunrise}</span>
          <span className="flex items-center gap-1">{t.sunset} <Sunset className="w-3 h-3 text-purple-400" strokeWidth={2.5}/></span>
       </div>
       <div className="relative w-full h-24 overflow-hidden">
          <svg viewBox="0 0 100 60" className="w-full h-full">
             <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="#334155" strokeWidth="2" strokeDasharray="4 4" />
             <g transform={`translate(${sunX - 6}, ${sunY - 6})`}>
                <circle cx="6" cy="6" r="4" fill="#fbbf24" className="animate-pulse shadow-lg shadow-amber-500/50" />
                <circle cx="6" cy="6" r="8" stroke="#fbbf24" strokeWidth="1" opacity="0.5" />
             </g>
             <line x1="0" y1="55" x2="100" y2="55" stroke="#1e293b" strokeWidth="1" />
          </svg>
          <div className="absolute bottom-2 left-0 right-0 text-center">
             <span className="text-[10px] font-bold text-amber-300 bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-500/20 backdrop-blur-sm">{nextEventText}</span>
          </div>
       </div>
       <div className="w-full flex justify-between items-end -mt-4 z-10">
          <span className="text-sm font-bold text-white">{new Date(sunrise).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
          <span className="text-xs text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">{isToday ? (progress > 0 && progress < 1 ? t.day : t.night) : t.sun}</span>
          <span className="text-sm font-bold text-white">{new Date(sunset).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
       </div>
    </div>
  );
};

// --- MOON WIDGET ---
const MoonWidget = ({ phase, lat, lang = 'ca' }) => {
  const t = TRANSLATIONS[lang];
  const phaseName = getMoonPhaseText(phase, lang);
  const illumination = Math.round((1 - Math.abs((phase - 0.5) * 2)) * 100);
  return (
    <div className="bg-slate-900/60 border border-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm relative h-full min-h-[140px]">
       <div className="absolute top-4 left-4 flex items-center gap-2 text-xs font-bold uppercase text-indigo-300 tracking-wider"><Moon className="w-3 h-3" strokeWidth={2.5} /> {t.moonPhase}</div>
       <div className="flex flex-col items-center justify-center mt-2">
          <div className="relative">
             <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full"></div>
             <MoonPhaseIcon phase={phase} lat={lat} className="w-16 h-16 text-slate-200 relative z-10" lang={lang} />
          </div>
          <span className="text-lg font-bold text-white mt-4">{phaseName}</span>
          <span className="text-xs text-slate-400 mt-1 font-medium bg-slate-800/50 px-2 py-0.5 rounded-full border border-slate-700">{illumination}% {t.illumination}</span>
       </div>
    </div>
  );
};

// --- POLLEN WIDGET ---
const PollenWidget = ({ data, lang = 'ca' }) => {
  if (!data) return null;
  const t = TRANSLATIONS[lang];
  
  const pollenMap = [
    { key: 'alder', val: data.alder_pollen },
    { key: 'birch', val: data.birch_pollen },
    { key: 'grass', val: data.grass_pollen },
    { key: 'mugwort', val: data.mugwort_pollen },
    { key: 'olive', val: data.olive_pollen },
    { key: 'ragweed', val: data.ragweed_pollen }
  ];

  const getLevelColor = (val) => {
    if (!val || val < 10) return 'bg-green-500'; 
    if (val < 50) return 'bg-yellow-500'; 
    if (val < 200) return 'bg-orange-500'; 
    return 'bg-red-500'; 
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/50 p-4 rounded-2xl backdrop-blur-sm relative h-full min-h-[140px] flex flex-col">
       <div className="flex items-center gap-2 text-xs font-bold uppercase text-indigo-300 tracking-wider mb-3">
         <Flower2 className="w-3 h-3" strokeWidth={2.5} /> {t.pollen}
       </div>
       <div className="grid grid-cols-2 gap-2 flex-1">
          {pollenMap.map((item) => (
             <div key={item.key} className="flex items-center justify-between bg-slate-950/30 p-2 rounded-lg border border-white/5">
                <span className="text-xs text-slate-300 font-medium">{t.pollenTypes[item.key]}</span>
                <div className={`w-2.5 h-2.5 rounded-full ${getLevelColor(item.val)} shadow-sm`}></div>
             </div>
          ))}
       </div>
    </div>
  );
};

// --- COMPASS GAUGE ---
const CompassGauge = ({ degrees, speed, label, subText, lang = 'ca' }) => {
  const directions = TRANSLATIONS[lang].directions || ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((degrees %= 360) < 0 ? degrees + 360 : degrees) / 45) % 8;
  const dirText = directions[index];
  
  // Custom Compass directions for display in the circle
  const N = directions[0];
  const S = directions[4];
  const E = directions[2];
  const W = directions[6];

  return (
    <div className="bg-slate-900/60 border border-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm relative group h-full">
      <div className="relative w-24 h-24 flex items-center justify-center mb-1">
         <div className="absolute inset-0 rounded-full border-2 border-slate-800 flex items-center justify-center">
            <span className="absolute top-1 text-[8px] text-slate-500 font-bold">{N}</span>
            <span className="absolute bottom-1 text-[8px] text-slate-500 font-bold">{S}</span>
            <span className="absolute left-1 text-[8px] text-slate-500 font-bold">{W}</span>
            <span className="absolute right-1 text-[8px] text-slate-500 font-bold">{E}</span>
         </div>
         <div 
            className="w-full h-full flex items-center justify-center transition-transform duration-1000 ease-out"
            style={{ transform: `rotate(${degrees}deg)` }}
         >
             <div className="w-1 h-12 bg-gradient-to-b from-red-500 to-transparent rounded-full relative -top-2">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-red-500"></div>
             </div>
         </div>
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 m-6 rounded-full border border-slate-700 backdrop-blur-sm">
            <span className="text-sm font-bold text-white">{Math.round(speed)}</span>
            <span className="text-[9px] text-slate-400">km/h</span>
         </div>
      </div>
      <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</div>
      <div className="text-xs font-bold text-teal-400 mt-0.5">{dirText} ({degrees}°)</div>
    </div>
  );
};

// --- TEMP RANGE BAR ---
const TempRangeBar = ({ min, max, globalMin, globalMax, displayMin, displayMax }) => {
  const totalRange = globalMax - globalMin || 1;
  const safeMin = Math.max(min, globalMin);
  const safeMax = Math.min(max, globalMax);
  const leftPct = ((safeMin - globalMin) / totalRange) * 100;
  const widthPct = ((safeMax - safeMin) / totalRange) * 100;

  return (
    <div className="flex items-center gap-3 w-full max-w-[12rem] md:max-w-[16rem]">
      <span className="text-xs text-slate-400 w-8 text-right font-medium tabular-nums">{displayMin}°</span>
      <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full relative overflow-hidden">
        <div className="absolute h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-amber-400 opacity-90" style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '6px' }} />
      </div>
      <span className="text-xs text-white w-8 text-left font-bold tabular-nums">{displayMax}°</span>
    </div>
  )
};

// --- SINGLE CHART (MULTI-MODEL SUPPORT) ---
const SingleHourlyChart = ({ data, comparisonData, layer, unit, hoveredIndex, setHoveredIndex, height = 140, lang = 'ca', shiftedNow }) => {
  if (!data || data.length === 0) return null;
  const t = TRANSLATIONS[lang];

  const layersConfig = {
    temp: { key: 'temp', color: '#818cf8', gradientStart: '#818cf8', title: t.temp },
    rain: { key: 'rain', color: '#3b82f6', gradientStart: '#3b82f6', title: t.rainProb },
    wind: { key: 'wind', color: '#2dd4bf', gradientStart: '#2dd4bf', title: t.wind },
    cloud: { key: 'cloud', color: '#94a3b8', gradientStart: '#94a3b8', title: t.cloud },
    humidity: { key: 'humidity', color: '#22d3ee', gradientStart: '#22d3ee', title: t.humidity }
  };

  const currentConfig = layersConfig[layer];
  const dataKey = currentConfig.key;
  const width = 800;
  const paddingX = 20;
  const paddingY = 30;

  // Gather values from ALL models to set Scale
  const values = data.map(d => d[dataKey]);
  let allValues = [...values];
  
  if (comparisonData && comparisonData.gfs) {
     const gfsVals = comparisonData.gfs.map(d => d[dataKey]);
     allValues = [...allValues, ...gfsVals];
  }
  if (comparisonData && comparisonData.icon) {
     const iconVals = comparisonData.icon.map(d => d[dataKey]);
     allValues = [...allValues, ...iconVals];
  }

  let minVal = Math.min(...allValues);
  let maxVal = Math.max(...allValues);

  if (layer === 'temp') {
     // Ensure buffer for temp
     minVal -= 2;
     maxVal += 2;
  } else if (layer === 'rain' || layer === 'cloud' || layer === 'humidity') {
    minVal = 0;
    maxVal = 100;
  } else if (layer === 'wind') {
    minVal = 0; 
    maxVal = Math.max(maxVal, 20);
  }
  
  const range = maxVal - minVal || 1;

  // Helper to calculate Y for any value
  const calcY = (val) => height - paddingY - ((val - minVal) / range) * (height - 2 * paddingY);

  const points = data.map((d, i) => ({
    x: paddingX + (i / (data.length - 1)) * (width - 2 * paddingX),
    y: calcY(d[dataKey]),
    value: d[dataKey],
    ...d
  }));

  const buildSmoothPath = (pts, keyY = 'y') => {
    if (pts.length === 0) return "";
    let d = `M ${pts[0].x},${pts[0][keyY]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx},${p0[keyY]} ${cx},${p1[keyY]} ${p1.x},${p1[keyY]}`;
    }
    return d;
  };

  // Main Line
  const linePath = buildSmoothPath(points, 'y');
  const areaPath = `${linePath} L ${width - paddingX},${height} L ${paddingX},${height} Z`;

  // Secondary Lines (Comparison)
  let gfsPath = "";
  let iconPath = "";

  if (comparisonData) {
      if (comparisonData.gfs && comparisonData.gfs.length > 0) {
          const gfsPoints = comparisonData.gfs.map((d, i) => ({
              x: paddingX + (i / (comparisonData.gfs.length - 1)) * (width - 2 * paddingX),
              y: calcY(d[dataKey])
          }));
          gfsPath = buildSmoothPath(gfsPoints, 'y');
      }
      if (comparisonData.icon && comparisonData.icon.length > 0) {
          const iconPoints = comparisonData.icon.map((d, i) => ({
              x: paddingX + (i / (comparisonData.icon.length - 1)) * (width - 2 * paddingX),
              y: calcY(d[dataKey])
          }));
          iconPath = buildSmoothPath(iconPoints, 'y');
      }
  }

  const hoverData = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <div className="relative w-full">
      <div className="absolute top-2 left-4 text-xs font-bold text-slate-400 uppercase tracking-wider z-10 flex items-center gap-2">
         <span className={`w-2 h-2 rounded-full`} style={{backgroundColor: currentConfig.color}}></span>
         {currentConfig.title}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-lg" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`gradient-${layer}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={currentConfig.gradientStart} stopOpacity="0.4" />
            <stop offset="100%" stopColor={currentConfig.gradientStart} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        
        {/* Fill Area (Main Model only) */}
        <path d={areaPath} fill={`url(#gradient-${layer})`} />

        {/* Comparison Lines (Rendered before Main so Main is on top) */}
        {gfsPath && <path d={gfsPath} fill="none" stroke="#4ade80" strokeWidth="1.5" strokeOpacity="0.8" strokeLinecap="round" strokeLinejoin="round" />}
        {iconPath && <path d={iconPath} fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeOpacity="0.8" strokeLinecap="round" strokeLinejoin="round" />}

        {/* Main Line */}
        <path d={linePath} fill="none" stroke={currentConfig.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Interactivity Overlay */}
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHoveredIndex(i)}>
            <rect x={p.x - (width / points.length / 2)} y={0} width={width / points.length} height={height} fill="transparent" className="cursor-crosshair"/>
            {/* Hour Labels */}
            {(i % (points.length > 12 ? 3 : 1) === 0) && (
              <text x={p.x} y={height - 2} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">{new Date(p.time).getHours()}h</text>
            )}
          </g>
        ))}

        {hoverData && (
          <g>
            <line x1={hoverData.x} y1={0} x2={hoverData.x} y2={height - paddingY} stroke="white" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
            <circle cx={hoverData.x} cy={hoverData.y} r="4" fill={currentConfig.color} stroke="white" strokeWidth="2" />
            <g transform={`translate(${Math.min(width - 60, Math.max(60, hoverData.x))}, ${Math.min(height - 40, Math.max(20, hoverData.y - 35))})`}>
               <rect x="-40" y="-22" width="80" height={34} rx="6" fill="#0f172a" stroke={currentConfig.color} strokeWidth="1" opacity="0.95" />
               <text x="0" y="0" dy="5" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">{Math.round(hoverData.value)}{unit}</text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};

const HourlyForecastChart = ({ data, comparisonData, unit, lang = 'ca', shiftedNow }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const t = TRANSLATIONS[lang];

  if (!data || data.length === 0) return null;
  
  return (
    <div className="w-full overflow-x-auto custom-scrollbar relative" onMouseLeave={() => setHoveredIndex(null)}>
      <div className="min-w-[220%] md:min-w-full space-y-3 pr-4">
        <SingleHourlyChart data={data} comparisonData={comparisonData} layer="temp" unit={unit} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={150} lang={lang} />
        <SingleHourlyChart data={data} comparisonData={comparisonData} layer="rain" unit="%" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={130} lang={lang} />
        <SingleHourlyChart data={data} comparisonData={comparisonData} layer="cloud" unit="%" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={130} lang={lang} />
        <SingleHourlyChart data={data} comparisonData={comparisonData} layer="wind" unit="km/h" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={130} lang={lang} />
      </div>

      {/* LEGEND FOR MULTI-MODEL */}
      <div className="flex justify-center items-center gap-4 mt-4 pt-2 border-t border-white/5">
           <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{t.modelsLegend}:</span>
           <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-indigo-500 border border-indigo-400"></div>
              <span className="text-xs text-slate-300">{t.modelBest}</span>
           </div>
           <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-green-400"></div>
              <span className="text-xs text-slate-300">{t.modelGfs}</span>
           </div>
           <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-amber-400"></div>
              <span className="text-xs text-slate-300">{t.modelIcon}</span>
           </div>
      </div>
    </div>
  );
};

// --- NOU COMPONENT: GRÀFICA DE PRECISIÓ (MINUT A MINUT) ---
// Aquest component mostra la pluja prevista pels pròxims 60 minuts en intervals de 15 minuts.
// És crucial per donar la sensació de "precisió" que demana l'usuari.
const MinutelyPreciseChart = ({ data, label, currentPrecip = 0 }) => {
  // MODIFICACIÓ: Si data és buida però currentPrecip > 0, creem un array fals per mostrar la pluja actual
  // Això soluciona el problema de que "no apareix res" quan plou però el radar no ho veu
  
  let chartData = data ? [...data] : [];
  
  // Assegurar que tenim almenys 4 slots
  while(chartData.length < 4) chartData.push(0);
  
  // Limitem a 4 intervals (1 hora)
  chartData = chartData.slice(0, 4);

  // HYBRID FIX: Si plou ara (currentPrecip > 0) i la previsió immediata és 0, 
  // assumim que el radar falla i injectem la pluja actual al primer slot.
  if (currentPrecip > 0 && chartData[0] === 0) {
      chartData[0] = currentPrecip;
      // Opcional: decaiment suau si volem simular que pararà, o mantenir-ho
      // De moment només el primer slot per ser honestos amb "Ara"
  }

  // Ara comprovem si tot és 0
  if (chartData.every(v => v === 0)) return null;
  
  const max = Math.max(...chartData, 0.5); // Escala mínima

  return (
    <div className="w-full mt-3 bg-blue-950/20 rounded-xl p-3 border border-blue-500/20 animate-in fade-in">
        <div className="flex items-center gap-2 mb-2">
            <CloudRain className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">{label}</span>
        </div>
        <div className="flex items-end gap-2 h-16 w-full pb-1">
           {chartData.map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                 
                 {/* VALUE DISPLAY (FIXED: SHOW DATA) */}
                 {val > 0 && (
                    <span className="text-[9px] font-bold text-blue-200 mb-0.5 animate-in slide-in-from-bottom-1">
                        {val >= 10 ? Math.round(val) : val.toFixed(1)}
                    </span>
                 )}

                 <div className="w-full bg-blue-900/30 rounded-sm relative h-full max-h-[40px] overflow-hidden flex items-end">
                    <div 
                      className="w-full bg-blue-400 rounded-sm transition-all group-hover:bg-blue-300"
                      style={{ height: `${(val / max) * 100}%`, minHeight: val > 0 ? '2px' : '0' }}
                    ></div>
                 </div>
                 <span className="text-[9px] text-slate-400 font-medium">
                    {i === 0 ? 'Ara' : `+${i * 15}m`}
                 </span>
              </div>
           ))}
        </div>
        <div className="flex justify-between items-center text-[9px] text-blue-400/70 mt-1 px-1">
           <span>Intensitat (mm)</span>
           <span>Previsió 1h</span>
        </div>
    </div>
  )
}


// --- CIRCULAR GAUGE ---
const CircularGauge = ({ value, max = 100, label, icon, color = "text-indigo-500", subText }) => {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(value, max) / max) * circumference;

  return (
    <div className="bg-slate-900/60 border border-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm relative group h-full">
      <div className="relative w-24 h-24 flex items-center justify-center">
         <svg className="w-full h-full transform -rotate-90">
            <circle cx="50%" cy="50%" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-800" />
            <circle cx="50%" cy="50%" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className={`${color} transition-all duration-1000 ease-out`} />
         </svg>
         <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`mb-1 ${color}`}>{icon}</div>
            <span className="text-sm font-bold text-white">{value}</span>
         </div>
      </div>
      <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-2">{label}</div>
      {subText && <div className="text-[10px] text-slate-500 mt-1">{subText}</div>}
    </div>
  );
};

export default function MeteoIA() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [weatherData, setWeatherData] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const [favorites, setFavorites] = useState([]);
  
  // ESTAT INICIAL AMB PERSISTÈNCIA
  const [unit, setUnit] = useState(() => localStorage.getItem('meteoia-unit') || 'C');
  const [lang, setLang] = useState(() => localStorage.getItem('meteoia-lang') || 'ca');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('meteoia-view') || 'basic');

  // --- RELLOTGE VIU ---
  // Aquest state és la clau per la "precisió" temporal. S'actualitza cada minut.
  const [now, setNow] = useState(new Date());

  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const t = TRANSLATIONS[lang];

  // GUARDAR PREFERÈNCIES
  useEffect(() => { localStorage.setItem('meteoia-unit', unit); }, [unit]);
  useEffect(() => { localStorage.setItem('meteoia-lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('meteoia-view', viewMode); }, [viewMode]);

  // --- INTERVAL RELLOTGE ---
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Actualitza cada minut
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const savedFavs = localStorage.getItem('meteoia-favs');
    if (savedFavs) setFavorites(JSON.parse(savedFavs));
  }, []);

  const saveFavorites = (newFavs) => {
    setFavorites(newFavs);
    localStorage.setItem('meteoia-favs', JSON.stringify(newFavs));
  };

  const toggleFavorite = () => {
    if (!weatherData) return;
    const currentLoc = weatherData.location;
    const isFav = favorites.some(f => f.name === currentLoc.name);
    const newFavs = isFav ? favorites.filter(f => f.name !== currentLoc.name) : [...favorites, currentLoc];
    saveFavorites(newFavs);
  };

  const removeFavorite = (e, name) => {
    e.stopPropagation();
    const newFavs = favorites.filter(f => f.name !== name);
    saveFavorites(newFavs);
  };

  const isCurrentFavorite = weatherData && favorites.some(f => f.name === weatherData.location.name);

  const formatTemp = (tempC) => {
    if (unit === 'F') return Math.round((tempC * 9/5) + 32);
    return Math.round(tempC);
  };

  const getUnitLabel = () => unit === 'F' ? '°F' : '°C';
  const isSnowCode = (code) => (code >= 71 && code <= 77) || code === 85 || code === 86;

  // --- ICONES MILLORADES (Amb Fill i Ombra) I LÒGICA WMO REFINADA ---
  const getWeatherIcon = (code, className = "w-6 h-6", isDay = 1, rainProb = 0) => {
    // Definim propietats comuns per donar consistència
    const commonProps = {
      strokeWidth: 2, // Línia una mica més gruixuda per claredat
      className: `${className} drop-shadow-md transition-all duration-300` // Afegim ombra per separar del fons
    };

    // OVERRIDE: Si la probabilitat de pluja és > 50% i el codi no és de precipitació, forcem icona de pluja
    if (rainProb > 50 && code < 50) {
       return <CloudRain {...commonProps} className={`${commonProps.className} text-blue-400 fill-blue-400/20 animate-bounce`} />;
    }

    // 0: Cel serè (Afegim Fill semitransparent)
    if (code === 0) return isDay 
      ? <Sun {...commonProps} className={`${commonProps.className} text-yellow-400 fill-yellow-400/30 animate-[spin_12s_linear_infinite]`} /> 
      : <Moon {...commonProps} className={`${commonProps.className} text-slate-300 fill-slate-300/30`} />;
    
    // 1-2: Parcialment ennuvolat (Afegim Fill als núvols i sol/lluna)
    if (code === 1 || code === 2) return isDay 
      ? <CloudSun {...commonProps} className={`${commonProps.className} text-orange-300`} />
      : <CloudMoon {...commonProps} className={`${commonProps.className} text-slate-400`} />;
    
    // 3: Cobert (Fill al núvol per donar pes)
    if (code === 3) return <Cloud {...commonProps} className={`${commonProps.className} text-slate-400 fill-slate-400/40 animate-[pulse_4s_ease-in-out_infinite]`} />;

    // 45, 48: Boira
    if (code >= 45 && code <= 48) return <CloudFog {...commonProps} className={`${commonProps.className} text-gray-400 fill-gray-400/30 animate-pulse`} />;
    
    // 51-55: Plugim (Drizzle) - Icona CloudDrizzle si existís, sinó CloudRain amb color més suau
    if (code >= 51 && code <= 55) return <CloudRain {...commonProps} className={`${commonProps.className} text-blue-300 fill-blue-300/20`} />;

    // 56-57: Plugim gebrador - Afegim toc cian
    if (code >= 56 && code <= 57) return <CloudRain {...commonProps} className={`${commonProps.className} text-cyan-300 fill-cyan-300/20`} />;

    // 61-65: Pluja (Rain) - Icona CloudRain estàndard
    if (code >= 61 && code <= 65) return <CloudRain {...commonProps} className={`${commonProps.className} text-blue-500 fill-blue-500/20 animate-bounce`} />;

    // 66-67: Pluja gebradora
    if (code >= 66 && code <= 67) return <CloudRain {...commonProps} className={`${commonProps.className} text-cyan-400 fill-cyan-400/20 animate-bounce`} />;

    // 71-77: Neu
    if (code >= 71 && code <= 77) return <Snowflake {...commonProps} className={`${commonProps.className} text-white fill-white/30 animate-[spin_3s_linear_infinite]`} />; 
    
    // 80-82: Ruixats de pluja (Showers) - Important: Usar CloudRain
    if (code >= 80 && code <= 82) return <CloudRain {...commonProps} className={`${commonProps.className} text-indigo-400 fill-indigo-400/20 animate-bounce`} />;

    // 85-86: Ruixats de neu
    if (code >= 85 && code <= 86) return <CloudSnow {...commonProps} className={`${commonProps.className} text-white fill-white/30 animate-pulse`} />;

    // 95-99: Tempesta (Custom Icon with Sun/Moon + Cloud + Lightning)
    if (code >= 95) return <VariableWeatherIcon isDay={isDay} {...commonProps} />;
    
    // Fallback
    return <Cloud {...commonProps} className={`${commonProps.className} text-gray-300 fill-gray-300/20 animate-[pulse_4s_ease-in-out_infinite]`} />;
 };
  
  const getLangCodeForAPI = (l) => l; 
  
  // Date Formatter helper
  const formatDate = (dateString, options) => {
      const locales = { ca: 'ca-ES', es: 'es-ES', en: 'en-US', fr: 'fr-FR' };
      // Force local time interpretation for YYYY-MM-DD
      const date = dateString.includes('T') ? new Date(dateString) : new Date(`${dateString}T00:00:00`);
      return new Intl.DateTimeFormat(locales[lang], options).format(date);
  };
  
  const formatTime = (dateString) => {
      const locales = { ca: 'ca-ES', es: 'es-ES', en: 'en-US', fr: 'fr-FR' };
      return new Date(dateString).toLocaleTimeString(locales[lang], {hour:'2-digit', minute:'2-digit'});
  };

  const getDynamicBackground = (code, isDay = 1) => {
    if (!weatherData) return "from-slate-900 via-slate-900 to-indigo-950";
    if (code >= 95) return "from-slate-900 via-slate-950 to-purple-950"; 
    if (isSnowCode(code)) return "from-slate-800 via-slate-700 to-cyan-950"; 
    if (code >= 51) return "from-slate-800 via-slate-900 to-blue-950"; 
    
    if (code === 0 && isDay) return "from-blue-500 via-blue-400 to-orange-300"; 
    if (code === 0 && !isDay) return "from-slate-950 via-indigo-950 to-purple-950"; 
    if (code <= 3 && isDay) return "from-slate-700 via-slate-600 to-blue-800"; 
    return "from-slate-900 to-indigo-950";
  };
  
  // BACKGROUND UPDATER: Add Sunset/Sunrise gradients
  const getRefinedBackground = () => {
    if(!weatherData) return "from-slate-900 via-slate-900 to-indigo-950";
    const { is_day, weather_code } = weatherData.current;
    
    // Check if it's sunrise or sunset time (within 45 mins)
    // We need to parse API strings which are local to the location
    if (weatherData.daily && weatherData.daily.sunrise && weatherData.daily.sunset) {
        const sunrise = new Date(weatherData.daily.sunrise[0]).getTime();
        const sunset = new Date(weatherData.daily.sunset[0]).getTime();
        const nowMs = shiftedNow.getTime(); // Use shifted now to match location time
        
        const hourMs = 45 * 60 * 1000;
        if (Math.abs(nowMs - sunrise) < hourMs) return "from-indigo-900 via-purple-800 to-orange-400"; // Sunrise
        if (Math.abs(nowMs - sunset) < hourMs) return "from-blue-900 via-purple-900 to-orange-500"; // Sunset
    }
    
    return getDynamicBackground(weather_code, is_day);
  };

  // --- NOU ALGORTIME DE GENERACIÓ DE TEXT MÉS HUMÀ ---
  const generateAIPrediction = (current, daily, hourly, aqiValue, language = 'ca', forcedCode = null) => {
    const tr = TRANSLATIONS[language];
    const feelsLike = current.apparent_temperature;
    const temp = current.temperature_2m;
    const humidity = current.relative_humidity_2m;
    const rainProb = daily.precipitation_probability_max[0];
    const snowSum = daily.snowfall_sum && daily.snowfall_sum[0];
    const precipSum = daily.precipitation_sum && daily.precipitation_sum[0];
    const windSpeed = current.wind_speed_10m;
    const code = forcedCode !== null ? forcedCode : current.weather_code;
    const maxTemp = daily.temperature_2m_max[0];
    const minTemp = daily.temperature_2m_min[0];
    const precip15 = current.minutely15 ? current.minutely15.slice(0, 4).reduce((a, b) => a + b, 0) : 0;
    const uvMax = daily.uv_index_max[0];
    const isDay = current.is_day;
    
    let summaryParts = [];
    let tips = [];
    let alerts = []; 
    let confidenceText = tr.aiConfidence;
    let confidenceLevel = 'high';

    // 1. INTRODUCCIÓ DINÀMICA
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) summaryParts.push(tr.aiIntroMorning);
    else if (hour >= 12 && hour < 19) summaryParts.push(tr.aiIntroAfternoon);
    else if (hour >= 19 && hour < 22) summaryParts.push(tr.aiIntroEvening);
    else summaryParts.push(tr.aiIntroNight);

    // 2. DESCRIPCIÓ GENERAL BASADA EN 3 MODELS (SIMULADA PER BEST_MATCH)
    if (code >= 95) summaryParts.push(tr.aiSummaryStorm);
    else if (code >= 71) summaryParts.push(tr.aiSummarySnow);
    else if (code >= 51 || precip15 > 0) summaryParts.push(tr.aiSummaryRain);
    else if (code <= 2) summaryParts.push(tr.aiSummaryClear);
    else summaryParts.push(tr.aiSummaryCloudy);

    // 3. ANÀLISI DE SENSACIÓ MILLORADA (ABSOLUTA + RELATIVA)
    const diff = feelsLike - temp;
    
    if (windSpeed > 20) {
        summaryParts.push(tr.aiWindMod);
    } 
    
    // Noves categories tèrmiques basades en temperatura absoluta i sensació
    if (feelsLike <= 0) summaryParts.push(tr.aiTempFreezing);
    else if (feelsLike > 0 && feelsLike < 10) summaryParts.push(tr.aiTempCold);
    else if (feelsLike >= 10 && feelsLike < 18) {
         // Ni fred ni calor, transició
    }
    else if (feelsLike >= 18 && feelsLike < 25) summaryParts.push(tr.aiTempMild);
    else if (feelsLike >= 25 && feelsLike < 32) summaryParts.push(tr.aiTempWarm);
    else if (feelsLike >= 32) summaryParts.push(tr.aiTempHot);

    // Xafogor check
    if (temp > 25 && humidity > 65) {
       summaryParts.push(language === 'ca' ? `Xafogor acusada, sensació real de ${Math.round(feelsLike)}°C. ` : language === 'es' ? `Boichorno notable, sensación de ${Math.round(feelsLike)}°C. ` : "");
    }

    // 4. PREVISIÓ DE PLUJA IMMEDIATA (RADAR)
    if (precip15 > 0.1) summaryParts.push(tr.aiRainExp);
    else if (rainProb < 20 && code < 50) summaryParts.push(tr.aiRainNone);

    // 5. ALERTS & CONSEJOS COMPLEXOS
    if (windSpeed > 40) {
      alerts.push({ type: tr.wind, msg: tr.alertWindHigh, level: 'warning' });
      tips.push(tr.tipWindbreaker);
    }
    
    if (temp < 5) {
      if (windSpeed > 10) tips.push(tr.tipCoat, tr.tipThermal); // Fred i vent
      else tips.push(tr.tipLayers);
    } else if (temp > 30) {
      tips.push(tr.tipHydration, tr.tipSunscreen);
    }

    if (rainProb > 40 || precip15 > 0) tips.push(tr.tipUmbrella);
    
    if (uvMax > 7 && isDay) tips.push(tr.tipSunscreen);

    // Confidence Logic
    if (code >= 80 || (rainProb > 40 && rainProb < 70)) {
        confidenceLevel = 'medium';
        confidenceText = tr.aiConfidenceMod;
    }

    // Default tips
    if (tips.length === 0) tips.push(tr.tipCalm);
    tips = [...new Set(tips)].slice(0, 4);

    return { text: summaryParts.join(""), tips, confidence: confidenceText, confidenceLevel, alerts };
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 2 && showSuggestions) {
        try {
          const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=${getLangCodeForAPI(lang)}&format=json`);
          const data = await res.json();
          setSuggestions(data.results || []);
          setActiveSuggestionIndex(-1); 
        } catch (e) { console.error(e); }
      } else if (query.length === 0) {
         setSuggestions(favorites);
         setActiveSuggestionIndex(-1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, showSuggestions, favorites, lang]);

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    const list = query.length === 0 ? favorites : suggestions;
    if (list.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSuggestionIndex(prev => (prev < list.length - 1 ? prev + 1 : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : list.length - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < list.length) {
        const item = list[activeSuggestionIndex];
        fetchWeatherByCoords(item.latitude, item.longitude, item.name, item.country);
        inputRef.current?.blur();
      }
    } else if (e.key === 'Escape') { setShowSuggestions(false); }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&accept-language=${lang}`);
            const data = await response.json();
            const locationName = data.address.city || data.address.town || data.address.village || data.address.municipality || "Ubicació";
            const locationCountry = data.address.country || "";
            fetchWeatherByCoords(latitude, longitude, locationName, locationCountry);
          } catch (err) {
            console.error("Error reverse geocoding:", err);
            fetchWeatherByCoords(latitude, longitude, "Ubicació Detectada");
          }
        },
        (error) => { setError("No s'ha pogut obtenir la ubicació."); setLoading(false); }
      );
    } else { setError("Geolocalització no suportada."); }
  };

  // NORMALIZE MULTI-MODEL DATA helper
  const normalizeModelData = (data) => {
     // If we request multiple models, Open-Meteo suffixes variables with model name
     // e.g. temperature_2m_best_match, temperature_2m_ecmwf_ifs4
     // We want to extract 'best_match' (or standard) as main, and others as comparison
     
     const result = { current: {}, hourly: {}, daily: {}, hourlyComparison: { gfs: [], icon: [] } };
     
     // 1. Process Current (Usually straightforward or just Best Match)
     Object.keys(data.current).forEach(key => {
        if (key.endsWith('_best_match') || key.endsWith('_ecmwf_ifs4')) {
           result.current[key.replace(/_best_match|_ecmwf_ifs4/g, '')] = data.current[key];
        } else if (!key.includes('_gfs_seamless') && !key.includes('_icon_seamless')) {
           result.current[key] = data.current[key];
        }
     });

     // 2. Process Daily (Same logic)
     Object.keys(data.daily).forEach(key => {
        if (key.endsWith('_best_match') || key.endsWith('_ecmwf_ifs4')) {
           result.daily[key.replace(/_best_match|_ecmwf_ifs4/g, '')] = data.daily[key];
        } else if (!key.includes('_gfs_seamless') && !key.includes('_icon_seamless')) {
           result.daily[key] = data.daily[key];
        }
     });

     // 3. Process Hourly & Build Comparison
     // Initialize arrays
     const gfsHourly = [];
     const iconHourly = [];
     const len = data.hourly.time.length;
     
     for (let i = 0; i < len; i++) {
        gfsHourly.push({});
        iconHourly.push({});
     }

     Object.keys(data.hourly).forEach(key => {
        const val = data.hourly[key];
        
        // MAIN DATA (Best Match / ECMWF)
        if (key.endsWith('_best_match') || key.endsWith('_ecmwf_ifs4')) {
           result.hourly[key.replace(/_best_match|_ecmwf_ifs4/g, '')] = val;
        } 
        // METADATA
        else if (key === 'time' || key === 'is_day') {
           result.hourly[key] = val;
        }
        // GFS
        else if (key.includes('_gfs_seamless')) {
           const cleanKey = key.replace('_gfs_seamless', '');
           val.forEach((v, i) => gfsHourly[i][cleanKey] = v);
        }
        // ICON
        else if (key.includes('_icon_seamless')) {
            const cleanKey = key.replace('_icon_seamless', '');
            val.forEach((v, i) => iconHourly[i][cleanKey] = v);
        }
     });

     result.hourlyComparison.gfs = gfsHourly;
     result.hourlyComparison.icon = iconHourly;
     
     // Fallback if strict suffixing wasn't present (e.g. standard request)
     if (Object.keys(result.current).length === 0) return data;
     
     return { ...data, ...result };
  };

  const fetchWeatherByCoords = async (lat, lon, name, country = "") => {
    setLoading(true);
    setError(null);
    setAiAnalysis(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setQuery(""); 
    
    try {
      // REQUEST ALL 3 MAJOR MODELS: ECMWF (Best Match default), GFS, ICON
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,wind_gusts_10m,precipitation&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,relative_humidity_2m,wind_gusts_10m,uv_index,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max,precipitation_sum,snowfall_sum,sunrise,sunset&timezone=auto&models=best_match,gfs_seamless,icon_seamless&minutely_15=precipitation,weather_code`;
      
      const [weatherRes, aqiRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen`)
      ]);
      
      if (!weatherRes.ok) throw new Error(`Error satèl·lit: ${weatherRes.status}`);
      const rawWeatherData = await weatherRes.json();
      const aqiData = await aqiRes.json();
      
      // NORMALIZE DATA FOR APP CONSUMPTION
      const processedWeatherData = normalizeModelData(rawWeatherData);

      setWeatherData({ ...processedWeatherData, location: { name, country, latitude: lat, longitude: lon } });
      setAqiData(aqiData);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error desconegut");
    } finally { setLoading(false); }
  };
  

  // CALCULAR 'ARA' SHIFTED (Desplaçament temporal)
  // Ara depèn de 'now', que canvia cada minut
  const shiftedNow = useMemo(() => {
    if (!weatherData) return now;
    const timezone = weatherData.timezone || 'UTC';
    return getShiftedDate(now, timezone);
  }, [weatherData, now]);

  // DADES DE PRECISIÓ (Next Hour)
  // Busquem les dades minutely que corresponen a "Ara"
  const minutelyPreciseData = useMemo(() => {
    // GUARD ADDED: Prevent slice error if minutely_15 or precipitation is missing
    if (!weatherData || !weatherData.minutely_15 || !weatherData.minutely_15.precipitation) return [];
    
    // Convertim l'hora actual (shifted) a timestamp per buscar
    const currentMs = shiftedNow.getTime();
    
    const times = weatherData.minutely_15.time.map(t => new Date(t).getTime());
    let idx = times.findIndex(t => t > currentMs);
    let currentIdx = (idx === -1) ? times.length - 1 : Math.max(0, idx - 1);
    
    // Return slice starting from current interval
    return weatherData.minutely_15.precipitation.slice(currentIdx, currentIdx + 4);
  }, [weatherData, shiftedNow]);

  // MODIFICACIÓ CLAU: CÀLCUL DEL CODI EFECTIU (SMART DETECTION)
  const effectiveWeatherCode = useMemo(() => {
    if (!weatherData) return 0;
    
    const currentCode = weatherData.current.weather_code;
    const currentPrecip = weatherData.current.precipitation;
    
    // 1. Minutely Radar (Immediate)
    const immediateRain = minutelyPreciseData && minutelyPreciseData.length > 0 ? minutelyPreciseData[0] : 0;
    
    // 2. Hourly Probability Check (Look at current hour slot)
    let hourlyRainProb = 0;
    let hourlyPrecip = 0;
    const nowMs = shiftedNow.getTime();
    
    // Find the hour slot we are currently in
    const hourIdx = weatherData.hourly.time.findIndex(t => {
        const tMs = new Date(t).getTime();
        return tMs <= nowMs && (tMs + 3600000) > nowMs;
    });

    if (hourIdx !== -1) {
        hourlyRainProb = weatherData.hourly.precipitation_probability[hourIdx] || 0;
        hourlyPrecip = weatherData.hourly.precipitation[hourIdx] || 0;
    }

    const hasRainData = currentPrecip > 0 || immediateRain > 0 || hourlyPrecip > 0.1;
    const highRainRisk = hourlyRainProb >= 45; // Baixem umbral per ser més sensibles (usuari vol "afinar")

    if ((hasRainData || highRainRisk) && currentCode < 50) {
        if (hourlyPrecip > 2 || immediateRain > 1) return 63; // Moderate
        return 61; // Slight rain fallback
    }
    
    return currentCode;
  }, [weatherData, minutelyPreciseData, shiftedNow]);

  // UPDATE AI WHEN EFFECTIVE CODE CHANGES
  useEffect(() => {
     if(weatherData && aqiData) {
         const currentWithMinutely = { ...weatherData.current, minutely15: weatherData.minutely_15?.precipitation };
         // Pass effectiveWeatherCode to generate description based on "Rain" not "Cloudy"
         const analysis = generateAIPrediction(currentWithMinutely, weatherData.daily, weatherData.hourly, aqiData?.current?.european_aqi || 0, lang, effectiveWeatherCode);
         setAiAnalysis(analysis);
     }
  }, [lang, weatherData, aqiData, effectiveWeatherCode]);


  const chartData = useMemo(() => {
    // GUARD ADDED: Prevent slice error if hourly data is incomplete
    if (!weatherData || !weatherData.hourly || !weatherData.hourly.temperature_2m || !weatherData.hourly.time) return [];
    
    // Utilitzem l'hora desplaçada (local del lloc) per saber on comença la gràfica
    const nowLocalHour = shiftedNow.getHours();
    
    // Busquem l'índex que correspon a l'hora actual (o la següent) a la llista horària
    const nowTime = shiftedNow.getTime();
    
    const idx = weatherData.hourly.time.findIndex(t => new Date(t).getTime() >= nowTime);
    let startIndex = 0;
    if (idx !== -1) startIndex = Math.max(0, idx);
    const endIndex = startIndex + 24;

    const mainData = weatherData.hourly.temperature_2m.slice(startIndex, endIndex).map((temp, i) => ({
      temp: unit === 'F' ? Math.round((temp * 9/5) + 32) : temp,
      apparent: unit === 'F' ? Math.round((weatherData.hourly.apparent_temperature[startIndex + i] * 9/5) + 32) : weatherData.hourly.apparent_temperature[startIndex + i],
      rain: weatherData.hourly.precipitation_probability[startIndex + i],
      precip: weatherData.hourly.precipitation[startIndex + i], 
      wind: weatherData.hourly.wind_speed_10m[startIndex + i],
      gusts: weatherData.hourly.wind_gusts_10m[startIndex + i],
      windDir: weatherData.hourly.wind_direction_10m[startIndex + i], 
      cloud: weatherData.hourly.cloud_cover[startIndex + i],
      humidity: weatherData.hourly.relative_humidity_2m[startIndex + i], 
      uv: weatherData.hourly.uv_index[startIndex + i],
      isDay: weatherData.hourly.is_day[startIndex + i],
      time: weatherData.hourly.time[startIndex + i],
      code: weatherData.hourly.weather_code[startIndex + i]
    }));

    return mainData;
  }, [weatherData, unit, shiftedNow]);

  // PREPARE COMPARISON DATA SLICES
  const comparisonData = useMemo(() => {
      if (!weatherData || !weatherData.hourlyComparison) return null;
      
      const nowTime = shiftedNow.getTime();
      const idx = weatherData.hourly.time.findIndex(t => new Date(t).getTime() >= nowTime);
      let startIndex = 0;
      if (idx !== -1) startIndex = Math.max(0, idx);
      const endIndex = startIndex + 24;

      const sliceModel = (modelData) => {
         if(!modelData) return [];
         return modelData.slice(startIndex, endIndex).map((d, i) => ({
             temp: unit === 'F' ? Math.round((d.temperature_2m * 9/5) + 32) : d.temperature_2m,
             rain: d.precipitation_probability,
             wind: d.wind_speed_10m,
             cloud: d.cloud_cover,
             humidity: d.relative_humidity_2m,
             time: weatherData.hourly.time[startIndex + i]
         }));
      };

      return {
          gfs: sliceModel(weatherData.hourlyComparison.gfs),
          icon: sliceModel(weatherData.hourlyComparison.icon)
      };

  }, [weatherData, unit, shiftedNow]);

  const weeklyExtremes = useMemo(() => {
    if(!weatherData) return { min: 0, max: 100 };
    return {
      min: Math.min(...weatherData.daily.temperature_2m_min),
      max: Math.max(...weatherData.daily.temperature_2m_max)
    };
  }, [weatherData]);
  
  // NOU CÀLCUL: Probabilitat de pluja actual (no màxima diària)
  const currentRainProbability = useMemo(() => {
     if (!weatherData || !weatherData.hourly) return 0;
     const nowMs = shiftedNow.getTime();
     const hourIdx = weatherData.hourly.time.findIndex(t => {
        const tMs = new Date(t).getTime();
        return tMs <= nowMs && (tMs + 3600000) > nowMs;
     });
     return hourIdx !== -1 ? weatherData.hourly.precipitation_probability[hourIdx] : 0;
  }, [weatherData, shiftedNow]);

  useEffect(() => {
    function handleClickOutside(event) { if (searchRef.current && !searchRef.current.contains(event.target)) setShowSuggestions(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const cycleLang = () => {
      const langs = ['ca', 'es', 'en', 'fr'];
      const currentIdx = langs.indexOf(lang);
      setLang(langs[(currentIdx + 1) % langs.length]);
  };
  
  const toggleViewMode = () => {
    setViewMode(prev => prev === 'basic' ? 'expert' : 'basic');
  };

  const DayDetailModal = () => {
    // GUARD ADDED: Prevent crash if hourly data is missing
    if (selectedDayIndex === null || !weatherData || !weatherData.hourly || !weatherData.hourly.temperature_2m) return null;
    
    const dayIdx = selectedDayIndex;
    const dateStr = weatherData.daily.time[dayIdx];

    const startHour = dayIdx * 24;
    const endHour = startHour + 24;
    
    const dayHourlyData = weatherData.hourly.temperature_2m.slice(startHour, endHour).map((temp, i) => ({
      temp: unit === 'F' ? Math.round((temp * 9/5) + 32) : temp,
      apparent: unit === 'F' ? Math.round((weatherData.hourly.apparent_temperature[startHour + i] * 9/5) + 32) : weatherData.hourly.apparent_temperature[startHour + i],
      rain: weatherData.hourly.precipitation_probability[startHour + i],
      precip: weatherData.hourly.precipitation[startHour + i], 
      wind: weatherData.hourly.wind_speed_10m[startHour + i],
      windDir: weatherData.hourly.wind_direction_10m[startHour + i],
      cloud: weatherData.hourly.cloud_cover[startHour + i],
      humidity: weatherData.hourly.relative_humidity_2m[startHour + i],
      uv: weatherData.hourly.uv_index[startHour + i],
      time: weatherData.hourly.time[startHour + i],
      isDay: weatherData.hourly.is_day[startHour + i],
      code: weatherData.hourly.weather_code[startHour + i]
    }));

    // --- NEW: Calculate Comparison Data for Modal ---
    const dayComparisonData = useMemo(() => {
        if (!weatherData.hourlyComparison) return null;

        const sliceModel = (modelData) => {
            if (!modelData) return [];
            return modelData.slice(startHour, endHour).map((d, i) => ({
                temp: unit === 'F' ? Math.round((d.temperature_2m * 9/5) + 32) : d.temperature_2m,
                rain: d.precipitation_probability,
                wind: d.wind_speed_10m,
                cloud: d.cloud_cover,
                humidity: d.relative_humidity_2m,
                time: weatherData.hourly.time[startHour + i]
            }));
        };

        return {
            gfs: sliceModel(weatherData.hourlyComparison.gfs),
            icon: sliceModel(weatherData.hourlyComparison.icon)
        };
    }, [weatherData, startHour, endHour, unit]);
    
    const isTodaySnow = isSnowCode(weatherData.daily.weather_code[dayIdx]);
    const precipSum = weatherData.daily.precipitation_sum[dayIdx];
    const snowSum = weatherData.daily.snowfall_sum[dayIdx];
    const uvIndex = weatherData.daily.uv_index_max[dayIdx];

    return (
      <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setSelectedDayIndex(null)}>
        <div 
          className="bg-slate-900 border-t md:border border-slate-700 w-full max-w-2xl rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="md:hidden w-full flex justify-center pt-3 pb-1">
             <div className="w-12 h-1.5 bg-slate-700 rounded-full"></div>
          </div>

          <div className="bg-slate-800/50 p-6 flex justify-between items-center border-b border-slate-700 sticky top-0 backdrop-blur-md z-20">
            <div>
              <h3 className="text-xl font-bold text-white capitalize">
                {formatDate(dateStr, { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <p className="text-xs text-slate-400">{t.detailedForecast}</p>
            </div>
            <button onClick={() => setSelectedDayIndex(null)} className="p-2 hover:bg-slate-700 rounded-full text-white transition-colors">
              <X className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Conditional Hourly Chart in Modal - PASS COMPARISON DATA IF EXPERT */}
            {viewMode === 'expert' && (
              <div className="bg-slate-950/30 rounded-2xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                     <Clock className="w-4 h-4 text-indigo-400 drop-shadow-sm fill-indigo-400/20" strokeWidth={2.5}/> {t.hourlyEvolution}
                   </div>
                </div>
                {/* UPDATED: Pass dayComparisonData */}
                <HourlyForecastChart data={dayHourlyData} comparisonData={dayComparisonData} unit={getUnitLabel()} lang={lang} shiftedNow={shiftedNow} />
              </div>
            )}
            
            {viewMode === 'basic' && (
               <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                  {dayHourlyData.filter((_, i) => i % 3 === 0).map((h, i) => (
                     <div key={i} className="flex flex-col items-center min-w-[3rem]">
                        <span className="text-xs text-slate-400">{new Date(h.time).getHours()}h</span>
                        <div className="my-1 scale-75">{getWeatherIcon(h.code, "w-6 h-6", h.isDay, h.rain)}</div>
                        <span className="text-sm font-bold">{Math.round(h.temp)}°</span>
                        {/* ADDED RAIN INFO */}
                        <div className="flex flex-col items-center mt-1 h-6 justify-start">
                           {h.rain > 0 && <span className="text-[10px] text-blue-400 font-bold">{h.rain}%</span>}
                           {h.precip > 0 && <span className="text-[9px] text-cyan-400">{h.precip}mm</span>}
                        </div>
                     </div>
                  ))}
               </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {snowSum > 0 ? (
                 <DetailStat label={t.snowAccumulated} value={`${snowSum} cm`} icon={<CloudSnow className="w-4 h-4 text-cyan-200 drop-shadow-sm fill-cyan-200/20" strokeWidth={2.5}/>} />
              ) : precipSum > 0 ? (
                 <DetailStat label={t.totalPrecipitation} value={`${Math.round(precipSum)} mm`} icon={<Umbrella className="w-4 h-4 text-blue-400 drop-shadow-sm fill-blue-400/20" strokeWidth={2.5}/>} />
              ) : (
                 <DetailStat label={t.rainProb} value={`${weatherData.daily.precipitation_probability_max[dayIdx]}%`} icon={<Umbrella className="w-4 h-4 text-blue-400 drop-shadow-sm fill-blue-400/20" strokeWidth={2.5}/>} />
              )}
              
              <DetailStat label={t.windMax} value={`${weatherData.daily.wind_speed_10m_max[dayIdx]} km/h`} icon={<Wind className="w-4 h-4 text-teal-400 drop-shadow-sm fill-teal-400/20" strokeWidth={2.5}/>} />
              
              {/* UV Visual Bar */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col items-center hover:border-slate-600 transition-colors">
                 <div className="text-slate-400 text-xs mb-2 flex items-center gap-1.5 font-medium uppercase tracking-wide"><Sun className="w-4 h-4 text-amber-400 drop-shadow-sm fill-amber-400/20" strokeWidth={2.5}/> {t.uvIndex}</div>
                 <div className="font-bold text-white text-lg">{uvIndex}</div>
                 <div className="w-full h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden flex">
                    <div className={`h-full ${uvIndex <= 2 ? 'bg-green-400' : uvIndex <= 5 ? 'bg-yellow-400' : uvIndex <= 7 ? 'bg-orange-400' : uvIndex <= 10 ? 'bg-red-500' : 'bg-purple-500'}`} style={{width: `${Math.min((uvIndex/11)*100, 100)}%`}}></div>
                 </div>
                 <div className="text-[9px] text-slate-500 mt-1 uppercase font-bold">
                    {uvIndex <= 2 ? t.uvLow : uvIndex <= 5 ? t.uvMod : uvIndex <= 7 ? t.uvHigh : uvIndex <= 10 ? t.uvVeryHigh : t.uvExtreme}
                 </div>
              </div>

              <DetailStat label={t.tempMin} value={`${formatTemp(weatherData.daily.temperature_2m_min[dayIdx])}${getUnitLabel()}`} icon={<Activity className="w-4 h-4 text-indigo-400 drop-shadow-sm fill-indigo-400/20" strokeWidth={2.5}/>} />
              <DetailStat label={t.sunrise} value={formatTime(weatherData.daily.sunrise[dayIdx])} icon={<Sunrise className="w-4 h-4 text-orange-400 drop-shadow-sm fill-orange-400/20" strokeWidth={2.5}/>} />
              <DetailStat label={t.sunset} value={formatTime(weatherData.daily.sunset[dayIdx])} icon={<Sunset className="w-4 h-4 text-purple-400 drop-shadow-sm fill-purple-400/20" strokeWidth={2.5}/>} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const currentBg = getRefinedBackground();

  const isTodaySnow = weatherData && (isSnowCode(weatherData.current.weather_code) || (weatherData.daily.snowfall_sum && weatherData.daily.snowfall_sum[0] > 0));

  // --- SAFE DATA RESOLUTION FOR WIDGET ---
  const moonPhaseVal = getMoonPhase(new Date());
  
  return (
    <div className={`min-h-screen bg-gradient-to-br ${currentBg} text-slate-100 font-sans p-4 md:p-6 transition-all duration-1000 selection:bg-indigo-500 selection:text-white`}>
      {/* WEATHER PARTICLES EFFECT - Use Effective Code */}
      {weatherData && <WeatherParticles code={effectiveWeatherCode} />}

      <div className="max-w-5xl mx-auto space-y-6 pb-20 md:pb-0 relative z-10">
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/10 backdrop-blur-md flex flex-col md:flex-row gap-4 items-center justify-between sticky top-2 z-50 shadow-xl">
          <div className="flex items-center gap-3 select-none w-full md:w-auto justify-between md:justify-start">
             <div className="flex items-center gap-3">
               <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20 animate-[pulse_4s_ease-in-out_infinite]">
                 <BrainCircuit className="w-6 h-6 text-white" strokeWidth={2}/>
               </div>
               <span className="font-bold text-xl tracking-tight">Meteo Toni <span className="text-indigo-400">Ai</span></span>
             </div>
             
             {/* Mobile Controls */}
             <div className="md:hidden flex gap-2">
                 <button 
                      onClick={toggleViewMode}
                      className={`border border-slate-700/50 text-indigo-300 font-bold p-2 rounded-lg w-10 h-10 flex items-center justify-center transition-all ${viewMode === 'expert' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800/50'}`}
                   >
                     {viewMode === 'expert' ? <LayoutDashboard className="w-5 h-5"/> : <LayoutTemplate className="w-5 h-5"/>}
                 </button>
                 <button 
                      onClick={() => setUnit(unit === 'C' ? 'F' : 'C')}
                      className="bg-slate-800/50 border border-slate-700/50 text-indigo-300 font-bold p-2 rounded-lg w-10 h-10 flex items-center justify-center"
                   >
                     {unit === 'C' ? '°C' : '°F'}
                 </button>
                 <button 
                      onClick={cycleLang}
                      className="bg-slate-800/50 border border-slate-700/50 text-indigo-300 font-bold p-2 rounded-lg w-10 h-10 flex items-center justify-center uppercase text-xs"
                      title="Canviar idioma"
                   >
                     <FlagIcon lang={lang} className="w-5 h-4 rounded shadow-sm" />
                 </button>
             </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto items-center" ref={searchRef}>
             {/* Desktop Controls */}
             <button 
                onClick={toggleViewMode}
                className={`hidden md:flex border border-slate-700/50 text-indigo-300 font-bold px-4 py-3 rounded-xl hover:text-white transition-all items-center gap-2 shadow-lg ${viewMode === 'expert' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950/50 hover:bg-slate-800'}`}
                title="Canviar mode de vista"
             >
               {viewMode === 'expert' ? <LayoutDashboard className="w-5 h-5"/> : <LayoutTemplate className="w-5 h-5"/>}
               <span className="text-xs uppercase font-bold tracking-wider">{viewMode === 'expert' ? t.modeExpert : t.modeBasic}</span>
             </button>

             <button 
                onClick={cycleLang}
                className="hidden md:flex bg-slate-950/50 border border-slate-700/50 text-indigo-300 font-bold p-3 rounded-xl hover:bg-indigo-500 hover:text-white hover:border-indigo-400 transition-all w-12 h-12 items-center justify-center shrink-0 shadow-lg uppercase"
                title="Canviar idioma"
             >
               <FlagIcon lang={lang} className="w-6 h-4 rounded shadow-sm" />
             </button>

             <button 
                onClick={() => setUnit(unit === 'C' ? 'F' : 'C')}
                className="hidden md:flex bg-slate-950/50 border border-slate-700/50 text-indigo-300 font-bold p-3 rounded-xl hover:bg-indigo-500 hover:text-white hover:border-indigo-400 transition-all w-12 h-12 items-center justify-center shrink-0 shadow-lg"
                title="Canviar unitats"
             >
               {unit === 'C' ? '°C' : '°F'}
             </button>

             <div className="relative flex-1 md:w-80">
               <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
               <input 
                 ref={inputRef}
                 type="text" 
                 placeholder={t.searchPlaceholder} 
                 value={query}
                 onFocus={() => setShowSuggestions(true)}
                 onChange={(e) => {setQuery(e.target.value); setShowSuggestions(true);}}
                 onKeyDown={handleKeyDown}
                 className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-500 transition-all shadow-inner touch-manipulation"
               />
               
               {showSuggestions && (
                 <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[60vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                   {suggestions.length === 0 && query.length === 0 && favorites.length > 0 && (
                     <div className="px-4 py-2 text-xs font-bold text-indigo-400 uppercase tracking-wider bg-slate-950/80 sticky top-0 backdrop-blur-sm">{t.favorites}</div>
                   )}
                   {(query.length === 0 ? favorites : suggestions).map((item, i) => (
                     <div
                       key={i}
                       className={`group w-full px-4 py-4 md:py-3 flex items-center justify-between border-b border-white/5 last:border-0 cursor-pointer transition-colors active:bg-white/10 ${i === activeSuggestionIndex ? 'bg-indigo-600/20 border-l-4 border-l-indigo-500' : 'hover:bg-white/5'}`}
                       onClick={() => fetchWeatherByCoords(item.latitude, item.longitude, item.name, item.country)}
                     >
                       <div className="flex items-center gap-3">
                         {query.length === 0 ? <Star className="w-5 h-5 text-amber-400 fill-amber-400"/> : <MapPin className="w-5 h-5 text-slate-500"/>}
                         <div className="flex flex-col text-left">
                            <span className="text-base md:text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{item.name}</span>
                            <span className="text-xs text-slate-500">{item.country || item.admin1}</span>
                         </div>
                       </div>
                       
                       {query.length === 0 ? (
                         <button 
                            onClick={(e) => removeFavorite(e, item.name)}
                            className="p-3 md:p-2 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-all md:opacity-0 group-hover:opacity-100 focus:opacity-100 touch-manipulation"
                            aria-label="Eliminar favorit"
                         >
                           <Trash2 className="w-5 h-5"/>
                         </button>
                       ) : (
                         i === activeSuggestionIndex && <ArrowRight className="w-4 h-4 text-indigo-400 animate-pulse"/>
                       )}
                     </div>
                   ))}
                 </div>
               )}
             </div>
             <button onClick={handleGetCurrentLocation} className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition-colors shadow-lg shadow-indigo-900/20 active:scale-95 touch-manipulation" title="Utilitza la meva ubicació">
                <LocateFixed className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* LOADING */}
        {loading && (
           <div className="animate-pulse space-y-6">
             <div className="h-64 bg-slate-800/50 rounded-[2.5rem] w-full"></div>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="grid grid-cols-2 gap-4 h-48"> {[1,2,3,4].map(i => <div key={i} className="bg-slate-800/50 rounded-2xl h-full"></div>)} </div><div className="lg:col-span-2 bg-slate-800/50 rounded-3xl h-48"></div></div>
           </div>
        )}

        {error && !loading && (
           <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-6 rounded-2xl flex items-center justify-center gap-3 animate-in shake">
             <AlertTriangle className="w-6 h-6"/> <span className="font-medium">{error}</span>
           </div>
        )}

        {!weatherData && !loading && !error && (
           <div className="text-center py-20 md:py-32 animate-in fade-in slide-in-from-bottom-4 px-4">
              <div className="inline-flex p-6 rounded-full bg-indigo-500/10 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                <CloudSun className="w-16 h-16 text-indigo-400 animate-pulse" strokeWidth={1.5} />
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">Meteo Toni AI</h2>
              <p className="text-slate-400 max-w-md mx-auto">{t.subtitle}</p>
              <div className="flex flex-wrap gap-3 justify-center mt-8 px-2">
                 <button onClick={() => setLang('ca')} className={`px-3 py-2 md:px-4 md:py-2 text-sm md:text-base rounded-full border flex items-center gap-2 transition-all ${lang === 'ca' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg scale-105' : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                    <FlagIcon lang="ca" className="w-4 h-3 md:w-5 md:h-4 rounded shadow-sm" /> Català
                 </button>
                 <button onClick={() => setLang('es')} className={`px-3 py-2 md:px-4 md:py-2 text-sm md:text-base rounded-full border flex items-center gap-2 transition-all ${lang === 'es' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg scale-105' : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                    <FlagIcon lang="es" className="w-4 h-3 md:w-5 md:h-4 rounded shadow-sm" /> Español
                 </button>
                 <button onClick={() => setLang('en')} className={`px-3 py-2 md:px-4 md:py-2 text-sm md:text-base rounded-full border flex items-center gap-2 transition-all ${lang === 'en' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg scale-105' : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                    <FlagIcon lang="en" className="w-4 h-3 md:w-5 md:h-4 rounded shadow-sm" /> English
                 </button>
                 <button onClick={() => setLang('fr')} className={`px-3 py-2 md:px-4 md:py-2 text-sm md:text-base rounded-full border flex items-center gap-2 transition-all ${lang === 'fr' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg scale-105' : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                    <FlagIcon lang="fr" className="w-4 h-3 md:w-5 md:h-4 rounded shadow-sm" /> Français
                 </button>
              </div>
           </div>
        )}

        {/* MAIN DASHBOARD */}
        {!loading && weatherData && (
          <div className="animate-in slide-in-from-bottom-8 duration-700 space-y-6">
            
            {/* ALERT BANNERS SYSTEM (ALWAYS VISIBLE) */}
            {aiAnalysis?.alerts?.length > 0 && (
              <div className="space-y-3">
                {aiAnalysis.alerts.map((alert, i) => (
                  <div 
                    key={i} 
                    className={`${alert.level === 'high' ? 'bg-red-500/20 border-red-500/40 text-red-100' : 'bg-amber-500/20 border-amber-500/40 text-amber-100'} p-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-500 shadow-lg`}
                    style={{animationDelay: `${i*100}ms`}}
                  >
                    <div className={`p-2 rounded-full ${alert.level === 'high' ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                      {alert.type === t.storm && <CloudLightning className="w-6 h-6" strokeWidth={2.5}/>}
                      {alert.type === t.snow && <Snowflake className="w-6 h-6" strokeWidth={2.5}/>}
                      {alert.type === t.wind && <Wind className="w-6 h-6" strokeWidth={2.5}/>}
                      {alert.type === t.sun && <ThermometerSun className="w-6 h-6" strokeWidth={2.5}/>}
                      {alert.type === 'Fred' && <ThermometerSnowflake className="w-6 h-6" strokeWidth={2.5}/>}
                      {alert.type === t.rain && <CloudRain className="w-6 h-6" strokeWidth={2.5}/>}
                      {alert.type === t.aqi && <AlertOctagon className="w-6 h-6" strokeWidth={2.5}/>}
                      {!['Tempesta','Neu','Vent','Calor','Fred','Pluja','Qualitat Aire', t.storm, t.snow, t.wind, t.sun, t.rain, t.aqi].includes(alert.type) && <AlertTriangle className="w-6 h-6"/>}
                    </div>
                    
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold uppercase tracking-wider text-xs ${alert.level === 'high' ? 'text-red-400' : 'text-amber-400'} border ${alert.level === 'high' ? 'border-red-500/50' : 'border-amber-500/50'} px-2 py-0.5 rounded-md`}>
                           {alert.level === 'high' ? t.alertDanger : t.alertWarning}
                        </span>
                        <span className="font-bold text-sm">{alert.type}</span>
                      </div>
                      <span className="font-medium text-sm mt-1 opacity-90">{alert.msg}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TOP CARD (ALWAYS VISIBLE) */}
            <div className="bg-slate-900/40 border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 relative overflow-hidden backdrop-blur-md shadow-2xl group">
               <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/30 transition-colors duration-1000 animate-pulse"></div>

               <div className="relative z-10">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                   <div>
                     <div className="flex items-center gap-3">
                       <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tighter">{weatherData.location.name}</h2>
                       <button onClick={toggleFavorite} className="hover:scale-110 transition-transform p-1 active:scale-90">
                         <Star className={`w-7 h-7 transition-colors ${isCurrentFavorite ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-amber-300'}`} />
                       </button>
                     </div>
                     <div className="flex items-center gap-4 mt-2 text-sm text-indigo-200 font-medium">
                        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> {weatherData.location.country}</span>
                        <span className="w-1 h-1 bg-indigo-500 rounded-full"></span>
                        {/* CORRECTED: Removed timezone prop from display to avoid double shift */}
                        <span className="flex items-center gap-1.5 text-slate-400"><Clock className="w-3.5 h-3.5"/> {t.localTime}: {shiftedNow.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                        <span className="w-1 h-1 bg-indigo-500 rounded-full hidden md:block"></span>
                        <button onClick={() => fetchWeatherByCoords(weatherData.location.latitude, weatherData.location.longitude, weatherData.location.name, weatherData.location.country)} className="flex items-center gap-1.5 hover:text-white transition-colors active:opacity-70">
                          <RefreshCw className="w-3.5 h-3.5"/> <span className="hidden md:inline">{t.updatedNow}</span><span className="md:hidden">{t.now}</span>
                        </button>
                     </div>
                   </div>
                   <div className="flex flex-col items-end self-end md:self-auto">
                      <div className="filter drop-shadow-2xl md:hover:scale-110 transition-transform duration-500">
                         {/* USE EFFECTIVE WEATHER CODE HERE */}
                        {getWeatherIcon(effectiveWeatherCode, "w-16 h-16 md:w-24 md:h-24", weatherData.current.is_day)}
                      </div>
                      <span className="text-lg md:text-xl font-medium text-slate-200 mt-2">
                         {effectiveWeatherCode === 0 ? t.clear : isSnowCode(effectiveWeatherCode) ? t.snow : (effectiveWeatherCode < 4) ? t.cloudy : t.rainy}
                      </span>
                   </div>
                 </div>

                 <div className="flex flex-col lg:flex-row items-end gap-8 lg:gap-12">
                   <div className="flex items-start gap-2 w-full md:w-auto justify-between md:justify-start">
                      <span className="text-7xl md:text-9xl font-bold text-white leading-none tracking-tighter drop-shadow-2xl">
                        {formatTemp(weatherData.current.temperature_2m)}°
                      </span>
                      <div className="space-y-2 mt-2 md:mt-4">
                         <div className="flex items-center gap-3 text-indigo-100 font-bold bg-white/5 border border-white/5 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm backdrop-blur-md shadow-lg">
                           <span className="text-rose-300 flex items-center gap-1">↑ {formatTemp(weatherData.daily.temperature_2m_max[0])}°</span>
                           <span className="w-px h-3 bg-white/20"></span>
                           <span className="text-cyan-300 flex items-center gap-1">↓ {formatTemp(weatherData.daily.temperature_2m_min[0])}°</span>
                         </div>
                         <div className="text-xs text-center text-slate-400 font-medium">
                           {t.feelsLike} {formatTemp(weatherData.current.apparent_temperature)}°
                         </div>
                      </div>
                   </div>

                   {/* AI INSIGHTS CARD */}
                   <div className="flex-1 w-full bg-slate-950/30 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-inner relative overflow-hidden">
                     <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-2 text-xs font-bold uppercase text-indigo-300 tracking-wider">
                         <BrainCircuit className="w-4 h-4 animate-pulse" strokeWidth={2}/> {t.aiAnalysis}
                       </div>
                       
                       {/* FIX: Check aiAnalysis before accessing confidenceLevel */}
                       {aiAnalysis && (
                           <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              aiAnalysis.confidenceLevel === 'high' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
                              aiAnalysis.confidenceLevel === 'medium' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
                              'text-red-400 border-red-500/30 bg-red-500/10'
                           }`}>
                              {aiAnalysis.confidence}
                           </span>
                       )}
                     </div>
                     
                     {aiAnalysis ? (
                       <div className="space-y-4 animate-in fade-in">
                         <TypewriterText text={aiAnalysis.text} />
                         <div className="flex flex-wrap gap-2">
                           {aiAnalysis.tips.map((tip, i) => (
                             <span key={i} className="text-xs px-3 py-1.5 bg-indigo-500/20 text-indigo-100 rounded-lg border border-indigo-500/20 flex items-center gap-1.5 shadow-sm animate-in zoom-in duration-500" style={{animationDelay: `${i*150}ms`}}>
                               {tip.includes(t.tipThermal) || tip.includes('Jaqueta') ? <Shirt className="w-3.5 h-3.5 opacity-70" strokeWidth={2.5}/> : <AlertTriangle className="w-3.5 h-3.5 opacity-70"/>}
                               {tip}
                             </span>
                           ))}
                         </div>
                         
                         {/* GRÀFICA PRECISIÓ DE PLUJA */}
                         <MinutelyPreciseChart data={minutelyPreciseData} label={t.preciseRain} currentPrecip={weatherData.current.precipitation} />
                       </div>
                     ) : (
                       <div className="flex items-center gap-2 text-slate-500 text-sm animate-pulse min-h-[3em]">
                         <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div> {t.generatingTips}
                       </div>
                     )}
                   </div>
                 </div>
               </div>
            </div>

            {/* CONDITIONAL RENDER: EXPERT vs BASIC */}
            {viewMode === 'expert' && (
              <div className="animate-in slide-in-from-bottom-4 duration-500">
                {/* METRICS & HOURLY GRAPH ROW (EXPERT ONLY) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-3 md:gap-4 auto-rows-fr">
                     {/* 1. Compass Gauge (Wind Direction) */}
                     <div className="col-span-1">
                       <CompassGauge 
                          degrees={weatherData.current.wind_direction_10m} 
                          speed={weatherData.current.wind_speed_10m} 
                          label={t.wind}
                          lang={lang}
                       />
                     </div>
                     
                     {/* 2. Humidity Gauge (New) */}
                     <CircularGauge 
                        icon={<Droplets className="w-6 h-6" strokeWidth={2.5}/>} 
                        label={t.humidity} 
                        value={weatherData.current.relative_humidity_2m} 
                        max={100}
                        subText="%"
                        color="text-blue-400"
                     />
                     
                     {/* 3. Pressure (Reduced or same) */}
                     <CircularGauge 
                        icon={<Gauge className="w-6 h-6" strokeWidth={2.5}/>} 
                        label={t.pressure} 
                        value={Math.round(weatherData.current.pressure_msl)} 
                        max={1100} 
                        subText="hPa"
                        color="text-pink-400"
                     />
                     
                     {/* 4. Rain/Snow (ARA MOSTRA L'ACTUAL) */}
                     <CircularGauge 
                        icon={isTodaySnow ? <Snowflake className="w-6 h-6" strokeWidth={2.5}/> : <Umbrella className="w-6 h-6" strokeWidth={2.5}/>} 
                        label={isTodaySnow ? t.snow : t.rain} 
                        value={currentRainProbability} 
                        max={100}
                        subText="%"
                        color={isTodaySnow ? "text-cyan-300" : "text-indigo-400"}
                     />

                     {/* 5. Sun Arc Widget */}
                     <div className="col-span-2 md:col-span-2">
                        <SunArcWidget 
                          sunrise={weatherData.daily.sunrise[0]} 
                          sunset={weatherData.daily.sunset[0]} 
                          lang={lang}
                          shiftedNow={shiftedNow}
                        />
                     </div>

                     {/* 6. NEW Moon Widget with SIMPLIFIED REAL PHASE */}
                     <div className="col-span-2 md:col-span-2">
                        <MoonWidget 
                          phase={moonPhaseVal} 
                          lat={weatherData.location.latitude} 
                          lang={lang}
                        />
                     </div>
                     
                     {/* 7. Pollen Widget */}
                     <div className="col-span-2 md:col-span-2">
                        <PollenWidget data={aqiData?.current} lang={lang} />
                     </div>

                     {/* AQI GAUGE WITH TEXT */}
                     <div className="col-span-2 md:col-span-2">
                       <div className="bg-slate-900/60 border border-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm relative h-full min-h-[140px]">
                          <div className="absolute top-4 left-4 flex items-center gap-2 text-xs font-bold uppercase text-indigo-300 tracking-wider">
                             <Leaf className="w-3 h-3" strokeWidth={2.5}/> {t.aqi}
                          </div>
                          <div className="flex flex-col items-center justify-center mt-4">
                             <div className="text-4xl font-bold text-white mb-1">{aqiData?.current?.european_aqi || '--'}</div>
                             <div className={`text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-wide ${
                                (aqiData?.current?.european_aqi || 0) <= 20 ? 'text-green-400 border-green-500/30 bg-green-500/10' :
                                (aqiData?.current?.european_aqi || 0) <= 40 ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' :
                                (aqiData?.current?.european_aqi || 0) <= 60 ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
                                (aqiData?.current?.european_aqi || 0) <= 80 ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' :
                                'text-red-400 border-red-500/30 bg-red-500/10'
                             }`}>
                                {t.aqiLevels[Math.min(Math.floor((aqiData?.current?.european_aqi || 0) / 20), 5)]}
                             </div>
                          </div>
                       </div>
                     </div>
                  </div>

                  {/* HOURLY VISUAL CHART WITH TABS */}
                  <div className="lg:col-span-2 bg-slate-900/40 border border-white/10 rounded-3xl p-4 md:p-6 relative overflow-hidden backdrop-blur-sm flex flex-col shadow-xl">
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 z-10 gap-4">
                       <h3 className="font-bold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-400 drop-shadow-sm fill-indigo-400/20" strokeWidth={2.5}/> {t.trend24h}</h3>
                       {/* Badge Indicating Multi-Model */}
                       <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/20 rounded-full border border-indigo-500/30">
                          <GitGraph className="w-3 h-3 text-indigo-300" />
                          <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">{t.modeExpert} - 3 Models</span>
                       </div>
                     </div>
                     
                     <HourlyForecastChart data={chartData} comparisonData={comparisonData} unit={getUnitLabel()} lang={lang} shiftedNow={shiftedNow} />

                     <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                  </div>

                </div>
              </div>
            )}
            
            {/* BASIC MODE HOURLY (Simplified) */}
            {viewMode === 'basic' && (
               <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 backdrop-blur-sm shadow-xl mb-6">
                 <h3 className="font-bold text-white flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-400 drop-shadow-sm fill-indigo-400/20" strokeWidth={2.5}/> {t.hourlyEvolution} (24h)</h3>
                 <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                    {chartData.filter((_, i) => i % 3 === 0).map((h, i) => (
                       <div key={i} className="flex flex-col items-center min-w-[3rem]">
                          <span className="text-xs text-slate-400">{new Date(h.time).getHours()}h</span>
                          <div className="my-1 scale-75 filter drop-shadow-sm">{getWeatherIcon(h.code, "w-8 h-8", h.isDay, h.rain)}</div>
                          <span className="text-sm font-bold">{Math.round(h.temp)}°</span>
                          {/* ADDED RAIN INFO */}
                          <div className="flex flex-col items-center mt-1 h-6 justify-start">
                             {h.rain > 0 && <span className="text-[10px] text-blue-400 font-bold">{h.rain}%</span>}
                             {h.precip > 0 && <span className="text-[9px] text-cyan-400">{h.precip}mm</span>}
                          </div>
                       </div>
                    ))}
                 </div>
               </div>
            )}

            {/* 7 DAY FORECAST - LIST STYLE (ALWAYS VISIBLE) */}
            <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
               <h3 className="font-bold text-white mb-5 flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-400 drop-shadow-sm fill-amber-400/20" strokeWidth={2.5}/> {t.forecast7days}</h3>
               <div className="space-y-2">
                 {weatherData.daily.time.map((day, i) => {
                   const isDaySnow = isSnowCode(weatherData.daily.weather_code[i]);
                   const precipSum = weatherData.daily.precipitation_sum[i];
                   const snowSum = weatherData.daily.snowfall_sum[i];
                   const listMoonPhase = getMoonPhase(new Date(day));

                   return (
                     <button 
                       key={i}
                       onClick={() => setSelectedDayIndex(i)}
                       className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group touch-manipulation active:bg-white/10"
                     >
                        {/* Day Name */}
                        <div className="w-16 text-left font-bold text-slate-200 capitalize">
                           {i === 0 ? t.today : formatDate(day, { weekday: 'short' })}
                        </div>

                        {/* Moon Phase (New) */}
                        <div className="hidden md:flex justify-center w-10 opacity-70">
                           <MoonPhaseIcon phase={listMoonPhase} lat={weatherData.location.latitude} lang={lang} className="w-6 h-6" />
                        </div>

                        {/* Icon & Precipitation & Volume */}
                        <div className="flex items-center gap-3 w-32 md:w-36">
                           <div className="group-hover:scale-110 transition-transform filter drop-shadow-md">
                               {getWeatherIcon(weatherData.daily.weather_code[i], "w-8 h-8", 1, weatherData.daily.precipitation_probability_max[i])}
                           </div>
                           <div className="flex flex-col items-start">
                             {weatherData.daily.precipitation_probability_max[i] > 10 && (
                                <span className={`text-xs flex items-center font-bold gap-0.5 ${isDaySnow ? 'text-cyan-200' : 'text-blue-300'}`}>
                                  <Umbrella className="w-3 h-3" strokeWidth={2.5}/>
                                  {weatherData.daily.precipitation_probability_max[i]}%
                                </span>
                             )}
                             {/* DISPLAY VOLUME (L or CM) */}
                             {snowSum > 0 ? (
                                <span className="text-[10px] font-medium text-cyan-100 flex items-center gap-0.5">
                                  {snowSum}cm
                                </span>
                             ) : precipSum > 0 ? (
                                <span className="text-[10px] font-medium text-blue-200 flex items-center gap-0.5">
                                  {Math.round(precipSum)}mm
                                </span>
                             ) : null}
                           </div>
                        </div>

                        {/* Temp Range Bar */}
                        <div className="flex-1 flex justify-end md:justify-center">
                           <TempRangeBar 
                              min={Math.round(weatherData.daily.temperature_2m_min[i])}
                              max={Math.round(weatherData.daily.temperature_2m_max[i])}
                              globalMin={weeklyExtremes.min}
                              globalMax={weeklyExtremes.max}
                              displayMin={formatTemp(weatherData.daily.temperature_2m_min[i])}
                              displayMax={formatTemp(weatherData.daily.temperature_2m_max[i])}
                           />
                        </div>
                     </button>
                   );
                 })}
               </div>
            </div>
            
            {/* FOOTER - COPYRIGHT */}
            <div className="w-full py-8 mt-8 text-center border-t border-white/5">
              <p className="text-xs text-slate-500 font-medium tracking-wider uppercase opacity-70 hover:opacity-100 transition-opacity">
                © {new Date().getFullYear()} Meteo Toni Ai <span className="mx-1.5 opacity-50">|</span> Desenvolupat per <span className="text-indigo-400 font-bold">Toni Tapias</span>
              </p>
            </div>

          </div>
        )}
        
        <DayDetailModal />
      </div>
    </div>
  );
}

function DetailStat({ label, value, icon }) {
  return (
    <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col items-center hover:border-slate-600 transition-colors">
       <div className="text-slate-400 text-xs mb-2 flex items-center gap-1.5 font-medium uppercase tracking-wide">{icon} {label}</div>
       <div className="font-bold text-white text-lg">{value}</div>
    </div>
  )
}