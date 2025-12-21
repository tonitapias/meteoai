# 🌤️ MeteoToni AI

> **La previsió del temps, reinterpretada.**
> Una aplicació meteorològica intel·ligent que prioritza el "realisme de finestra" i l'anàlisi de dades avançat.

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&style=flat-square)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite&style=flat-square)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&style=flat-square)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)]()

[**🔗 Veure Demo en Viu**](https://tonitapias.github.io/meteoai)

---

## 📖 Sobre el Projecte

**MeteoToni AI** no és només una altra aplicació del temps que escup dades crues. És una eina dissenyada per interpretar la meteorologia com ho faria un humà: mirant per la finestra.

Utilitzant la potència d'**Open-Meteo** i **RainViewer**, l'aplicació analitza múltiples models (ECMWF, GFS, ICON) i dades de radar en temps real per oferir una experiència coherent. Si el model diu "Ennuvolat" però el radar detecta pluja, l'app et dirà que plou.

## ✨ Funcionalitats Clau

### 🧠 Intel·ligència "De Finestra"
- **Nowcasting Realista:** L'app prioritza les dades de precipitació minut a minut. Si cauen "quatre gotes" (<0.2mm) o hi ha un "diluvi" (>2mm), el text i les icones s'adapten a la realitat instantània, ignorant les etiquetes generals si cal.
- **Anàlisi IA:** Generació de resums textuals naturals que interpreten la sensació tèrmica, el vent i la inestabilitat, oferint consells de roba i alertes.

### 📊 Dades Avançades (Mode Expert)
- **Cota de Neu Realista:** Càlcul precís (`Isoterma 0ºC - 300m`) amb visualització gràfica intuïtiva.
- **Índexs de Confort:** Punt de Rosada (xafogor), Índex CAPE (potencial de tempesta) i Qualitat de l'Aire.
- **Nivells de Pol·len:** Informació detallada per a al·lèrgics (Vern, Gramínies, Olivera, etc.).

### 📡 Radar Predictiu
- Mapa interactiu integrat amb **RainViewer**.
- **Animació de futur (+2h):** Veus cap a on es mouen les tempestes per anticipar-te.

### 🎨 Disseny i UX
- **Interfície Glassmorphism:** Disseny modern, net i adaptat a dispositius mòbils i escriptori.
- **Fons Dinàmics:** Canvien segons l'hora solar real (no de rellotge) i les condicions meteorològiques.
- **Gràfics Interactius:** Evolució horària de temperatura, pluja, vent i cota de neu.

## 📂 Estructura del Projecte

El codi està organitzat de manera modular per facilitar-ne el manteniment:

```text
meteoai/
├── public/                 # Recursos estàtics (icones, robots.txt)
├── src/
│   ├── assets/             # Imatges i logos
│   ├── components/         # Components de React
│   │   ├── DayDetailModal.jsx  # Modal amb detalls diaris
│   │   ├── Header.jsx          # Capçalera i cercador
│   │   ├── RadarModal.jsx      # Mapa de radar
│   │   ├── WeatherCharts.jsx   # Gràfics SVG (D3/Custom)
│   │   ├── WeatherIcons.jsx    # Lògica d'icones dinàmiques
│   │   ├── WeatherUI.jsx       # Elements d'interfície (Banderes, Text)
│   │   └── WeatherWidgets.jsx  # Ginys petits (Sol, Lluna, Vent...)
│   ├── constants/
│   │   └── translations.js     # Textos en 4 idiomes
│   ├── utils/
│   │   ├── formatters.js       # Funcions de format
│   │   └── weatherLogic.js     # "Cervell" de l'app (càlculs meteo)
│   ├── App.jsx             # Component principal i gestió d'estat
│   ├── main.jsx            # Punt d'entrada
│   └── index.css           # Estils globals Tailwind
├── package.json
└── vite.config.js

🛠️ Tecnologies Utilitzades
Frontend: React 19 + Vite

Estils: Tailwind CSS (Disseny responsiu i animacions)

Icones: Lucide React (Coherència visual)

Dades Meteorològiques: Open-Meteo API

Radar i Satèl·lit: RainViewer API

Geocoding: Nominatim (OpenStreetMap)

🚀 Instal·lació i Desplegament
Si vols executar el projecte localment:

Clonar el repositori:

Bash

git clone [https://github.com/tonitapias/meteoai.git](https://github.com/tonitapias/meteoai.git)
cd meteoai
Instal·lar dependències:

Bash

npm install
Executar en mode desenvolupament:

Bash

npm run dev
Construir per a producció:

Bash

npm run build
Desplegament a GitHub Pages
El projecte està configurat per desplegar-se fàcilment:

Bash

npm run deploy

🌍 Idiomes Suportats
L'aplicació està totalment localitzada en:

CA Català

🇪🇸 Castellà

🇬🇧 Anglès

🇫🇷 Francès

🤝 Contribucions
Les suggerències i millores són benvingudes! Si tens alguna idea per fer l'app encara més "llista", no dubtis a obrir una issue o un pull request.

<p align="center"> Fet amb ❤️ i molt de ☕ per <b>Toni Tapias</b> </p>