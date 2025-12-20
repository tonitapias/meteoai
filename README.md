# 🌦️ Meteo Toni AI

Benvinguts a la **Meteo Toni AI**! 👋

Aquesta no és la típica aplicació del temps avorrida. És un projecte personal on he volgut portar la previsió meteorològica un pas més enllà, barrejant dades reals amb una mica de "màgia" (lògica intel·ligent) perquè t'expliqui el temps com ho faria un amic.

Ara, **totalment internacionalitzada** i més robusta que mai!

## 🔗 Vols provar-la ara mateix?

No cal instal·lar res! Pots veure l'aplicació funcionant en directe aquí:

👉 **[Fes clic aquí per obrir la Meteo Toni AI](https://tonitapias.github.io/meteoai/)**

*Funciona perfectament al mòbil, a la tablet i a l'ordinador.*

---

## 😎 Què la fa especial?

Més enllà de dir-te la temperatura, aquesta app té algunes coses molt xules sota el capó:

- **🌍 Multi-idioma (NOU!)**: L'app ara parla 4 idiomes: **Català, Castellà, Anglès i Francès**. Pots canviar d'idioma a l'instant i tot el contingut (inclosos els anàlisis d'IA) s'adapta.
- **🤖 El "Cervell" (AI Analysis)**: L'app analitza les dades i et genera un text personalitzat (Tipus: *"Agafa jaqueta que refresca"* o *"Consens de models, pluja segura"*).
- **📡 Radar i Cota de Neu**: Inclou visualització de radar de precipitació en temps real i un giny específic per a la cota de neu quan fa fred.
- **🛡️ Robustesa Total**: Sistema protegit perquè puguis consultar el temps sempre, fins i tot si falten algunes dades puntuals.
- **☔️ Especialista en pluja**: Si hi ha un risc alt de precipitació, l'app et mostra pluja directament, encara que els sensors diguin només "núvol".
- **📱 Mode Mòbil i Expert**: Pots triar entre una vista bàsica o una vista experta amb gràfics comparatius, CAPE, Punt de Rosada i més.

## 🌳 Estructura del Projecte

Així és com estan organitzades les peces per dins:

```text
meteoai/
├── public/                 # Arxius estàtics públics
│   ├── Robots.txt
│   ├── Sitemap.xml
│   └── vite.svg
├── src/
│   ├── assets/             # Recursos gràfics
│   ├── components/         # Les peces visuals de l'app
│   │   ├── DayDetailModal.jsx  # Finestra amb detalls del dia
│   │   ├── Header.jsx          # Capçalera amb cerca, idiomes i controls
│   │   ├── RadarModal.jsx      # Visor del radar de pluja
│   │   ├── WeatherCharts.jsx   # Gràfics de previsió
│   │   ├── WeatherIcons.jsx    # Lògica de les icones animades
│   │   ├── WeatherUI.jsx       # Elements visuals auxiliars
│   │   └── WeatherWidgets.jsx  # Ginys individuals (Sol, Lluna, Vent...)
│   ├── constants/          # Dades constants
│   │   └── translations.js     # Diccionari de traduccions (CA, ES, EN, FR)
│   ├── utils/              # Lògica i funcions d'ajuda
│   │   ├── formatters.js       # Formateig de textos i números
│   │   └── weatherLogic.js     # "Cervell" de predicció i anàlisi AI
│   ├── App.css             # Estils globals
│   ├── App.jsx             # Component principal
│   └── main.jsx            # Punt d'entrada
├── index.html              # Pàgina principal
└── package.json            # Configuració del projecte

Fet amb 💙 per Toni Tapias.