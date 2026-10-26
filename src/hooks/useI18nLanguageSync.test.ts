// src/hooks/useI18nLanguageSync.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import i18n from '../i18n';
import { useI18nLanguageSync } from './useI18nLanguageSync';
import type { Language } from '../translations';

describe('useI18nLanguageSync', () => {
    afterEach(async () => { await i18n.changeLanguage('ca'); });

    it("i18next (avís d'actualització, radar) pren l'idioma triat a l'app, i el segueix quan canvia", async () => {
        await i18n.changeLanguage('en'); // p. ex. el que ha detectat del navegador
        const { rerender } = renderHook(({ lang }: { lang: Language }) => useI18nLanguageSync(lang), { initialProps: { lang: 'ca' as Language } });
        await waitFor(() => expect(i18n.language).toBe('ca'));
        expect(i18n.t('updateAction')).toBe(i18n.getResource('ca', 'translation', 'updateAction'));

        rerender({ lang: 'fr' });
        await waitFor(() => expect(i18n.language).toBe('fr'));
    });
});
