import { Wind, Droplets, Activity, LucideIcon } from 'lucide-react';

interface StatProps {
  icon: LucideIcon;
  value: number | string;
  unit: string;
  label: string;
}

interface WeatherStatsGridProps {
  windSpeed: number | string;    // Solució: Pot rebre valors fallback com '--'
  humidity: number | string;     // Solució: Pot rebre valors fallback com '--'
  apparentTemp: number | string; // Solució: Pot rebre valors fallback com '--'
}

export const WeatherStatsGrid = ({ windSpeed, humidity, apparentTemp }: WeatherStatsGridProps) => {
  const stats: StatProps[] = [
    { icon: Wind, value: windSpeed, unit: 'km/h', label: 'VENT' },
    { icon: Droplets, value: humidity, unit: '%', label: 'HUMITAT' },
    { icon: Activity, value: apparentTemp, unit: '°', label: 'SENSACIÓ' }
  ];

  return (
    <div className="grid grid-cols-3 gap-2 relative z-10">
      {stats.map((s, idx) => (
        <div key={idx} className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#151725] border border-white/5 hover:border-white/10 transition-colors group">
            <s.icon className="w-4 h-4 text-slate-500 mb-1 group-hover:text-indigo-400 transition-colors" />
            <span className="text-lg font-mono font-bold text-white tabular-nums tracking-tight">
                {s.value}<span className="text-[9px] text-slate-500 ml-0.5">{s.unit}</span>
            </span>
            <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest">{s.label}</span>
        </div>
      ))}
    </div>
  );
};