# 🌤️ Meteo Toni AI

**Meteo Toni AI** és una aplicació meteorològica de nova generació construïda amb **React** i **Vite**. Va més enllà de la simple previsió, oferint una anàlisi textual "tipus IA", comparativa entre múltiples models meteorològics (GFS, ICON, ECMWF) i una experiència visual immersiva amb fons dinàmics i efectes de partícules.

## ✨ Funcionalitats Clau

- **🧠 Anàlisi Intel·ligent**: Algoritme que genera resums de les condicions, riscos i consells de roba en llenguatge natural.
- **📊 Comparativa Multi-Model**: Compara les previsions dels models **ECMWF**, **GFS** i **ICON** per detectar divergències i assegurar la fiabilitat.
- **🎨 Interfície Immersiva**: 
  - Fons degradats dinàmics basats en el codi de temps, l'hora del dia (Hora Daurada/Blava) i la sortida/posta de sol.
  - Sistema de partícules per a pluja 🌧️ i neu ❄️.
  - Icones animades amb Lucide React.
- **🌍 Global i Local**: 
  - Cerca precisa d'ubicacions amb autocompletat.
  - Suport per a Geolocalització.
  - Ajust automàtic a la zona horària local del lloc cercat.
- **📉 Mètriques Avançades**:
  - Gràfiques de precipitació minut a minut (pròxima hora).
  - Índex CAPE, Punt de Rosada, tendències de pressió.
  - Visualització de l'Arc Solar i Fase Lunar.
  - Qualitat de l'aire (AQI) i nivells de pol·len.
- **⚙️ Personalitzable**:
  - **Modes**: Bàsic (Visió general) vs. Expert (Dades tècniques).
  - **Idiomes**: Català, Castellà, Anglès, Francès.
  - **Unitats**: Celsius/Fahrenheit.

## 🛠️ Tecnologies Utilitzades

- **Framework**: [React](https://reactjs.org/) (Hooks, Context, Memoization)
- **Eina de Build**: [Vite](https://vitejs.dev/)
- **Estils**: [Tailwind CSS](https://tailwindcss.com/)
- **Icones**: [Lucide React](https://lucide.dev/)
- **Dades**: [Open-Meteo API](https://open-meteo.com/) (Gratuït, ús no comercial)
- **Geocoding**: OpenStreetMap (Nominatim)

## 📂 Estructura del Projecte

El projecte segueix una arquitectura modular i neta:

```bash
src/
├── components/       # Components d'Interfície
│   ├── DayDetailModal.jsx  # Detall diari i comparativa
│   ├── WeatherCharts.jsx   # Integració de gràfiques (Recharts)
│   ├── WeatherIcons.jsx    # Lògica visual, icones i partícules
│   ├── WeatherWidgets.jsx  # Gauges, widgets de sol/lluna
│   └── WeatherUI.jsx       # Elements UI petits (Text tipus màquina, Banderes)
├── utils/            # Funcions auxiliars
│   ├── formatters.js       # Format de dates, hores i unitats
│   └── weatherLogic.js     # Càlculs físics (Punt de rosada, etc.)
├── constants/        # Dades estàtiques
│   └── translations.js     # Diccionaris d'idiomes (i18n)
└── App.jsx           # Lògica principal de l'aplicació