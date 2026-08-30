export const TempRangeBar = ({ min, max, globalMin, globalMax }: { min: number, max: number, globalMin: number, globalMax: number }) => {
    const totalRange = (globalMax - globalMin) || 1;

    // [FIX PRECISIÓ] Des del fix de getInversionCorrectedTemp a ForecastSection.tsx,
    // el `min` d'un dia concret pot quedar per sota de `globalMin` (la correcció
    // només pot restar graus, mai sumar-ne). Abans, `leftPercent` es clampava a 0
    // però `widthPercent` es calculava sobre min/max sense clampar, allargant la
    // barra cap a la dreta més del compte. Ara clampem la posició de min i de max
    // de forma independent, i l'amplada visible és la diferència entre totes dues
    // — mai inflada per la part retallada per l'esquerra.
    const rawLeftPercent = ((min - globalMin) / totalRange) * 100;
    const rawRightPercent = ((max - globalMin) / totalRange) * 100;

    const leftPercent = Math.max(0, Math.min(100, rawLeftPercent));
    const rightPercent = Math.max(0, Math.min(100, rawRightPercent));
    const widthPercent = Math.max(5, rightPercent - leftPercent);

    return (
        <div className="w-full h-2.5 bg-[#0f111a] rounded-full relative overflow-hidden border border-white/10 shadow-inner">
            <div className="absolute inset-0 opacity-20 bg-slate-800"></div>
            <div 
                className="absolute h-full rounded-full bg-gradient-to-r from-sky-400 via-yellow-400 to-rose-500 shadow-[0_0_10px_rgba(251,191,36,0.4)]"
                style={{ 
                    left: `${leftPercent}%`, 
                    width: `${widthPercent}%`,
                    transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            ></div>
        </div>
    );
};