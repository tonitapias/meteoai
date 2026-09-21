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

interface ChartDimensions {
    width: number;
    height: number;
    paddingX: number;
    paddingY: number;
}

export const calculateYDomain = (values: number[], layer: string): { min: number; max: number } => {
    if (values.length === 0) return { min: 0, max: 100 };

    let min = Math.min(...values);
    let max = Math.max(...values);

    if (layer === 'rain' || layer === 'humidity' || layer === 'cloud') {
        min = 0;
        max = 110; 
    } else if (layer === 'precip') {
        min = 0;
        // CANVI RADICAL: Marge doble (2.0) per absorbir pics de pluja sense tocar sostre.
        const actualMax = Math.max(max, 1); 
        max = actualMax * 2.0; 
    } else {
        const range = max - min || 1;
        min -= range * 0.1;
        max += range * 0.1;
    }

    return { min, max };
};

export const generateGraphPoints = (
    data: ChartDataPoint[],
    dims: ChartDimensions,
    domain: { min: number; max: number },
    dataKey: string
): GraphPoint[] => {
    const { width, height, paddingX, paddingY } = dims;
    const { min, max } = domain;
    const rng = max - min || 1;

    const calcY = (val: number | null) => {
        if (val === null) return height + 10;
        
        const rawY = height - paddingY - ((val - min) / rng) * (height - 2 * paddingY);
        // CLAMPING: Això és el que realment protegeix de sortir de la gràfica.
        // Assegura que cap punt estigui per sobre del marge superior (paddingY).
        return Math.max(paddingY, rawY); 
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
            x: paddingX + (i / (Math.max(data.length, 2) - 1)) * (width - 2 * paddingX),
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
