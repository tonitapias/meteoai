// src/components/WeatherCharts.tsx
// SmartForecastCharts/SingleHourlyChart (Mode Expert) van ser extrets a
// SmartForecastCharts.tsx per poder-los carregar com a chunk lazy independent —
// vegeu el comentari a l'inici d'aquell fitxer per l'explicació.
import { CloudRain } from 'lucide-react';
import { MATRIX_BG } from './widgets/widgetStyles';

interface MinutelyPreciseChartProps {
    data: (number | null)[];
    label: string;
    currentPrecip?: number;
}

export const MinutelyPreciseChart = ({ data, label, currentPrecip: _currentPrecip = 0 }: MinutelyPreciseChartProps) => {
    const chartData = Array.isArray(data) ? [...data] : [];
    let processedData = chartData.map(v => v !== null && v !== undefined && !isNaN(v) ? v : 0);

    if(processedData.length === 0) return null;
    while(processedData.length < 4) processedData.push(0);
    processedData = processedData.slice(0, 4);

    if (processedData.every(v => v === 0)) return null;

    const max = Math.max(...processedData, 0.5);

    const getIntensityColor = (val: number): string => {
        if (val === 0) return 'bg-transparent';
        if (val < 2.0) return 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]';
        if (val < 7.0) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]';
        return 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]';
    };


    return (
        <div className="w-full mt-3 bg-[#0a0b10]/90 rounded-2xl p-4 border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-md animate-in fade-in relative transform-gpu overflow-hidden">
            <div className={MATRIX_BG}></div>
            <div className="flex items-center justify-between mb-3 relative z-10">
                <div className="flex items-center gap-2">
                    <CloudRain className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{label}</span>
                </div>
            </div>
            <div className="relative h-16 w-full pb-1 z-10">
                <div className="flex items-end gap-2.5 h-full w-full relative z-10">
                {processedData.map((val, i) => (
                    <div key={`minutely-${i}`} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                        {val > 0 ? (
                            <span className="text-[9px] font-black mb-0.5 text-white drop-shadow-md">{val.toFixed(1)}<span className="opacity-50 text-[8px] ml-0.5">mm</span></span>
                        ) : (
                            <span className="text-[9px] font-bold mb-0.5 text-slate-600 opacity-50">-</span>
                        )}
                        <div className="w-full bg-[#050608]/80 rounded-sm relative h-full max-h-[40px] overflow-hidden flex items-end border border-white/5 shadow-inner">
                            <div
                                className={`w-full rounded-[1px] transition-all duration-700 ease-out ${getIntensityColor(val)}`}
                                style={{ height: `${(val / max) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
                </div>
            </div>
        </div>
    );
};
