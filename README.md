# 🌦️ MeteoToni Ai - El Temps amb Personalitat

**MeteoToni Ai** no és només una aplicació del temps. És un assistent meteorològic intel·ligent que combina dades d'alta precisió amb la potència de la **IA Generativa (Google Gemini)** per oferir-te prediccions humanes, properes i útils.

![Estat del Projecte](https://img.shields.io/badge/Status-Producció-green)
![Tecnologia](https://img.shields.io/badge/Stack-React_|_Vite_|_Tailwind-blue)
![IA](https://img.shields.io/badge/AI-Google_Gemini-purple)

---

## ✨ Característiques Principals

### 🧠 1. La IA "MeteoToni"
L'aplicació analitza les dades fredes i les converteix en consells pràctics amb dos modes automàtics:
* **Mode Enginy:** Si el temps és tranquil, el MeteoToni farà broma, utilitzarà expressions locals i serà proper.
* **Mode Alerta:** Si detecta condicions severes (vent fort, tempestes), es posa seriós i prioritza la seguretat.
* **Memòria Intel·ligent:** Utilitza un sistema de *Smart Caching* per recordar la predicció i no gastar quota d'API innecessàriament.

### 📡 2. Arquitectura de Dades Híbrida
* **Open-Meteo:** Dades globals de base.
* **Injecció AROME HD:** Quan és possible, injecta dades d'alta resolució (model francès de 1.3km) per a una precisió extrema a Catalunya i rodalies.
* **Fallback Automàtic:** Si una font falla, l'aplicació es degrada suaument sense mostrar errors a l'usuari.

### 🗺️ 3. Radar de Pluja i Mapes
* **Visualització Interactiva:** Accés directe a mapes meteorològics per veure l'evolució de les pluges i núvols en temps real.
* **Capes HD:** Suport per a visualització d'alta definició de les precipitacions.

### 📍 4. Geolocalització Avançada
* Sistema de detecció millorat que troba correctament **pobles petits, llogarets i municipis**, no només grans ciutats.
* Optimitzat per evitar crides GPS redundants.

### ⚡ 5. Rendiment i Eficiència
* **Zero-Latency UX:** Mostra dades de la caché (`localStorage`) a l'instant mentre actualitza el fons.
* **Estalvi de Quota:** Protecció contra el límit `429` de Google mitjançant la persistència de les respostes de la IA (1 hora de validesa).

---

## 🛠️ Instal·lació i Execució Local

1.  **Clona el repositori:**
    ```bash
    git clone [https://github.com/tonitapias/meteoai.git](https://github.com/tonitapias/meteoai.git)
    cd meteoai
    ```

2.  **Instal·la les dependències:**
    ```bash
    npm install
    ```

3.  **Configura les Variables d'Entorn:**
    Crea un fitxer `.env` a l'arrel del projecte i afegeix la teva clau de Google Gemini:
    ```env
    VITE_GEMINI_API_KEY=la_teva_clau_aqui
    ```
    *(Nota: Aquest fitxer està ignorat per `.gitignore` per seguretat).*

4.  **Engega el servidor de desenvolupament:**
    ```bash
    npm run dev
    ```

---

## 🚀 Desplegament (Producció)

Aquest projecte utilitza **GitHub Actions** per desplegar automàticament a **GitHub Pages**.

### Configuració de Seguretat (Secrets)
Perquè la IA funcioni en producció sense exposar la clau al codi font:

1.  Vés al repositori a GitHub → **Settings** → **Secrets and variables** → **Actions**.
2.  Crea un **New repository secret**:
    * Nom: `VITE_GEMINI_API_KEY`
    * Valor: `La teva clau de Google AI Studio`

### Workflow
Cada vegada que facis un `push` a la branca `main`, l'acció `.github/workflows/deploy.yml`:
1.  Construirà l'aplicació (`npm run build`).
2.  Injectarà la clau API de forma segura.
3.  Publicarà la web a `https://<usuari>.github.io/meteoai/`.

---

## 📂 Estructura del Projecte

```text
src/
├── components/    # Elements visuals (Targetes, Gràfics, etc.)
├── hooks/         # Lògica principal (useWeather.js amb la gestió de caché i IA)
├── services/      # Connexió amb Gemini (gemini.js amb gestió d'errors i prompts)
├── utils/         # Algoritmes de càlcul meteorològic
└── App.jsx        # Punt d'entrada

```

---

## 🛡️ Notes de Privacitat i Límits

* **API Quota:** L'aplicació està optimitzada per funcionar dins del *Free Tier* de Google Gemini (15 RPM / 1.500 RPD).
* **Geolocalització:** Les dades d'ubicació només s'utilitzen al navegador de l'usuari per consultar l'API del temps i no es guarden en cap servidor extern.

---

Fet amb ❤️ i 🌧️ per **Toni Tapias**.

```

```