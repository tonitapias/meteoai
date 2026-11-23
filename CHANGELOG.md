# Registre de canvis

Totes les novetats de MeteoToni AI, de la versió més recent a la més antiga. Cada versió té la seva etiqueta git (`vX.Y.Z`): per veure el codi d'una versió o comparar-ne dues, per exemple [v3.68.0...v3.69.0](https://github.com/tonitapias/meteoai/compare/v3.68.0...v3.69.0). La *release* de GitHub és la de l'última versió i enllaça aquí.

Les seccions «Millores publicades entre la vX i la vY» recullen el que es va publicar sense canviar de versió. Les de la v3.26.0 i la v3.9.9, al final, són les notes de les primeres *releases*, tal com es van escriure.

## 🖥️ Novetats de la v3.69.0: el detall del dia a l'ordinador, i la neu es diu neu

- **El detall del dia, en dues columnes a l'ordinador.** A partir de 1.024 px el detall s'eixampla: a l'esquerra, el resum, l'avís oficial del dia, les xifres i els gràfics horaris (Temp · Pluja · Vent · Neu, amb els models); a la dreta, la columna del dia. Es veuen totes dues coses alhora, sense el commutador «Columna | Gràfic». Al mòbil i a la tauleta, tot queda igual.
- **Amb neu, l'app parla de neu.** La insígnia de l'anàlisi de la IA diu «Neu dubtosa» o «Neu incerta» (abans, «Pluja incerta» en plena nevada), i «Precipitació dubtosa» o «incerta» quan pot ser qualsevol de les dues. El gràfic de les pròximes 24 h diu «Prob. precipitació», i el lector de pantalla llegeix «de probabilitat de neu» als dies i a les hores de neu, també sota zero sense precipitació prevista.
- **El radar ja no contradiu la previsió.** Si la previsió ja diu que neva o plou i el radar encara no ho veu (a dalt d'un cim, per exemple, no hi veu la neu feble), l'avís ho diu així: «La previsió diu que ja neva, però el radar encara no ho veu aquí: segons el radar, arribaria d'aquí a uns 30 min.» Abans deia «podria començar a nevar» amb «Nevada moderada» a la capçalera.
- Als quatre idiomes.

## 📅 Novetats de la v3.68.0: el detall del dia, en una columna

- **La columna del dia.** El detall d'un dia porta la franja del cel de la Previsió girada: les hores de dalt a baix, una per fila, amb el cel de cada hora (els mateixos codis que les icones), la temperatura com una corba que baixa per la columna amb el marge entre els models globals en gris al darrere, la pluja com un histograma de costat i el vent amb la fletxa cap on bufa. Les hores de nit s'enfosqueixen, la sortida i la posta tallen la columna i, avui, una línia marca l'hora en curs. Fa la feina que feien els moments del dia, les targetes i la taula de 24 files.
- **«Columna | Gràfic».** Un toc torna als gràfics horaris de sempre (Temp · Pluja · Vent · Neu, amb els models).
- **Els vuit dies, a dalt.** Cada dia amb la seva mini-franja del cel: un toc i canvies de dia. Les fletxes del teclat i el lliscament continuen funcionant.
- **Un resum que es llegeix.** El cel, la data, la mínima i la màxima en dues línies, i la fiabilitat i el rang probable en una frase en lloc de tres xips. Les xifres del dia (pluja o neu, vent màxim amb la ratxa, UV amb la seva categoria, i les hores de sol o la cota de neu) van en una sola fila.
- **Avisos oficials del dia.** Si un avís toca aquell dia, surt sota el resum amb les hores i la font, i el dia porta un punt ambre al selector.
- **Finestra seca.** Els dies que plou, el tram sense pluja més llarg (3 hores o més), marcat també a la columna.
- **Ratxes i sensació, quan es noten.** La ratxa de cada hora surt en ambre quan és forta (40 km/h o més, o 15 més que el vent mitjà a partir de 25), i la sensació tèrmica quan s'allunya 3° o més de la temperatura.
- **Més curt i més lleuger.** Al mòbil el detall fa menys de la meitat d'alt (de 3.870 a uns 1.340 px), la creu de tancar ja no tapa la posta ni res, i fora els desenfocaments, les resplendors i les capses dins de capses.
- **La neu, en cm a tota l'app.** La unitat la tria el que cau més: neu en cm (també una nevada de 0,1 cm) i pluja en mm. Abans, en plena nevada feble, la tira de 24 h deia «0,1 mm», la previsió immediata «0,0mm», el gràfic de les 24 h «Total 0,3 mm · Inici de pluja» i «AROME HD contra el global» «Neu 0 mm». Ara també ho diuen en cm el modal del model regional i el resum que rep la IA, i la llegenda de la tira diu les unitats que hi ha.
- **Els avisos del radar diuen neu quan neva.** «Podria començar a nevar d'aquí a uns 30 min», «La neu s'ha avançat», «Neu no prevista», o «la pluja o la neu» quan pot ser qualsevol de les dues, segons el cel previst i la temperatura d'ara. A la Pica d'Estats, a -8 °C i nevant, deia «la pluja podria començar».
- Als quatre idiomes.

## 🗓️ Novetats de la v3.67.0: la pestanya Previsió, redissenyada

- **La setmana comença avui.** La primera fila de la llista és avui, amb la màxima, la mínima i la icona de tot el dia, les mateixes que la targeta principal i el detall; obre el detall d'avui. El botó «Avui» de la capçalera ja no cal.
- **La franja del cel de cada dia.** Sota cada dia, una franja de 24 hores amb el cel de cada hora: sol, clarianes, núvol, boira, pluja, neu, tempesta o nit. Es veu quan plourà o farà sol, no només si en farà. Surt dels mateixos codis que trien la icona del dia, així que no poden dir coses diferents. La quantitat de pluja va a sota, on cau, i a la fila d'avui les hores passades s'apaguen i una marca diu on és ara. A l'ordinador i a la tauleta, cada dia fa una sola línia i les franges apilades es llegeixen com un mosaic de dies i nits.
- **Les pròximes 24 hores, d'un cop d'ull.** El gràfic surt de seguida: quatre pestanyes curtes (Temp · Pluja · Vent · Neu) que hi caben a qualsevol mòbil, també a l'ordinador. Una sola lectura gran dona el valor de l'hora (la d'ara, o la que toques o per on passes el ratolí) i el de cada model, en lloc de les tres targetes i els cinc xips d'abans. L'acord entre models porta una frase que diu d'on surt («fins a 4,0° de diferència a les 05H»).
- **Es veu quina és la previsió.** La previsió va en color i els quatre models globals en gris fi, cadascun amb el seu traç, sense resplendor. A la temperatura, la màxima, la mínima i el desacord màxim van marcats sobre la corba, com al giny de Detall; la pluja, el vent i la cota de neu porten les seves xifres en una línia a sota. L'escala, a la dreta. Els models que vulguis amagar, des de «Models».
- **AROME HD contra el global, en tres files.** Les tres xifres d'ara (temperatura, pluja i vent) del model regional i del global, amb la diferència, en tres files al mòbil i en tres columnes a l'ordinador. Cada una obre el seu detall com abans.
- **Més lleuger als mòbils modestos.** Fora la taca de llum difuminada de la llista, l'animació 3D de la comparació de models i les animacions infinites de la targeta que surt on no hi ha model d'alta resolució.
- El detall del dia fa servir els mateixos gràfics horaris. Als quatre idiomes.

## 🛠️ Millores publicades entre la v3.66.0 i la v3.67.0

- **«Ratxes» a tot arreu.** L'app deia «ratxes» en uns llocs i «ràfegues» en uns altres (el detall del dia, els gràfics, el bàner «Motiu», el consell de seguretat i l'avís de vent). Ara és «ratxa» a tot arreu, com als avisos del Meteocat, també al text de la IA.
- **La targeta principal ja no es desquadra al mòbil.** Amb una etiqueta llarga («Parcialment ennuvolat») la icona baixava a sota en gran, i una temperatura negativa de dues xifres («−33°») no hi cabia.
- **Cap avís de neu o gel impossible.** Un codi de neu del model amb 10 °C i la cota de gel a 1.600 m feia sortir «Neu prevista»; ara l'avís només en surt quan és possible.

## 🌡️ Novetats de la v3.66.0: la pestanya Detall, més clara

- **Temperatura, el primer giny del Detall.** A tota l'amplada: la temperatura d'ara, la sensació (i per què, quan és pel vent o per la humitat), on és ara entre la mínima i la màxima d'avui i les pròximes 24 hores amb el color de cada grau. El modal hi afegeix la franja de sensació (de «Gelada» a «Calor extrema»), els avisos de gelada, calor intensa o canvi brusc, l'evolució de 48 hores i quatre estadístiques. Les xifres són les de la capçalera: la màxima i la mínima d'avui surten d'un sol lloc per a tots dos.
- **La qualitat de l'aire, per contaminants.** El giny mostra el PM2.5, el PM10, el NO₂ i l'O₃, cada un amb una barra del color de la seva banda; el pitjor té sempre el color del giny. A l'ordinador ja no queda una franja estreta amb un buit al voltant.
- **Les bandes de la qualitat de l'aire, corregides.** Ara són les d'Open-Meteo: fins a 20 bona, 40 raonable, 60 moderada, 80 dolenta, 100 molt dolenta i, per sobre, extrema. Abans un índex de 55 sortia «Dolenta» i un de 90 també; ara són «Moderada» i «Molt dolenta», com ja deia l'anàlisi de la IA.
- **La brúixola del vent, més clara.** La direcció és l'agulla de l'anell, al costat d'on ve el vent i apuntant cap on va; la velocitat i les ratxes van en un arc de velocímetre a baix, de 0 a 120 km/h. Abans els arcs sortien del Nord i semblaven una direcció: amb vent de sud-oest, s'il·luminaven entre el nord i el nord-est. La mateixa brúixola al giny i al modal.
- **Totes les fletxes del vent apunten cap on va.** La de la pestanya Ara anava 45° desviada.
- **La pressió, amb unitats.** El giny diu de què és la tendència i en quant de temps («+1,4 hPa · 3 h»), amb el mateix nom que el modal, i porta un manòmetre en lloc de la icona d'avís. Sense dades no s'inventa cap «Estable».
- **Valors a l'eix dels gràfics.** Els gràfics de pressió, punt de rosada, vent, visibilitat, UV, qualitat de l'aire, CAPE, núvols i temperatura porten de 2 a 4 línies guia amb valors rodons, a la dreta, per poder llegir una xifra sense arrossegar. El del punt de rosada ja no retalla els valors per sota de −5 °C.
- **Per al lector de pantalla.** Cada targeta del Detall i del Cel té un nom curt amb el seu valor («Vent 28 km/h O · Detall»); abans el lector en llegia tot el contingut barrejat.
- Als quatre idiomes.

## 🌧️ Novetats de la v3.65.0: l'avís de pluja que la previsió no té

L'avís de la pantalla principal quan el radar veu pluja al teu lloc i la previsió, per a aquell moment, no en té. Abans deia sempre «El radar detecta pluja que el model no preveu… Pot ser un xàfec molt localitzat», també quan no era cert: el 18/11/2026 a Sant Feliu Sasserra la previsió esperava la pluja a la 01:00 i el radar la veia a tot el voltant.

- **«La pluja s'ha avançat».** Si la previsió porta pluja en les 3 hores següents, l'avís ho diu i dona l'hora en què s'esperava: «Segons el radar, aquí ja plou de manera feble. La previsió no l'esperava fins cap a la 01:00.»
- **«Pluja no prevista».** Si no en porta, l'avís ho diu així i, segons quina part dels 10 km del voltant té pluja al radar, afegeix que sembla un ruixat local (que podria durar poc) o que la pluja cobreix una zona àmplia. Si no és clar, no en diu res.
- **Com plou.** De manera feble, moderada o amb força, segons el radar i amb els mateixos llindars que la resta de l'app.
- **En blau**, com l'avís de quan començarà o acabarà la pluja: és informació, no un perill. Sense «radar Doppler» ni «activitat de precipitació».
- Als quatre idiomes.

## 🛠️ Millores publicades entre la v3.64.0 i la v3.65.0

- **L'etiqueta de la targeta de l'hora del radar, en una sola línia.** Arrossegant enrere al mòbil, «IMATGE DE FA 42 MIN» saltava a dues línies i empenyia l'hora fins a sobre de la línia de progrés. Ara és més curta en els quatre idiomes («FA 42 MIN»), no salta de línia i l'hora va en format de 24 h segons l'idioma de l'app.

## 📱 Novetats de la v3.64.0: la barra de temps, dins la targeta de l'hora, i els recents a la benvinguda

Dos ajustos després de provar la v3.63.0 al mòbil:

- **La barra de temps ja no ocupa una fila.** A la v3.63.0 era una fila a part, a sobre dels botons del radar, i al mòbil ocupava massa pantalla. Ara la targeta de l'hora és la barra: s'hi arrossega el dit o el ratolí d'esquerra a dreta per passar pels fotogrames, i una línia a la vora de baix diu on és, de la imatge més antiga a la més recent. Els controls tornen a fer 64 px d'alt i la llegenda torna al seu lloc. Es fa igual a l'iPhone, on un control lliscant normal només es mou des del polze. Amb el teclat i el lector de pantalla funciona com abans (tabulador, fletxes, Inici i Fi; «16:50, fa 84 min»).
- **Els recents, també a la benvinguda.** En tocar el cercador de la benvinguda sense escriure-hi res, s'obre la llista «Recents» amb els mateixos llocs que al tauler, i el que hi tries també s'hi desa. Els favorits continuen sent els botons de sota del cercador i no s'hi repeteixen.

## 🔎 Novetats de la v3.63.0: cerques recents i barra de temps del radar

- **Cerques recents.** En tocar el cercador del tauler sense escriure-hi res, a sota dels favorits surten els tres últims llocs que hi has triat (secció «Recents», amb la regió i el país). S'hi torna d'un toc o amb les fletxes i Enter. Un lloc que ja hi és puja al primer lloc; els favorits no s'hi repeteixen i la ubicació del GPS no hi entra. Es desen al navegador, com els favorits.
- **Barra de temps al radar.** A sobre dels botons de reproducció, un control lliscant amb l'hora de la primera i de l'última imatge porta a qualsevol fotograma: amb el dit, el ratolí o el teclat (fletxes, Inici i Fi). Moure'l atura l'animació, i l'hora gran i «Imatge de fa N min» diuen de quan és el fotograma triat. El lector de pantalla en diu l'hora i quant fa («16:50, fa 84 min» o «la més recent»).
- Totes dues, als quatre idiomes.

## 🛠️ Millores publicades entre la v3.62.0 i la v3.63.0

- **Segona volta de l'auditoria d'UX (17 i 18/11/2026).** Els punts que havien quedat oberts, revisats a meteotoniai.com:
  - **Avisos del Meteocat que diuen què, on i quan.** La franja diu la comarca i el llindar oficial («Avís groc al Gironès: ratxa màxima de més de 72 km/h») i de quan a quan és per a la teva comarca («De dt. 18:00 a dt. 23:59»), amb l'hora del lloc. Abans només deia «Avís groc: Vent», el final era el de l'avís sencer de totes les comarques i sortia una hora desplaçat (les hores de Meteocat són locals, encara que portin una «Z»). Un avís que s'acaba mentre l'app és oberta deixa de sortir. La descripció oficial no canvia.
  - **La IA i el vent.** Amb ràfegues de 40 km/h o més en les pròximes 6 hores, el text les esmenta i ja no diu que el vent és «suau» (a Girona ho deia amb ràfegues de 44 km/h). En català, la regla de llengua demana també que l'adjectiu concordi amb el nom («ràfegues més notables»).
  - **El resum provisional.** «Fresc» només per sota de 15 °C de sensació (amb 17 °C ja no recomana jaqueta), i el fred del vespre es diu en futur i amb la mínima de la nit que ve, no amb la de la matinada passada. «Temperatures suaus», ben escrit.
  - **El focus, a tots els modals.** En obrir-los, el focus hi entra i el tabulador no en surt (al radar, a partir de 640 px, es quedava fora); la resta de la pàgina queda inert, i en tancar-los el focus torna al botó o a la targeta que els ha obert, també a Safari. Ara també als deu modals dels ginys (pressió, UV, aire, CAPE, rosada, visibilitat, núvols, cota de neu, vent) i a «Extrems del planeta».
  - **L'explicació de «Temperatura ±3°», dins la pantalla.** Al mòbil, la bombolla començava fora de la pantalla per l'esquerra i el text de la IA s'hi pintava a sobre. Ara fa l'amplada de la targeta, va per sobre del text i es tanca amb Escape o tocant fora.
  - **Tot en el teu idioma.** Els botons del mapa del radar («Apropa», «Allunya», «Ubicació no disponible»…) ja no surten en anglès, i el país es mostra en l'idioma de l'app encara que l'enllaç s'hagi fet en un altre («ESPAÑA» i no «ESPANYA»).
  - **Paraules senceres.** El bloc «AROME HD contra el global» diu «Global» i «Diferència» (abans «GLO» i «Δ»), i el detall hora a hora, el nom del model.
  - **Text de 12 px com a mínim a Previsió.** Al mòbil, 96 de cada 128 textos de la pestanya feien 10-11 px; ara cap no baixa de 12 px, en cap dels quatre idiomes, i les etiquetes dels eixos dels gràfics tenen contrast AA.
  - **Sentry, encara menys.** Una sessió per càrrega de pàgina: abans, cada canvi de pestanya enviava dos sobres.

## ⚙️ Novetats de la v3.62.0: la configuració, a la capçalera

- **Un engranatge a la capçalera del tauler.** Al mòbil, a la primera fila al costat de la marca; a PC, després del cercador. Obre un full «Configuració» amb l'idioma, «Com funciona» i «Buida la memòria cau».
- **L'idioma, des de qualsevol pestanya.** CA · ES · EN · FR: canvia a l'instant, amb la previsió i l'anàlisi de la IA. Abans només es podia canviar a la benvinguda.
- **«Com funciona», també des del tauler.** S'obre a sobre del full, i la creu, Escape o el botó enrere del mòbil hi tornen.
- **Buidar la memòria cau, a la vista.** Abans s'amagava al botó «En línia» del peu. Esborra les previsions i les anàlisis desades; els favorits i les preferències es queden. El peu ara només diu si hi ha connexió.
- El mateix full opac que «Què vols compartir?», amb el focus a dins mentre és obert, i als quatre idiomes.

### També dins de la v3.62.0

- **Primera càrrega més lleugera.** La gravació de pantalla que fa servir Sentry per entendre els errors es baixa a part, quan el navegador queda lliure: el codi que el mòbil ha de baixar i compilar abans de pintar res passa de 278 a 238 kB comprimits (−15 %). Continua gravant només quan hi ha un error.
- **El radar ja no demana imatges esborrades.** LibreWXR publica una imatge cada 10 minuts i, en aquell moment, esborra la més antiga. L'app desava la llista d'imatges 5 minuts: si el radar s'obria just després d'un canvi, el primer pas de l'animació sortia sense pluja (una desena de tessel·les no trobades) i l'última imatge no era la més nova. Ara la llista desada caduca quan toca la imatge següent.
- **Traduccions vigilades.** Una prova revisa els 87 diccionaris de textos repartits pel codi i avisa si en algun hi falta un idioma o un text.

## 🛠️ Millores publicades entre la v3.61.0 i la v3.62.0

- **Auditoria d'UX del 16/11/2026.** Una revisió de l'app sencera, contrastada amb el codi, ha portat una trentena d'arreglaments:
  - **El mateix a tot arreu.** Detall i la IA diuen el mateix estat del cel que la capçalera; a Previsió hi ha un sol indicador d'acord entre models; a Ara, un sol distintiu del model regional; el model global s'explica al costat del distintiu, i la resolució del model es diu igual a tot arreu («Malla d'1,5 km»).
  - **La IA.** L'avís provisional surt de les regles i de nit ja no diu «Gaudeix del dia»; sap en quin moment del dia és i veu els fenòmens de les 48 hores; el text surt en un segon (i de cop, amb «reduir el moviment»), i la insígnia de confiança s'obre tocant-la.
  - **Ginys i finestres que quadren.** La pressió i el vent diuen la tendència i el nom de Beaufort amb els mateixos llindars que la seva finestra; la cota de neu del detall del dia només surt si queda a prop del lloc; «Models amb pluja» compta també la sèrie principal; la franja de 24 hores diu què vol dir cada xifra de pluja; el resum de 7 dies compta els dies de pluja com la llista, i el radar aturat diu de quan és la imatge.
  - **Cada idioma, sencer.** La data, el vent, la pressió, la rosada, la humitat, els punts cardinals i el títol de la pestanya en cada idioma; vocabulari planer en lloc del to «tàctic», i el títol del detall del dia amb majúscula només inicial.
  - **Accessibilitat.** Cap text per sota de 10 px i etiquetes grises amb contrast AA; la ciutat és el títol principal; cada dia de la llista té un nom en una frase; el cercador té nom i els resultats ja no mostren coordenades, i les finestres del model regional, del consens i del radar guarden el focus.
  - **Sense salts en carregar.** El peu ja no salta quan arriba la previsió (el desplaçament de la pàgina passa de 0,26 a 0).
  - **Sentry, sota el límit.** Menys traces i gravacions només de les sessions amb un error: abans s'arribava al límit d'enviaments en menys d'un minut.
- **L'actualització automàtica, també en recarregar.** Amb una versió nova en espera, recarregar o navegar podia deixar la pàgina següent amb el codi antic uns 30 segons. Ara el canvi només es demana si la pàgina continua amagada al cap d'un segon, i es torna a provar si no s'ha aplicat.

## 🗺️ Novetats de la v3.61.0: costes i fronteres amb les masses d'aire

- **Ara se sap on cau cada cosa.** La imatge de les masses d'aire és opaca i tapava el mapa: no es veia si el nucli d'una DANA era sobre el golf de Cadis o sobre les Balears. Ara, amb «Masses d'aire» activa, una línia blanca fina ressegueix la costa i les fronteres dels països.
- **Sola.** S'encén i s'apaga amb la capa, sense cap botó nou, i mentre és amagada no baixa res. Va per sobre de la imatge i per sota del radar i els llamps; la capa **Noms** hi afegeix les ciutats.
- **Sense rius.** Les línies són el contorn dels països (de Mapbox). El contorn de l'aigua, que es va provar primer, hi afegia tots els rius i llacs de l'interior.
- Comprovat també que el Meteosat publica cada imatge sencera de cop (les mateixes tessel·les, idèntiques, en aparèixer i 9 minuts després), de manera que el proxy la pot desar des del primer moment.

## 🌀 Novetats de la v3.60.0: les masses d'aire al radar

- **Una capa per veure l'aire fred en alçada.** Al menú de capes del radar, **Núvols** té una quarta opció: Cap · Global · HD · **Masses d'aire**. Mostra l'Airmass RGB d'EUMETSAT, una imatge de satèl·lit feta per veure les DANA, els tàlvegs i les entrades d'aire polar abans que es notin a terra.
- **Com es llegeix.** Blau i morat, aire fred polar; vermell i taronja, aire sec que baixa de l'estratosfera; verd, aire càlid tropical; blanc, núvols alts. **El vermell marca el corrent en jet i el nucli de les DANA**: és el color que cal buscar. La llegenda ho explica i diu de quina hora és la imatge.
- **Europa i l'Àfrica, cada 15 minuts.** De 45° O a 45° E la imatge és del Meteosat de 0°, uns 20–30 minuts enrere, i s'anima amb el radar i els llamps, que van per sobre.
- **La resta del món, cada 3 hores.** A Amèrica, l'Àsia i el Pacífic es mostra el mosaic d'EUMETSAT, que ajunta tots els satèl·lits geostacionaris en una sola imatge sense costures i amb els mateixos colors.
- **Amb reserva.** Si el Meteosat va 90 minuts o més endarrerit, Europa passa al mosaic; i si una tessel·la falla, el proxy serveix la del mosaic perquè no quedi el forat.
- **Per què no la NASA.** L'Airmass de GOES i de Himawari de NASA GIBS surt verd i groc on el d'EUMETSAT mostra l'aire fred morat (comparats a la mateixa zona i hora): la llegenda no hi valdria, i per això no es fa servir.
- **Límits.** La imatge és opaca i ocupa el lloc dels núvols (sota no es veuen les costes: la capa **Noms** ajuda). La dada fa uns 3 km, i de molt a prop es veu a blocs. La primera persona que demana un tros de mapa pot esperar-se fins a uns 20 segons, perquè EUMETSAT el fa a mida; després queda desat per a tothom.
- Es recorda com la resta de capes, i és als quatre idiomes (Masses d'aire · Masas de aire · Air masses · Masses d'air).

## 🔄 Novetats de la v3.59.0: l'app s'actualitza sola

- **Sense avís per acceptar.** Quan hi ha una versió nova, l'app ja no mostra «Hi ha una versió nova disponible · Actualitza»: es posa sola, en un moment en què la recàrrega no molesta.
- **Quan?** En sortir de l'app (canviar d'app, bloquejar el mòbil o canviar de pestanya): quan hi tornes, ja tens la nova. O en obrir-la, si encara no l'has tocada (els primers 20 segons): una recàrrega d'un segon.
- **Mai a mig fer.** Amb un modal, un full, el radar o el visor del planeta oberts, no recarrega: s'espera a una altra ocasió. La pestanya on eres es conserva.
- **També amb l'app oberta dies seguits.** El navegador només mirava si hi havia versió nova en obrir l'app de zero; ara també ho mira en tornar-hi i, amb l'app a la vista, cada hora (com a molt un cop per hora i només amb connexió).
- **Sense penjar-se.** La protecció de la v3.9.6 es manté: la versió nova mai no pren el control d'una pantalla que encara executa el codi antic. Ara només en tria el moment l'app mateixa.
- **Una última vegada:** qui tingui la v3.58.0 o una d'anterior veurà l'avís «Actualitza» un cop més, perquè és el codi antic qui el mostra. A partir de la v3.59.0, ja no.

## 🛠️ Millores publicades entre la v3.58.0 i la v3.59.0

- **La targeta principal, més curta al mòbil.** El vent (velocitat, direcció i ratxes), la humitat i la sensació van en tres targetes petites en una fila: la targeta passa de 740 a 623 px a 375 px d'amplada i, amb els botons, cap a la primera pantalla. Mateixes xifres, colors i icones; a partir de 768 px, la de sempre. README: captura del mòbil al dia.
- **A PC, els avisos en una fila a dalt.** A partir de 1.280 px, la pluja de la pròxima hora i els avisos (llamps, nowcast, realitat del radar, alerta oficial) s'apilaven a la columna de l'anàlisi i estiraven la targeta principal, que quedava buida al mig. Ara van en una fila a dalt, a tota l'amplada, i a sota la targeta i l'anàlisi fan la mateixa alçada.
- El build ja no avisa d'un error de CSS que generava una expressió regular d'una prova.

## 🗂️ Novetats de la v3.58.0: quatre pestanyes en lloc d'una pàgina llarga

- **Ara, Previsió, Detall i Cel.** El tauler ja no és una sola pàgina: la vista completa feia gairebé nou pantalles de mòbil i les pròximes 24 hores quedaven quatre pantalles avall. **Ara** és el que cal saber d'un cop d'ull: la targeta principal, els avisos quan n'hi ha, l'anàlisi de la IA, les pròximes 24 hores i uns destacats (pressió, qualitat de l'aire, lluna, visibilitat i, els dies que n'hi ha, el fenomen gros del planeta) que porten a la pestanya del seu giny. **Previsió** té els 7 dies, els gràfics horaris per models i el motor de consens; **Detall**, els ginys de les condicions d'ara (vent, UV, visibilitat, qualitat de l'aire, núvols, pressió, punt de rosada, CAPE i cota de neu); **Cel**, el cicle solar, la lluna i «Més enllà del teu cel».
- **El Radar, a la barra.** A un toc des de qualsevol pestanya. Ja no es repeteix a la targeta principal; el botó del model HD (AROME HD, ICON-D2…) s'hi queda.
- **Al mòbil**, la barra és fixa a baix, on arriba el polze, i s'amaga mentre escrius al cercador. La targeta principal és més compacta (la icona al costat de la temperatura) i l'avís de versió nova ja no tapa la barra.
- **A PC**, la barra va a dalt i s'enganxa en fer scroll. A partir de 1.280 px, Ara i Previsió fan dues columnes de la mateixa alçada: la targeta principal amb els avisos i l'anàlisi al costat, i els 7 dies amb els gràfics horaris, que aquí van amb pestanyes.
- **L'enrere hi compta.** Des de Previsió, Detall o Cel torna a Ara; des d'Ara surt com sempre; amb un modal obert, el tanca sense canviar de pestanya. Un refresc torna a la mateixa pestanya, i un lloc nou s'obre a Ara.
- **Sense peticions de més.** Canviar de pestanya no torna a demanar cap dada: cada pestanya es munta la primera vegada que l'obres i després s'hi queda.
- **Accessible i als quatre idiomes:** patró de pestanyes amb fletxes, Inici i Fi, i noms curts que hi caben a 320 px (ca, es, en, fr).
- **Adéu a Essencial i Completa.** El xip «Vista» i la targeta «Vols més detall?» desapareixen, i les preferències que en quedaven al navegador s'esborren soles. Tot el que hi havia a la vista completa és en alguna pestanya.

