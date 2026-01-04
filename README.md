# 🌤️ MeteoToniAi (PWA Edition)

**MeteoToniAi** és una aplicació meteorològica d'última generació construïda amb **React 19** i **Vite**.

Més enllà de mostrar dades crues, utilitza un **Motor Híbrid Intel·ligent** que combina models globals (ECMWF) amb models d'alta resolució (AROME) i un sistema expert ("AI") per interpretar el temps en llenguatge natural.

> **🚀 NOVETAT:** Ara és una **Progressive Web App (PWA)**. Pots instal·lar-la al teu mòbil com una aplicació nativa!

---

## 📱 Novetats de la Versió "PWA"

Hem transformat l'experiència web en una aplicació mòbil completa:

* **📲 Instal·lable:** Afegeix l'app a la pantalla d'inici del teu Android o iPhone. Sense passar per la botiga d'aplicacions.
* **⚡ Rendiment Extrem:** Càrrega intel·ligent de components (*Lazy Loading*) i optimització de gràfics (*React.memo*). L'app és ara molt més ràpida i lleugera.
* **🖼️ Mode Immersiu:** Funciona a pantalla completa ("standalone"), eliminant la barra del navegador per a una experiència 100% nativa.
* **🎨 Icones Adaptatives:** Noves icones d'alta resolució que s'adapten perfectament a iOS i Android.

---

## ✨ Característiques Principals

### 1. Motor Híbrid Intel·ligent
L'aplicació decideix dinàmicament quina font de dades utilitzar segons la ubicació i necessitat:
* **ECMWF IFS (Global):** Per a previsions generals a llarg termini.
* **AROME France (Alta Resolució - 1.3km):** S'injecta automàticament ("Híbrid") per a les pròximes 48h a Europa Occidental. Millora dràsticament la precisió en tempestes, vent local i orografia.

### 2. El "Cervell" (AI System)
Un sistema expert local (no requereix API externa de xat) que:
* Analitza variables complexes (CAPE, Punt de Rosada, Isoterma 0ºC).
* Genera resums en llenguatge natural: *"Està plovent feblement, però s'espera que pari en 20 minuts."*
* Emet **alertes de seguretat** i consells de roba basats en la sensació tèrmica real.

### 3. UI "Emerald" & Glassmorphism
* **Indicador de Batec:** Un punt de llum verd (`animate-ping`) indica quan el model d'alta precisió AROME està actiu.
* **Disseny Modern:** Transparències, efectes de vidre i colors cian/turquesa per denotar tecnologia.

---

## 🛠️ Stack Tecnològic

* **Core:** React 19 + Vite
* **Estils:** Tailwind CSS 3
* **Mapes:** Leaflet + React-Leaflet
* **PWA:** Vite Plugin PWA (Service Workers + Manifest)
* **Icones:** Lucide React

---

## 📂 Com instal·lar al mòbil

Un cop desplegada, visita la web des del teu dispositiu:

### 🤖 Android (Chrome)
1.  Obre el menú (els 3 punts a dalt a la dreta).
2.  Prem **"Instal·lar aplicació"** o **"Afegir a la pantalla d'inici"**.

### 🍎 iOS (Safari)
1.  Prem el botó **"Compartir"** (quadrat amb fletxa, a baix al centre).
2.  Desplaça't cap avall i selecciona **"Afegir a la pantalla d'inici"**.

---

## 🚀 Desenvolupament i Desplegament

### Executar en local
```bash
npm install
npm run dev

```

### Provar la PWA en local (Build Preview)

Les característiques PWA (instal·lació, service workers) només funcionen amb la build de producció:

```bash
npm run build
npm run preview

```

### Desplegar a GitHub Pages

El projecte està configurat per pujar automàticament la carpeta `dist` optimitzada:

```bash
npm run deploy

```

---

## 🌍 Crèdits de Dades

* **Meteorologia:** [Open-Meteo API](https://open-meteo.com/) (Models: ECMWF IFS, AROME France, GFS, ICON).
* **Geocoding:** [OpenStreetMap / Nominatim](https://nominatim.org/).
* **Qualitat Aire:** Copernicus Atmosphere Monitoring Service.

---

Desenvolupat amb ❤️ per **Toni Tapias**

```

```