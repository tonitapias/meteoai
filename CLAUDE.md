# MeteoAI (MeteoToniAi)

PWA de previsió meteorològica: React 19 + TypeScript + Vite 6 + Tailwind 3, Mapbox GL per al radar,
models d'Open-Meteo (globals + 14 regionals HD seleccionats per ubicació) i text per IA via worker.
En producció a https://meteotoniai.com (Cloudflare); l'adreça antiga tonitapias.github.io/meteoai
encara es publica en paral·lel.

## Idioma i to

- Parla sempre en **català** amb l'usuari, també als resums i botons de final de torn.
- Missatges de commit en català, estil conventional: `fix(ara): …`, `feat(radar): …`, `docs(readme): …`,
  `chore(release): bump version to X.Y.Z`. L'àmbit és la pestanya o zona (ara, previsio, detall, cel,
  radar, avisos, deps…). La descripció explica l'efecte per a l'usuari, no el canvi de codi.
- Disseny: la interfície té una identitat pròpia. Arregla els problemes dins del seu llenguatge visual;
  no proposis restyles genèrics "d'estil IA".

## Ordres

```
npm run dev          # Vite a 5173 (launch.json: meteoai-dev; meteoai-preview a 4173)
npm run type-check   # tsc --noEmit
npm run lint         # eslint .
npm run build
TZ=UTC npx vitest run --testTimeout=60000 --exclude "**/*api-contract.test.ts"
```

- Executa els tests **amb `TZ=UTC`** abans de fer push: el CI corre en UTC, i un test que construeix
  "ara" sense zona horària hi pot fallar (ja ha bloquejat un desplegament).
- `--testTimeout=60000` perquè la màquina sovint va carregada. Amb una altra sessió executant
  vitest/vite, la suite pot trigar ~20 min i donar "Failed to start forks worker … Timeout": no són
  errors reals, torna a passar aquests fitxers amb `--maxWorkers=1`.
- `src/test/*api-contract.test.ts` consulten serveis externs (Open-Meteo, avisos, GIBS/CIRA...). El CI
  normal els exclou; només corren al workflow diari `api-health-check.yml`. Una fallada seva sol ser
  inestabilitat externa.
- El test de tancament de l'ascensor de WelcomeScreen és inestable sota càrrega (waitFor d'1 s).

## Desplegament i versions

- **Un push a `main` desplega a producció** (`deploy.yml`: type-check + lint + test + build + wrangler).
  No facis commit, push, merge ni desplegament sense que l'usuari ho demani explícitament.
- Correccions, infraestructura, refactors, dependències i analítica: **cap canvi de versió ni de README**.
- Només un canvi que l'usuari de l'app noti (funció nova o comportament diferent) porta:
  commit `feat`, commit `docs(readme)`, commit `chore(release): bump version to X.Y.Z` (package.json)
  i entrada a `CHANGELOG.md`. Si no és clar a quin grup pertany, pregunta.
- GitHub: només hi ha una release, la "Latest", amb les notes de la seva versió i un enllaç a
  `CHANGELOG.md`. Les releases antigues s'esborren, però les etiquetes es mantenen. Les etiquetes noves
  han de ser anotades. Abans d'editar una release, desa'n el cos (`gh release view --json body`).
- Dependabot: `npm update <paquets>` dins dels rangs actuals, commit només del lockfile
  (`fix(deps): …`), sense canvi de versió. Tailwind 4 descartat (navegadors antics).

## Convencions del codi

- Traduccions: 4 idiomes (`src/translations/{ca,es,en,fr}.ts`, diccionari `TRANSLATIONS[lang]`).
  Tota cadena nova va als quatre. L'idioma actiu és `usePreferences().lang`, **no** `i18n.language`.
- Un modal de detall llegeix el mateix valor "ara" que el giny des d'on s'obre (p. ex. `current.X`),
  no `hourly.X[currentIndex]`.
- El modal "Com funciona" (`HowItWorksModal.tsx`) cita xifres de models i fonts d'avisos: mantén-les
  sincronitzades quan canviïs aquest codi.
- Compatibilitat amb mòbils antics i de gamma baixa: res de `dvh` (fes servir `%`), ni `backdrop-blur`
  ni animacions infinites a les zones pesades.
- Navegació: pestanyes Ara · Previsió · Detall · Cel + Radar.

## Entorn (Windows)

- Els worktrees poden tenir `node_modules` com a **junction** cap a `C:\Dev\meteoai\node_modules`.
  Comprova-ho (`Get-Item … -Force`, LinkType) abans de fer `npm ci`/`npm update` dins d'un worktree, i
  elimina-la amb `cmd /c rmdir` abans d'esborrar el worktree. Vitest i eslint també poden recollir
  fitxers dels worktrees.
- Si una altra sessió ha canviat `package-lock.json`, cal `npm ci` (no n'hi ha prou amb `npm install`).
  Atura abans el servidor de preview: si té fitxers oberts, `npm ci` falla a mig camí.
- Per verificar amb el navegador mentre una altra sessió ocupa el 5173, afegeix temporalment una entrada
  a `.claude/launch.json` amb `--port 5176 --strictPort` i desfés-la després. Els errors CORS del worker
  en aquest port són esperables.
- Un service worker de la PWA que es queda d'abans pot servir codi vell: recarrega sense memòria cau
  abans de concloure res. No et fiïs dels errors de consola d'una pestanya reutilitzada.
- Els workers de l'API són en repositoris a part: `C:\Dev\Workers-Cloudflare\meteoai-proxy`
  (api.meteotoniai.com) i el proxy de satèl·lit (sat.meteotoniai.com). Només accepten `meteotoniai.com`
  com a Origin.
