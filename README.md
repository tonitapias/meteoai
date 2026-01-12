# 🌦️ Meteo Toni AI (v2.5 Pro)

> Una aplicació meteorològica de nova generació impulsada per Intel·ligència Artificial i dissenyada amb una interfície "Glassmorphism" professional.

![Version](https://img.shields.io/badge/version-2.5%20Pro-blue) ![React](https://img.shields.io/badge/React-18-61DAFB) ![Vite](https://img.shields.io/badge/Vite-5-646CFF) ![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC)

## ✨ Característiques Principals

### 🧠 Intel·ligència Artificial (Gemini Flash)
- **Anàlisi en Temps Real:** Generació de resums meteorològics detallats, consells de roba i alertes basades en les dades actuals.
- **Dades Híbrides:** Fusió intel·ligent de models meteorològics per oferir la màxima precisió.

### 🎨 Disseny & UX (Glassmorphism)
- **Interfície Adaptativa (Responsive):**
  - **Mòbil:** Gràfics optimitzats amb pestanyes (Temp | Pluja | Vent) i scroll horitzontal per evitar distorsions.
  - **Escriptori:** Layout asimètric professional (Panell de Control vs Tauler de Dades).
- **Icones Vives:** Animacions suaus segons la velocitat del vent i la precipitació.
- **Fons Dinàmics:** Canvien automàticament segons l'hora del dia (sortida/posta de sol) i el codi del temps (neu, tempesta, sol, etc.).

### 📊 Dades Meteorològiques Avançades
- **Models Comparatius:** Visualització simultània de **ECMWF, GFS i ICON**.
- **Previsió AROME HD:** Accés a dades d'alta resolució (1.3km) amb indicador "Live HD" i detall hora a hora.
- **Quantitats Precises:** Previsió de precipitació en **mm** (pluja) i **cm** (neu acumulada).
- **Incertesa i Divergència:** Alerta automàtica quan els models discrepen significativament.

### 🛠️ Ginys Experts
- **Radar i Satèl·lit:** Mapes interactius.
- **Cota de Neu:** Gràfic dedicat per a la isoterma 0ºC.
- **Qualitat de l'Aire:** Nivells de pol·len i índex AQI europeu.
- **Astronomia:** Arc solar i fases lunars precises.

## 🚀 Tecnologies

- **Core:** [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/).
- **Estils:** [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) (Icones).
- **Dades:** - [Open-Meteo API](https://open-meteo.com/) (Temps i Models).
  - [BigDataCloud API](https://www.bigdatacloud.com/) (Geocodificació inversa CORS-friendly).
  - [Google Gemini API](https://ai.google.dev/) (Intel·ligència Artificial).
- **Rendiment:** `IndexedDB` per a cau local i `React.memo` per a renderitzat eficient.

## ⚙️ Instal·lació i Execució

1. **Clonar el repositori:**
   ```bash
   git clone [https://github.com/el-teu-usuari/meteo-toni-ai.git](https://github.com/el-teu-usuari/meteo-toni-ai.git)
   cd meteo-toni-ai

```

2. **Instal·lar dependències:**
```bash
npm install

```


3. **Configurar variables d'entorn:**
Crea un fitxer `.env` a l'arrel i afegeix la teva clau de Gemini:
```env
VITE_GEMINI_API_KEY=la_teva_clau_api_aqui

```


4. **Arrencar en mode desenvolupament:**
```bash
npm run dev

```


5. **Compilar per a producció:**
```bash
npm run build

```



## 📱 Captures de Pantalla

| Vista Mòbil | Vista Escriptori |
| --- | --- |
| https://github.com/tonitapias/meteoai/blob/main/public/screenshot-mobile.png | https://github.com/tonitapias/meteoai/blob/main/public/screenshot-desktop.png |

## 🌍 Idiomes Suportats

* Català (Per defecte)
* Castellà
* Anglès
* Francès

## 📄 Llicència

Aquest projecte està sota la llicència MIT.

---

**Designed by MeteoAIToni** | Powered by Open-Meteo & Google Gemini

```

```