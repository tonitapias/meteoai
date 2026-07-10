import { Wind, Zap, Navigation2, AlertTriangle, CloudOff } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, getWindDirectionText } from './widgetHelpers';

// Funció helper matemàticament segura per dibuixar arcs SVG (Risc Zero: Protecció contra NaN i Infinity)
const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    if (isNaN(startAngle) || isNaN(endAngle) || Math.abs(startAngle - endAngle) < 0.1) return '';
    
    const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
      const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
      return { x: centerX + (radius * Math.cos(angleInRadians)), y: centerY + (radius * Math.sin(angleInRadians)) };
    };
    
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";
    
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

// Avaluació de risc ràpida (Escala Beaufort simplificada)
const getTacticalLabel = (speed: number, isValid: boolean, lang: string) => {
    if (!isValid) return lang === 'ca' ? 'SENSE DADES' : 'NO DATA';
    if (speed < 5) return lang === 'ca' ? 'CALMA' : 'CALM';
    if (speed < 20) return lang === 'ca' ? 'MODERAT' : 'MODERATE';
    if (speed < 40) return lang === 'ca' ? 'FORT' : 'STRONG';
    if (speed < 70) return lang === 'ca' ? 'VENTADA' : 'GALE';
    return lang === 'ca' ? 'TEMPORAL' : 'STORM';
};

