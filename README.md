\<div align="center"\>  
\<img src="public/vite.svg" alt="Logo" width="80" height="80" /\>

# **🌍 MeteoToni AI**

**La nova generació de predicció meteorològica intel·ligent.**

[Veure Demo](https://tonitapias.github.io/meteoai/) · [Informar d'un Error](https://www.google.com/search?q=https://github.com/tonitapias/meteoai/issues) · [Sol·licitar Funció](https://www.google.com/search?q=https://github.com/tonitapias/meteoai/issues)

\</div\>

## **📖 Sobre el Projecte**

**MeteoToni AI** és una aplicació meteorològica avançada que transcendeix la simple visualització de dades. Utilitza algorismes d'interpretació de dades ("IA") per convertir mètriques meteorològiques complexes en resums textuals naturals, consells de salut i recomanacions de vestimenta.

A diferència de les apps convencionals, MeteoToni AI integra **comparatives multi-model** (ECMWF, GFS, ICON) per oferir un consens de predicció més fiable, tot presentat en una interfície immersiva que reacciona visualment a les condicions actuals.

## **✨ Característiques Principals**

### **🧠 Intel·ligència Meteorològica**

* **Anàlisi Textual Dinàmica**: Generació automàtica de resums diaris (Ex: "Dia plàcid", "Risc de tempestes") basats en l'anàlisi creuada de múltiples variables.  
* **Smart Tips**: Consells personalitzats sobre roba, hidratació, protecció solar i ús de paraigües segons les condicions exactes del moment.  
* **Alertes Intel·ligents**: Sistema de notificacions visuals per fenòmens extrems (Vent fort, UV extrem, Qualitat de l'aire perillosa).

### **📊 Precisió i Dades Multi-Model**

* **Consens de Models**: Visualitza i compara dades de tres dels models més prestigiosos del món:  
  * 🇪🇺 **ECMWF** (Model Europeu \- Best Match)  
  * 🇺🇸 **GFS** (Model Americà)  
  * 🇩🇪 **ICON** (Model Alemany)  
* **Previsió Minut a Minut**: Gràfica de precipitació d'alta precisió per a la pròxima hora (Nowcasting).  
* **Modes de Vista**:  
  * **Bàsic**: Per a una consulta ràpida i visual.  
  * **Expert**: Gràfiques comparatives detallades, gauges de pressió/humitat i dades tècniques.

### **🌿 Salut i Astronomia**

* **Qualitat de l'Aire (AQI)**: Monitoratge en temps real de contaminants.  
* **Rastrejador de Pol·len**: Nivells específics per a al·lèrgics (Gramínies, olivera, bedoll, etc.).  
* **Astro-Widgets**:  
  * Cicle solar interactiu amb hores daurades/blaves.  
  * Fases lunars renderitzades amb precisió astronòmica.

### **🎨 Experiència d'Usuari (UX)**

* **Fons Dinàmics**: Gradients que canvien segons l'hora (alba, dia, capvespre, nit) i el temps (pluja, neu, sol).  
* **Partícules Reactives**: Efectes visuals de pluja i neu que responen a la intensitat de la precipitació real.  
* **Multi-idioma**: 🇦🇩 Català, 🇪🇸 Castellà, 🇬🇧 Anglès, 🇫🇷 Francès.

## **🛠️ Stack Tecnològic**

Aquest projecte està construït amb un stack modern enfocat al rendiment i l'experiència de desenvolupament:

| Tecnologia | Ús |
| :---- | :---- |
| **[React 19](https://react.dev/)** | Llibreria UI principal (Hooks, Custom Hooks). |
| [**Vite**](https://vitejs.dev/) | Bundler i entorn de desenvolupament ultraràpid. |
| [**Tailwind CSS**](https://tailwindcss.com/) | Estils utility-first i disseny responsive. |
| [**Open-Meteo API**](https://open-meteo.com/) | Font de dades meteorològiques (Open Source). |
| [**Nominatim API**](https://nominatim.org/) | Geocodificació inversa i cerca de llocs. |
| [**Lucide React**](https://lucide.dev/) | Iconografia vectoritzada i lleugera. |

## **🚀 Instal·lació i Ús Local**

Segueix aquests passos per clonar i executar el projecte a la teva màquina local:

### **Prerequisits**

* **Node.js** (v18 o superior)  
* **npm** o **yarn**

### **Passos**

1. **Clona el repositori:**  
   git clone \[https://github.com/tonitapias/meteoai.git\](https://github.com/tonitapias/meteoai.git)  
   cd meteoai

2. **Instal·la les dependències:**  
   npm install

3. **Inicia el servidor de desenvolupament:**  
   npm run dev

   L'aplicació estarà disponible a http://localhost:5173.  
4. **Compila per a producció:**  
   npm run build

## **📂 Estructura del Projecte**

meteoai/  
├── public/              \# Assets estàtics (imatges, robots.txt)  
├── src/  
│   ├── assets/          \# Logos i vectors  
│   ├── App.jsx          \# Component Principal (Lògica de negoci i UI)  
│   ├── main.jsx         \# Punt d'entrada React  
│   └── index.css        \# Directives Tailwind i estils globals  
├── eslint.config.js     \# Configuració de Linter  
├── tailwind.config.js   \# Configuració de Tailwind  
└── vite.config.js       \# Configuració de Vite

## **🤝 Contribució**

Les contribucions són benvingudes\! Si tens idees per millorar l'algorisme de predicció o la interfície:

1. Fes un **Fork** del projecte.  
2. Crea una branca per a la teva funcionalitat (git checkout \-b feature/NovaFuncionalitat).  
3. Fes **Commit** dels canvis (git commit \-m 'Afegida nova gràfica de vent').  
4. Fes **Push** a la branca (git push origin feature/NovaFuncionalitat).  
5. Obre un **Pull Request**.

## **📄 Llicència**

Distribuït sota la llicència **MIT**. Consulta el fitxer LICENSE per a més informació.

## **👨‍💻 Autor**

Desenvolupat amb ❤️ per **Toni Tapias**.

* **GitHub**: [@tonitapias](https://www.google.com/search?q=https://github.com/tonitapias)  
* **Web**: [tonitapias.github.io/meteoai](https://tonitapias.github.io/meteoai/)

\<p align="center"\>  
Si t'agrada aquest projecte, considera donar-li una estrella ⭐ al repositori\!  
\</p\>