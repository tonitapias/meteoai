# ⚡ MeteoToni AI - Previsió Meteorològica d'Alta Precisió

[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite_6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini_3.5-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Sentry](https://img.shields.io/badge/Sentry-Telemetry-362D59?style=for-the-badge&logo=sentry&logoColor=white)]()
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-success?style=for-the-badge&logo=pwa&logoColor=white)]()

> **Previsió meteorològica d'alta precisió, combinant models globals, model d'alta resolució i intel·ligència artificial.**

MeteoToni AI combina la potència predictiva dels models meteorològics globals amb la precisió topogràfica de 14 models nacionals d'alta resolució (AROME, ICON-D2, HRRR, JMA i altres, fins a 1km), seleccionats automàticament segons la teva ubicació, tot processat per un motor d'intel·ligència artificial en temps real per oferir-te la previsió més precisa possible allà on siguis.

### ⚠️ Propòsit i Limitacions
MeteoToni AI és exclusivament una eina d'informació analítica. Proporciona dades basades en models matemàtics, **però les matemàtiques no eviten els riscos físics**. Aquesta aplicació no és un sistema de prevenció d'accidents, no detecta perills objectius sobre el terreny i no garanteix la seguretat en cap ruta. L'avaluació final de les condicions i la presa de decisions recau sempre, i de manera innegociable, en la formació, l'experiència visual i el criteri de l'usuari sobre el terreny.

---

## ✨ Visió General de la Interfície (Spatial UI)

<div align="center">
  <img src="./public/screenshot-desktop.png" alt="Pantalla d'Inici Escriptori" width="800" style="border-radius: 10px; box-shadow: 0 4px 15px rgba(56,189,248,0.2);">
  <p><em>La pantalla d'inici amb disseny Spatial UI i Neo-Skeuomorfisme, punt de partida per cercar qualsevol ubicació del món.</em></p>
</div>

<br/>

<div align="center" style="display: flex; justify-content: center; gap: 20px;">
  <img src="./public/screenshot-mobile.png" alt="Vista Mòbil Condicions Actuals" width="300" style="border-radius: 10px; box-shadow: 0 4px 15px rgba(56,189,248,0.2);">
  <img src="./public/screenshot-mobile-widgets.png" alt="Telemetria Multimodel" width="300" style="border-radius: 10px; box-shadow: 0 4px 15px rgba(56,189,248,0.2);">
</div>
<div align="center">
  <p><em>Esquerra: Condicions actuals en temps real. Dreta: Telemetria gràfica completa comparant AROME HD amb els models globals.</em></p>
</div>

---

## 🛡️ Pilars Arquitectònics

### 1. La Doctrina "Risc Zero" (Fiabilitat de Codi)
Aquest concepte s'aplica estrictament a l'**estabilitat del software**. En entorns complexos, necessites que la teva eina de dades no et deixi penjat ni et menteixi. El projecte està construït sota una arquitectura innegociable de tolerància a fallades tècniques:
* **Zero Falsos Positius:** Si l'API perd connexió o no hi ha dades disponibles, l'app mostra un estat explícit de "sense dades" en lloc de xifres. Mai s'imprimeixen dades numèriques nul·les (`0 km/h`) que puguin portar a una mala interpretació de la situació.
* **Validació Estricta (Zod):** Tot el trànsit de xarxa que entra al sistema és validat amb esquemes estrictes abans de tocar la interfície visual.
* **Network Resilience:** Sistema de re-intents i timeouts personalitzats per combatre la intermitència de cobertura.
* **Observabilitat Total:** Integració profunda amb `@sentry/react` per capturar excepcions silencioses i fallades de validació de dades a la capa de xarxa.

