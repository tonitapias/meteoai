import { ArrowUp, ArrowDown } from 'lucide-react';

interface MainTemperatureDisplayProps {
  temp: number | null;
  max: number | null;
  min: number | null;
  weatherLabel: string;
  statusColor: string;
}

export const MainTemperatureDisplay = ({ temp, max, min, weatherLabel, statusColor }: MainTemperatureDisplayProps) => {
  // DOCTRINA RISC ZERO: Validació estricta numèrica per separar 0°C (Glaçada) de null (Sense Dades)
  const isValidTemp = typeof temp === 'number' && !isNaN(temp);
  const isValidMax = typeof max === 'number' && !isNaN(max);
  const isValidMin = typeof min === 'number' && !isNaN(min);

  // Escut de renderitzat amb arrodoniment per evitar decimals llargs de l'API
  const formatTemp = (val: number | null, isValid: boolean) => {
    return isValid && val !== null ? Math.round(val) : '--';
  };

  return (
    <div className="mt-8 md:mt-12 flex flex-col md:flex-row items-baseline md:items-end gap-6 relative z-10">
        
        {/* TEMPERATURA PRINCIPAL */}
        <div className="relative leading-none">
            <h1 className={`text-[6rem] sm:text-[8rem] md:text-[10rem] font-mono font-medium tracking-tighter tabular-nums drop-shadow-2xl z-10 relative transition-colors duration-700 ${isValidTemp ? 'text-white' : 'text-slate-600'}`}>
                {formatTemp(temp, isValidTemp)}°
            </h1>
            
            {/* SPATIAL UI: Aura atmosfèrica de la temperatura (S'apaga si perdem senyal) */}
            <div className={`absolute inset-0 text-[6rem] sm:text-[8rem] md:text-[10rem] font-mono font-medium blur-[40px] opacity-20 select-none pointer-events-none tracking-tighter tabular-nums transition-colors duration-1000 ${isValidTemp ? 'text-indigo-400' : 'text-transparent'}`}>
                {formatTemp(temp, isValidTemp)}°
            </div>
        </div>

        {/* MÈTRIQUES I ESTAT */}
        <div className="flex flex-col gap-4 pb-6 md:pb-10 min-w-[140px] z-10 relative">
            
            {/* Càpsula d'Estat Meteorològic (Spatial UI) */}
            <div className={`flex items-center gap-3 px-3 py-1.5 rounded-full border backdrop-blur-md w-fit shadow-[inset_0_1px_4px_rgba(255,255,255,0.1)] transition-colors duration-500 ${isValidTemp ? 'bg-black/40 border-white/10' : 'bg-slate-900/50 border-slate-700/50'}`}>
                <span className={`w-2 h-2 rounded-full transition-colors duration-500 ${isValidTemp ? statusColor : 'bg-slate-600'}`}></span>
                <span className={`text-xs font-black uppercase tracking-wider transition-colors duration-500 ${isValidTemp ? 'text-white' : 'text-slate-500'}`}>
                    {weatherLabel}
                </span>
            </div>

            {/* Màximes i Mínimes */}
            <div className="flex items-center gap-4 text-sm font-mono font-bold">
                <div className="flex items-center gap-1">
                    <ArrowUp className={`w-3.5 h-3.5 transition-colors duration-500 ${isValidMax ? 'text-rose-400' : 'text-slate-600'}`} />
                    <span className={`tabular-nums transition-colors duration-500 ${isValidMax ? 'text-white' : 'text-slate-500'}`}>
                        {formatTemp(max, isValidMax)}°
                    </span>
                </div>
                
                {/* Divisor òptic */}
                <div className={`w-px h-3 transition-colors duration-500 ${isValidMax || isValidMin ? 'bg-white/10' : 'bg-slate-700/50'}`}></div>
                
                <div className="flex items-center gap-1">
                    <ArrowDown className={`w-3.5 h-3.5 transition-colors duration-500 ${isValidMin ? 'text-cyan-400' : 'text-slate-600'}`} />
                    <span className={`tabular-nums transition-colors duration-500 ${isValidMin ? 'text-white' : 'text-slate-500'}`}>
                        {formatTemp(min, isValidMin)}°
                    </span>
                </div>
            </div>
        </div>
    </div>
  );
};