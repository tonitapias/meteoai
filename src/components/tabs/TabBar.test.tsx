import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TabBar from './TabBar';
import { TRANSLATIONS } from '../../translations';
import type { DashboardTab } from './dashboardTabs';

const renderBar = (active: DashboardTab = 'now', mounted: DashboardTab[] = ['now'], lang: keyof typeof TRANSLATIONS = 'ca') => {
    const onSelect = vi.fn();
    const onRadar = vi.fn();
    render(<TabBar active={active} mounted={new Set(mounted)} onSelect={onSelect} onRadar={onRadar} strings={TRANSLATIONS[lang].tabs} />);
    return { onSelect, onRadar };
};

describe('TabBar → patró de pestanyes d\'ARIA', () => {
    it('un tablist amb nom i quatre pestanyes, en ordre; la seleccionada és l\'única del Tab', () => {
        renderBar('forecast', ['now', 'forecast']);
        const list = screen.getByRole('tablist', { name: 'Seccions del temps' });
        const tabs = within(list).getAllByRole('tab');
        expect(tabs.map((tab) => tab.textContent)).toEqual(['Ara', 'Previsió', 'Detall', 'Cel']);
        expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false', 'false']);
        expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1, -1]);
    });

    it('aria-controls només apunta a panells que existeixen', () => {
        renderBar('now', ['now', 'sky']);
        const [now, forecast, detail, sky] = screen.getAllByRole('tab');
        expect(now.getAttribute('aria-controls')).toBe('dashboard-panel-now');
        expect(sky.getAttribute('aria-controls')).toBe('dashboard-panel-sky');
        expect(forecast.hasAttribute('aria-controls')).toBe(false);
        expect(detail.hasAttribute('aria-controls')).toBe(false);
    });

    it('fletxes (amb volta), Inici i Fi activen la pestanya i hi porten el focus', () => {
        const { onSelect } = renderBar('now');
        const tabs = screen.getAllByRole('tab');
        fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
        expect(onSelect).toHaveBeenLastCalledWith('forecast');
        expect(document.activeElement).toBe(tabs[1]);
        fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
        expect(onSelect).toHaveBeenLastCalledWith('sky');
        expect(document.activeElement).toBe(tabs[3]);
        fireEvent.keyDown(tabs[3], { key: 'ArrowRight' });
        expect(onSelect).toHaveBeenLastCalledWith('now');
        fireEvent.keyDown(tabs[1], { key: 'End' });
        expect(onSelect).toHaveBeenLastCalledWith('sky');
        fireEvent.keyDown(tabs[2], { key: 'Home' });
        expect(onSelect).toHaveBeenLastCalledWith('now');
        onSelect.mockClear();
        fireEvent.keyDown(tabs[0], { key: 'Enter' });
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('el clic activa la pestanya', () => {
        const { onSelect } = renderBar('now');
        fireEvent.click(screen.getByRole('tab', { name: 'Detall' }));
        expect(onSelect).toHaveBeenCalledWith('detail');
    });

    it('el Radar és un botó fora del tablist que obre el radar', () => {
        const { onRadar, onSelect } = renderBar('now');
        const radar = screen.getByRole('button', { name: 'Obre el radar' });
        expect(screen.getByRole('tablist').contains(radar)).toBe(false);
        fireEvent.click(radar);
        expect(onRadar).toHaveBeenCalledTimes(1);
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('a baix (mòbil) va a <body>, fixa; a dalt (escriptori) es queda al seu lloc, enganxada', () => {
        const props = { active: 'now' as const, mounted: new Set<DashboardTab>(['now']), onSelect: () => {}, onRadar: () => {}, strings: TRANSLATIONS.ca.tabs };
        const bottom = render(<div data-testid="host-bottom"><TabBar {...props} /></div>);
        const bottomBar = screen.getByRole('tablist').parentElement!.parentElement!;
        expect(screen.getByTestId('host-bottom').contains(bottomBar)).toBe(false);
        expect(bottomBar.className).toContain('fixed');
        bottom.unmount();

        render(<div data-testid="host-top"><TabBar {...props} placement="top" /></div>);
        const topBar = screen.getByRole('tablist').parentElement!.parentElement!;
        expect(screen.getByTestId('host-top').contains(topBar)).toBe(true);
        expect(topBar.className).toContain('sticky');
        // El mateix patró: les quatre pestanyes i el Radar fora del tablist.
        expect(screen.getAllByRole('tab')).toHaveLength(4);
        expect(screen.getByRole('tablist').contains(screen.getByRole('button', { name: 'Obre el radar' }))).toBe(false);
    });

    it('els noms als quatre idiomes', () => {
        const names = (lang: keyof typeof TRANSLATIONS) => {
            const { unmount } = render(
                <TabBar active="now" mounted={new Set(['now'])} onSelect={() => {}} onRadar={() => {}} strings={TRANSLATIONS[lang].tabs} />
            );
            const text = screen.getAllByRole('tab').map((tab) => tab.textContent);
            unmount();
            return text;
        };
        expect(names('es')).toEqual(['Ahora', 'Previsión', 'Detalle', 'Cielo']);
        expect(names('en')).toEqual(['Now', 'Forecast', 'Details', 'Sky']);
        expect(names('fr')).toEqual(['Actuel', 'Prévisions', 'Détails', 'Ciel']);
    });
});