### 2. Motor de Consens Multi-Model
Per reduir l'impacte dels microclimes, l'aplicació no confia en una sola font. Creua en temps real:
* **Models Globals (ECMWF, AIFS, GFS, ICON):** Analitzen l'atmosfera a gran escala per definir tendències i el pas de grans sistemes frontals — inclòs AIFS, el model d'intel·ligència artificial de l'ECMWF; Open-Meteo selecciona automàticament el "Best Match" més fiable per a cada zona del planeta.
* **14 Models Regionals d'Alta Resolució:** Segons la ubicació consultada, l'app selecciona automàticament el model nacional de més resolució disponible — AROME HD i ICON-D2 a Europa central i occidental, UKMO al Regne Unit i Irlanda, MET Norway i DMI als Nòrdics i Islàndia, MeteoSwiss a Suïssa, KNMI als Països Baixos, ItaliaMeteo a Itàlia, CHMI i GeoSphere a Txèquia i Àustria, ALADIN-CE (consorci LACE) a Polònia, Hongria, Eslovàquia, Romania, Bulgària, els Bàltics i Moldàvia, HRRR als EUA, HRDPS al Canadà i JMA al Japó i Corea (entre 1 i 5km segons el model). Fora d'aquestes zones, l'app utilitza honestament el consens dels models globals.
* **Consensus Widget:** Compara el model regional actiu amb el consens dels models globals i indica el nivell de fiabilitat de la previsió —consens, divergència, incertesa o redundància (quan el "best match" global ja coincideix amb el model regional)— per a temperatura, vent i pluja.
* **Meteograma Multimodel:** La "Telemetria Gràfica Completa" del Consensus Widget mostra 6 sèries alhora (el model regional actiu, ECMWF, AIFS, GFS, ICON i el blend global) per visualitzar la incertesa real entre models en un sol gràfic.
* **Avís de Canvi Sobtat (3h):** Si el model global o el model regional actiu preveu pluja forta o vent fort en les properes tres hores, el Consensus Widget ho marca amb un avís visual explícit, encara que la situació actual sigui tranquil·la — el model regional hi aporta la sensibilitat necessària per detectar convecció local que el model global sol allisar.
* **Verificació amb Radar en Temps Real:** Els models poden no veure un xàfec molt localitzat que sí és real. L'app mostreja el píxel exacte del radar Doppler a la teva ubicació i el compara amb la previsió del model per a aquest mateix moment; si el radar detecta precipitació que el model no preveu, t'ho notifica a la pantalla principal.
* **Quan començarà o acabarà la pluja:** a partir de la projecció a curt termini del radar (nowcast, ~55 minuts), l'app estima si la precipitació a la teva ubicació exacta està a punt de començar o d'acabar, independentment del que digui el model per a aquesta hora.

