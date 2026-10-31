// src/components/planet/CycloneIcon.tsx
// En un fitxer propi perquè el xip de la Vista essencial la fa servir sense carregar res més de la secció.

/** Icona de cicló (no n'hi ha a lucide): l'ull i dos braços d'espiral. */
export const CycloneIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={className}>
        <circle cx="12" cy="12" r="2.5" />
        <path d="M5 9a8 8 0 0 1 12-4M19 15a8 8 0 0 1-12 4" />
    </svg>
);
