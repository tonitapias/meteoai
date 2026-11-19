// src/utils/windDial.ts
// Geometria de la brúixola del vent (WindDial: el giny del Detall i WindModal) i el criteri de TOTES les fletxes del vent.
//
// La brúixola separa dues coses que abans anaven barrejades a l'anell:
//  - la DIRECCIÓ: l'agulla sobre l'anell, a l'angle d'on ve el vent, apuntant cap on va;
//  - la VELOCITAT i les RATXES: un arc de velocímetre a la part de baix, dins l'anell, que s'omple d'esquerra a dreta.
// Abans els arcs de velocitat i de ratxes es dibuixaven des del Nord en sentit horari i es llegien com una direcció: amb
// vent de SO, l'arc s'il·luminava entre el N i el NE.
//
// CRITERI DE LES FLETXES: "cap on va", com als mapes de vent. El nom ("SO") diu d'on ve; la fletxa segueix el flux.
// L'agulla de la brúixola s'hi posa al costat d'on ve i apunta cap al centre (també "cap on va"). Abans la mini-brúixola
// d'Ara girava la icona Navigation de lucide (que ja apunta al NE) sense compensar-ho i anava 45° desviada.

/** Velocitat al final de l'arc (km/h), la mateixa escala que tenia l'anell; per sobre, l'arc queda ple. */
export const WIND_DIAL_MAX_KMH = 120;

/**
 * L'arc del velocímetre, en graus de brúixola (0 = dalt, sentit horari): comença a baix a l'esquerra (235°) i acaba a
 * baix a la dreta (125°) passant pel Sud. Mai no passa per dalt: no es pot confondre amb una direcció.
 */
export const SPEED_ARC_START_DEG = 235;
export const SPEED_ARC_SWEEP_DEG = 110;

const fmt = (n: number) => Number(n.toFixed(2));

/** Punt (x, y) d'un cercle de radi r a l'angle de brúixola `deg` (y creix cap avall, com a l'SVG). */
export const dialPoint = (cx: number, cy: number, r: number, deg: number): { x: number; y: number } => {
    const rad = (deg * Math.PI) / 180;
    return { x: fmt(cx + r * Math.sin(rad)), y: fmt(cy - r * Math.cos(rad)) };
};

/** Fracció de l'arc (0-1) d'una velocitat. DOCTRINA RISC ZERO: sense dada, null (l'arc no es dibuixa). */
export const speedFraction = (kmh: number | null | undefined, max = WIND_DIAL_MAX_KMH): number | null =>
    typeof kmh === 'number' && Number.isFinite(kmh) && max > 0 ? Math.max(0, Math.min(1, kmh / max)) : null;

/** Camí SVG de l'arc del velocímetre fins a la fracció indicada, d'esquerra a dreta per baix. Buit si no hi ha res a pintar. */
export const speedArcPath = (fraction: number | null, cx: number, cy: number, r: number): string => {
    if (fraction === null || !(fraction > 0)) return '';
    const sweep = SPEED_ARC_SWEEP_DEG * Math.min(1, fraction);
    const start = dialPoint(cx, cy, r, SPEED_ARC_START_DEG);
    const end = dialPoint(cx, cy, r, SPEED_ARC_START_DEG - sweep);
    // sweep-flag 0: a la pantalla, d'esquerra a dreta per baix és el sentit contrari al de les agulles del rellotge.
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 0 ${end.x} ${end.y}`;
};

/**
 * Gir (graus, 0-359) que cal donar a una icona de fletxa perquè apunti cap on va un vent que ve de `fromDeg`.
 * `iconBaseDeg`: cap on apunta la icona sense girar (Navigation2 i ArrowUp de lucide, 0°, amunt; Navigation, 45°, al NE).
 */
export const windArrowRotation = (fromDeg: number, iconBaseDeg = 0): number =>
    (((fromDeg + 180 - iconBaseDeg) % 360) + 360) % 360;

/** La icona Navigation de lucide apunta al NE (45°) sense girar. */
export const NAVIGATION_ICON_BASE_DEG = 45;