### 3. Observatoris Solar i Lunar
Dos modals de detall interactius, accessibles tocant els ginys compactes de Cicle Solar i Fase Lunar, amb una direcció visual pròpia més cinematogràfica (fons estelat, herois a gran escala) i selecció real de qualsevol dels 14 dies següents — tot el modal (heroi, trajectòria, cronologia, estadístiques) es recalcula per al dia triat:
* **Cicle Solar:** cronologia completa del dia (crepuscle astronòmic, nàutic i civil, hora daurada, migdia solar amb elevació màxima), posició real del sol en temps real (azimut i altitud), *scrubbing* horari a la trajectòria (arrossega per veure la posició exacta a qualsevol hora), hores de sol reals vs. teòriques, índex UV màxim i en cel clar, radiació solar acumulada i azimut exacte de sortida i posta.
* **Cicle Lunar:** fase, il·luminació i edat (amb orientació correcta per a l'hemisferi sud), sortida i posta amb l'azimut exacte de cada esdeveniment, distància Terra-Lluna amb detecció de Superlluna/Micro lluna, pròxima lluna plena i nova, i calendari lunar dia a dia.
* Sortida, posta, durada del dia i fase lunar es calculen amb astronomia local (sense dependre del model meteorològic), així que són precises per als 14 dies; els valors que sí depenen del temps (UV, radiació) es mostren honestament només on Open-Meteo té dades reals, sense extrapolar-los.

### 4. Observatori de Risc de Tempesta (CAPE)
Un tercer modal de detall, accessible tocant el giny de CAPE en Mode Expert, per seguir l'evolució del risc de convecció sense sortir de l'app:
* **Evolució horària (48h):** gràfic *scrubbable* de l'energia convectiva disponible (CAPE), amb les bandes dels llindars de risc (moderat, alt, sever) i la probabilitat de pluja superposada, per distingir quan el risc pot arribar a materialitzar-se de veritat.
* **Pròxima finestra de tempesta:** avisa amb quantes hores falten per al primer tram de risc i quin serà el pic de CAPE previst, o confirma honestament que no n'hi ha cap en les properes 48 hores.
* **Estadístiques ràpides:** CAPE màxim a 24h i 48h, total d'hores en risc i nivell de congelació actual.
* Reutilitza dades horàries que l'app ja demanava a Open-Meteo — cap crida de xarxa nova ni dependència externa.

### 5. Observatori de Qualitat de l'Aire
Un quart modal de detall, accessible tocant el giny de Qualitat de l'Aire en Mode Expert, amb tot el desglossament que Open-Meteo ja proporcionava però que no es mostrava enlloc:
* **Evolució horària (48h)** de l'Índex Europeu de Qualitat de l'Aire (EAQI), *scrubbable*, amb les bandes oficials de les 6 categories (Bona, Raonable, Moderada, Dolenta, Molt Dolenta, Extrema).
* **Desglossament complet de contaminants:** PM2.5, PM10, NO2, O3 i SO2 amb el seu valor real en µg/m³ — sense inventar-hi cap codi de color per contaminant, ja que no hi ha una taula oficial de llindars prou fiable per a cadascun per separat; el color de severitat només s'aplica a l'índex global, que sí té bandes oficials verificades.
* **Pol·len i pols en suspensió:** els 6 tipus de pol·len que Open-Meteo cobreix (vern, bedoll, gramínies, artemisa, olivera, ambrosia) i la pols en suspensió — rellevant per intrusions de pols saharianes, força habituals a la Mediterrània. Només es mostren els que realment es detecten, per no omplir la pantalla de zeros fora de temporada.
* **Avís de calima a la pantalla principal:** quan la pols (CAMS) supera els 100 µg/m³ —o el PM10 els 150 µg/m³ sense pols identificada, que s'etiqueta com a "partícules" i no com a calima— amb aire sec (HR < 75 %) i sense pluja, apareix una càpsula ambre amb la xifra i una insígnia sobre la icona del temps, i la IA local en avisa. És un **avís d'aerosols, no de visibilitat**: la visibilitat del model meteorològic no veu la calitja d'aerosols (verificat contra 24 mesos de METAR de 20 aeroports: el 95 % de les hores amb calitja observada tenien ≥ 10 km al model) i la pols del CAMS només prediu fluixament la visibilitat observada (a les hores en què salta l'avís, només el 13 % té < 10 km). Per això el text diu que el cel es pot veure enterbolit però que la visibilitat no sempre baixa. Amb aquests llindars salta el ~5 % de les hores a Canàries i gairebé mai a la resta d'Europa.
* Reutilitza dades que l'app ja demanava a l'API de Qualitat de l'Aire d'Open-Meteo — cap crida de xarxa nova.

