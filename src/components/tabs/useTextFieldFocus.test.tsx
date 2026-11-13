import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { isTextField, useTextFieldFocus } from './useTextFieldFocus';

const Probe = ({ enabled }: { enabled: boolean }) => {
    const typing = useTextFieldFocus(enabled);
    return (
        <div>
            <input aria-label="cerca" />
            <input aria-label="casella" type="checkbox" />
            <textarea aria-label="nota" />
            <button type="button">botó</button>
            <output data-testid="typing">{String(typing)}</output>
        </div>
    );
};

const typing = () => screen.getByTestId('typing').textContent;

describe('useTextFieldFocus → la barra s\'amaga mentre s\'escriu', () => {
    it('és cert amb el focus en un camp de text, també en passar d\'un a l\'altre; fals en sortir-ne', () => {
        render(<Probe enabled />);
        expect(typing()).toBe('false');
        act(() => screen.getByLabelText('cerca').focus());
        expect(typing()).toBe('true');
        act(() => screen.getByLabelText('nota').focus());
        expect(typing()).toBe('true');
        act(() => screen.getByRole('button', { name: 'botó' }).focus());
        expect(typing()).toBe('false');
        act(() => screen.getByLabelText('casella').focus());
        expect(typing()).toBe('false');
    });

    it('desactivat (barra a dalt, escriptori), sempre fals', () => {
        render(<Probe enabled={false} />);
        act(() => screen.getByLabelText('cerca').focus());
        expect(typing()).toBe('false');
    });

    it('què compta com a camp de text', () => {
        const make = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };
        expect(isTextField(make('<input>'))).toBe(true);
        expect(isTextField(make('<input type="search">'))).toBe(true);
        expect(isTextField(make('<input type="range">'))).toBe(false);
        expect(isTextField(make('<button>'))).toBe(false);
        expect(isTextField(null)).toBe(false);
    });
});
