export const TempRangeBar = ({ min, max, globalMin, globalMax }: { min: number, max: number, globalMin: number, globalMax: number }) => {
    const totalRange = (globalMax - globalMin) || 1;
    const leftPercent = ((min - globalMin) / totalRange) * 100;
    const widthPercent = ((max - min) / totalRange) * 100;

    return (
        <div className="w-full h-2.5 bg-[#0f111a] rounded-full relative overflow-hidden border border-white/10 shadow-inner">
            <div className="absolute inset-0 opacity-20 bg-slate-800"></div>
            <div 
                className="absolute h-full rounded-full bg-gradient-to-r from-sky-400 via-yellow-400 to-rose-500 shadow-[0_0_10px_rgba(251,191,36,0.4)]"
                style={{ 
                    left: `${Math.max(0, Math.min(100, leftPercent))}%`, 
                    width: `${Math.max(5, Math.min(100, widthPercent))}%`,
                    transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            ></div>
        </div>
    );
};