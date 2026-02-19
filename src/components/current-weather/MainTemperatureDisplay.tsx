import { ArrowUp, ArrowDown } from 'lucide-react';

interface MainTemperatureDisplayProps {
  temp: number;
  max: number;
  min: number;
  weatherLabel: string;
  statusColor: string;
}

export const MainTemperatureDisplay = ({ temp, max, min, weatherLabel, statusColor }: MainTemperatureDisplayProps) => {
  return (
    <div className="mt-8 md:mt-12 flex flex-col md:flex-row items-baseline md:items-end gap-6">
        <div className="relative leading-none">
        <h1 className="text-[6rem] sm:text-[8rem] md:text-[10rem] font-mono font-medium text-white tracking-tighter tabular-nums drop-shadow-2xl z-10 relative">
            {temp}°
        </h1>
        <div className="absolute inset-0 text-[6rem] sm:text-[8rem] md:text-[10rem] font-mono font-medium text-indigo-500 blur-3xl opacity-20 select-none pointer-events-none tracking-tighter tabular-nums">
            {temp}°
        </div>
        </div>

        <div className="flex flex-col gap-4 pb-6 md:pb-10 min-w-[140px]">
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md w-fit">
            <span className={`w-2 h-2 rounded-full ${statusColor} transition-colors duration-500`}></span>
            <span className="text-xs font-black text-white uppercase tracking-wider">
                {weatherLabel}
            </span>
        </div>

        <div className="flex items-center gap-4 text-sm font-mono font-bold text-slate-400">
            <div className="flex items-center gap-1">
                <ArrowUp className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-white tabular-nums">{max}°</span>
            </div>
            <div className="w-px h-3 bg-white/10"></div>
            <div className="flex items-center gap-1">
                <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-white tabular-nums">{min}°</span>
            </div>
        </div>
        </div>
    </div>
  );
};