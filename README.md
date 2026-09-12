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

### 4. Alertes Meteorològiques Oficials
Per complementar l'anàlisi tàctica de la IA (horitzó de 6 hores) amb avisos d'organismes oficials i horitzons més llargs (24-48h):
* **Set fonts oficials, seleccionades automàticament per ubicació:** NWS (EUA), AEMET (Espanya), Meteocat (Catalunya), Météo-França (Vigilància), IPMA (Portugal), DWD (Alemanya) i Protezione Civile (Itàlia).
* **Sense duplicats:** dins de Catalunya, Meteocat substitueix AEMET —mai es mostren els dos alhora— perquè és la font més precisa (a nivell de comarca) i evita que el mateix avís aparegui dues vegades amb redaccions diferents.
* **Totes les alertes visibles:** el banner permet desplegar-les totes, no només la més greu — cadascuna amb el seu esdeveniment, venciment i font.
* **Traducció automàtica:** cap font cobreix nativament els 4 idiomes de l'app; quan cal, el mateix motor d'IA (Gemini/Groq) tradueix l'avís al vol, amb memòria cau per evitar cost repetit entre usuaris.
* **Font sempre citada:** cada avís mostra l'organisme oficial d'origen i un enllaç directe — mai només un resum generat per IA sense atribució.
* **Salut monitoritzada:** un test diari comprova les 7 fonts oficials directament (no només el proxy) i avisa per correu si alguna es trenca.

### 5. Disseny Visual: Spatial UI & Neo-Skeuomorfisme
Dissenyada sota el concepte de *Dark Dashboard* per facilitar la lectura ràpida sota qualsevol llum:
* **GPU Acceleration:** Ús intel·ligent de capes per crear hologrames 3D i separar visualment els nivells de profunditat.
* **Neo-Skeuomorfisme:** Informació presentada amb codis de colors funcionals (Verd=Òptim, Ambre=Avís) i estats lluminosos que imiten instrumentació física.
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
| **Radar i Satèl·lit** | LibreWXR (amb RainViewer de reserva) + EUMETSAT | Radar Doppler i imatge satèl·lit (Meteosat, GOES, Himawari), servits per un proxy propi en Cloudflare Workers amb caché. |
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
* Dades de radar via [LibreWXR](https://librewxr.net/) (amb [RainViewer](https://www.rainviewer.com/) com a font de reserva) i imatge satèl·lit d'EUMETSAT.
* IA impulsada per Google Gemini, amb Groq com a sistema de reserva.

---
<div align="center">
  <p><em>Previsió meteorològica de precisió, allà on siguis.</em> 🌤️</p>
</div>
