# 🌦️ MeteoToni AI (v2.5.0-PRO)

> **Més que una aplicació del temps.** Un meteoròleg tàctic personalitzat impulsat per IA i models d'alta resolució.

![React](https://img.shields.io/badge/React-18-blue) ![Vite](https://img.shields.io/badge/Vite-5-purple) ![Gemini AI](https://img.shields.io/badge/Powered%20by-Gemini%20Pro-orange) ![License](https://img.shields.io/badge/License-MIT-green)

## 🚀 Sobre el Projecte

**MeteoToni AI** redefineix l'experiència de consultar el temps. En lloc de mostrar només números freds, utilitza **Google Gemini** per analitzar patrons complexos i oferir consells accionables ("Lifestyle" vs "Seguretat") basats en la severitat del clima.

Combina la precisió del model **AROME HD** (1.3km) amb un sistema de **fallback intel·ligent** per garantir que, si plou, ho sàpigues abans de sortir de casa.

---

## ✨ Funcionalitats Estel·lars

### 🧠 1. IA amb "Personalitat Tàctica"
El sistema no només resumeix el temps; l'entén.
- **Mode Lifestyle:** Si fa bo, et suggereix rentar el cotxe, assecar roba o fer esport.
- **Mode Seguretat:** Si detecta vent >40km/h o tempestes, canvia el to a autoritari i prioritza alertes.
- **Cache Intel·ligent:** Guarda les anàlisis a `localStorage` (30 min) per estalviar costos d'API i millorar la velocitat.

### ☔ 2. Monitor de Precipitació "Zero-Error"
Un giny exclusiu que només apareix quan hi ha amenaça de pluja en la pròxima hora.
- **Lògica de Fallback:**
  1.  Prioritza dades de **Radar en Viu** (minut a minut).
  2.  Si el radar falla (zona cega), salta automàticament al model **AROME HD**.
  3.  Divideix la previsió horària en segments de 15 minuts per generar una gràfica sintètica.

### 🎨 3. UI/UX Premium
- **Disseny Bento Grid:** Organització modular i neta.
- **Vidre Esmaltat (Glassmorphism):** Estètica moderna amb fons dinàmics segons el clima.
- **Country Aware:** Reconeixement automàtic de Ciutat i País (via Nominatim).
- **Multi-idioma:** Suport natiu (Català, Anglès, Castellà, Francès) amb traducció de prompts d'IA.

---

## 🛠️ Stack Tecnològic

* **Frontend:** React 18 + TypeScript + Vite
* **Estils:** Tailwind CSS + Shadcn/UI (conceptes) + Lucide Icons
* **Dades Meteorològiques:** Open-Meteo API (Models: AROME, GFS, ICON, ECMWF)
* **Intel·ligència Artificial:** Google Generative AI SDK (Gemini 1.5 Flash / Pro)
* **Geolocalització:** Browser GPS + Nominatim (Reverse Geocoding)
* **Gràfics:** Recharts (Personalitzats per a pluja i temperatura)

---

## ⚙️ Instal·lació i Desplegament

### Prerequisits
Necessites una API Key de Google Gemini (Gratuïta).

1.  **Clonar el repositori:**
    ```bash
    git clone [https://github.com/tu-usuari/meteo-toni-ai.git](https://github.com/tu-usuari/meteo-toni-ai.git)
    cd meteo-toni-ai
    ```

2.  **Instal·lar dependències:**
    ```bash
    npm install
    ```

3.  **Configurar l'entorn:**
    Crea un fitxer `.env` a l'arrel:
    ```env
    VITE_GEMINI_API_KEY=la_teva_clau_api_aqui
    ```

4.  **Executar en local:**
    ```bash
    npm run dev
    ```

5.  **Compilar per a producció:**
    ```bash
    npm run build
    ```

---

## 📂 Estructura del Codi (Clau)

* **`src/hooks/useWeatherCalculations.ts`**: El cervell numèric. Aquí resideix la lògica del "Fallback de Pluja" i la normalització de models.
* **`src/services/geminiService.ts`**: El cervell creatiu. Conté l'enginyeria de prompts avançada (mapa d'idiomes, detecció de to).
* **`src/components/CurrentWeather.tsx`**: Targeta principal amb lògica visual (Badges de País/AROME).
* **`src/utils/weatherLogic.ts`**: Pre-processament de dades per "alimentar" l'IA amb context net.

---

## 🤝 Contribucions

Les Pull Requests són benvingudes. Per a canvis majors, si us plau obre una *issue* primer per discutir el que t'agradaria canviar.

---

<div align="center">
  <p>Fet amb ❤️ i molt de ☕ per <b>Toni</b></p>
  <p><i>v2.5.0-PRO - Stable Release</i></p>
</div>