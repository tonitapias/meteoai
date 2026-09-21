// src/utils/chartUtils.ts

export interface ChartDataPoint extends Record<string, unknown> {
    time: string;
    [key: string]: unknown;
}

export interface GraphPoint {
    x: number;
    y: number;
    value: number | null;
    time: string;
}

export interface ChartDimensions {
    width: number;
    height: number;
    paddingX: number;
    paddingY: number;
    /** Marges pròpies: si hi són manen sobre paddingX/paddingY (l'eix Y necessita més marge a l'esquerra). */
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
}

/** Domini de l'eix Y i les marques (valors) on dibuixar les línies de quadrícula. */
export interface ChartAxis {
    min: number;
    max: number;
    ticks: number[];
}

const resolvePadding = (dims: ChartDimensions) => ({
    left: dims.paddingLeft ?? dims.paddingX,
    right: dims.paddingRight ?? dims.paddingX,
    top: dims.paddingTop ?? dims.paddingY,
    bottom: dims.paddingBottom ?? dims.paddingY
});

/** X d'una posició de la sèrie (0 = primera hora), repartides per l'àrea útil del gràfic. */
export const indexToX = (index: number, count: number, dims: ChartDimensions): number => {
    const { left, right } = resolvePadding(dims);
    return left + (index / (Math.max(count, 2) - 1)) * (dims.width - left - right);
};

/** Posició de la sèrie més propera a una X (píxels dins el gràfic), dins de [0, count − 1]. */
export const xToIndex = (x: number, count: number, dims: ChartDimensions): number => {
    const { left, right } = resolvePadding(dims);
    const span = dims.width - left - right;
    if (span <= 0 || count <= 1) return 0;
    const i = Math.round(((x - left) / span) * (Math.max(count, 2) - 1));
    return Math.max(0, Math.min(count - 1, i));
};

/** Y d'un valor dins el domini, SENSE retallar (la retallada és cosa de generateGraphPoints). */
export const valueToY = (value: number, dims: ChartDimensions, domain: { min: number; max: number }): number => {
    const { top, bottom } = resolvePadding(dims);
    const rng = domain.max - domain.min || 1;
    return dims.height - bottom - ((value - domain.min) / rng) * (dims.height - top - bottom);
};

export interface NiceTicksOptions {
    /** Nombre de trams que es vol aproximadament (per defecte 4). */
    target?: number;
    /** Multiplicadors "rodons" del pas dins d'una dècada (per defecte 1, 2, 5, 10). */
    steps?: readonly number[];
}

/**
 * Domini i marques amb valors "rodons" (12, 16, 20, 24, 28) que contenen tots els valors. Un rang sense
 * amplada (tots els valors iguals) s'obre una mica perquè hi hagi eix.
 */
export const calculateNiceTicks = (min: number, max: number, options: NiceTicksOptions = {}): ChartAxis => {
    const target = options.target ?? 4;
    const steps = options.steps ?? [1, 2, 5, 10];

    let lo = min;
    let hi = max;
    if (hi - lo <= 0) {
        const pad = Math.max(Math.abs(lo) * 0.05, 1);
        lo -= pad;
        hi += pad;
    }

    const rawStep = (hi - lo) / target;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const step = (steps.find(s => s * magnitude >= rawStep * (1 - 1e-9)) ?? 10) * magnitude;

    const first = Math.floor(lo / step + 1e-9) * step;
    const last = Math.ceil(hi / step - 1e-9) * step;
    const ticks: number[] = [];
    for (let v = first; v <= last + step * 1e-6; v += step) ticks.push(Number(v.toFixed(6)));

    return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
};

/**
 * Eix Y de cada capa. La probabilitat (i humitat/núvols) és sempre 0–100; el volum de pluja, el vent i la
 * cota parteixen de zero o d'un rang mínim perquè un plugim de 0,1 mm o una calma de 3 km/h no omplin
 * el gràfic; la resta (temperatura, cota de neu) s'ajusta als valors.
 */
export const calculateAxis = (values: number[], layer: string): ChartAxis => {
    if (layer === 'rain' || layer === 'humidity' || layer === 'cloud') {
        return { min: 0, max: 100, ticks: [0, 50, 100] };
    }

    const finite = values.filter(v => Number.isFinite(v));
    if (finite.length === 0) return { min: 0, max: 10, ticks: [0, 5, 10] };

    const lo = Math.min(...finite);
    const hi = Math.max(...finite);

    if (layer === 'precip') return calculateNiceTicks(0, Math.max(hi, 1));
    if (layer === 'wind') return calculateNiceTicks(0, Math.max(hi, 10));
    if (layer === 'snowLevel') return calculateNiceTicks(lo, hi);
    return calculateNiceTicks(lo, hi, { steps: [1, 2, 4, 5, 10] });
};

