// src/constants/chartColors.ts

export interface ColorDefinition {
    color: string;
    gradientStart: string;
}

export const CHART_COLORS = {
    temp: { 
        color: '#818cf8',       // Indigo-400
        gradientStart: '#818cf8' 
    },
    rain: { 
        color: '#3b82f6',       // Blue-500
        gradientStart: '#3b82f6' 
    },
    precip: { 
        color: '#60a5fa',       // Blue-400
        gradientStart: '#2563eb' // Blue-600
    },
    wind: { 
        color: '#2dd4bf',       // Teal-400
        gradientStart: '#2dd4bf' 
    },
    cloud: { 
        color: '#94a3b8',       // Slate-400
        gradientStart: '#94a3b8' 
    },
    humidity: { 
        color: '#22d3ee',       // Cyan-400
        gradientStart: '#22d3ee' 
    },
    snowLevel: { 
        color: '#cbd5e1',       // Slate-300
        gradientStart: '#f1f5f9' // Slate-100
    },
    // Colors de referència per comparativa (ECMWF vs GFS vs ICON)
    models: {
        gfs: '#4ade80',        // Green-400
        icon: '#fbbf24'        // Amber-400
    }
} as const;