## 🛰️ Novetats de la v3.57.0: l'Himawari en color al visor orbital

- **L'Himawari, en GeoColor.** Al visor «Mira-ho des de l'òrbita» d'«Extrems del planeta», el disc de l'Himawari només sortia en infraroig, perquè la NASA no en publica el color. Ara surt en GeoColor de [CIRA SLIDER](https://slider.cira.colostate.edu/) (Colorado State University), el mateix algorisme que fa servir la NOAA per al GOES: color real de dia i, de nit, els núvols sobre les llums de les ciutats. Els tres discs es veuen ara amb el mateix estil.
- **Més recent:** la imatge té uns 30–40 minuts, contra els 50–60 de l'infraroig.
- **Al seu lloc.** CIRA dona la vista real del satèl·lit (des de 36.000 km); el mòbil la passa a la mateixa projecció que els altres dos discs, perquè els ciclons, els rècords i els incendis caiguin al lloc exacte (comprovat contra l'infraroig de la NASA de la mateixa hora).
- **Amb xarxa de seguretat.** CIRA és una web de recerca, sense garantia de servei (tot i que del 12 de setembre a l'11 de novembre va publicar el 98 % de les imatges). El proxy valida cada imatge i la desa per a tothom; si no arriba en 10 segons, o si algun dia CIRA canvia o plega, el disc mostra l'infraroig de la NASA com abans. Una prova diària avisa si es trenca, i el proxy té un interruptor per apagar-ho sense publicar l'app.
- La capa de núvols HD del radar no canvia: l'Himawari hi continua en infraroig.

## 🛠️ Millores publicades entre la v3.56.0 i la v3.57.0

- **El visor orbital ja no s'encalla.** El disc del GOES arribava tard i el de l'Himawari no arribava mai: es demanava a la NASA una imatge gran en latitud i longitud, i aquell servei tardava de 8 segons a 3 minuts (el 12 de novembre fins i tot amb peces petites). Ara el disc es munta amb els taulers HD del proxy, els mateixos de la capa de núvols del radar: uns 2–6 segons la primera vegada i gairebé res si ja els ha demanat algú, perquè queden desats per a tothom.
- **El GOES en color, molt més recent:** surt del GeoColor de NOAA/NESDIS, d'uns 30 minuts, en lloc d'una imatge d'una hora i mitja o més.
- **Si una imatge falla, una altra.** Com a molt 20 segons en total (abans, fins a un minut); si el color del GOES no arriba, l'infraroig, i si una hora té forats, la de 10 minuts abans. També s'ha tapat la ratlla fosca que la NASA deixa a 180° al disc de l'Himawari.
- README: noves captures del radar amb els núvols en color de GOES i de Meteosat.

## 📡 Novetats de la v3.56.0: un sol radar a cada moment

- **L'animació del radar ja no es veu sobreposada.** El mapa pintava dues fonts de radar alhora, RainViewer per sobre de LibreWXR. RainViewer ja no fa cas de l'escala de colors que li demanem i sempre dona la seva (blava, amb la plugim beix), i les seves zones de pluja no coincideixen amb les de LibreWXR a la mateixa hora: es veien dues paletes i dues pluges diferents barrejades. Ara cada fotograma és d'una sola font.
- **LibreWXR, i RainViewer quan cal.** LibreWXR arriba a molts més llocs del món (l'Àfrica, Rússia, el Canadà, els oceans), però de vegades s'encalla: el 12 de novembre publicava una hora nova cada 10 minuts amb la mateixa imatge d'Europa (en 2 hores, a Alemanya no hi canviava ni un píxel, mentre que a RainViewer en canviava el 99 %). L'app compara la primera i l'última imatge de les 2 hores al voltant del lloc amb les de RainViewer i, si LibreWXR està encallat o no respon, el mapa passa a RainViewer. Quan LibreWXR torna a funcionar, el mapa hi torna sol.
- **La llegenda segueix la font.** Amb LibreWXR, l'escala NEXRAD de sempre; amb RainViewer, la seva: de la plugim beix als blaus, el groc, el taronja, el vermell i el rosa.
- **Arreglat: avisos de pluja forta falsos.** Quan l'avís «pluja que el model no veu» no podia llegir LibreWXR, provava RainViewer, però amb la taula de colors de LibreWXR la plugim beix de RainViewer es llegia com centenars de mm/h. Ara els dos avisos de pluja només llegeixen LibreWXR, i callen si està encallat al lloc, perquè llegirien pluja antiga.
- **Un límit:** amb RainViewer, de molt a prop el radar es veu una mica menys definit, perquè no passa del zoom 7 (era la mateixa capa que fins ara es veia a sobre).

## ❄️ Novetats de la v3.55.0: la neu, amb els colors de la pluja

- **El radar ja no distingeix la neu.** Amb l'opció de neu dels servidors de radar, la neu moderada sortia exactament del mateix blau que la pluja feble, i la fila «Neu» de la llegenda feia pensar que una taca blava podia ser neu quan plovia. Ara tota la precipitació surt amb la mateixa escala i el color només diu la intensitat, com als radars del Meteocat i de l'AEMET. On neva ho diu la cota de neu de la previsió.
- **Llegenda més simple:** una sola fila «Pluja o neu», més la dels llamps.
- **Arreglat: la lectura del radar per als avisos.** L'avís «pluja que el model no veu» i l'hora en què comença o s'acaba de ploure llegeixen el píxel del radar a la teva ubicació. Demanaven les imatges amb la neu però en traduïen els colors amb la taula de la pluja: sobre 186.394 píxels de neu reals, la neu feble (unes dècimes de mm/h) es llegia com uns 1.500 mm/h i la neu moderada com si no hi hagués res. Ara el mapa i la lectura fan servir les mateixes imatges sense neu, i la taula hi encaixa.

## 🎨 Novetats de la v3.54.0: la llegenda del radar, plegable i amb la neu

- **Un sol botó, sempre plegat.** La llegenda fixa dels llamps deixa lloc a un botó petit «Llegenda» a baix a l'esquerra, que ocupa menys mapa que abans. Comença sempre plegat en obrir el radar, també a l'ordinador, i en tocar-lo s'obre una targeta amb la pluja, la neu i els llamps a la mateixa escala, de «menys» a «més». Només hi surten les capes enceses.
- **Pluja i neu, amb els colors de debò.** La pluja, amb l'escala NEXRAD que pinta el radar. La neu té els seus blaus, que hem mesurat sobre imatges reals del radar amb la neu activada i desactivada (la taula oficial de RainViewer diu, per error, que en aquesta escala la neu té els colors de la pluja), i van alineats sota la pluja de la mateixa intensitat. Un avís honest: alguns blaus de la neu coincideixen amb els de la pluja feble, de manera que una taca blava pot ser pluja feble o neu moderada.
- **Llamps**, amb la mateixa paleta de la capa, sense xifres perquè les dues fonts (Meteosat i les xarxes de terra de la NOAA) no compten igual.

## 🧭 Novetats de la v3.53.0: el radar recorda les capes i la càmera es mou menys

La segona part del redisseny del menú de capes.

- **El radar s'obre com el vas deixar.** El mapa de fons, la pluja, els llamps, els núvols (Cap, Global o HD, en infraroig o en color), la nit, els noms, els focs i la foto NASA es desen al dispositiu. Dues excepcions pensades: el Relleu 3D no es recorda, perquè el radar s'obriria inclinat, i de HD es recorda que el volies però no quin satèl·lit, perquè es tria sempre el que cobreix el lloc consultat (qui viatja no acaba a l'altra punta del món). Si l'emmagatzematge del navegador no hi és, el radar s'obre amb les capes de sempre.
- **Quantes capes hi ha enceses.** El botó de capes porta un número (els núvols compten com una), de manera que d'una ullada saps si t'has deixat activat algun extra. El lector de pantalla ho diu: «Capes del mapa · 4 capes actives».
- **La càmera només es mou quan cal.** Activar els focs ja no t'allunya fins a mig continent. La foto NASA es veu sencera fins al zoom 8 i s'esvaeix fins al 10 (abans s'esvaïa a partir del 5,5, i per això el mapa s'havia d'allunyar fins al 3,2); ara només s'allunya si mires més a prop del zoom 8. El relleu 3D inclina el mapa i, si cal, s'acosta fins al zoom 8, en lloc de saltar al 11,5: una vista regional amb les muntanyes a l'horitzó. Els satèl·lits HD ja només movien la càmera quan miraves fora de la seva zona.

*Entre la v3.52.0 i la v3.53.0 hi ha també el commit buit 055e7d8, que no canvia l'app: només va tornar a llançar el desplegament de la v3.52.0, que s'havia encallat amb la caiguda de GitHub Actions de l'11 de novembre.*

## 🗺️ Novetats de la v3.52.0: el menú de capes del radar, redissenyat

El menú de capes tenia 15 files una sota l'altra: al mòbil feia dues pantalles i mitja d'alt i en un portàtil se'n veia només un terç. Ara hi cap tot sense scroll i s'entén d'una ullada.

- **Quatre blocs.** *Mapa de fons* (Fosc, Clar, Relleu i Satèl·lit, amb una mostra de color), *Temps ara* (Pluja i Llamps, amb interruptors), *Núvols* i *Més capes* (Nit, Noms, Relleu 3D, Focs i Foto NASA, en una graella d'icones). A sota, una línia explica la capa que acabes de tocar: per exemple, que la foto NASA és del darrer dia complet i no en directe.
- **Núvols, un sol selector: Cap · Global · HD.** L'infraroig global i els satèl·lits d'alta resolució no es poden veure alhora, però abans semblaven interruptors independents en dues seccions: encendre Meteosat HD apagava els núvols globals sense avisar. Ara és una sola tria. HD agafa directament el satèl·lit que cobreix el lloc consultat (Meteosat a Europa i l'Àfrica, GOES a Amèrica, Himawari a l'Àsia i el Pacífic, marcat amb una agulla) i es pot canviar amb un toc; a sota hi ha Infraroig | Color (Himawari només té infraroig).
- **Mòbil i ordinador.** Al mòbil el menú puja des de baix i el mapa continua visible a dalt, de manera que cada canvi es veu a l'instant; es tanca lliscant-lo avall, tocant el mapa o amb la X. A l'ordinador és un panell al costat del botó de capes, sense scroll fins i tot en una pantalla de 768 px d'alt.
- **Noms planers** als quatre idiomes: fora «Tàctic», «(Blanc)», «(Òptic)», l'etiqueta «SAT» i l'«IR» repetit. Canviar el mapa de fons ja no tanca el menú.
- **Més lleuger i accessible.** El menú ja no posa 16 desenfocaments i 10 filtres d'ombra damunt del mapa animat, cosa que es nota als mòbils modestos. Cada botó diu al lector de pantalla si està activat, la X és prou gran per al dit i, en tancar el menú, el focus torna al botó de capes.

## 🛠️ Millores publicades entre la v3.51.0 i la v3.52.0

Publicades sense canvi de versió; ara ja són dins de l'etiqueta v3.52.0.

- **Manteniment** (3b33fbe): una prova vigila que l'arxiu de GeoColor de NOAA/NESDIS doni una imatge diferent a cada hora. Quan no és així (l'11 de novembre servia el mateix tauler a totes les hores), el proxy fa servir només el color de GOES de la NASA.

## ⚡ Novetats de la v3.51.0: l'avís de llamps a prop, també a Amèrica

- **«Llamps a prop» a la resta d'Amèrica.** A l'oest de 60° O i al nord de 25° S, l'avís de la pantalla principal i la IA fan servir ara la mateixa font que el mapa: la densitat de llamps de les xarxes de detecció a terra NLDN i GLD360 (NOAA nowCOAST), les dues últimes finestres de 15 minuts en 50 km al voltant de la ubicació. Amb llamps a 30 km o menys avisa amb la distància, la direcció i quant fa (a 10 km o menys, en vermell i amb el consell de refugiar-se), i diu que els han detectat «les xarxes de detecció de la NOAA». La IA ho rep com una observació d'ara mateix i el semàfor puja a precaució amb el motiu «Llamps detectats a uns N km».
- **La distància, on cauen de veritat.** nowCOAST difumina cada llamp sobre les cel·les veïnes: un llamp en una cel·la de 8 km en 15 minuts fa una densitat d'1, però un terç de les taques aïllades no hi arriben enlloc. Per no avançar la distància uns 8 km, l'app la mesura fins a les cel·les d'1 o més i, si la taca és d'un llamp sol, fins al seu centre, no fins a la vora groga. «Activitat elèctrica intensa» vol dir 25 o més, el mateix percentatge de píxels que l'intens de Meteosat on se solapen.
- **Textos.** El motiu del semàfor ja no diu «per satèl·lit» (a Amèrica no ho és) i «Com funciona» explica que a Amèrica els llamps venen de xarxes de terra. Als quatre idiomes. A Europa i l'Àfrica no canvia res: continua el Lightning Imager de Meteosat-12.

## ⚡ Novetats de la v3.50.0: llamps a tota Amèrica i GOES en color més al dia

- **Llamps a la resta d'Amèrica.** La capa de llamps del radar ara cobreix també els Estats Units, el Canadà, Mèxic, el Carib, l'Amèrica Central i el nord i el centre de Sud-amèrica (a l'oest de 60° O i al nord de 25° S). Hi surt la densitat de llamps de les xarxes de detecció a terra NLDN i GLD360, que publica NOAA nowCOAST cada 15 minuts, uns 7–16 minuts després; cada fotograma mostra la finestra que conté la seva hora. A l'est de 60° O continua el Lightning Imager de Meteosat-12, i el proxy retalla les dues fonts per aquesta línia perquè cap llamp no surti dues vegades.
- **Els mateixos colors a tot arreu.** nowCOAST té una paleta pròpia (groc, vermell, magenta, blau, verd). L'app la passa a la de Meteosat comparant totes dues fonts sobre el Brasil, on se solapen, de manera que a la frontera es veuen igual. La capa es diu ara «Llamps (MTG i NOAA)» i la llegenda va de «pocs» a «molts», sense xifres, perquè les dues fonts no compten igual.
- **El que no hi és:** els llamps del satèl·lit GOES (GLM) no tenen cap servei oficial en forma de mapa; la NOAA només en publica els fitxers originals. L'avís «Llamps a prop» de la pantalla principal continua sent només a la zona de Meteosat.
- **GOES en color, més al dia i més lleuger.** El GeoColor de GOES ara ve de NOAA/NESDIS, que publica el mateix producte uns 20 minuts abans que la NASA, amb GOES-East i GOES-West ja ajuntats i en JPEG també les imatges més noves (10–20 KB per tessel·la en lloc dels PNG de 140–180 KB): el bucle en color pesa unes 6 vegades menys. I ja no depèn que la NASA l'incorpori a temps: el 9 de novembre la NASA va tenir GOES-East i el GeoColor aturats més de dues hores i el mode color passava a l'infraroig, mentre que NESDIS anava al dia. Si a NESDIS li falta una imatge o no respon, aquella tessel·la ve de la NASA com abans. L'infraroig de GOES continua venint de la NASA.

## 🛠️ Millores publicades entre la v3.49.0 i la v3.50.0

Publicades sense canvi de versió; ara ja són dins de l'etiqueta v3.50.0.

- **El gràfic de 7 dies** (d55c82c, 028e031): el resum diu com va la setmana i no contradiu els bigotis; bandes d'incertesa, columnes tàctils i la pluja per quantitat.
- **La IA** (d2b121b, bf8c845, 5b8848c, c353200): la previsió de les properes 6 hores diu la pluja amb la certesa que té, no com un fet segur, i el text en català surt sense els errors de forma que es repetien (apòstrofs davant de nombres, «fa d'11 °C»...).
- **Meteosat HD més ràpid** (8f02bb2): les imatges d'EUMETSAT es demanen a l'adreça pròpia de cada capa. L'IR i el GeoColour de Meteosat passen d'uns 7 segons per tessel·la (o de no arribar a carregar) a mig segon.
- **La capa d'incendis torna a sortir** (2010a3c): la NASA va deixar de publicar els focs de Suomi NPP el 2 de novembre; ara són els de NOAA-20 i NOAA-21, amb el mateix detall.
- **Adreces pròpies dels proxies** (b320fe5): l'app crida els workers a api.meteotoniai.com i sat.meteotoniai.com; les adreces antigues continuen funcionant per a les apps instal·lades.
- **Manteniment** (8c71d87, 461edb8): dependències (avís de Dependabot) i wrangler al desplegament.

## 🧭 Novetats de la v3.49.0: «Extrems del planeta», versió 2

Una navegació nova, un protagonista només quan cal i fitxes que expliquen cada dada.

- **Cada dada obre la seva fitxa.** Les rajoles i els xips de la targeta porten directament a la fitxa del rècord o del fenomen. La llista, les fitxes i el visor orbital comparteixen la mateixa capçalera (fletxa, d'on vens, on ets i la creu), i el botó enrere del mòbil puja un sol nivell: del visor a la fitxa, de la fitxa a la llista i de la llista fora. Abans tancava tot el detall. En tornar a la llista, es recupera on eres.
- **Un protagonista només quan passa alguna cosa excepcional:** calor humida de 31 °C, un cicló de categoria 4 o 5 amb la dada recent, una alerta vermella de GDACS o un rècord físic excepcional (50 °C, una ratxa de 150 km/h lluny dels cims o 960 hPa), amb una línia que diu per què es destaca. Els altres dies, les cinc dades tenen el mateix pes. A la Vista essencial, el seu xip n'obre la fitxa directament.
- **Fitxes que expliquen:** els tres primers de cada rècord (amb «empat tècnic» quan la diferència és més petita que el marge de les estacions), «Què és», «Per què aquí ara» (calculat amb les dades: l'hora solar, l'aire molt humit, el sol de 24 hores al Pol Sud a 2.800 m, l'interior dels continents, el cinturó de borrasques de l'Antàrtida...) i «I l'escalfament?», amb una etiqueta honesta del que en diu l'IPCC: la calor extrema, cada cop més freqüent; el fred extrem, al revés; les ratxes i les borrasques, no es pot dir. Un sol dia no és cap senyal del clima, i la fitxa ho diu. La de la calor humida té, a més, l'escala del cos en paraules.
- **Alertes de GDACS:** les taronja i vermelles tenen un apartat propi amb l'enllaç a l'informe, i un cicló amb alerta que NASA EONET encara no té també hi surt (l'1 de novembre, Murasu, amb alerta vermella a l'Índia, no hi era).
- **Dades més honestes:** la calor humida sense decimal a la targeta i al visor (les estacions donen graus sencers), quant fa de cada mesura i de la dada de cada cicló, la traça del cicló al visor, el color dels xips segons la categoria real i el context de les cremes de sabana africanes. Etiquetes de com a mínim 11 px.

## 🛠️ Millores publicades entre la v3.48.0 i la v3.49.0

Publicades sense canvi de versió; ara ja són dins de l'etiqueta v3.49.0.

- **«Calor humida» en lloc de «bulb humit».** El nom tècnic a peu de carrer no diu res: ara la targeta diu «Calor humida més alta del món», amb «temperatura de bulb humit» en petit a sota, el detall «Calor humida (bulb humit)» i el visor orbital «29,0 °C de calor humida». El nom tècnic s'hi queda perquè el valor és més baix que la temperatura de l'aire i, sense, semblaria poca calor. En castellà, «calor húmeda»; en francès, «chaleur humide»; en anglès es manté «wet-bulb», que ja és el nom corrent.
- **El control de qualitat, en paraules planeres.** On deia «massa diferents dels veïns», ara diu que es descarten les estacions «que no quadren gens amb les estacions del voltant» (a més de les que tenen la posició o els valors impossibles). Als quatre idiomes.

## 🛰️ Novetats de la v3.48.0: «Mira-ho des de l'òrbita»

Els extrems del planeta, ara també des de l'espai.

- **Un visor amb tres ulls.** Cada pestanya del detall d'«Extrems del planeta» acaba amb el botó «Mira-ho des de l'òrbita»: la Terra sencera tal com la veuen ara Meteosat-12 (0°), GOES-19 (75,2° O) i Himawari-9 (140,7° E), amb un selector per passar d'un a l'altre.
- **Imatges reals.** Meteosat en GeoColour d'EUMETSAT; GOES en GeoColor i Himawari en infraroig, de NASA GIBS, posades al disc pel mateix mòbil. El visor diu l'hora de cada imatge.
- **Cada cosa al seu lloc.** Sobre el disc hi ha els ciclons, els rècords de les estacions, els incendis i les inundacions per país, els volcans i el lloc que mires. La forma diu què és i el color, com és d'intens. Tocar un cicló n'obre la fitxa, i la fletxa et torna al visor.
- **S'obre on cal.** Des de «Rècords d'ara», a l'ull on cauen els rècords; des de «Fenòmens actius», al del fenomen principal. Si el cicló més intens és a l'altra banda del planeta, un botó t'hi porta.
- **A la Vista essencial, només quan passa una cosa grossa.** Els dies amb un cicló de categoria 4 o 5, la targeta «Vols més detall?» ho diu el primer de tot («Tifó de categoria 4 al Pacífic»), i la línia curta també. Els altres dies, no canvia res.
- **Pensat per a mòbils modestos:** el visor només es baixa si l'obres, sense desenfocaments ni animacions en bucle, i la consulta de la Vista essencial surt quan la previsió ja és a la pantalla.

## 🌍 Novetats de la v3.47.0: els extrems del planeta

Al final de la **Vista completa** hi ha una secció nova, «Més enllà del teu cel»: primer el teu cel, al final el planeta.

- **El bulb humit més alt del món.** Combina calor i humitat: és la mesura de la calor que de debò és perillosa per al cos. Una barra marca els llindars de 31 °C i 35 °C, i la targeta diu a quants graus n'és el planeta.
- **Els rècords d'ara mateix:** el lloc més calent, el més fred, la ratxa més forta i la pressió més baixa, d'unes 5.000 estacions de tot el món, amb control de qualitat abans de mostrar-los.
- **«Per què aquí?»:** l'explicació de cada rècord, calculada a partir de les dades: l'hora solar del lloc més calent, la nit polar, l'ull d'un cicló o el cim on el vent s'accelera.
- **Fenòmens actius:** ciclons tropicals, incendis grans per país, inundacions i volcans.
- **La fitxa de cada cicló:** categoria, la corba d'intensitat dels últims dies amb la intensificació ràpida marcada, cap on es mou, a quina distància és del lloc que mires i l'enllaç a l'avís oficial.
- **Fonts obertes i oficials:** METAR de la NOAA, GDACS (Comissió Europea i Nacions Unides) i NASA EONET.
- Als quatre idiomes, en °C o °F, i pensat per a mòbils modestos.

## 🏡 Novetats de la v3.46.0: MeteoToni AI es muda a meteotoniai.com

L'app té casa pròpia: **[meteotoniai.com](https://meteotoniai.com)**. L'adreça antiga, `tonitapias.github.io/meteoai`, continua funcionant mentre duri la mudança.

- **Un avís a l'adreça antiga.** Una franja a dalt de tot, «MeteoToni AI s'ha mudat», porta a la nova amb un toc.
- **T'emportes el que tenies.** Els favorits, l'idioma, els graus, la vista i els secrets trobats de la benvinguda viatgen amb tu. Van dins el fragment de l'enllaç, que no arriba a cap servidor, i en arribar l'adreça queda neta. Si a l'adreça nova ja hi tenies favorits, se sumen.
- **Si la tens instal·lada**, la franja et recorda que la tornis a instal·lar des de l'adreça nova i que esborris la icona vella. Provat a Android i a iPhone.
- **Als quatre idiomes**, al mòbil i a l'ordinador.

### També dins de la v3.46.0

- **Allotjament a Cloudflare.** Cada versió es publica des de GitHub Actions només si passen el type-check, el lint i els tests, i ara amb capçaleres pròpies: memòria cau immutable per als fitxers que porten un hash al nom i capçaleres de seguretat bàsiques.
- **Sentry, igual de discret.** El que s'hi envia no porta mai les dades de la mudança, ni tan sols arrodonides.
- **Dependències:** `postcss-selector-parser` 6.1.5 (avís de Dependabot; només s'usa en compilar l'app).
- Una prova de privadesa de Sentry que fallava segons l'hora del dia ja no ho fa.

## 🎁 Novetats de la v3.45.0: un segon secret a la benvinguda

La pantalla d'inici n'amaga un altre, ben diferent del primer. Tampoc no en direm res més: et toca trobar-lo.

- Quan en trobes un, l'app et diu quants n'has trobat.
- Funciona a qualsevol lloc del món, als quatre idiomes, al mòbil i a l'ordinador.
- Pensat per a mòbils modestos: sense desenfocaments ni filtres, i respecta l'opció del sistema de reduir el moviment.
- No fa més lenta l'entrada a l'app: només es baixa quan algú el troba.

## 🎁 Novetats de la v3.44.0: un secret a la benvinguda

La pantalla d'inici amaga una sorpresa. No en direm res més: et toca trobar-la.

- Funciona als quatre idiomes, al mòbil i a l'ordinador.
- Pensada per a mòbils modestos: sense desenfocaments ni filtres, i respecta l'opció del sistema de reduir el moviment.
- No fa més lenta l'entrada a l'app: només es baixa quan algú la troba.

## 🏠 Novetats de la v3.43.0: botó Inici al tauler

Un cop dins de la previsió d'un lloc, no hi havia cap manera de tornar a la primera pantalla (el cercador, «Utilitza la meva ubicació» i els favorits) sense recarregar l'app. Ara:

- **Una casa a l'esquerra del cercador** torna a la benvinguda. Al mòbil és només la icona, amb una àrea tàctil de 44 px; a partir de 640 px porta el text «Inici». Per al lector de pantalla es diu «Torna a l'inici», «Volver al inicio», «Back to home» o «Retour à l'accueil».
- **L'adreça queda neta.** Perd el lloc i, en recarregar, ja no es torna a obrir; tampoc no s'afegeix cap entrada a l'historial.
- **No es torna a carregar sol.** Ni en tornar a l'app, ni amb la comprovació de cada minut, ni per una previsió que arribi tard darrere d'una de desada, ni per un GPS que respongui després d'haver tornat a l'inici. Si havies obert la previsió des d'un enllaç, també surt la benvinguda.
- **Es conserven els favorits, l'idioma i la vista**, i triar el mateix lloc just després el torna a carregar.
- El botó enrere de l'Android continua tancant els modals, com abans.
- A 320 px, el text d'exemple del cercador acaba amb «…» quan no hi cap, en lloc de quedar tallat.
- Provat a 320 i 375 px d'amplada als quatre idiomes i a PC.

## 🔗 Novetats de la v3.42.0: compartir un lloc o la teva posició

Fins ara l'adreça de l'app era sempre la mateixa: no es podia enviar «mira el temps a Puigcerdà» ni dir on ets. Ara:

- **Un enllaç obre directament un lloc.** L'adreça porta el lloc que tens a pantalla (`?lat=…&lon=…&nom=…`) i qui l'obre va directe al tauler d'aquell lloc, sense passar per la benvinguda (si l'enllaç no porta el nom, l'app el busca). Un enllaç mal escrit s'ignora i surt la benvinguda de sempre.
- **L'adreça segueix el lloc** que tens a pantalla (cercador, favorit o GPS) sense afegir entrades a l'historial: el botó enrere del mòbil continua tancant els modals.
- **Botó Compartir**, a dalt a la dreta de la targeta principal. Fa servir el full de compartir del sistema i, si no n'hi ha (al Firefox d'ordinador, per exemple), copia l'enllaç i ho avisa.
- **Un lloc consultat o la teva posició, cadascun amb el seu missatge.** Amb un lloc cercat o un favorit s'envia «Mira el temps a Girona…», encara que sigui a tocar d'on ets. Amb la teva posició (la del GPS), primer surt «Què vols compartir?»:
  - **Comparteix la meva posició:** les coordenades amb 5 decimals (~1 m) i un enllaç de Google Maps.
  - **Comparteix només el temps de Girona:** el lloc a ~1 km, perquè qui el rep no sàpiga on ets exactament.
  - **Copia les coordenades**, per dictar-les o enganxar-les on calgui.
- **Coordenades de veritat.** Són sempre les demanades: les del GPS tal com arriben, mai les d'una previsió desada d'un poble del costat (fins a 20 km) ni les d'una dada guardada d'uns metres més enllà.
- **Qui rep una posició** la veu com a «Posició compartida», amb les coordenades i els botons «Obre a Google Maps» i «Com arribar-hi».
- Als quatre idiomes, i provat a 320 i 375 px d'amplada. La previsualització de l'enllaç a les apps de missatgeria és la general de l'app.

### També dins de la v3.42.0

- **Sentry ja no rep la posició exacta.** Hi arribava per les dades dels errors i per les adreces de les peticions i, amb els enllaços, també per l'adreça de la pàgina. Ara, a errors, traces i repeticions, l'adreça de l'app hi va sense el lloc i les coordenades queden arrodonides a ~1 km. L'enllaç que comparteixes i les peticions de la previsió conserven tota la precisió.
- **Xifres, idioma i favorits coherents a tota l'app** (auditoria del 26-10):
  - El «ARA» de la tira de 24 hores marca la mateixa temperatura que la capçalera, i la capçalera ja no posa un 0° fals quan falta la dada.
  - El peu de pàgina és traduït, diu l'estat real de la connexió i el model real (AROME HD o Global), i el seu botó només buida la memòria cau: els favorits i les preferències es queden.
  - Els favorits s'identifiquen pel lloc (a menys d'1 km), no pel nom: dos pobles que es diuen igual ja no es confonen, i «Londres» i «London» són el mateix favorit. El cercador busca en l'idioma de la interfície.
  - Els decimals van en el format de cada idioma a tota l'app («18,3» en català, «18.3» en anglès) i «kmh» passa a «km/h».
  - Les targetes del consens es poden obrir amb el teclat, i el radar i l'avís d'actualització segueixen l'idioma triat des de la benvinguda.
  - El dia d'una fase principal de la Lluna es diu com ella («Lluna plena» el dia que ho és).
  - Radar: RainViewer només fins al zoom 7 (al 8 tornava una imatge d'error que es llegia com a pluja), RainViewer de reserva si una tessel·la de LibreWXR falla, i una tessel·la il·legible ja no compta com a «sec».
  - Resum de la IA: la mínima i la màxima en graus enters, i la temperatura d'ara amb la mateixa xifra que la capçalera.

## 🗂️ Novetats de la v3.41.0: vistes Essencial i Completa

Els botons «Bàsic» i «Expert» no s'entenien: al mòbil no tenien cap etiqueta, «Expert» semblava que demanés saber-ne i, en tocar-lo, la primera pantalla no canviava (els ginys nous sortien unes dues pantalles més avall). Ara:

- **Dues vistes amb noms que diuen què hi trobes:** l'Essencial (el temps d'ara, les pròximes hores i la setmana) i la Completa (hi afegeix vent, pressió, núvols, qualitat de l'aire, sol i lluna, i gràfics per models), als quatre idiomes.
- **El xip «Vista».** El selector gran de dalt passa a ser un xip petit al costat de la marca (a PC, a la dreta del cercador) que obre un menú amb una frase per a cada vista. Es distingeix pel color i la icona: blau cel amb un quadre a l'Essencial, indi amb una graella a la Completa. Fins que l'obres per primer cop porta un punt de novetat, sense cap animació.
- **«Vols més detall?»** A la vista essencial, just després del resum de la IA, una targeta presenta la completa amb valors d'ara que no s'hi veuen (pressió, qualitat de l'aire, fase lunar i visibilitat), calculats igual que als ginys, perquè no es contradiguin mai. Si ja coneixes la vista completa o toques «Ara no», queda en una sola línia.
- **Es veu on comença la vista completa.** Una franja indi amb el títol, el que hi ha a sota i un botó per tornar a l'essencial. Si canvies de vista des del xip, la pàgina hi baixa sola; si toques «Mostra la vista completa», els panells surten al lloc de la targeta.
- **L'app recorda la vista triada**, i ara també s'obre si el navegador bloqueja l'emmagatzematge (abans, en aquest cas, podia no arrencar).
- **Motor de consens amb noms entenedors:** «Compara els models» obre la «Comparació de models · Pròximes 24 hores» (abans, «Telemetria gràfica avançada»), i el detall de cada variable es diu «Hora a hora».
- **«Com funciona»** diu on es veu cada model per separat: als gràfics hora a hora de la vista completa.

Mesurat en els quatre idiomes i a 320, 360, 375 i 390 px d'amplada: el xip cap al costat de la marca i la franja no es talla (per sota de 375 px, el botó de tornada baixa a una segona línia).

### També dins de la v3.41.0

- **Sense targeta buida quan no plou.** Sota la previsió principal quedava una franja buida cada vegada que no s'esperava pluja la pròxima hora: ara el gràfic de pluja minut a minut només surt quan té alguna cosa a mostrar.
- **Dependències al dia:** vite 6.4.5, vitest 4.1.12, fast-uri 3.1.9 i serialize-javascript 7.1.4 (eines de compilació i de proves). GitHub ja no té cap avís de seguretat obert (n'hi havia 13). El de zod s'ha descartat: només s'arregla passant a zod 4, una migració que trenca els esquemes de l'app, i la correcció no afecta cap esquema que fem servir.
- **Una prova de la benvinguda que fallava una de cada tres vegades** quan la màquina anava carregada ara espera prou el càlcul del cel.

## 🛠️ Millores publicades entre la v3.40.0 i la v3.41.0

La benvinguda nova, revisada amb les primeres captures reals:

- **Titular sense «exacte»:** «El temps on ets, vist de més a prop.» Cap previsió no pot prometre el temps exacte; el que l'app dona és més resolució. La segona línia pren el color del moment del dia: rosa a l'alba, or al migdia, taronja a la posta i lavanda de nit.
- **La Lluna es veu**, amb la forma real i la fase dita en paraules de cada dia, i, si ja havies donat permís d'ubicació, surten les hores de sortida i posta del sol.
- **La columna del cel, amb més color:** les capes de núvols amb els colors del giny Capes de núvols, una resplendor suau al sol i la lluna, i una entrada d'un sol cop en què el sol (o la lluna) fa el camí des de l'horitzó fins a l'hora d'ara; res si el sistema demana reduir el moviment. A la posta, el cel de dalt ja no és tot marró.
- **Cercador i favorits translúcids**, i la llista de resultats sencera dins la pantalla i per sobre del peu (abans, al mòbil, només se'n veia un). A partir del quart favorit, un botó «+N» els ensenya tots.
- **Marca més gran** i un sol nom a tot arreu: MeteoToni AI.
- **«Com funciona» al dia:** cinc fonts globals amb AIFS, 14 models nacionals amb la cobertura real, 7 fonts d'avisos oficials i el resum amb IA amb les regles fixes que el corregeixen.

## 🌅 Novetats de la v3.40.0: una benvinguda nova, «la columna del cel»

La pantalla de benvinguda era un holograma amb dades inventades (cubs que deien «0.0 mm», «KNOTS» o «SYNC»), un botó que calia mantenir premut 1,5 segons i 145 animacions en bucle. Ara:

- **La columna del cel.** Un esquema de l'aire que tenim a sobre: un disc amb corbes de nivell, les tres capes de núvols —baixos, mitjans i alts, amb les mateixes alçades i colors que el giny Capes de núvols— i el camí del sol a l'hora actual; de nit, la Lluna amb la fase real. Els colors del fons són els del cel del modal Solar i canvien amb l'alba, el dia, la posta i la nit.
- **Sense cap dada i igual per a tothom.** La pantalla no consulta res: el cel es calcula al mateix dispositiu i és sempre el del lloc on és el mòbil o l'ordinador. Fa servir la ciutat de referència de la seva zona horària o, si ja havies donat permís d'ubicació, la teva posició, sense tornar-te-la a demanar. Els llocs que consultes no el canvien.
- **Un sol toc, i el botó ja no es bloqueja.** «Utilitza la meva ubicació» funciona amb un toc. Abans, si el navegador no donava la ubicació, el botó quedava «LLEST» i desactivat fins a recarregar la pàgina. Ara, si el permís està denegat, la ubicació no està disponible o el GPS triga massa, l'avís en diu el motiu a sota del botó i es pot tornar a provar; si l'avís de permís queda sense respondre, als 30 segons el botó torna a l'estat normal. Amb la ubicació desactivada, el cercador passa al davant.
- **Cercador i favorits a la mateixa pantalla.** La cerca és la mateixa que la de la capçalera, i els favorits hi surten com a botons per entrar-hi d'un toc. El selector Bàsic/Expert, que abans de tenir una previsió no servia de res, ja no hi surt.
- **Textos nous en els quatre idiomes**, sense eslògans genèrics: «El temps del lloc exacte on ets.»
- **Es veu bé a totes les mides.** Al mòbil, el botó principal ja no queda fora de la pantalla (abans començava a 769 px d'una pantalla de 812); a 1024 px, el títol i el botó ja no es tallen; i a PC hi cap tot sense desplaçar la pàgina. Els botons d'idioma fan 44 px d'alt (abans 27) i, al mòbil, l'idioma es tria amb el selector del sistema.
- **Més lleugera.** Sense desenfocaments, filtres ni animacions en bucle: només una entrada, un cop, que respecta l'opció de reduir el moviment. El càlcul del cel i la columna es carreguen just després del primer pintat, i el paquet inicial de l'app és fins i tot una mica més petit que abans.
- **«Com funciona»** diu 14 models nacionals (deia 13).

Límits: sense permís d'ubicació, el cel és el de la ciutat de referència de la zona horària, i el moment del dia (alba, dia, posta o nit) pot anar una hora avançat o endarrerit com a molt; una mica més en zones horàries molt grans, com la de la Xina.

## 🛠️ Millores publicades entre la v3.39.0 i la v3.40.0

- **Meteosat HD quan EUMETSAT va endarrerit.** Si EUMETSAT publicava tard, els fotogrames més nous de la capa sortien buits. Ara es veu l'última imatge real (de fins a 3 hores) i el color només quan no va més de 30 minuts per darrere de l'infraroig.
- **El desplegable del cercador** torna a tenir el fons opac; s'havia tornat transparent amb l'aligerament del tauler.

## 🛰️ Novetats de la v3.39.0: GOES i Himawari HD cada 10 minuts, i GOES en color

Les capes «GOES HD (Amèrica)» i «Himawari HD (Àsia)» del radar s'havien quedat enrere respecte a Meteosat HD. Agafaven les hores del satèl·lit de LibreWXR (una per hora, ja endarrerida) i el proxy hi restava 90 minuts més: es veien imatges de fa unes 3 hores (comprovat: a les 10:30 UTC, la de les 07:30) i només 2 de diferents per bucle. Ara fan com Meteosat HD:

- **Una imatge per cada fotograma de radar.** Les hores les dona el proxy propi a partir de la NASA (GIBS té GOES i Himawari cada 10 minuts): unes 10 imatges diferents per bucle en lloc de 2, i la més nova de fa 30–40 minuts en lloc d'unes 3 hores. En un bucle de prova: 10 imatges de GOES, de 09:30 a 11:00 UTC, sense cap fotograma buit.
- **GOES en color.** El selector IR | Color, que fins ara només tenia Meteosat, surt també sota GOES: color real de dia (GeoColor, a ~1 km) i, de nit, els núvols sobre les llums de les ciutats, uns 45 minuts enrere. Himawari continua en infraroig, perquè la NASA no en publica el color.
- **La mateixa paleta.** L'infraroig manté la paleta de la NASA, que pinta de colors els cims freds de les tempestes.
- **Més cobertura.** Les dues capes arriben fins a 66°N (abans 60°N; més amunt el píxel s'estira i la paleta pinta el gel de l'Àrtic com si fossin núvols), i GOES arriba fins a la línia de canvi de data. La frontera entre GOES-West i GOES-East és ara a mig camí dels dos satèl·lits (106°O).
- **Lleuger quan es pot, i sense forats.** La NASA publica cada imatge en PNG i, més tard, també en JPEG, que pesa 6–8 vegades menys i es veu igual (una tessel·la d'infraroig fa 4–12 KB en lloc de 35–80); però mentre el JPEG hi va arribant pot sortir amb blocs negres. El proxy dona el PNG mentre la imatge és recent (l'infraroig, els primers 50 minuts; el color, 90) i el JPEG a partir d'aleshores. Així cada fotograma és d'una sola hora i sense forats, i la imatge més nova arriba tan aviat com la NASA la publica; a canvi, al primer bucle les 1–2 imatges més noves de l'infraroig (4–5 en color) pesen més.
- **Atribució** de NASA GIBS (GOES: NOAA/CIRA; Himawari: JMA) al panell d'informació del radar.

## ⚡ Novetats de la v3.38.0: llamps del satèl·lit, avís de tempesta a prop i Meteosat HD en color

Meteosat-12 porta un detector de llamps, el Lightning Imager, que l'app encara no aprofitava. Ara:

- **Capa de llamps al radar** (activa per defecte). Mostra l'àrea de llamps de cada 5 minuts sobre Europa, l'Àfrica i l'Atlàntic, publicada uns 12 minuts després, per sobre del radar. Cada fotograma mostra els 10 minuts que l'envolten, de manera que cada llamp surt un sol cop al bucle. Les zones amb pocs llamps són translúcides i els nuclis intensos, granats, perquè no tapin el radar. Té llegenda (d'1 a 20 o més llamps en 5 minuts). Una tessel·la sense llamps pesa 369 bytes.
- **Avís «Llamps a prop» a la pantalla principal.** L'app mira els últims 30 minuts en 50 km al voltant de la ubicació. Amb llamps a 30 km o menys avisa amb la distància, la direcció i quant fa, i un botó obre el radar; a 10 km o menys l'avís és vermell i aconsella refugiar-se. Comprovat amb la tempesta del 19 al 20 d'octubre a Menorca; la distància i la direcció coincideixen amb un càlcul independent (1 km de diferència).
- **La IA ho sap.** Rep els llamps com una observació real, no com una previsió, i ho diu a la primera frase («Hi ha una tempesta activa a 1 km al nord-oest…»). El semàfor passa a precaució amb el motiu «Llamps detectats per satèl·lit a uns N km», i si la IA no respon, l'anàlisi local de reserva també avisa de tempesta.
- **Meteosat HD en color.** La capa té un selector IR | Color. En color fa servir el producte GeoColour: color real de dia i, de nit, els núvols sobre les llums de les ciutats, una imatge cada 10 minuts. Per defecte continua en infraroig.
- **Sense parpellejos ni peticions de més.** Una consulta de llamps que falla no esborra un avís vigent (es manté fins a 10 minuts); si en fallen unes quantes seguides, s'espera fins a 10 minuts abans de tornar-ho a provar. Fora de l'abast del satèl·lit (Amèrica, Àsia) no es fa cap petició.
- **README:** el radar té ara una secció pròpia, amb totes les capes, d'on surten i cada quant s'actualitzen.

Límits: la posició dels llamps té una resolució de pocs quilòmetres i de dia el satèl·lit en detecta menys; no substitueix una xarxa de detecció a terra.

Imatges i llamps: *Contains modified EUMETSAT Meteosat data 2026* (CC BY 4.0).

## 🛰️ Novetats de la v3.37.0: Meteosat HD, ara amb MTG i una imatge cada 10 minuts

La capa «Meteosat HD (Europa)» del radar feia servir el Meteosat de segona generació (MSG), que EUMETSAT deixarà de servir cap al 2027, i agafava les hores de la llista de satèl·lit de LibreWXR, que en dona una per hora: en un bucle de 2 hores de radar només hi havia 2 imatges de satèl·lit, unes 72 minuts endarrerides, i si LibreWXR fallava la capa desapareixia encara que EUMETSAT funcionés. Ara fa servir el Meteosat de tercera generació (MTG, Meteosat-12):

- **El doble de nitidesa.** Píxels d'uns 2 km sobre Catalunya (abans uns 4,6 × 3,4 km); es nota sobretot de prop.
- **Una imatge per cada fotograma de radar.** Cada fotograma porta la imatge de satèl·lit de la mateixa desena de minuts: unes 10 imatges diferents per bucle en lloc de 2, i la més nova amb una mediana de 27 minuts en lloc de 72. En un bucle real a producció: 11 imatges, de 15:10 a 16:50 UTC.
- **Més amunt.** La capa arriba fins a 72°N (el Cap Nord); abans s'aturava a 66,5°N.
- **Contrast ajustat per a MTG.** MTG té menys contrast a la part brillant que MSG; l'app hi aplica un contrast i una lluminositat mínima propis perquè els núvols es vegin com abans sense enfosquir la resta. L'opacitat no canvia.
- **Sense dependre de LibreWXR.** Les hores les dona el proxy propi a partir d'EUMETSAT (quina és l'última imatge publicada), així que la capa continua encara que LibreWXR no respongui.
- **Reserva automàtica.** Si MTG s'endarrereix més d'una hora, la sessió passa sencera a MSG mentre aquest funcioni, sense barrejar tessel·les dels dos satèl·lits. També es pot forçar des del proxy sense publicar l'app.
- **Dades:** al mòbil, activar la capa i mirar dos bucles gasta uns 1,0–1,2 MB (abans 0,19 MB), perquè hi ha cinc vegades més imatges; els bucles següents surten de la memòria cau del navegador. Al primer bucle, alguna tessel·la lenta d'EUMETSAT pot arribar tard i veure's a la volta següent.

Imatges: *Contains modified EUMETSAT Meteosat data 2026* (CC BY 4.0), com ja diu el panell d'informació del radar.

## 🛠️ Millores publicades entre la v3.36.0 i la v3.37.0

- **El modal Capes de núvols segueix el cursor.** En passar el cursor o el dit pel gràfic d'evolució, les tres capes ja mostraven l'hora triada, però la xifra gran de cobertura efectiva i el seu estat es quedaven en el valor d'ara (a les 11:00 les capes deien 100 / 0 / 0 % i el modal continuava dient «93 % Cobert», quan tocava «30 %, Parcialment ennuvolat»). Ara la xifra, l'estat i l'hora segueixen el cursor i tornen a ara en deixar-lo, com als altres modals experts.

## ☁️ Novetats de la v3.36.0: el giny Capes de núvols, a PC i a mòbil

El giny de núvols del Mode Expert (abans «Profunditat de núvols») eren tres barres verticals l'una al costat de l'altra. A PC, on la targeta és estreta i alta, no hi cabien: les xifres «100%» es tocaven, les etiquetes quedaven apretades i el títol es tallava; a mòbil, les línies de fons travessaven les xifres. Ara és un perfil vertical del cel:

- **Les capes, com al cel.** Alts a dalt, mitjans al mig i baixos a baix, cadascuna amb una barra horitzontal i el seu percentatge, i les alçades que les separen (3 i 8 km, les d'Open-Meteo) marcades a les línies entre capes.
- **La cobertura efectiva i el seu estat** (Serè, Parcialment ennuvolat, Molt ennuvolat o Cobert): la mateixa xifra i la mateixa paraula que el modal que s'obre tocant-lo, i el mateix càlcul que tria la icona de cel.
- **Bé a totes les mides.** A PC, la xifra i el perfil van apilats; a mòbil i a tauleta, l'un al costat de l'altre (en mòbils molt estrets, apilats). Comprovat de 320 a 1440 px d'amplada, en els quatre idiomes i amb cel serè, ennuvolat, cobert i sense dades.
- **Nou nom: «Capes de núvols»** (*Capas de nubes*, *Cloud layers*, *Étages nuageux*): mostra quant cobreix cada capa, no el gruix dels núvols, i l'antic no cabia a PC.
- **Honest amb les dades:** una capa sense dada surt com a «--», mai com a 0 %. I lleuger: sense desenfocaments, filtres ni animacions en bucle.

## 🛠️ Millores publicades entre la v3.35.0 i la v3.36.0

- **Tauler més lleuger als mòbils modestos.** El Mode Expert recalculava a cada fotograma més d'un centenar de capes de desenfocament de fons que, sobre el fons gairebé negre, no es veien. S'han tret sense que canviï el color dels ginys, i la pluja i la neu de fons es posen en pausa quan no es veuen (i no surten si el sistema demana menys moviment). Amb el tauler quiet, el cost de pintar la graella de ginys en un mòbil lent simulat ha baixat de 308 a 22 ms per segon.

## 🌕 Novetats de la v3.35.0: el modal Fase lunar, com el seu giny

Després del redisseny dels ginys de la v3.34.0, el modal que s'obre tocant la Fase lunar encara tenia el disseny antic: quadrícula i estrelles de fons, una icona de lluna brillant sense mars i una tira horitzontal de 14 dies que a mòbil només en deixava veure dos i mig. No s'assemblava gens al giny. Ara té el mateix llenguatge que la targeta i la mateixa estructura que el modal Cicle solar:

- **La mateixa Lluna que el giny, en gran.** Amb els mars i l'anell que marca el punt del cicle, girada mig volt a l'hemisferi sud. Al costat, la fase, «50% il·luminada · Edat 8 dies» i, avui, on és al cel («Ara +23° · 165° SSE», o «sota l'horitzó»).
- **Es canvia de dia com al Cicle solar:** fletxes, el botó «Avui», les tecles ←/→ o lliscant el dit; tot el modal es recalcula per al dia triat.
- **Sortida i posta** grans, amb l'azimut de cadascuna (i «+1d» quan la posta cau l'endemà); **distància** Terra-Lluna amb la barra perigeu–apogeu i l'avís de Superlluna o Microlluna; **pròximes plena i nova** amb la data i quants dies falten.
- **Calendari lunar de 15 dies en llista**, sense scroll horitzontal: fase, il·luminació, sortida i posta de cada dia; tocar-ne un l'obre.
- **Els mateixos valors que el giny.** Els dos fan servir el mateix dibuix i els mateixos càlculs: la fase (avui, a l'hora real), l'edat, la posició i la pròxima plena hi coincideixen.
- **Lleuger**, com el Cicle solar: sense desenfocaments, filtres ni animacions en bucle. En català, castellà, anglès i francès.

### La direcció del sol, també a mòbil

Al modal Cicle solar, la brúixola «Direcció del sol» (el recorregut del sol vist des de dalt i l'azimut de la sortida i de la posta) només sortia a pantalla gran: a mòbil no es veia enlloc cap a on surt o es pon el sol. Ara surt a totes les mides; a mòbil, just sota el gràfic d'alçada, i el punt del sol la segueix quan s'arrossega el gràfic.

## 🌗 Novetats de la v3.34.0: el Sol i la Lluna del tauler, amb el cel real

Els ginys de Cicle solar i Fase lunar del Mode Expert eren dels que menys deien i dels que més costaven de pintar: un arc simbòlic amb una estela que s'avançava al sol, i una lluna amb una lluentor animada sense parar, desenfocaments de 50 px i de fons i perspectiva 3D. Ara s'han redissenyat de cap a peus amb les dades reals:

- **Cicle solar, una finestra al cel.** El fons del gràfic és el color que té el cel en aquell moment —blau de dia, càlid a la posta, negre amb estrelles de nit— i la corba és l'alçada real del sol al llarg del dia, pintada per franges de llum (nit, hora blava, hora daurada i dia), amb el tram ja recorregut a tot color. El sol és a la seva posició («Ara +7° · 250° OSO»), el migdia porta l'alçada i l'hora («39° · 13:36») i a sota hi ha la sortida i la posta amb l'azimut i la durada del dia amb quant ha canviat respecte d'ahir («−2 min 39 s»). També el sol de mitjanit i la nit polar.
- **Fase lunar, la Lluna com és.** Amb els mars i la part fosca, girada mig volt a l'hemisferi sud, dins d'un anell que marca en quin punt del cicle som (nova a dalt, quarts als costats, plena a baix). A sota, la il·luminació i on és ara al cel («50% il·luminada · 21° SSE», o «sota l'horitzó»), la sortida i la posta del dia i la pròxima lluna plena («dl. 26 · 8 dies»).
- **El mateix que els modals.** Tots dos fan servir els mateixos càlculs que els seus modals: el compte enrere, la durada del dia, la fase, l'edat, la posició de la Lluna i la pròxima plena hi coincideixen. De passada, el compte enrere del giny solar ja no marca un minut de més que el modal després de cada canvi de minut.
- **Lleugers.** Cap desenfocament, filtre ni animació en bucle, com els modals des de la v3.31.0. La corba del sol es dibuixa un cop al dia i, cada minut, només es mouen el sol i els textos.
- En català, castellà, anglès i francès.

## 🛠️ Millores publicades entre la v3.33.0 i la v3.34.0

- **Fase lunar real.** La fase sortia d'un mes lunar de durada fixa (29,53 dies): comparada amb les 99 fases oficials de l'USNO de 2026 i 2027, s'equivocava fins a 17 hores, la il·luminació fins a 8 punts, i el nom de la fase sortia diferent unes 16 nits l'any. Ara es calcula amb els instants reals de les quatre fases principals (algorisme de Meeus), amb menys de 2 minuts d'error, i l'edat és el temps des de la lluna nova real (el 18 d'octubre el giny deia «Dia 7» amb una Lluna de gairebé 8 dies). A més, el giny la calculava amb l'hora local com si fos UTC (2 hores de desfasament a Barcelona, 11 a Sydney); ara fa servir l'hora real, com el modal. I al modal, el dia d'una lluna plena o nova que ja havia passat de matinada, «Pròxima lluna plena» saltava al mes següent («en 29 dies») en lloc de dir «avui».
- **Avisos oficials d'Alemanya (DWD).** Ara surten del servei de mapes oficial del DWD (el web d'on sortien abans bloqueja algunes connexions amb un captcha), i 91 dels 400 districtes que no rebien els seus avisos —ciutats com Munic o Friburg, que el DWD agrupa amb el seu districte, i les zones partides entre costa i interior— ja els reben.
- **Giny lunar en francès.** Algunes etiquetes sortien en castellà.

## 🏔️ Novetats de la v3.33.0: la Cota de neu, a tota la fila

El giny de Cota de neu només surt quan el nivell de congelació és prou baix perquè la neu compti. Com que és l'únic giny del Mode Expert que va i ve, a PC es quedava sol a l'última fila del tauler: ocupava una de les quatre columnes, era més baix que la resta i deixava tres forats al costat (a tauleta, mitja fila buida). A mòbil no es notava.

Ara **ocupa tota la fila a qualsevol amplada** i s'ha redissenyat per aprofitar l'espai:

- **La resposta a l'esquerra:** la cota d'ara i la **mínima de les pròximes 48 hores**, amb d'aquí a quantes hores arriba («0 m · d'aquí a 17 h»). La isoterma 0 °C surt a la capçalera.
- **Un perfil d'altitud al llarg del temps a la dreta:** la línia de la cota de les pròximes 48 hores sobre una muntanya que **queda nevada per sobre de la cota**, una línia que marca **l'altitud del lloc** («Aquí · 14 m»), l'eix d'altituds i els canvis de dia en una franja pròpia. Si falten hores, la línia s'interromp en lloc d'inventar-se el tros que falta.
- **El mateix que el modal.** La mínima i la màxima de 48 hores es calculen amb la mateixa finestra al giny i al modal, així que sempre coincideixen.
- **Lleuger:** sense desenfocaments ni animacions en bucle, com la resta de modals des de la v3.31.0. En català, castellà, anglès i francès, i en peus si fas servir °F.

### Gràfics dels modals experts a tota l'amplada

A PC, el gràfic d'evolució de 48 hores dels nou modals experts (Cota de neu, Qualitat de l'aire, Núvols, Confort, Pressió, Tempesta, UV, Visibilitat i Vent) quedava **estret al mig del full**, i el punt que segueix el ratolí **no coincidia amb la línia**: amb el ratolí al 75 % de l'amplada, el punt es dibuixava al 60 %. Ara el gràfic omple l'amplada sense que els traços es deformin, i el punt cau on hi ha el ratolí o el dit. A mòbil es veu igual que abans.

## 🛠️ Millores publicades entre la v3.32.0 i la v3.33.0

- **Open-Meteo lent o saturat.** Quan el servidor trigava més de 10 segons, els tres intents es tallaven abans de rebre res i l'app es quedava sense dades. Ara la previsió espera fins a 25 segons en un sol intent; si el servei està saturat (errors 5xx), es torna a provar als 3 i als 8 segons, i si és el límit de peticions (429), ja no es reintenta, perquè només gastava més quota.
- **Modals del Motor de Consens.** La Telemetria gràfica i el detall del consens quedaven tapats per la capçalera de la pàgina, i la pàgina de sota es podia desplaçar amb el modal obert.
- **Anàlisi de la IA.** Els graus surten amb el signe «°» i no amb «º». Quan hi ha un avís ambre o vermell i no arriba cap consell, la targeta en mostra un de fix per a aquell perill.
- **README.** Captures de pantalla actuals, i al manifest de la PWA les mides de les captures ara quadren amb les imatges reals.

## ⚠️ Novetats de la v3.32.0: l'avís de la IA diu per què, amb xifres

Quan l'anàlisi +6h posava un avís, el bàner només deia una etiqueta genèrica, com «Motiu: VENT FORT I RÀFEGUES». No deia si eren ràfegues de 51 o de 79 km/h, ni quan, ni per què l'avís era ambre i no verd, i el text de la IA de vegades ho explicava i de vegades no.

Ara, sota el «Motiu», surt una línia amb **què l'ha fet saltar, quan i a partir de quin llindar**:

- **Vent:** «Ràfegues de fins a 62 km/h cap a les 17:00 (precaució a partir de 50 km/h)».
- **Pluja:** la màxima en una hora («Pluja de fins a 8,4 mm en una hora cap a les 15:00»), amb el llindar en mm/h.
- **Calor i fred:** la màxima o la mínima i la seva hora («Mínima de -2 °C cap a les 07:00 (a 0 °C o menys pot glaçar)»).
- **Tempesta, calamarsa, neu, aiguaneu, pluja gelant, boira i boira gebradora:** l'hora en què arriben. La calima i les partícules, «ara mateix».

**No ho escriu la IA.** Ho calcula el tallafocs determinista, amb els mateixos llindars amb què decideix el nivell de l'avís i sobre la mateixa finestra de 6 hores que llegeix la IA, així que les xifres quadren amb el seu text. Només surt si les regles han vist el mateix perill al mateix nivell que diu el bàner; si la IA en veu un altre (o el veu més greu), es mostra el bàner sense la línia, en lloc d'unes xifres que no l'expliquen. Quan neva amb temperatures sota zero, la línia surt tant si la IA tria la neu com el fred. En català, castellà, anglès i francès.

Les anàlisis que el navegador ja tenia desades abans d'actualitzar mostren el bàner sense la línia fins que caduquen (com a molt, una hora).

## 🛠️ Millores publicades entre la v3.31.0 i la v3.32.0

- **Imatge Satèl·lit (NASA) al radar.** La capa sortia gairebé tota negra: el servei de la NASA (GIBS) va començar a respondre amb imatges negres per a les zones sense dades, i es guardaven a la memòria cau. Arreglat al servidor intermediari, i el navegador ja no reaprofita les tessel·les negres que tenia desades.
- **Dependències.** brace-expansion i source-map-js (alertes de seguretat de Dependabot, només de compilació i proves; no formen part de l'app publicada).

## ☀️ Novetats de la v3.31.0: el Cicle solar, redissenyat per a qualsevol mòbil

El modal del Cicle solar anava a batzegades en mòbils de gamma baixa. Mesurat amb el modal obert: 14 capes de desenfocament de fons (una a pantalla completa, gairebé invisible perquè el fons era un 95 % negre), 55 estrelles animades sense parar que obligaven a recalcular-les a cada fotograma encara que no toquessis res, 4 desenfocaments grans més i 635 elements. A més, en navegadors i WebViews d'Android antics el modal creixia més que la pantalla i el botó de tancar en quedava fora.

Ara té **0 desenfocaments, 0 filtres, 0 animacions en bucle i la meitat d'elements**, i s'ha redissenyat de cap a peus sense perdre cap dada:

- **La resposta primer.** Sortida i posta grans —les mateixes hores i el mateix compte enrere que el giny del tauler—, azimut de cadascuna, durada del dia, quant ha canviat respecte d'ahir (en minuts i segons) i el pròxim esdeveniment. Es canvia de dia amb fletxes, el botó «Avui», les tecles ←/→ o lliscant el dit.
- **L'alçada del sol, amb el cel de veritat.** Un gràfic amb el color real del cel a cada hora (alba, ple dia, posta, nit amb estrelles), les bandes de crepuscle i l'hora daurada i blava sobre la corba. El sol és un disc brillant que es mou per la corba: arrossegant-lo (o amb el teclat) dona l'hora, l'azimut, l'alçada, l'ombra i la fase de llum de qualsevol minut. Arrossegar el gràfic ja no bloqueja l'scroll de la pàgina, i un segon dit no l'interromp.
- **Efemèrides en taula.** Matí i vespre: sortida i posta, crepuscles civil, nàutic i astronòmic, hora daurada i blava com a franges, migdia i mitjanit solar i llum útil, amb el que ja ha passat, el que passa ara i el que ve.
- **Previsió de sol i calendari de 15 dies.** UV amb la categoria de l'OMS, hores de sol sobre les hores de llum, radiació i qualitat estimada de la posta; calendari de 15 dies sense scroll horitzontal. En pantalla gran, una brúixola amb el recorregut del sol.
- **Dies difícils ben resolts.** Canvis d'hora (dies de 23 i 25 hores), la línia de canvi de data, sol de mitjanit, nit polar, latituds altes sense nit astronòmica i postes que cauen passada la mitjanit.
- **S'obre abans.** El codi es comença a carregar quan toques la targeta, i si encara triga, un esquelet ocupa el lloc del modal.

### També dins de la v3.31.0

- **Lluna i modals experts sense treball de GPU en repòs.** Sense desenfocaments de fons (8–9 per modal abans) ni animacions en bucle (92 a la Lluna), amb el mateix aspecte: superfícies opaques del to de cada full, lluïssors com a degradats estàtics i les estrelles de la Lluna fixes (i rodones, no estirades). Amb un modal obert, les animacions del tauler de sota es posen en pausa.
- **Modals que funcionen en navegadors antics.** Els modals experts, el del model regional i el del radar ja no fan servir unitats `dvh`: a Chrome/WebView anteriors a la 108, Samsung Internet antic i iOS 15.0–15.3, la capçalera i el botó de tancar quedaven fora de la pantalla i el mapa del radar sense alçada.
- **Targeta del Cicle solar.** Títol i textos en els 4 idiomes; després de la posta compta fins a la sortida real de demà, i el compte enrere ja no queda fins a un minut endarrerit respecte del modal.

## 🛠️ Millores publicades entre la v3.30.0 i la v3.31.0

- **Radar.** El mapa es recupera sencer si el navegador perd el context gràfic, l'animació ja no sincronitza tot el mapa a cada pas i la càmera no surt d'Europa en activar Meteosat HD; un sol clic a Play torna a reproduir l'animació després de passar per la pestanya de vent; atribució obligatòria d'EUMETSAT al panell d'informació.
- **Meteosat HD** cobreix fins a 66,5° N (Noruega, Islàndia, Finlàndia), amb dues traduccions corregides, i una prova diària avisa si el satèl·lit que fa servir s'atura.
- **Memòria cau.** Les previsions de més de 24 hores es poden un cop per sessió, i ja no hi ha la neteja que podia esborrar les preferències.
- **Dependències.** fast-uri 3.1.8 (alerta de seguretat de Dependabot, només de compilació).

## 📶 Novetats de la v3.30.0: sense connexió, la previsió desada

Abans, si en obrir l'app no es podia obtenir la previsió (sense cobertura, en mode avió, amb Open-Meteo caigut o amb el límit de peticions), tot el tauler se substituïa per «No s'ha pogut carregar el temps», encara que l'app tingués desada una previsió de feia poques hores. I amb mala cobertura podies passar més de mig minut mirant l'esquelet de càrrega abans de veure l'error.

- **Previsió desada en lloc de la pantalla d'error.** Sense connexió, amb l'API caiguda o amb una resposta de més de 8 segons, l'app mostra l'última previsió desada del lloc (fins a 24 hores) amb un avís a dalt de tot: «Previsió desada — No s'ha pogut actualitzar. És la previsió de les 10:30 (fa 3 h).», amb un botó per reintentar-ho.
- **Avançada fins a l'hora actual, no congelada.** L'"ara", les 24 hores i els gràfics comencen a l'hora actual amb els valors previstos per a aquesta hora; passada la mitjanit, «avui» torna a ser avui a totes les pantalles. Un valor que la previsió desada no té es mostra com a sense dades, mai amb el de l'hora vella.
- **També si t'has mogut.** El GPS no dona mai les mateixes coordenades: si no hi ha cap previsió desada del punt exacte, es fa servir la més propera (fins a 20 km) i l'avís diu de quin lloc és i a quants quilòmetres.
- **S'actualitza sola.** Quan torna la connexió, quan tornes a l'app o quan arriba la resposta lenta, la previsió nova substitueix la desada sense fer res; la comparació amb el model global (consens) també es torna a demanar.
- **Sense IA sobre dades velles.** Amb la previsió desada no es demana cap anàlisi nova a la IA: es mostra l'anàlisi local, feta amb les mateixes dades de la pantalla. La qualitat de l'aire no es mostra, perquè la desada seria d'una altra hora.
- **La qualitat de l'aire ja no fa caure la previsió.** Ve d'un altre servidor d'Open-Meteo, i si fallava l'app es quedava sense previsió. Ara la previsió surt igualment i només el giny queda sense dades.

Límit: si la previsió desada és d'ahir, el «rang probable» dels dies es calcula com si fos d'avui i pot quedar una mica estret (d'un dia de marge com a molt).

### També dins de la v3.30.0

- **Al tròpic, el "plugim" es diu pluja.** Open-Meteo tria el codi de l'ECMWF només per la quantitat de pluja (per a aquest model, "plugim" vol dir menys d'1,3 mm per hora), i als 24 aeroports tropicals de la verificació, quan l'app pintava plugim i plovia, els METAR deien plugim només un 6 % de les vegades (pluja el 70 %, ruixat o tempesta el 24 %). Ara, al tròpic, aquestes hores es pinten com a pluja feble, moderada o forta segons la quantitat, i amb clarianes com a ruixat. A Ubud, un dia de pluja de tarda que deia «Plugim moderat» ara diu «Pluja feble». Només canvien el nom i la icona: si plou o no, i les tempestes, queden igual. Fora del tròpic el plugim no es toca.

---

## 🌴 Novetats de la v3.29.0: icones fidels al tròpic i ruixats

Fora dels models d'alta resolució, al tròpic la sèrie principal de l'app és l'ECMWF de 9 km, que plovisqueja contínuament: 0,1–0,3 mm per hora durant hores, fins i tot amb el cel gairebé serè. A Natal (Brasil) la setmana sortia amb plugim els 7 dies, i el detall d'un dia deia «Plugim feble» al costat de gairebé 12 hores de sol. Tot s'ha contrastat amb un any de METAR (octubre 2025 – setembre 2026) de 24 aeroports tropicals del Brasil, Indonèsia, la resta d'Àsia, l'Àfrica, el Carib i Oceania, passant 118 previsions de 7 dies per aeroport pel motor de l'app.

- **Al tròpic, sense el "plugim" de cada dia.** El model pintava pluja en un 34–40 % de les hores quan en plovia un 8 %, i a les hores de 0,1 mm només plovia un 10 % de les vegades. Ara, al tròpic i sense model regional, una hora amb menys de 0,5 mm i el cel no gairebé tapat (85 % o menys) es pinta amb el cel que toca; els mil·límetres i la probabilitat de pluja es continuen mostrant. A la previsió setmanal (dies 1 a 5), els dies amb icona de pluja o tempesta passen del 85 % al 65 % (en plou el 46 %), la pluja real quan hi ha icona puja del 53 % al 62 % i el plugim passa de pintar-se un 33 % dels dies a un 6 %. A Natal, del 87 % al 53 % dels dies (en plou el 35 %); a Bali, del 88 % al 67 % (en plou el 47 %).
- **Ruixat quan plou amb clarianes (a tot arreu).** La pluja i el plugim amb el cel trencat (60 % de cobertura efectiva o menys) es pinten com a ruixat —sol o lluna amb gotes— en lloc del núvol amb pluja: la pluja contínua i el plugim necessiten una capa de núvols sencera. Es decideix a cada hora, a l'"ara" i al dia; un dia amb pluja al matí amb el cel tapat i ruixats a la tarda surt com a ruixats.
- **La icona de tempesta, verificada també al tròpic, no canvia.** A 1–5 dies vista surt el 48 % dels dies i trona el 22 %; quan surt, aquell dia trona un 40 % de les vegades, i cap alternativa provada (més CAPE, més pluja, només el codi de tempesta del model) no l'ha millorada a tots els terminis. Punt feble conegut: a les costes de ruixats marítims com la del nord-est del Brasil, el CAPE és alt però gairebé no hi trona (un 3 % dels dies) i la icona hi surt un 28 % dels dies.

Límits: el filtre de pluja només s'aplica al tròpic (fora no s'ha verificat); un METAR és un punt i, com a "dia de pluja", hi compta qualsevol informe de precipitació; un dia encara pot sortir de plugim per una sola hora amb el cel tapat, perquè la icona del dia és la de l'hora pitjor.

---

## 🔬 Millores publicades entre la v3.28.0 i la v3.29.0

Una revisió de tota la cadena de previsió amb criteri de meteoròleg: cada regla que decideix el que veu l'usuari s'ha contrastat amb observacions reals (METAR de 30 aeroports europeus) i s'ha canviat només on les dades ho justificaven. Es van publicar a producció sense canvi de versió i ara ja són dins de l'etiqueta `v3.29.0`.

### 🌡️ Temperatura

- **Rang probable (80 %) en lloc del rang entre models.** El gràfic de tendència i el detall de dia dibuixaven el mínim i el màxim d'ECMWF, GFS, ICON i best_match, que només contenia la temperatura real el 48 % de les vegades (el 37 % al dia 7). Ara cada dia porta el rang dins del qual queden la màxima i la mínima reals 8 de cada 10 vegades, calibrat amb 76.755 dies de 30 aeroports segons el dia vista i l'acord entre models: el conté el 80 % de les vegades (validat deixant cada aeroport fora; per aeroport, del 68 al 91 %). S'eixampla amb el dia vista i quan els models discrepen.
- **Correcció d'inversió tèrmica reduïda a la meitat.** A les nits serenes i en calma de novembre a març, la correcció de fins a 3,5 °C empitjorava la temperatura (error mitjà d'1,38 a 1,55 °C; només millorava 9 de 29 aeroports). Amb fins a 1,75 °C l'error baixa a 1,33 °C i la mínima diària també encerta més. La sensació tèrmica porta ara la mateixa correcció, a la capçalera i al que rep la IA.
- **Dies 4 a 7: temperatura barrejada amb AIFS**, el model d'intel·ligència artificial de l'ECMWF: hi pesa un 25 % el dia 4 i un 50 % del dia 5 al 7, sense salts a la gràfica horària. Amb un any de previsions a 30 aeroports, l'error mitjà baixa un 8 % a la màxima i un 12 % a la mínima, i els dies errats en més de 5 °C passen del 5,6 al 4,0 % a la màxima i del 6,1 al 3,7 % a la mínima. El rang probable d'aquests dies s'ha recalibrat amb la sèrie nova. Límit: AIFS suavitza el cicle diari i els dies més calorosos surten una mica més curts.
- **Màxima i mínima de la capçalera coherents** amb el detall d'«Avui» i la llista (abans eren el diari del model global en brut: a Girona, 28° de màxima amb 31° a les hores).

### 🌧️ Pluja, neu i icones

- **Intensitat de la pluja d'"ara" en mm/h**, com a les hores: les dades de 15 minuts la feien semblar 4 vegades més feble (2 mm/h eren "pluja feble" a dalt i "moderada" a la taula).
- **Centímetres de neu coherents amb la icona:** surten de la mateixa pluja i del mateix motor que la icona de cada hora. Abans, 108 de 234 dies amb neu en joc es contradeien (icona de neu amb mm, o centímetres amb icona de pluja).
- **Verificat i sense canvis:** la regla neu/aiguaneu/pluja (CSI 0,70 amb 1.015 hores de neu o aiguaneu, millor que les regles de temperatura humida), el marge de 300 m de la cota de neu (fer-lo dependre de la humitat ho empitjora) i el filtre de virga (amb HR < 45 % només plou de debò el 7 % de les hores).

### ⚡ Tempesta, UV i confort

- **Cisallament del vent (0–6 km)** al modal de tempesta: al pic de CAPE, diu si les tempestes serien aïllades, organitzades (multicèl·lules) o amb supercèl·lules possibles. És informatiu (no toca la icona ni el risc) i no s'ha pogut verificar localment.
- **CAPE entre 100 i 1.200 J/kg: «Feble» en lloc d'«Estable»**, i les etiquetes i el títol del giny en l'idioma de l'usuari (abans sempre en català).
- **Índex UV classificat sobre l'enter**, com l'OMS (abans un 5,8 sortia «Moderat» en lloc d'«Alt»), també per a la finestra de protecció.
- **Punt de rosada i direcció del vent del mateix model** que la temperatura i la humitat (el punt de rosada del modal de confort podia diferir fins a 9,8 °C).

### 🛡️ Robustesa

- Si el model regional falla puntualment, la previsió global només es reaprofita 2 minuts (abans 15), perquè la càrrega següent torni a provar el regional.

### Altres correccions

- La probabilitat de pluja ja no diu 0 % al costat de la pluja d'un model que no és ICON.
- Les etiquetes del radar ja no surten amb «API KEY REQUIRED» (ara són vectorials, de Mapbox).
- El desplegament s'atura si fallen el type-check, el lint o els tests.
- La regla de tempesta per CAPE queda documentada amb la seva verificació.

---

## 🧭 Confiança de l'anàlisi de la IA (v3.27.0 – v3.28.0)

La insígnia de l'**Anàlisi Meteo IA (+6h)** es va revisar després d'un cas real: una nit d'anticicló amb el cel serè sortia «Incertesa alta» en vermell al costat de «Temps tranquil».

- **Mira les mateixes 6 hores de què parla el text.** Abans reutilitzava la fiabilitat del dia sencer, que de nit jutjava hores ja passades. Mesurat amb 262.617 finestres de 6 hores de 30 aeroports europeus (un any de previsions de curt termini contra els METAR), no avisava de res: quan deia «incertesa alta», la previsió fallava tan sovint com quan deia «consens» (un 18 %). A Catalunya era pitjor: sortia en vermell un 20 % del temps i fallava menys que el «consens». Ara compara, hora a hora, la sèrie que veus (el model regional o el global) amb ECMWF, GFS, ICON i AIFS, i quants globals contradiuen si plourà: la previsió falla un 10 % de les vegades amb «consens», un 26 % amb un dubte moderat i un 56 % amb un dubte fort.
- **Diu què és incert.** «Temperatura ±3°» (o ±4°, ±5°) en ambre quan els models només discrepen en la temperatura: el marge és on queda la real en 8 de cada 10 casos. «Pluja dubtosa» (ambre) o «Pluja incerta» (vermell) quan discrepen en si plourà. En passar-hi per sobre, una frase ho explica. Textos en català, castellà, anglès i francès, i en Fahrenheit el marge es converteix.
- **Sense dades, sense insígnia.** Si falta la dada d'ara o no hi ha prou models per comparar, no surt cap insígnia, en lloc d'un «consens» per defecte o d'una «incertesa alta» que quedava sola quan arribava el text de Gemini.
- **Correcció:** si durant l'espera de mig segon abans d'analitzar arribaven dades noves de la mateixa consulta, l'anàlisi no es feia mai i la pantalla es quedava amb l'anterior (text i insígnia inclosos).

Límits: mesura l'acord entre models, no l'exactitud; en nits d'inversió on els models no s'hi posen d'acord (Girona, per exemple) surt un marge de temperatura ampli, en ambre.

---

## Canvis de la v3.26.0

### 🧩 Nous modals de detall (Mode Expert)

Els 9 widgets del Mode Expert tenen ara el seu propi modal de detall, amb gràfic horari *scrubbable* i xifres clau: **Cota de Neu**, **Núvols** (perfil de capes), **Visibilitat i Boira**, **Punt de Rosada** (Índex de Confort), **Pressió Atmosfèrica**, **Índex UV** (Exposició Solar), **Qualitat de l'Aire**, **Risc de Tempesta** (CAPE) i **Vent**. Tots comparteixen el mateix valor "ara" que el giny des del qual s'obren.

### 🌫️ Icones i estat del cel

- Una única font calcula la icona horària; la boira ja no es pinta si el model no la preveu i la saturació del punt no ho confirma.
- Boira gebradora i pluja engelant amb icona pròpia; icones diferenciades per als núvols baixos i la intensitat de la precipitació.
- El llindar de boira per núvols baixos s'ha calibrat amb dades reals d'AROME i METAR de Catalunya (70 % → 50 %).
- La icona del dia i el resum diari passen pels mateixos filtres que l'evolució horària.

### 🧠 IA tàctica

- Rep la qualitat de l'aire i l'avís de calima (abans arribava com a "N/D").
- Distingeix cel serè, poc ennuvolat, parcial, molt ennuvolat i cobert.
- L'aiguaneu (codis WMO 68/69) ja no arriba com a text cru i puja el semàfor de risc a AMBER.
- Rep la temperatura tal com la veu l'usuari (amb la correcció d'inversió tèrmica) i les xifres ja calculades, no dades brutes.
- Nou perill reconegut: **AIR_QUALITY** (qualitat de l'aire / pols en suspensió), amb avís de calima a la pantalla principal.
- Text de reserva local traduït als 4 idiomes de l'app (abans sempre sortia en català).

### 📊 Gràfics i previsió

- **Gràfics horaris d'Expert:** comparen 4 models (ECMWF, GFS, ICON, AIFS) alhora, amb banda de desacord, xip d'acord calibrat, llegenda per amagar models, pluja en barres, ràfegues i cota de neu compacta.
- **Gràfic de tendència (7 dies):** coherent amb la llista i el detall de dia (mateixes màximes/mínimes, sense zeros inventats), mostra el desacord entre models i l'origen de les dades, i cada dia obre el seu propi detall.
- **Detall del dia:** capçalera coherent amb la llista i el gràfic, mostra fiabilitat/rang/font, afegeix estat del cel, moments del dia i una tira per canviar de dia; el detall d'avui ja es pot obrir correctament.
- **Pluja del model regional com a evidència calibrada:** contrastada amb 306.879 hores de METAR de 16 aeroports, el vell "70 % fix" sobreestimava la probabilitat real un factor ~3; ara la probabilitat es calibra contra la freqüència observada. El total diari de pluja és la suma de les hores mostrades, no el valor diari del model global.
- **Fiabilitat entre models:** ara jutja el pitjor acord entre màxima *i* mínima (abans només mirava la màxima), validat amb 95.610 casos de 24 aeroports.
- La previsió es refresca sola quan l'app es desperta o les dades envelleixen (sense pantalla de càrrega).

### 🛰️ Radar

- Capa híbrida RainViewer + LibreWXR (cobertura terrestre real per sobre de la cobertura global), amb *fallback* de fotograma més proper.
- Millores de fluïdesa (limitació de VRAM, sincronització sense *deadlock*, filtratge geogràfic de NWS).
- Correcció de desaturació a les capes GOES/Himawari d'alta definició.

### 🔧 Infraestructura del repositori

- Llicència **MIT** afegida (el README ja l'esmentava però faltava el fitxer).
- **CI** nou a GitHub Actions: type-check, lint i tests (701 tests) en cada push i pull request.
- **Dependabot** activat (alertes de vulnerabilitats i actualitzacions de seguretat).
- Metadades del repositori completades (descripció, topics, `package.json`) i `.env.example` afegit.
- Resum en anglès afegit a l'inici del README.

---

## Canvis de la v3.9.9

### Novetats

* **Quan començarà o acabarà la pluja:** a partir de la projecció a curt termini del radar (nowcast, fins a ~55 minuts), l'app estima si la precipitació a la teva ubicació exacta està a punt de començar o d'acabar, independentment de la previsió del model per a aquesta hora.

### Correccions

* Marge de seguretat (timeout) al mostreig de tessel·les de radar, per evitar que una càrrega d'imatge penjada bloquegi indefinidament la nova estimació de temporització.

---

**Commits complets:** https://github.com/tonitapias/meteoai/compare/v3.29.0...main (des de la v3.29.0) · https://github.com/tonitapias/meteoai/compare/v3.28.0...v3.29.0 (des de la v3.28.0) · https://github.com/tonitapias/meteoai/compare/v3.26.0...v3.29.0 (des de la v3.26.0) · https://github.com/tonitapias/meteoai/compare/v3.9.9...v3.29.0 (des de la v3.9.9)
