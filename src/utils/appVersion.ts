// src/utils/appVersion.ts
import pkg from '../../package.json';

// DOCTRINA RISC ZERO: Blindatge d'arxius externs (package.json pot ser ofuscat en producció)
// Font única de veritat per a la versió mostrada a la UI (Footer.tsx, WelcomeScreen.tsx).
// Si mai s'ha d'actualitzar el fallback, aquest és l'únic lloc a tocar.
export const APP_VERSION: string = pkg && pkg.version ? pkg.version : '3.8.4';