export const generateGraphPoints = (
    data: ChartDataPoint[],
    dims: ChartDimensions,
    domain: { min: number; max: number },
    dataKey: string
): GraphPoint[] => {
    const { height } = dims;
    const { top } = resolvePadding(dims);

    const calcY = (val: number | null) => {
        if (val === null) return height + 10;

        // CLAMPING: Això és el que realment protegeix de sortir de la gràfica.
        // Assegura que cap punt estigui per sobre del marge superior.
        return Math.max(top, valueToY(val, dims, domain));
    };

    return data.map((d, i) => {
        let val: number | null = null;
        
        if (d[dataKey] !== undefined && d[dataKey] !== null) {
            val = Number(d[dataKey]);
        } else if (dataKey === 'rain' && (d.pop ?? d.precipitation_probability) != null) {
            val = Number(d.pop ?? d.precipitation_probability);
        } else if (dataKey === 'precip' && (d.precipitation ?? d.qpf) != null) {
            val = Number(d.precipitation ?? d.qpf);
        } else if (dataKey === 'wind' && d.wind_speed_10m != null) {
            val = Number(d.wind_speed_10m);
        } else if (dataKey === 'humidity' && d.relative_humidity_2m != null) {
            val = Number(d.relative_humidity_2m);
        }

        return {
            x: indexToX(i, data.length, dims),
            y: calcY(val),
            value: val,
            time: d.time
        };
    });
};

export const generateSmoothPath = (pts: GraphPoint[], heightLimit: number): string => {
    // DOCTRINA RISC ZERO: una hora sense dada (value null) TALLA el traç. Abans es filtrava i la corba
    // unia els dos punts veïns, dibuixant una previsió que cap model havia donat per a aquelles hores.
    let d = '';
    let prev: GraphPoint | null = null;
    let segments = 0;

    for (const p of pts) {
        if (p.value === null || p.y > heightLimit + 50) {
            prev = null;
            continue;
        }
        if (prev === null) {
            d += `${d ? ' ' : ''}M ${p.x},${p.y}`;
        } else {
            // CORRECCIÓ LINT: sense variable 'cy'. La corba té tangents horitzontals sobre punts ja 'clampats'.
            const cx = (prev.x + p.x) / 2;
            d += ` C ${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
            segments++;
        }
        prev = p;
    }
    // Sense cap tram (0 o 1 punts vàlids aïllats) no hi ha res a dibuixar.
    return segments === 0 ? "" : d;
};
/** Un tram de la banda de models: la Y de la línia més alta (`top`) i de la més baixa (`bottom`) a una x. */
export interface BandPoint {
    x: number;
    top: number;
    bottom: number;
}

/**
 * Àrea entre el model més alt i el més baix de cada hora (la "banda de models"), amb la mateixa corba
 * suau que generateSmoothPath perquè quedi ajustada a les línies. Una hora sense banda (null: menys de
 * dos models amb dada) TALLA l'àrea, com un forat talla una línia; un tram d'un sol punt no té àrea.
 */
export const generateBandPath = (band: ReadonlyArray<BandPoint | null>): string => {
    const runs: BandPoint[][] = [];
    let current: BandPoint[] = [];
    for (const p of band) {
        if (p === null) {
            if (current.length > 0) runs.push(current);
            current = [];
        } else {
            current.push(p);
        }
    }
    if (current.length > 0) runs.push(current);

    return runs
        .filter(run => run.length >= 2)
        .map(run => {
            let d = `M ${run[0].x},${run[0].top}`;
            for (let i = 0; i < run.length - 1; i++) {
                const cx = (run[i].x + run[i + 1].x) / 2;
                d += ` C ${cx},${run[i].top} ${cx},${run[i + 1].top} ${run[i + 1].x},${run[i + 1].top}`;
            }
            const last = run[run.length - 1];
            d += ` L ${last.x},${last.bottom}`;
            for (let i = run.length - 1; i > 0; i--) {
                const cx = (run[i].x + run[i - 1].x) / 2;
                d += ` C ${cx},${run[i].bottom} ${cx},${run[i - 1].bottom} ${run[i - 1].x},${run[i - 1].bottom}`;
            }
            return `${d} Z`;
        })
        .join(' ');
};
