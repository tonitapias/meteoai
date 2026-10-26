// src/hooks/useI18nLanguageSync.ts
// i18next (radar, mapa del vent i avís d'actualització) segueix l'idioma triat a l'app: usePreferences().lang és la font de
// veritat, i18next només en fa de mirall. Abans s'hi posava en muntar-se els modals del tauler: a la benvinguda, l'avís
// d'actualització sortia en l'idioma del navegador encara que l'usuari n'hagués triat un altre.
import { useEffect } from 'react';
import i18n from '../i18n';
import type { Language } from '../translations';

export function useI18nLanguageSync(lang: Language): void {
  useEffect(() => {
    if (i18n.language !== lang) void i18n.changeLanguage(lang);
  }, [lang]);
}