### 6. Observatori d'Exposició Solar (Índex UV)
Un cinquè modal de detall, accessible tocant el giny d'Índex UV en Mode Expert, centrat en quan cal protegir-se avui, no només en el valor puntual d'ara:
* **Corba horària d'avui:** a diferència del CAPE i l'AQI (finestra contínua de 48h), l'UV segueix el cicle diari del sol, així que el modal mostra la corba completa d'avui (00:00–23:00) en lloc de barrejar dos dies amb hores de nit sense sentit.
* **Real vs. cel clar:** la corba real de `uv_index` es compara amb `uv_index_clear_sky` (què faria el sol sense núvols), per veure quant protegeix la cobertura núvolosa del dia.
* **Finestra de protecció:** calcula i mostra l'hora d'inici i final en què cal protegir-se (llindar oficial OMS, UV≥3), amb un estat "actiu ara mateix" quan pertoca, o confirma honestament que avui no cal protecció.
* **Bandes oficials OMS:** reutilitza exactament el mateix sistema de 5 categories (Baix/Moderat/Alt/Molt Alt/Extrem) que ja fa servir el Cicle Solar per al UV màxim diari — cap llindar nou inventat.
* Reutilitza `hourly.uv_index`/`uv_index_clear_sky`, ja demanats a Open-Meteo — cap crida de xarxa nova.

### 7. Observatori Baromètric (Pressió)
Un sisè modal de detall, accessible tocant el giny de Pressió en Mode Expert:
* **Evolució de 48h** de la pressió atmosfèrica (`pressure_msl`), *scrubbable*, sense un "zero" absolut artificial — l'eix s'escala al rang real de la finestra.
* **Classificació real de la tendència:** reutilitza la terminologia dels butlletins marítims (estable / pujant-baixant lentament / pujant-baixant / ràpidament / molt ràpidament, llindars 1.5/3.5/6.0 hPa en 3h) — el mateix criteri que fan servir els avisos per a petites embarcacions, no un color inventat.
* **Canvi més sobtat de la finestra:** escaneja les 48h amb una tendència mòbil de 3h i assenyala el moment en què la pressió puja o baixa més ràpid, amb la seva hora — una caiguda de més de 3 hPa en 3h és el senyal operatiu clàssic d'un front pertorbat en 6-12h.
* Reutilitza `hourly.pressure_msl`, ja demanat a Open-Meteo — cap crida de xarxa nova.

