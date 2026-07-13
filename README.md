# ⚡ MeteoToni AI - Tactical Atmospheric Operating System

[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite_6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini_2.0-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Sentry](https://img.shields.io/badge/Sentry-Telemetry-362D59?style=for-the-badge&logo=sentry&logoColor=white)]()
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-success?style=for-the-badge&logo=pwa&logoColor=white)]()

> **La meteorologia de precisió es troba amb l'enginyeria tàctica de risc zero.**

MeteoToni AI no és una simple aplicació del temps; és un **sistema de telemetria meteorològica d'alta precisió** dissenyat per operar en condicions extremes i d'alta muntanya. Combina la potència predictiva de models globals amb la precisió topogràfica de models d'alta resolució, tot processat per una arquitectura tolerant a fallades i un motor d'Intel·ligència Artificial (Gemini) en temps real.

---

## ✨ Visió General de la Interfície (Spatial UI)

<div align="center">
  <img src="./public/screenshot-desktop.png" alt="Tauler Principal Escriptori" width="800" style="border-radius: 10px; box-shadow: 0 4px 15px rgba(56,189,248,0.2);">
  <p><em>El HUD Tàctic (Head-Up Display) amb disseny Spatial UI i Neo-Skeuomorfisme, mostrant telemetria avançada i diagnòstics de sistema.</em></p>
</div>

<br/>

<div align="center" style="display: flex; justify-content: center; gap: 20px;">
  <img src="./public/screenshot-mobile.png" alt="Vista Mòbil AROME" width="300" style="border-radius: 10px; box-shadow: 0 4px 15px rgba(56,189,248,0.2);">
  <img src="./public/screenshot-mobile-widgets.png" alt="Widgets Avançats" width="300" style="border-radius: 10px; box-shadow: 0 4px 15px rgba(56,189,248,0.2);">
</div>
<div align="center">
  <p><em>Esquerra: Previsió horària d'alta resolució AROME HD. Dreta: Consensus Widget analitzant discrepàncies entre models.</em></p>
</div>

---

## 🛡️ Pilars Arquitectònics

### 1. La Doctrina "Risc Zero"
A la muntanya, un error a l'aplicació pot costar car. Aquest projecte està construït sota una arquitectura innegociable de tolerància a fallades:
* **Zero Falsos Positius:** Si l'API falla, es mostren estats de `[ SENSOR STANDBY ]`. Mai s'imprimeixen dades numèriques buides o nul·les (`0 km/h`) que puguin confondre l'usuari.
* **Validació Estricta (Zod):** Tot el trànsit de xarxa que entra al sistema és validat amb esquemes geomètrics estrictes abans de tocar la interfície.
* **Network Resilience:** Sistema natiu de re-intents (`fetchWithRetry`) i Timeouts personalitzats per combatre la pèrdua de cobertura a la muntanya.
* **Observabilitat Total:** Integració profunda amb `@sentry/react` per capturar excepcions, timeouts GPS i fallades de validació de dades a la capa de xarxa.

### 2. Motor de Consens Multi-Model
Per evitar les sorpreses dels microclimes, l'aplicació no confia en una sola font. Creua en temps real:
* **Models Globals (ECMWF, GFS, ICON):** Analitzen l'atmosfera a gran escala per definir tendències i tempestes massives.
* **Models d'Alta Resolució (WRF, AROME):** Apliquen un zoom extrem d'1.3km per entendre com els relleus orogràfics alteraran el vent i la pluja exactament on ets.
* **Consensus Widget:** Un sistema heurístic que compara ambdós models i assigna un % de "precisió o afinitat". Si hi ha *Divergència*, l'usuari rep una alerta de risc de microclima.

### 3. Disseny Visual: Spatial UI & Neo-Skeuomorfisme
Dissenyada sota el concepte de *Dark Dashboard* tàctic:
* **GPU Acceleration:** Ús intel·ligent de les capes gràfiques per crear hologrames 3D i profunditat d'interfície.
* **Neo-Skeuomorfisme:** Botons físics virtuals (nuclis d'ignició) i estats lluminosos (LEDs) que retornen la sensació tàctil a les pantalles planes.
* **Smart Dictionary (i18n):** Interfície totalment desacoblada amb diccionaris interns per garantir canvis d'idioma autònoms (ca, es, en, fr) en estat offline sense dependre d'APIs de traducció.

---

## ⚙️ Arquitectura Tècnica (Under the Hood)

Una mirada ràpida a com està construïda l'aplicació per dins, basada en l'auditoria de producció:

| Capa | Tecnologia | Detalls d'Implementació Clau |
| :--- | :--- | :--- |
| **Frontend Core** | React 19 + TypeScript | Tipat estricte (sense `any`), Hooks personalitzats per separar la lògica d'UI. |
| **Build Tool** | Vite 6 | Configuració optimitzada per a PWA i compilació ultraràpida. |
| **Estils** | Tailwind CSS | Sistema de disseny utilitari avançat (*Glassmorphism*, animacions CSS natives). |
| **Protecció API** | Zod + Sentry | Interceptors tipats per evitar excepcions de xarxa no controlades a producció. |
| **Gestió d'Estat** | Context API + IDB | Memòria cau persistent d'alt rendiment (`idb-keyval`) per a funcionament offline-first. |
| **Dades Externes** | Open-Meteo API | Fusió intel·ligent de múltiples models orogràfics. |
| **Intel·ligència** | Groq | Integració segura via Proxy per a narratives descriptives adaptades al relleu local. |

---

## 🛠️ Instal·lació Local

Si vols explorar el codi font o col·laborar:

1.  **Clona el repositori:**
    ```bash
    git clone [https://github.com/ToniTapias/meteoai.git](https://github.com/ToniTapias/meteoai.git)
    cd meteoai
    ```

2.  **Instal·la les dependències:**
    ```bash
    npm install
    ```

3.  **Configura l'entorn:**
    Crea un fitxer `.env` a l'arrel de l'aplicació. Aquesta aplicació utilitza un servidor intermediari (Proxy) per amagar la clau de l'API de Gemini per raons de seguretat. Has de configurar-lo de la següent manera:

    ```env
    # URL del teu Proxy per a l'API de Gemini (OBLIGATORI)
    VITE_PROXY_URL=[https://la-teva-url-del-proxy.com/api/chat](https://la-teva-url-del-proxy.com/api/chat)
    
    # Temps d'espera per a les peticions a l'API (OPCIONAL, per defecte 10000ms)
    VITE_API_TIMEOUT=10000
    ```

4.  **Auditoria de Codi (Doctrina Risc Zero):**
    Abans de compilar, valida la integritat estructural del codi:
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

* Desenvolupat amb passió i enginyeria de precisió per **Toni Tapias** - © 2026.
* Llicència MIT.
* Dades meteorològiques proporcionades per [Open-Meteo](https://open-meteo.com/) sota llicència Creative Commons.
* IA impulsada per Groq.

---
<div align="center">
  <p><em>La meteo no perdona; el codi, tampoc.</em> 🏔️⚡</p>
</div>