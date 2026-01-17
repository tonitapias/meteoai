# 🌦️ MeteoToni AI

[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite_6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini_2.0-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-success?style=for-the-badge&logo=pwa&logoColor=white)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **La meteorologia de precisió es troba amb la narrativa intel·ligent.**

MeteoToni AI redefineix l'experiència de consultar el temps. No és només una altra app de dades; és un sistema híbrid que combina la física atmosfèrica d'alta resolució (models d'1.3km) amb la capacitat d'una IA generativa d'última generació per explicar-te què passarà realment al teu carrer, amb un llenguatge humà i conscient de la incertesa.

---

## ✨ Visió General de la Interfície

*(Substitueix aquestes imatges per captures reals de la teva aplicació per un efecte "wow")*

<div align="center">
  <img src="./public/screenshots/desktop-dashboard.png" alt="Tauler Principal Escriptori" width="800" style="border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
  <p><em>El tauler principal amb disseny Bento-Grid, mostrant dades actuals, gràfics i el resum de la IA.</em></p>
</div>

<br/>

<div align="center" style="display: flex; justify-content: center; gap: 20px;">
  <img src="./public/screenshots/mobile-arome.png" alt="Vista Mòbil AROME" width="300" style="border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
  <img src="./public/screenshots/mobile-widgets.png" alt="Widgets Avançats" width="300" style="border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
</div>
<div align="center">
  <p><em>Esquerra: Previsió horària d'alta resolució AROME HD. Dreta: Widgets experts (Cota de neu, Punt de rosada).</em></p>
</div>

---

## 🚀 Característiques Clau: Més enllà de les Dades

### 🧠 El Cervell: IA Híbrida i Conscient
A diferència dels chatbots estàndard, l'IA de MeteoToni està profundament integrada en el motor de dades:
* **Arquitectura de Doble Capa:** Generació de prediccions locals instantànies (zero latència) mentre Gemini 2.0 processa un relat enriquit en segon pla.
* **Consciència de Fiabilitat:** La IA sap si els models matemàtics discrepen. Si la fiabilitat és baixa, el resum t'ho comunicarà en lloc de donar falses certeses.
* **Narrativa Humana:** Entrenada per evitar tecnicismes ("gradients", "isoterma") i explicar fenòmens complexos com la xafogor o el risc de tempesta amb un to proper.

### 🏗️ El Motor: Física d'Alta Resolució (AROME HD)
Hem auditat i ajustat els algorismes per reflectir la realitat física:
* **Model AROME 1.3km:** Injecció de dades hiper-locals sobre els models globals (GFS/ECMWF) per a les primeres 48 hores.
* **Física de Núvols Realista:** Nou càlcul de nuvolositat efectiva que pondera més els núvols alts i mitjans, evitant icones de "sol" quan el cel està emblanquinat.
* **Tempestes Precises (CAPE):** Un sistema d'alertes que només activa la icona de tempesta si hi ha una combinació d'energia convectiva alta i precipitació activa, eliminant falsos positius.
* **Llindar "TRACE" (0.1mm):** Filtratge de dades perquè les icones de pluja només apareguin quan la precipitació és visualment perceptible.

### 📱 L'Experiència: PWA Moderna
* **Rendiment Extrem:** Construïda amb React 19 i Vite 6, amb *code-splitting* basat en rutes i components (Modals Lazy).
* **Offline-First:** Estratègia de caché robusta utilitzant **IndexedDB**, permetent que l'app funcioni i mostri les últimes dades fins i tot sense connexió.
* **Disseny Responsiu:** Interfície fluida inspirada en el disseny "Bento" que s'adapta des de mòbils fins a pantalles 4K.

---

## ⚙️ Arquitectura Tècnica (Under the Hood)

Una mirada ràpida a com està construïda l'aplicació per dins, basada en l'auditoria de producció:

| Capa | Tecnologia | Detalls d'Implementació Clau |
| :--- | :--- | :--- |
| **Frontend Core** | React 19 + TypeScript | Tipat estricte, Hooks personalitzats (`useWeather`, `useWeatherCalculations`) per separar lògica d'UI. |
| **Build Tool** | Vite 6 | Configuració optimitzada per a PWA, generació d'actius i *tree-shaking* agressiu. |
| **Estils** | Tailwind CSS | Sistema de disseny utilitari amb animacions CSS natives i Lucide Icons. |
| **Gestió d'Estat** | Context API + IDB | Memòria cau persistent d'alt rendiment (`idb-keyval`) amb *bucketing* geoespacial i TTL diferenciat (dades vs IA). |
| **Dades Externes** | Open-Meteo API | Fusió intel·ligent de múltiples models (AROME, ECMWF, GFS, ICON). |
| **Intel·ligència** | Google Gemini API | Integració via SDK amb *prompt engineering* dinàmic basat en la severitat del clima. |
| **CI/CD** | GitHub Actions | Flux de treball automatitzat per a build, validació de tipus i desplegament segur a GitHub Pages. |

---

## 🛠️ Instal·lació Local

Si vols explorar el codi font:

1.  **Clona el repositori:**
    ```bash
    git clone [https://github.com/tonitapias/meteoai.git](https://github.com/tonitapias/meteoai.git)
    cd meteoai
    ```

2.  **Instal·la les dependències:**
    ```bash
    npm install
    ```

3.  **Configura l'entorn:**
    Crea un fitxer `.env` a l'arrel i afegeix la teva clau d'API de Google Gemini:
    ```env
    VITE_GEMINI_API_KEY=la_teva_clau_aquí
    ```

4.  **Arranca el servidor de desenvolupament:**
    ```bash
    npm run dev
    ```

5.  **Executa els tests (Validació de lògica física):**
    ```bash
    npm test
    ```

---

## 📄 Llicència i Crèdits

* Desenvolupat per Toni Tapias - © 2025.
* Llicència MIT.
* Dades meteorològiques proporcionades per [Open-Meteo](https://open-meteo.com/) sota llicència Creative Commons.
* IA impulsada per Google Gemini.

---
<div align="center">
  <p><em>Fet amb ❤️, ⚛️ i molts ☁️ a Barcelona.</em></p>
</div>