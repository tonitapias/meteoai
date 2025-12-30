# 🌤️ MeteoToniAi

**MeteoToniAi** és una aplicació meteorològica avançada construïda amb React 19 i Vite. A diferència de les apps convencionals, no només mostra dades crues, sinó que utilitza un **Motor Híbrid Intel·ligent** que combina models globals (ECMWF) amb models d'alta resolució (AROME) i un sistema expert ("AI") per interpretar el temps en llenguatge natural.

---

## 🚀 Novetats de la Versió 7 (v7)

Aquesta versió introdueix millores significatives en la precisió de les dades i la interfície d'usuari:

* **🟢 UI "Emerald" Minimalista:** Nou indicador d'estat per al model d'alta precisió. Hem substituït les etiquetes de text per un **punt de llum verd maragda que batega** (`animate-ping`), indicant que les dades AROME estan actives sense soroll visual.
* **☁️ Hibridació de Núvols Millorada:** S'ha corregit la injecció de dades a `useWeather`. Ara, els widgets de nuvolositat (`CloudLayersWidget`) mostren les dades d'alta resolució en temps real quan estan disponibles, en lloc de recaure en el model global.
* **💎 Botons "Glassmorphism" Refinats:** Els controls per activar el Radar i el Model HD tenen nous estils amb efectes de brillantor (`shine`) i colors cian/turquesa per denotar tecnologia i precisió.
* **🧠 Lògica de Resiliència:** El sistema prioritza automàticament el model AROME (1.3km) a Europa Occidental, però fa un *fallback* transparent al model global (ECMWF) si hi ha fallades de connexió.

---

## ✨ Característiques Principals

### 1. Motor Híbrid Intel·ligent

L'aplicació decideix dinàmicament quina font de dades utilitzar:

* **ECMWF IFS (Global):** Per a previsions a llarg termini i zones fora d'Europa.
* **AROME France (Alta Resolució):** "Injectat" automàticament per a les pròximes 48h quan l'usuari és a la zona de cobertura. Millora dràsticament la precisió en tempestes, vent i orografia.

### 2. El "Cervell" (AI System)

No és només un panell de números. L'arxiu `weatherLogic.js` conté un sistema expert que:

* Analitza múltiples variables (CAPE, Punt de Rosada, Vent, Isoterma 0ºC).
* Genera resums textuals ("Està plovent feblement, però pararà aviat").
* Emet alertes de seguretat i consells de roba basats en la sensació tèrmica.

### 3. Widgets Avançats

* **Capes de Núvols:** Visualització percentual de núvols Baixos, Mitjans i Alts.
* **Cota de Neu:** Gràfic visual de l'alçada on la pluja es converteix en neu.
* **Arc Solar:** Posició exacta del sol i hores de llum restants.
* **Consens de Models:** Calcula la fiabilitat de la predicció comparant GFS, ICON i ECMWF.

---

## 📂 Estructura del Projecte

Aquest és l'arbre de fitxers actualitzat amb els components clau:

```text
meteoai/
├── public/
│   ├── Robots.txt
│   ├── Sitemap.xml
│   └── vite.svg
├── src/
│   ├── assets/
│   ├── components/              # UI i Widgets
│   │   ├── AIInsights.jsx       # Panell de text intel·ligent
│   │   ├── AromeModal.jsx       # Informació sobre el model HD
│   │   ├── CurrentWeather.jsx   # Capçalera principal (Nou disseny Emerald)
│   │   ├── DayDetailModal.jsx   # Detall diari
│   │   ├── ErrorBanner.jsx
│   │   ├── ExpertWidgets.jsx    # Graella de widgets tècnics
│   │   ├── ForecastSection.jsx  # Previsió horària i diària
│   │   ├── Header.jsx           # Cerca i Geolocalització
│   │   ├── RadarMap.jsx         # Mapa de precipitació (Leaflet)
│   │   ├── WeatherCharts.jsx    # Gràfiques de tendència
│   │   └── WeatherWidgets.jsx   # Components individuals (Compass, Moon, CloudLayers)
│   ├── constants/
│   │   ├── translations.js      # Diccionari multi-idioma (CA, ES, EN, FR)
│   │   └── weatherConfig.js     # Llindars de vent, pluja, temperatura
│   ├── hooks/                   # Lògica de negoci (Custom Hooks)
│   │   ├── useAIAnalysis.js     # Generador de text
│   │   ├── useArome.js          # Fetcher específic model AROME
│   │   ├── usePreferences.js    # Gestió de favorits i configuració
│   │   └── useWeather.js        # Hook Principal (Gestor d'Estat i Hibridació)
│   ├── utils/
│   │   ├── formatters.js        # Formateig de dates i hores
│   │   └── weatherLogic.js      # Algoritmes de normalització i càlcul "AI"
│   ├── App.jsx
│   ├── index.css                # Estils globals i Tailwind
│   └── main.jsx
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js

```

---

## 🛠️ Instal·lació i Desplegament

### Desenvolupament Local

```bash
# Instal·lar dependències
npm install

# Iniciar servidor de desenvolupament
npm run dev

```

### Build i Producció

El projecte està configurat per desplegar-se automàticament a GitHub Pages:

```bash
# Generar build i desplegar
npm run deploy

```

*Aquesta comanda executa `vite build` i puja la carpeta `dist` a la branca `gh-pages`.*

---

## 🌍 Crèdits de Dades

* **Meteorologia:** [Open-Meteo API](https://open-meteo.com/) (Models: ECMWF IFS, AROME France, GFS, ICON).
* **Geocoding:** [OpenStreetMap / Nominatim](https://nominatim.org/).
* **Qualitat Aire:** Copernicus Atmosphere Monitoring Service.

---

Desenvolupat amb ❤️ per **Toni Tapias**