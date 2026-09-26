// src/constants/weatherConfig.ts

export const WEATHER_THRESHOLDS = {
  // Llindars de precipitació (mm)
  PRECIPITATION: {
    TRACE: 0.1,    // Mínim per considerar que plou
    LIGHT: 0.5,    // Pluja feble
    MODERATE: 1.5, // Pluja moderada
    HEAVY: 4.0,    // Pluja forta
    INTENSIFY_FACTOR: 1.5 // Factor per considerar que la pluja s'intensifica (AI)
  },

  // Cobertura de núvols (%)
  CLOUDS: {
    FEW: 15,       // 0-15%: Serè
    SCATTERED: 45, // 15-45%: Parcialment ennuvolat
    BROKEN: 85,    // 45-85%: Molt ennuvolat
    OVERCAST: 85,  // >85%: Cobert
    STORM_BASE: 60, // Mínim de núvols per considerar tempesta
    // Dins del codi 2 (45-85 %), a partir d'aquí el cel es pinta com a "molt ennuvolat"
    // (icona Cloudy) i no com a "parcialment ennuvolat" (sol amb núvol). Aprox. 5-6 oktes.
    MOSTLY_CLOUDY: 70,
    // Mínim de núvols BAIXOS (%) perquè una previsió de boira es confirmi (visibilityRules.ts).
    // La boira és un núvol a nivell de terra, i el model la representa com a nuvolositat baixa:
    // amb menys, el senyal de boira és majoritàriament fals. Verificat contra 24 mesos de METAR
    // de 20 aeroports europeus i canaris (350.000 hores model↔METAR, ICON): amb >= 70 % el
    // CSI puja de 0,25 a 0,30, la taxa de falses alarmes baixa de 0,73 a 0,65 i el biaix de
    // 2,7 a 1,9, a canvi de perdre un 8 % de les hores de boira encertades (POD 0,73 -> 0,67).
    // Per què 50 i no 70: amb el camí real de l'app (AROME) a 9 aeroports europeus qualsevol
    // llindar entre 30 i 90 % és estadísticament igual (CSI 0,375; 50 vs 70: +0,002, dins del
    // soroll), però a Girona i Sabadell (2 anys de METAR, 358 hores de boira) el 70 % era pitjor:
    // el 58 % de les hores de boira real tenen < 70 % de núvols baixos al model (boira de
    // radiació poc gruixuda que la capa baixa no veu) i 50 vs 70 dona +0,018 de CSI (IC 95 %
    // [+0,004, +0,036]). Amb només ICON (fora d'AROME) el 70 % encara és ~0,03 de CSI millor.
    FOG_MIN_LOW: 50
  },

  // Humitat i Boira
  HUMIDITY: {
    HIGH: 92,             // Humitat alta (per forçar icona variable)
    // Diferència màxima T − Td (°C) perquè una previsió de boira es confirmi
    // (visibilityRules.ts). Verificat contra 200.000 METAR d'un any (11 aeroports
    // de la zona AROME): amb visibilitat < 1 km, T−Td té mediana 0 °C i P97 = 1 °C, i
    // amb T−Td ≥ 1,5 °C hi ha 0 casos de boira en 65.000 informes. Contra 272 hores
    // de boira observada (12 nov–29 des 2025, ±1 h): exigir T−Td ≤ 0,5 °C sobre el
    // senyal de boira del model fa passar el FAR de 78 % a 55 % i el biaix de 4,3 a
    // 1,6 (CSI 0,21 → 0,38). 0,4 és pràcticament igual; més enllà de 0,7 es perd
    // gairebé tot el guany.
    FOG_MAX_SPREAD: 0.5
  },

  // Inestabilitat (J/kg)
  CAPE: {
    // Per sota, l'energia convectiva és negligible i l'etiqueta és "Estable". Entre WEAK i MIN_STORM l'aire és feblement
    // inestable, no estable: la mateixa verificació de la regla de tempesta (stormRules.ts) troba trons observats amb
    // CAPE de 800 J/kg, i baixar MIN_STORM a 800 milloraria el CSI. Abans tot aquest tram es pintava "Estable" en verd.
    WEAK: 100,
    MIN_STORM: 1200,   // Mínim per risc de tempesta
    HIGH_STORM: 2000,  // Risc sever o tempesta seca
    EXTREME: 3000      // Situació perillosa
  },

  // Cisallament del vent en capa profunda (km/h): diferència vectorial entre el vent a 10 m i a 500 hPa (~5,5 km), el
  // substitut habitual del cisallament 0–6 km. NO diu si hi haurà tempesta (això ho decideix la regla de CAPE, verificada
  // a stormRules.ts) sinó com s'organitzaria si n'hi ha: < 10 m/s tempestes aïllades i de vida curta; 10–20 m/s
  // multicèl·lules i sistemes organitzats; >= 20 m/s supercèl·lules possibles (llindars de la literatura operativa:
  // Weisman i Klemp 1982, Thompson et al. 2003, ESSL). No verificat localment: en un any, 30 aeroports només registren
  // 22 hores de calamarsa als METAR, massa poques per mesurar un senyal de severitat.
  SHEAR: {
    MODERATE: 36, // 10 m/s
    STRONG: 72    // 20 m/s
  },

  // Tendència baromètrica (hPa / 3h) — terminologia real dels butlletins marítims
  // (Met Office i similars): "lentament" / "" / "ràpidament" / "molt ràpidament".
  // >3 hPa/3h és el llindar operatiu clàssic que anuncia un front pertorbat en 6-12h.
  PRESSURE: {
    STABLE: 0.1,      // Per sota, es considera "estable" (soroll de mesura)
    SLOW: 1.5,        // 0.1-1.5: lentament
    MODERATE: 3.5,    // 1.6-3.5: sense qualificatiu ("pujant/baixant")
    RAPID: 6.0        // 3.6-6.0: ràpidament; >6.0: molt ràpidament
  },

  // Confort del punt de rosada (°C) — escala del NWS (National Weather Service):
  // ≤55°F (≈12.8°C) sec/còmode, 55-65°F (≈12.8-18.3°C) enganxós, >65°F (≈18.3°C) opressiu.
  // El llindar de "molt opressiu" (>24°C) és àmpliament citat en fonts secundàries, no d'una
  // taula NWS única — es documenta com a tal, no com a llindar oficial estricte.
  DEW_POINT: {
    DRY: 10,          // Per sota: sec
    COMFORTABLE: 13,  // 10-13: còmode
    STICKY: 18,       // 13-18: humit / enganxós
    OPPRESSIVE: 24    // 18-24: opressiu; per sobre: molt opressiu
  },

  // Vent (km/h)
  WIND: {
    LIGHT: 20,     // < 20 km/h
    MODERATE: 40,  // 20-40 km/h
    STRONG: 60,    // 40-60 km/h
    EXTREME: 90    // > 90 km/h
  },

  // Temperatures (ºC) - NOU BLOC PER EVITAR L'ERROR
  TEMP: {
    FREEZING: 0,     // Gelada
    COLD: 10,        // Fred
    MILD: 18,        // Suau
    WARM: 25,        // Càlid
    HOT: 30,         // Calor
    EXTREME_HEAT: 35 // Calor extrema
  },

  // Alertes generals - NOU BLOC
  ALERTS: {
    CAPE_STORM: 1500,     // Llindar per alerta de tempesta
    PRECIP_SUM_HIGH: 20,  // mm acumulats per alerta de pluja
    UV_HIGH: 6,           // Índex UV alt
    UV_EXTREME: 10,       // Índex UV extrem
    AQI_BAD: 60           // Qualitat aire dolenta
  },

  // Neu i Fred
  SNOW: {
    TEMP_SNOW: 1,      // Temperatura aire <= 1ºC -> Neu segura
    TEMP_MIX: 4,       // Temperatura aire <= 4ºC -> Possible aiguaneu
    // Metres per sota de la cota 0 on pot nevar (cota de neu = cota de gel − 300 m). Verificat, hivern 2025-26 (nov.–mar.),
    // 30 aeroports europeus, previsió de curt termini de la sèrie de l'app contra el tipus de precipitació dels METAR (13.438
    // hores de precipitació, 1.015 de neu o aiguaneu):
    //  - 300 m és el millor marge fix, tant per a la cota sola (CSI 0,676; 250 m 0,651, 350 m 0,674) com dins de la regla de
    //    neu de l'app (CSI 0,697; 200 m 0,672, 400 m 0,667);
    //  - fer-lo dependre de la humitat de superfície (aire sec → cota més baixa pel refredament per evaporació:
    //    300 + k·(100 − HR)) sempre ho empitjora (k = 5: 0,669; k = 10: 0,620). Prop de la cota, l'HR de superfície gairebé
    //    no separa la neu de la pluja (mediana 90 % contra 88 %): el que compta és l'aire de sobre, que la superfície no veu.
    FREEZING_BUFFER: 300
  },

  // Visibilitat (m). POOR/GOOD ja eren usats per visibilityRules.ts/weatherLogic.ts per
  // determinar el codi de temps (boira); FOG/HAZE afegits per a les 4 bandes visuals que ja
  // pintava VisibilityWidget.tsx (ara centralitzades perquè el giny i el modal de detall no
  // puguin desincronitzar-se). GOOD es comparteix entre tots dos usos (10000m).
  VISIBILITY: {
    POOR: 1000,  // Menys d'1km es considera boira si no plou (visibilityRules.ts)
    FOG: 2000,   // Per sota: boira (VisibilityWidget/Modal)
    HAZE: 5000,  // 2000-5000: calitja
    GOOD: 10000
  },

  // Pols en suspensió / partícules (CAMS, via l'API de Qualitat de l'Aire d'Open-Meteo), µg/m³.
  // AVÍS D'AEROSOLS, no una previsió de visibilitat. Contra 24 mesos de METAR de 20 aeroports:
  //  - la visibilitat del model meteorològic NO veu la calitja d'aerosols (a les hores amb HZ
  //    observat el 95 % tenien >= 10 km al model, i ICON no en dona cap a Canàries);
  //  - la pols del CAMS sí que puja molt a les hores amb HZ (Canàries: mediana 438 µg/m³ contra
  //    un P90 de 46 de la resta), però com a predictor de visibilitat és fluix: amb aquesta regla
  //    (aire sec) només el 13 % de les hores tenen visibilitat observada < 10 km (4 % < 5 km).
  // Per això només s'usa per avisar que hi ha molta pols a l'aire (cel enterbolit, salut), mai per
  // dir que la visibilitat és baixa. Amb aquests llindars salta el ~5 % de les hores a Canàries i
  // gairebé mai a la resta d'Europa. El llindar d'humitat deixa fora la boirina humida.
  AEROSOL: {
    DUST_MIN: 100,     // pols (dust) >= 100 µg/m³ -> avís de calima
    PM10_MIN: 150,     // PM10 >= 150 µg/m³ (EAQI "extremadament dolenta") sense pols -> avís de partícules
    MAX_HUMIDITY: 75   // HR < 75 %: aire sec (≈ deliqüescència del NaCl); per sobre és boirina, no aerosol sec
  },

  // Configuració per defecte de l'UI
  DEFAULTS: {
    MAX_DISPLAY_SNOW_LEVEL: 3500, // Només mostrem cota neu si és inferior a això
  }
} as const;