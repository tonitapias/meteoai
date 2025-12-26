# 🌤️ Meteo Toni AI

Una aplicació meteorològica avançada construïda amb **React**, **Vite** i **Tailwind CSS**. Aquest projecte destaca per la seva interfície moderna ("Glassmorphism"), l'ús d'intel·ligència artificial per interpretar les dades del temps i una arquitectura altament modular i escalable.

## 🚀 Novetats de l'Arquitectura (Refactoring)

Aquesta aplicació ha estat completament refactoritzada per separar la lògica de la presentació, millorant el rendiment i la facilitat de manteniment.

### 📂 Estructura del Projecte

```text
src/
├── 🧩 components/           # Components Visuals (UI pur)
│   ├── AIInsights.jsx       # Panell d'anàlisi intel·ligent i consells
│   ├── CurrentWeather.jsx   # Targeta principal amb temperatura i icona animada
│   ├── ExpertWidgets.jsx    # Giny de brúixola, pressió, pol·len, sol/lluna
│   ├── ForecastSection.jsx  # Carrusel horari i llista de 7 dies
│   ├── Header.jsx           # Cercador i controls globals
│   ├── DayDetailModal.jsx   # Detall del dia seleccionat
│   ├── RadarModal.jsx       # Mapa de precipitació
│   └── ... (WeatherIcons, WeatherUI, etc.)
│
├── 🎣 hooks/                # Custom Hooks (Lògica de Negoci)
│   ├── useWeather.js            # Connexió API (Open-Meteo) i Geolocalització
│   ├── useWeatherCalculations.js # Càlculs pesats (mitjanes, gràfiques, fons dinàmics)
│   ├── usePreferences.js        # Gestió de localStorage (Idiomes, Unitats, Favorits)
│   └── useAIAnalysis.js         # Generació de textos i alertes basats en dades
│
├── 🛠️ utils/                # Funcions d'ajuda pures
│   └── weatherLogic.js      # Lògica interna de predicció i icones
│
└── 📄 App.jsx               # Controlador principal (Layout i Composició)

```

## ✨ Característiques Principals

* **Mode Expert vs Bàsic:** Disseny responsiu que s'adapta per mostrar graelles de dades avançades o una vista simplificada.
* **Living Icons:** Icones meteorològiques que reaccionen al vent, la pluja i l'hora del dia.
* **Anàlisi AI:** Interpretació automàtica de les dades per oferir consells de roba i alertes de seguretat.
* **Previsió Precisa:** Dades minut a minut, horàries i a 7 dies utilitzant models múltiples (GFS, ICON, ECMWF).
* **Radar:** Integració de mapes de precipitació en temps real.
* **Multi-idioma:** Suport complet per a CA, ES, EN, FR.

## 🛠️ Instal·lació i Ús

1. **Clonar el repositori:**
```bash
git clone [https://github.com/tonitapias/meteoai.git](https://github.com/tonitapias/meteoai.git)
cd meteoai

```


2. **Instal·lar dependències:**
```bash
npm install

```


3. **Executar en local:**
```bash
npm run dev

```


4. **Compilar per a producció:**
```bash
npm run build

```



## 🔧 Tecnologies Utilitzades

* **React 18**: Llibreria UI.
* **Vite**: Build tool ultraràpid.
* **Tailwind CSS**: Estils i disseny responsiu.
* **Lucide React**: Iconografia vectorial.
* **Recharts**: Gràfiques de temperatura i pluja.
* **Open-Meteo API**: Font de dades meteorològiques (sense API Key).

## 🤝 Contribució

Gràcies a la nova estructura modular, afegir funcionalitats és molt senzill:

1. Si és **lògica nova**, crea un Hook a `src/hooks/`.
2. Si és **visual**, crea un component a `src/components/`.
3. Importa-ho a `App.jsx`.

---

© 2025 Meteo Toni AI - Desenvolupat amb ❤️ i React.