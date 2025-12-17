# 🌦️ Meteo Toni AI

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![Open-Meteo](https://img.shields.io/badge/Open--Meteo-API-orange?style=for-the-badge)

**Meteo Toni AI** és una aplicació meteorològica avançada desenvolupada amb React que combina dades de múltiples models numèrics (ECMWF, GFS, ICON) amb un motor d'anàlisi intel·ligent per oferir previsions precises i fàcils d'entendre.

A diferència de les apps convencionals, aquesta eina està dissenyada tant per a usuaris bàsics com per a **aficionats a la meteorologia**, incloent-hi mètriques avançades com el CAPE, el Punt de Rosada i mapes de models comparatius.

## ✨ Funcionalitats Principals

### 🧠 Intel·ligència Meteorològica (AI)
* **Motor d'Anàlisi Heurístic:** Genera resums textuals automàtics basats en variables complexes (inestabilitat, vent, pressió).
* **Alertes Intel·ligents:** Avisos personalitzats per tempestes severes (basat en CAPE), risc de nevades o xafogor extrema.
* **Consells Dinàmics:** Recomanacions de roba i activitats segons la previsió.

### 📊 Dades "Pro" i Multi-Model
* **Comparativa de Models:** Visualització simultània de les previsions del model Europeu (**ECMWF**), Americà (**GFS**) i Alemany (**ICON**) per detectar la incertesa (divergència).
* **Índexs Avançats:**
    * ⚡ **CAPE (J/kg):** Potencial d'energia convectiva per predir tempestes.
    * 💧 **Punt de Rosada:** Càlcul precís de la sensació de xafogor (Fórmula de Magnus).
    * 📉 **Tendència Baromètrica:** Detecció de canvis de pressió (puja/baixa/estable).
* **Nowcasting:** Previsió de pluja minut a minut per a la pròxima hora.

### 🎨 Experiència d'Usuari (UX/UI)
* **Disseny Glassmorphism:** Interfície moderna amb efectes de transparència i fons dinàmics que canvien segons l'hora i el temps (dia/nit, pluja, neu).
* **Visualització de Dades:** Gràfics SVG personalitzats (sense llibreries externes pesades) per a un rendiment òptim.
* **Modes de Visualització:**
    * 👓 **Mode Essencial:** Informació clara i directa per al dia a dia.
    * 🔬 **Mode Avançat:** Panell de control complet amb totes les variables tècniques.
* **Multilingüe:** Disponible en Català, Castellà, Anglès i Francès.

## 🛠️ Stack Tecnològic

El projecte ha estat construït seguint una **arquitectura modular** per garantir l'escalabilitat i el manteniment.

* **Core:** [React](https://react.dev/) (Hooks: `useState`, `useEffect`, `useMemo`, `useRef`).
* **Build Tool:** [Vite](https://vitejs.dev/) (Rendiment ultraràpid).
* **Estils:** [Tailwind CSS](https://tailwindcss.com/) (Disseny responsiu i glassmorphism).
* **Icones:** [Lucide React](https://lucide.dev/).
* **Dades:**
    * [Open-Meteo API](https://open-meteo.com/): Dades meteorològiques (gratuït i open-source).
    * [Nominatim (OSM)](https://nominatim.org/): Geolocalització i cerca de llocs.

## 📂 Estructura del Projecte

El codi s'ha refactoritzat per separar la lògica de negoci de la interfície d'usuari:

```bash
src/
├── components/         # Components visuals reutilitzables
│   ├── WeatherCharts.jsx   # Gràfics SVG (Previsió horària, pluja minut a minut)
│   └── WeatherWidgets.jsx  # Widgets petits (Sol, Lluna, Vent, CAPE...)
├── utils/              # Lògica pura i càlculs
│   └── weatherLogic.js     # Normalització de models, fórmules (Magnus), motor IA
├── constants/          # Dades estàtiques
│   └── translations.js     # Diccionaris d'idiomes (i18n)
└── App.jsx             # Controlador principal i gestió d'estat