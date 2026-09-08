// src/components/AstroStatCard.tsx
// Targeta d'estadística compartida pels modals "planetaris" (Solar, Lunar).
interface AstroStatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  valueClassName?: string;
  trendIcon?: React.ReactNode;
}

export const StatCard = ({ label, value, sub, icon, valueClassName, trendIcon }: AstroStatCardProps) => (
  <div className="rounded-xl border border-white/5 bg-black/30 backdrop-blur-md p-3 flex flex-col gap-1">
    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
      {icon}{label}
    </span>
    <span className={`text-lg font-black tabular-nums leading-none flex items-center gap-1.5 ${valueClassName || 'text-white'}`}>
      {value}{trendIcon}
    </span>
    {sub && <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">{sub}</span>}
  </div>
);