### 8. Índex de Confort (Punt de Rosada)
Un setè modal de detall, accessible tocant el giny de Punt de Rosada en Mode Expert — construït al voltant del punt de rosada, no de la humitat relativa sola, perquè aquesta última és enganyosa fora de context (90% d'humitat a 5°C no té res a veure amb 90% a 30°C):
* **Evolució de 48h** del punt de rosada (`dew_point_2m`), *scrubbable*, amb la humitat relativa de cada hora com a dada secundària.
* **Escala de confort real (NWS):** Sec / Còmode / Humit / Opressiu / Molt Opressiu, basada en els llindars del National Weather Service dels EUA (≈12.8°C i ≈18.3°C) — la banda superior es documenta com a àmpliament citada, no com a llindar oficial únic, per no sobrevendre'n la precisió.
* **Finestra de xafogor:** primer tram de la finestra amb condicions humides i el seu pic previst, o confirma que no n'hi ha cap en les properes 48 hores.
* Reutilitza `hourly.dew_point_2m`/`relative_humidity_2m`, ja demanats a Open-Meteo — cap crida de xarxa nova.

### 9. Visibilitat i Boira
Un vuitè modal de detall, accessible tocant el giny de Visibilitat en Mode Expert:
* **Evolució de 48h** de la visibilitat (`visibility`), *scrubbable*, amb les mateixes 4 bandes que ja pintava el giny (Excel·lent/Bona/Calitja/Boira) — ara centralitzades a `WEATHER_THRESHOLDS` perquè giny i modal no puguin desincronitzar-se mai.
* **Avís de boira:** primer tram de la finestra amb visibilitat per sota del llindar de boira i el mínim previst, o confirma que no n'hi ha cap en les properes 48 hores.
* **Boira gebradora:** la boira confirmada a T ≤ 0 °C és sempre gebradora (gotetes subrefredades que dipositen gebre i deixen gel a terra) i té icona pròpia: la boira amb un floc de neu a la cantonada. El llindar està verificat contra 24 mesos de METAR de 20 aeroports europeus i canaris (702.000 informes): per sobre de 0 °C no hi ha cap boira gebradora en 4.482 informes de boira, i a T ≤ −1 °C ho és entre el 94 i el 100 %.
* **Pluja i plugim engelants:** quan el model diagnostica precipitació líquida sobre una superfície sota zero, l'app la mostra com a engelant —amb el mateix floc de neu sobre la icona de plugim o de pluja— en lloc de convertir-la en neu, que és un fenomen diferent i menys perillós que la glaçada a la carretera. La IA n'avisa amb un text i un avís de risc de gel propis.
* **Porta de núvols baixos:** la boira és un núvol a nivell de terra, així que només es confirma si el model porta almenys un 70 % de núvols baixos (a més del senyal del model, la saturació i l'absència de pluja). Contra 24 mesos de METAR de 20 aeroports (350.000 hores comparades amb la sortida del model), això puja l'índex d'encert (CSI) de 0,25 a 0,30 i baixa les falses alarmes de 0,73 a 0,65, a canvi de perdre un 8 % de les hores de boira encertades. Si la dada de núvols baixos falta, no s'aplica —mai es converteix una dada absent en un 0 %.
* Reutilitza `hourly.visibility`, ja demanat a Open-Meteo — cap crida de xarxa nova.

### 10. Núvols: Perfil de Capes
Un novè modal de detall, accessible tocant el giny de Núvols en Mode Expert:
* **Cobertura efectiva actual:** ponderació de les tres capes (baixos×1.0 + mitjans×0.6 + alts×0.3 — el mateix càlcul que ja determina la icona de cel a la resta de l'app) classificada en 4 estats (Serè/Parcialment Ennuvolat/Molt Ennuvolat/Cobert).
* **Evolució de 48h per capa:** gràfic *scrubbable* amb les tres capes (alts/mitjans/baixos) superposades, per veure com evoluciona el perfil vertical del cel al llarg del temps, no només un percentatge global.
* **Estadístiques:** capa dominant de la finestra (la de major cobertura mitjana) i hores amb cel cobert.
* **Icona i etiqueta "Molt ennuvolat":** a partir del 70 % de cobertura efectiva, el cel deixa de pintar-se com el sol entre núvols i passa a la icona de dos núvols, amb l'etiqueta corresponent a la capçalera. Es decideix amb el mateix percentatge que va decidir el codi de cel, a "ara", a cada hora i al diari (mitjana diürna).
* Reutilitza `hourly.cloud_cover_low/mid/high`, ja demanats a Open-Meteo — cap crida de xarxa nova.

### 11. Cota de Neu
Un desè modal de detall, accessible tocant el giny de Cota de Neu en Mode Expert (només visible quan el nivell de congelació és prou baix perquè la neu sigui rellevant):
* **Cota actual i nivell de congelació:** la cota de neu (altitud on la pluja passa a neu, ≈300m per sota de la isoterma 0°C) com a valor principal, amb el nivell de congelació mostrat a part com a dada de context.
* **Evolució de 48h**, *scrubbable*, sense un "zero" absolut artificial — l'eix s'escala al rang real de la finestra, igual que Pressió.
* **Avís de cota mínima:** quantes hores falten fins al moment en què la neu arribarà més avall, i a quina altitud.
* A diferència de la resta de modals, no llegeix les dades horàries en cru: la cota de neu és un càlcul derivat amb una cadena de reserva entre models (ECMWF/GFS/ICON) quan AROME-HD no cobreix una hora concreta — reutilitza el mateix càlcul centralitzat que ja alimenta el giny, per no poder-se'n desincronitzar mai.

### 12. Vent: Velocitat, Direcció i Ratxes
L'últim modal de detall dels ginys experts, accessible tocant el giny de Vent en Mode Expert — pensat com a complement de dades pures al mapa de vent (Windy), que ja és molt visual:
* **Brúixola gran** amb la direcció exacta en graus i velocitat i ratxes actuals ben grans.
* **Escala Beaufort oficial** (13 graus, 0-12), amb els llindars en km/h verificats contra el Servei Meteorològic de Catalunya i els noms en cada idioma verificats contra fonts de referència — no una escala inventada.
* **Evolució de 48h**, *scrubbable*, amb velocitat i ratxes superposades, més una franja de fletxes que mostra com gira el vent al llarg del temps.
* **Avís de pròxima ratxa forta** i tres estadístiques: ratxa màxima, velocitat mitjana i direcció dominant de la finestra.
* Reutilitza `hourly.wind_speed_10m/wind_direction_10m/wind_gusts_10m`, ja demanats a Open-Meteo — cap crida de xarxa nova.

### 13. Alertes Meteorològiques Oficials
Per complementar l'anàlisi tàctica de la IA (horitzó de 6 hores) amb avisos d'organismes oficials i horitzons més llargs (24-48h):
* **Set fonts oficials, seleccionades automàticament per ubicació:** NWS (EUA), AEMET (Espanya), Meteocat (Catalunya), Météo-França (Vigilància), IPMA (Portugal), DWD (Alemanya) i Protezione Civile (Itàlia).
* **Sense duplicats:** dins de Catalunya, Meteocat substitueix AEMET —mai es mostren els dos alhora— perquè és la font més precisa (a nivell de comarca) i evita que el mateix avís aparegui dues vegades amb redaccions diferents.
* **Totes les alertes visibles:** el banner permet desplegar-les totes, no només la més greu — cadascuna amb el seu esdeveniment, venciment i font.
* **Traducció automàtica:** cap font cobreix nativament els 4 idiomes de l'app; quan cal, el mateix motor d'IA (Gemini/Groq) tradueix l'avís al vol, amb memòria cau per evitar cost repetit entre usuaris.
* **Font sempre citada:** cada avís mostra l'organisme oficial d'origen i un enllaç directe — mai només un resum generat per IA sense atribució.
* **Salut monitoritzada:** un test diari comprova les 7 fonts oficials directament (no només el proxy) i avisa per correu si alguna es trenca.

### 14. Disseny Visual: Spatial UI & Neo-Skeuomorfisme
Dissenyada sota el concepte de *Dark Dashboard* per facilitar la lectura ràpida sota qualsevol llum:
* **GPU Acceleration:** Ús intel·ligent de capes per crear hologrames 3D i separar visualment els nivells de profunditat.
* **Neo-Skeuomorfisme:** Informació presentada amb codis de colors funcionals (Verd=Òptim, Ambre=Avís) i estats lluminosos que imiten instrumentació física.
* **Llenguatge d'icones del temps:** cada estat té una icona diferent, i dins de cada família la intensitat es llegeix pel nombre de marques —2, 3 o 5 ratlles a la pluja; 2, 4 o 6 flocs a la neu—. El plugim té gotetes fines, l'aiguaneu barreja una ratlla de pluja amb flocs, la tempesta amb calamarsa hi afegeix pedres, el "majorment serè" és un sol amb un núvol petit, i tot el que gela en tocar terra (boira, plugim i pluja engelants) porta un floc de neu a la cantonada. L'aiguaneu (pluja i neu barrejades) es deriva de la temperatura (1–4 °C) i de la cota de gel (isoterma 0 °C sobre el terra, a menys de 300 m): Open-Meteo no el publica.
* **Smart Dictionary (i18n):** Interfície totalment desacoblada per garantir canvis d'idioma autònoms en estat offline.

---

## ⚙️ Arquitectura Tècnica (Under the Hood)

Una mirada ràpida a l'auditoria de producció:

| Capa | Tecnologia | Detalls d'Implementació Clau |
| :--- | :--- | :--- |
| **Frontend Core** | React 19 + TypeScript | Tipat estricte (sense `any`), Hooks personalitzats i protecció de nuls. |
| **Build Tool** | Vite 6 | Configuració optimitzada per a PWA i compilació ultraràpida; en desplegar una versió nova, l'app avisa amb un banner en lloc de penjar-se amb codi obsolet. |
| **Estils** | Tailwind CSS | Sistema utilitari (*Glassmorphism*, animacions CSS natives, mobile-first). |
| **Protecció API** | Zod + Sentry | Interceptors tipats (Mur de Contenció) per evitar caigudes de UI per dades corruptes. |
| **Gestió d'Estat** | Context API + IDB | Memòria cau persistent (`idb-keyval`) per a funcionament offline-first. |
| **Dades Meteorològiques** | Open-Meteo API | Orquestració dels models globals (ECMWF, AIFS, GFS, ICON, Best Match) i de 14 models regionals d'alta resolució, seleccionats automàticament per ubicació. |
| **Radar i Satèl·lit** | LibreWXR + RainViewer (capa híbrida) + EUMETSAT | Radar Doppler: RainViewer (cobertura terrestre real) es renderitza per sobre de LibreWXR (cobertura global), que es veu per sota allà on RainViewer no arriba. Imatge satèl·lit (Meteosat, GOES, Himawari) servida per un proxy propi en Cloudflare Workers amb caché. |
| **Alertes Oficials** | NWS + AEMET + Meteocat + Météo-França + IPMA + DWD + Protezione Civile | Consulta automàtica per ubicació via el mateix Worker de Cloudflare (Meteocat substitueix AEMET dins de Catalunya, mai els dos alhora), amb traducció IA i memòria cau quan la font no cobreix l'idioma de l'app. Salut comprovada diàriament contra les 7 fonts oficials. |
| **Intel·ligència** | Gemini AI (amb Groq de reserva) | Anàlisi de risc meteorològic via un Worker propi a Cloudflare; un tallafocs determinista sobreescriu la IA si les dades brutes indiquen més risc del que reporta. |

---

## 🛠️ Instal·lació Local

1.  **Clona el repositori:**
    ```bash
    git clone https://github.com/ToniTapias/meteoai.git
    cd meteoai
    ```

2.  **Instal·la les dependències:**
    ```bash
    npm install
    ```

3.  **Configura l'entorn:**
    Crea un fitxer `.env` a l'arrel de l'aplicació. Has de configurar el servidor intermediari per a l'API de Gemini:

    ```env
    # URL del teu Proxy per a l'API de Gemini (OBLIGATORI)
    VITE_PROXY_URL=https://la-teva-url-del-proxy.com/api/chat
    
    # Temps d'espera per a les peticions a l'API (OPCIONAL, per defecte 10000ms)
    VITE_API_TIMEOUT=10000
    ```

4.  **Auditoria de Codi:**
    Valida la integritat estructural del codi abans d'executar:
    ```bash
    npm run type-check   # Executa el compilador TS per caçar errors de tipatge
    npm run lint         # Revisa les regles d'estil
    ```

5.  **Arranca el servidor de desenvolupament:**
    ```bash
    npm run dev
    ```

---

## 📄 Llicència i Crèdits

* Desenvolupat per **Toni Tapias**, amb col·laboració d'intel·ligència artificial — vegeu [CONTRIBUTORS.md](./CONTRIBUTORS.md) per als detalls. © 2026.
* Llicència MIT.
* Dades meteorològiques proporcionades per [Open-Meteo](https://open-meteo.com/) sota llicència Creative Commons.
* Dades de radar via [LibreWXR](https://librewxr.net/) i [RainViewer](https://www.rainviewer.com/) (capa híbrida) i imatge satèl·lit d'EUMETSAT.
* IA impulsada per Google Gemini, amb Groq com a sistema de reserva.

---
<div align="center">
  <p><em>Previsió meteorològica de precisió, allà on siguis.</em> 🌤️</p>
</div>