export const CompassGauge = ({ degrees, speed, gusts, lang }: WidgetProps) => {
  const t = getTrans(lang) as Record<string, unknown>;

  // DOCTRINA RISC ZERO: Validació estricta d'integritat de dades abans de qualsevol càlcul de UI
  const isValidSpeed = typeof speed === 'number' && !isNaN(speed);
  const isValidDeg = typeof degrees === 'number' && !isNaN(degrees);
  const isValidGusts = typeof gusts === 'number' && !isNaN(gusts);

  const safeSpeed = isValidSpeed ? speed : 0;
  const safeDeg = isValidDeg ? degrees : 0;
  const safeGusts = isValidGusts ? gusts : 0;

  const directionText = isValidDeg ? getWindDirectionText(safeDeg) : '--';
  const displayDeg = isValidDeg ? Math.round(safeDeg) : '--';
  const displaySpeed = isValidSpeed ? Math.round(safeSpeed) : '--';
  const displayGusts = isValidGusts ? Math.round(safeGusts) : '--';

  // Escala tàctica i colors
  const gustThresholds = { warning: 50, danger: 80 };
  const isDanger = isValidGusts && safeGusts > gustThresholds.danger;
  const isWarning = isValidGusts && safeGusts > gustThresholds.warning && !isDanger;
  
  const gustColorText = isDanger ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-cyan-400';
  const gustGradientId = isDanger ? 'dangerGradient' : isWarning ? 'warningGradient' : 'safeGradient';
  
  const hasGusts = isValidGusts && isValidSpeed && (safeGusts > safeSpeed + 5); 
  
  // Càlculs per als arcs de l'anell (amb límit a 359.9 per evitar problemes de renderitzat SVG)
  const maxSpeedScale = 120; 
  const speedArcAngle = isValidSpeed ? Math.min(359.9, (safeSpeed / maxSpeedScale) * 360) : 0;
  const gustArcAngle = isValidGusts ? Math.min(359.9, (safeGusts / maxSpeedScale) * 360) : 0;
  
  const tacticalLabel = getTacticalLabel(safeSpeed, isValidSpeed, lang || 'ca');

  // SPATIAL UI BASE
  const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-[#0c0e15]/95 to-[#05060a]/95 border border-white/10 shadow-[0_16px_32px_rgba(0,0,0,0.6)] transform-gpu flex flex-col transition-colors duration-700`;
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

  return (
    <div className={SPATIAL_WIDGET_STYLE}>
      
      {/* Capes de fons espacials */}
      <div className={MATRIX_BG}></div>
      
      {/* Glow d'emergència si les ratxes són extremes */}
      {isDanger && isValidSpeed && (
          <div className="absolute inset-0 bg-rose-500/5 animate-pulse pointer-events-none z-0"></div>
      )}

      <div className="flex justify-between items-start w-full z-10 p-2">
          <div className={`${TITLE_STYLE.replace('mb-4', 'mb-0')} flex items-center gap-2`}>
              <div className={`p-1.5 rounded-lg border shadow-sm transition-colors duration-500 ${isValidSpeed ? 'bg-cyan-500/10 border-cyan-500/20 shadow-[0_0_12px_rgba(34,211,238,0.2)]' : 'bg-slate-800/50 border-slate-700/50'}`}>
                 {isValidSpeed ? <Wind className="w-4 h-4 text-cyan-400" /> : <CloudOff className="w-4 h-4 text-slate-500" />}
              </div>
              <span className="tracking-widest font-bold text-slate-200">{String(t.wind || "VENT")}</span>
          </div>
          <div className={`flex flex-col items-end px-3 py-1.5 rounded-lg border shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] transition-colors duration-500 ${isValidDeg ? 'bg-[#0a0c12] border-white/5' : 'bg-transparent border-transparent'}`}>
               <span className={`text-xs font-mono font-black tracking-wider ${isValidDeg ? 'text-slate-300' : 'text-slate-600'}`}>
                   {isValidDeg ? `${displayDeg}° ${directionText}` : '--°'}
               </span>
          </div>
      </div>
      
      {/* Contenidor central d'alta llegibilitat */}
      <div className="relative flex-1 flex flex-col items-center justify-center min-h-[220px] my-4 z-10">
        <div className="relative w-56 h-56 flex items-center justify-center">
             
             {/* Sistema d'anells SVG amb Gradients Tàctics */}
             <svg width="100%" height="100%" viewBox="0 0 200 200" className="absolute inset-0 drop-shadow-xl z-0">
                <defs>
                    <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                    <linearGradient id="warningGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                    <linearGradient id="dangerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f43f5e" />
                        <stop offset="100%" stopColor="#be123c" />
                    </linearGradient>
                    <linearGradient id="safeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                </defs>

                {/* Anell base fosc */}
                <circle cx="100" cy="100" r="80" fill="none" stroke="#131722" strokeWidth="16" />
                
                {/* Marques de brúixola (Ticks) */}
                {[...Array(36)].map((_, i) => {
                    const angle = i * 10;
                    const isCardinal = i % 9 === 0;
                    const innerRadius = isCardinal ? 68 : 72;
                    const outerRadius = 88;
                    const x1 = 100 + innerRadius * Math.cos((angle - 90) * Math.PI / 180);
                    const y1 = 100 + innerRadius * Math.sin((angle - 90) * Math.PI / 180);
                    const x2 = 100 + outerRadius * Math.cos((angle - 90) * Math.PI / 180);
                    const y2 = 100 + outerRadius * Math.sin((angle - 90) * Math.PI / 180);
                    // Si no hi ha dades, apaguem els ticks
                    const strokeColor = isValidSpeed ? (isCardinal ? "#334155" : "#1e293b") : "#1e293b";
                    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={strokeColor} strokeWidth={isCardinal ? "2" : "1"} opacity={isValidSpeed ? "0.6" : "0.2"} />;
                })}

                {/* Arc de Ratxes (Capa inferior, més ample, transparent amb gradient) */}
                {isValidGusts && hasGusts && safeGusts > 0 && (
                   <path 
                      d={describeArc(100, 100, 80, 0, gustArcAngle)} 
                      fill="none" 
                      stroke={`url(#${gustGradientId})`}
                      strokeWidth="16" 
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out opacity-30"
                   />
                )}

                {/* Arc de Velocitat Sostinguda (Capa superior, gradient lluminós) */}
                {isValidSpeed && safeSpeed > 0 && (
                   <path 
                      d={describeArc(100, 100, 80, 0, speedArcAngle)} 
                      fill="none" 
                      stroke="url(#speedGradient)" 
                      strokeWidth="16" 
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                   />
                )}
             </svg>

             {/* Fletxa de Direcció Orbital */}
             <div className="absolute w-full h-full flex items-start justify-center transition-transform duration-1000 ease-out pointer-events-none z-20" style={{ transform: `rotate(${safeDeg}deg)` }}>
                <div className={`mt-[-8px] rounded-full p-1.5 border shadow-[0_4px_12px_rgba(0,0,0,0.8)] transition-colors duration-500 ${isValidDeg ? 'bg-[#0c0e15] border-slate-700' : 'bg-transparent border-transparent shadow-none'}`}>
                    <Navigation2 
                        className={`w-5 h-5 transition-all duration-500 ${isValidDeg ? 'text-cyan-400 fill-cyan-400/20 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] opacity-100' : 'text-slate-700 opacity-20'}`} 
                        style={{ transform: 'rotate(180deg)' }} 
                    />
                </div>
             </div>

             {/* Punts Cardinals Textuals (Estilitzats) */}
             <span className={`absolute top-5 left-1/2 -translate-x-1/2 text-[11px] font-black px-1 rounded transition-colors duration-500 ${isValidDeg ? 'text-slate-400 bg-[#0c0e15]' : 'text-slate-700 bg-transparent'}`}>N</span>
             <span className={`absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] font-black px-1 rounded transition-colors duration-500 ${isValidDeg ? 'text-slate-400 bg-[#0c0e15]' : 'text-slate-700 bg-transparent'}`}>S</span>
             <span className={`absolute left-5 top-1/2 -translate-y-1/2 text-[11px] font-black py-1 rounded transition-colors duration-500 ${isValidDeg ? 'text-slate-400 bg-[#0c0e15]' : 'text-slate-700 bg-transparent'}`}>W</span>
             <span className={`absolute right-5 top-1/2 -translate-y-1/2 text-[11px] font-black py-1 rounded transition-colors duration-500 ${isValidDeg ? 'text-slate-400 bg-[#0c0e15]' : 'text-slate-700 bg-transparent'}`}>E</span>

             {/* Nucli de dades: Alta llegibilitat */}
             <div className="absolute flex flex-col items-center justify-center z-30 w-40 h-40 rounded-full mt-2">
                
                {/* Etiqueta Tàctica (Beaufort o Error) */}
                <span className={`text-[9px] font-bold uppercase tracking-widest mb-1 px-2 py-0.5 rounded-full border backdrop-blur-sm transition-colors duration-500 ${isValidSpeed ? 'text-slate-400 bg-white/5 border-white/5' : 'text-slate-500 bg-black/40 border-slate-700/50'}`}>
                    {tacticalLabel}
                </span>

                {/* Velocitat Sostinguda (Massiva) */}
                <div className="flex flex-col items-center justify-center">
                    <span className={`text-6xl font-mono font-black tabular-nums tracking-tighter leading-none drop-shadow-2xl transition-colors duration-500 ${isValidSpeed ? 'text-white' : 'text-slate-600'}`}>
                        {displaySpeed}
                    </span>
                    <span className={`text-[11px] font-bold uppercase tracking-widest mt-1 drop-shadow-md transition-colors duration-500 ${isValidSpeed ? 'text-cyan-400 opacity-90' : 'text-slate-600'}`}>
                        km/h
                    </span>
                </div>

                {/* Ratxes (Text clar amb iconografia d'alerta si cal, ocult si no hi ha dades) */}
                {isValidGusts && hasGusts && (
                    <div className={`mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 border border-white/10 shadow-inner ${gustColorText} backdrop-blur-sm`}>
                        {isDanger ? <AlertTriangle className="w-3.5 h-3.5 fill-current" /> : <Zap className="w-3.5 h-3.5 fill-current" />}
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            {lang === 'ca' ? 'Ratxes' : 'Gusts'}:
                        </span>
                        <span className="text-sm font-mono font-black tabular-nums">
                            {displayGusts}
                        </span>
                    </div>
                )}
             </div>
        </div>
      </div>
    </div>
  );
};