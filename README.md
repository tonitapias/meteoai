# 🌦️ Meteo Toni AI

Benvinguts a la **Meteo Toni AI**! 👋

Aquesta no és la típica aplicació del temps avorrida. És un projecte personal fet amb **React** on he volgut portar la previsió meteorològica un pas més enllà, barrejant dades reals amb una mica de "màgia" (lògica intel·ligent) perquè t'expliqui el temps com ho faria un amic.

## 🔗 Vols provar-la ara mateix?

No cal instal·lar res! Pots veure l'aplicació funcionant en directe aquí:

👉 **[Fes clic aquí per obrir la Meteo Toni AI](https://tonitapias.github.io/meteoai/)**

*Funciona perfectament al mòbil, a la tablet i a l'ordinador.*

---

## 😎 Què la fa especial?

Més enllà de dir-te la temperatura, aquesta app té algunes coses molt xules sota el capó:

- **🤖 El "Cervell" (AI Analysis)**: L'app analitza les dades i et genera un text personalitzat (Tipus: *"Agafa jaqueta que refresca"* o *"Consens de models, pluja segura"*).
- **☔️ Especialista en pluja**: Si hi ha un risc alt de precipitació, l'app et mostra pluja directament, encara que els sensors diguin només "núvol".
- **🏎️ Velocitat total**: Tot està pensat perquè la cerca de ciutats sigui instantània i l'app es mogui amb total fluïdesa.
- **📱 Mode Mòbil i Expert**: Pots triar entre una vista bàsica o una vista experta amb gràfics i dades avançades.

## 🌳 Estructura del Projecte

Així és com estan organitzades les peces per dins:

```text
meteoai/
├── public/                 # Arxius públics i icones
├── src/
│   ├── assets/             # Imatges i recursos visuals
│   ├── components/         # Les peces de la web
│   │   ├── Header.jsx          # Cercador, favorits i controls
│   │   ├── WeatherCharts.jsx   # Gràfics d'evolució horària
│   │   ├── WeatherWidgets.jsx  # Panells de vent, pressió, sol, etc.
│   │   ├── WeatherIcons.jsx    # Lògica visual d'icones dinàmiques
│   │   ├── DayDetailModal.jsx  # Detalls a fons de cada dia
│   │   └── WeatherUI.jsx       # Elements visuals auxiliars
│   ├── constants/          # Traduccions (CA, ES, EN, FR)
│   ├── utils/              # La "intel·ligència" de l'app
│   │   ├── weatherLogic.js     # Algorismes de predicció i neteja
│   │   └── formatters.js       # Formateig de dates i dades
│   ├── App.jsx             # El cor que mou tota la informació
│   └── main.jsx            # Punt d'entrada del codi
├── index.html              # Pàgina principal
└── package.json            # Configuració i llibreries

🛠️ Tecnologies

React + Vite (Velocitat i modernitat)

Tailwind CSS (Disseny i animacions)

Open-Meteo API (Dades de models ECMWF, GFS i ICON)

Fet amb 💙 i molt de codi per Toni Tapias.