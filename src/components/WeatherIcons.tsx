// src/components/WeatherIcons.tsx
import React, { useState, useEffect, memo } from 'react';
import { 
  Sun, Moon, CloudLightning, CloudRain, CloudSun, CloudMoon, 
  Cloud, CloudFog, Snowflake, CloudSnow 
} from 'lucide-react';

interface CommonIconProps extends React.HTMLAttributes<HTMLDivElement> {
  isDay?: number | boolean;
  className?: string;
}

interface Particle {
  id: number;
  left: number;
  delay: number;
  duration: number;
  opacity: number;
}

// DOCTRINA RISC ZERO: Funció d'avaluació estricta per evitar falsos positius amb el 0
const checkIsDaylight = (isDay?: number | boolean) => isDay === 1 || isDay === true;

// DOCTRINA RISC ZERO: Sincronització de Telemetria (Evita Falsos Positius/Negatius per desajust del model)
const applyTelemetrySync = (code: number, precipAmt: number = 0): number => {
  let syncedCode = code;

  if (precipAmt > 0) {
    // Fals Negatiu (Tempesta Oculta): El model diu sol/núvol/boira però hi ha precipitació real
    if (syncedCode <= 48) {
      if (precipAmt <= 2) syncedCode = 61;       // Pluja feble
      else if (precipAmt <= 10) syncedCode = 63; // Pluja moderada
      else syncedCode = 65;                      // Pluja forta (ex: 19mm forçat a tempesta)
    }
  } else if (precipAmt === 0) {
    // Fals Positiu (Gota Freda visual): El model marca pluja/neu però la precipitació real és 0mm
    const isPrecipCode = 
      (syncedCode >= 51 && syncedCode <= 67) || 
      (syncedCode >= 71 && syncedCode <= 77) || 
      (syncedCode >= 80 && syncedCode <= 86) || 
      syncedCode === 95;
      
    if (isPrecipCode) {
      syncedCode = 3; // Rebaixem la icona a Ennuvolat pur per no generar alarma visual
    }
  }

  return syncedCode;
};

// DOCTRINA RISC ZERO: Bloqueig Tèrmic (Thermal Lock) per imperatius físics
const applyThermalLock = (code: number, temp?: number | null): number => {
  if (typeof temp !== 'number' || temp <= 0) return code;
  
  let safeCode = code;
  // Si estem a +0ºC, qualsevol formació de gel/neu és un error del model i la rebaixem a aigua
  if (safeCode === 48) safeCode = 45; // Boira gebradora -> Boira
  if (safeCode === 56) safeCode = 51; // Plugim gebrador -> Plugim
  if (safeCode === 57) safeCode = 53; // Plugim gebrador fort -> Plugim fort
  if (safeCode === 66) safeCode = 61; // Pluja gebradora -> Pluja
  if (safeCode === 67) safeCode = 63; // Pluja gebradora forta -> Pluja forta
  if (safeCode >= 71 && safeCode <= 77) safeCode = 63; // Neu -> Pluja moderada
  if (safeCode === 85 || safeCode === 86) safeCode = 81; // Xàfecs de neu -> Xàfecs de pluja
  
  return safeCode;
};

const VariableWeatherIcon = ({ isDay, className, ...props }: CommonIconProps) => {
  const isDaylight = checkIsDaylight(isDay);
  
  return (
    <div className={`${className} relative flex items-center justify-center transform-gpu`} {...props}>
      <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] z-0">
         {isDaylight ? (
           <Sun className="w-full h-full text-amber-400 fill-amber-400/30 animate-[pulse_4s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]" strokeWidth={2} />
         ) : (
           <Moon className="w-full h-full text-slate-300 fill-slate-300/30 drop-shadow-[0_0_15px_rgba(203,213,225,0.4)]" strokeWidth={2} />
         )}
      </div>
      <CloudLightning className="w-full h-full text-fuchsia-400 fill-fuchsia-400/20 animate-pulse relative z-10 drop-shadow-[0_0_15px_rgba(192,38,211,0.8)]" strokeWidth={2} />
    </div>
  );
};

const VariableRainIcon = ({ isDay, className, ...props }: CommonIconProps) => {
  const isDaylight = checkIsDaylight(isDay);

  return (
    <div className={`${className} relative flex items-center justify-center transform-gpu`} {...props}>
      <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] z-0">
         {isDaylight ? (
           <Sun className="w-full h-full text-amber-400 fill-amber-400/30 animate-[pulse_4s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" strokeWidth={2} />
         ) : (
           <Moon className="w-full h-full text-slate-300 fill-slate-300/30 drop-shadow-[0_0_10px_rgba(203,213,225,0.3)]" strokeWidth={2} />
         )}
      </div>
      <CloudRain className="w-full h-full text-cyan-400 fill-cyan-400/20 animate-pulse relative z-10 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]" strokeWidth={2} />
    </div>
  );
};

export const WeatherParticles = memo(({ code, temp, precipAmt = 0 }: { code: number, temp?: number | null, precipAmt?: number }) => {
  const syncedCode = applyTelemetrySync(code, precipAmt);
  const safeCode = applyThermalLock(syncedCode, temp);
  
  const isSnow = (safeCode >= 71 && safeCode <= 77) || safeCode === 85 || safeCode === 86;
  const isRain = (safeCode >= 51 && safeCode <= 67) || (safeCode >= 80 && safeCode <= 82) || (safeCode >= 95);
  
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
      const timer = setTimeout(() => {
          if (!isSnow && !isRain) {
              setParticles([]);
              return;
          }
          
          const count = 30; 
          const newParticles: Particle[] = [...Array(count)].map((_, i) => ({
              id: i,
              left: Math.random() * 100,
              delay: Math.random() * 5,
              duration: Math.random() * 2 + (isSnow ? 5 : 1),
              opacity: Math.random() * 0.5 + 0.1
          }));
          setParticles(newParticles);
      }, 0);

      return () => clearTimeout(timer);
  }, [isSnow, isRain]);

  if (!isSnow && !isRain) return null;
  const type = isSnow ? 'snow' : 'rain';

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 transform-gpu" style={{ transform: 'translateZ(0)' }}>
      {particles.map((p) => (
          <div 
            key={p.id}
            className={`absolute top-[-20px] ${type === 'rain' ? 'w-[1.5px] h-6 bg-gradient-to-b from-transparent to-cyan-400/60' : 'w-1.5 h-1.5 bg-white/80 rounded-full blur-[1px] shadow-[0_0_4px_white]'}`}
            style={{ 
                left: `${p.left}%`, 
                animation: `fall ${p.duration}s linear ${p.delay}s infinite`, 
                opacity: p.opacity 
            }}
          />
      ))}
      <style>{`@keyframes fall { to { transform: translateY(110vh); } }`}</style>
    </div>
  );
});

WeatherParticles.displayName = 'WeatherParticles';

// eslint-disable-next-line react-refresh/only-export-components
export const getWeatherIcon = (
    code: number, 
    className: string = "w-6 h-6", 
    isDay: number | boolean = 1, 
    _rainProb: number = 0, 
    windSpeed: number = 0,
    temp?: number | null,
    precipAmt: number = 0
): React.ReactNode => {
    const isDaylight = checkIsDaylight(isDay);
    
    // Filtres en cascada: 1r Sincronització Telemetria -> 2n Bloqueig Tèrmic
    const syncedCode = applyTelemetrySync(code, precipAmt);
    const safeCode = applyThermalLock(syncedCode, temp);
    
    // SPATIAL UI: Base compartida amb drop-shadow genèric per volumetria
    const commonProps = {
      strokeWidth: 2, 
      className: `${className} drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] transition-all duration-500 transform-gpu` 
    };

    if (safeCode === 0) return isDaylight 
      ? <Sun {...commonProps} className={`${commonProps.className} text-amber-400 fill-amber-400/30 animate-[pulse_4s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]`} /> 
      : <Moon {...commonProps} className={`${commonProps.className} text-slate-300 fill-slate-300/30 drop-shadow-[0_0_15px_rgba(203,213,225,0.4)]`} />;
    
    if (safeCode === 1) {
       const windClass = windSpeed > 40 ? "animate-[pulse_0.5s_ease-in-out_infinite]" : "";
       return isDaylight 
         ? <Sun {...commonProps} className={`${commonProps.className} text-amber-400 fill-amber-400/10 ${windClass} drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]`} />
         : <Moon {...commonProps} className={`${commonProps.className} text-slate-300 fill-slate-300/10 ${windClass} drop-shadow-[0_0_10px_rgba(203,213,225,0.2)]`} />;
    }

    if (safeCode === 2) {
       const windClass = windSpeed > 40 ? "animate-[pulse_0.5s_ease-in-out_infinite]" : "";
       return isDaylight 
         ? <CloudSun {...commonProps} className={`${commonProps.className} text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.3)] ${windClass}`} />
         : <CloudMoon {...commonProps} className={`${commonProps.className} text-slate-400 ${windClass}`} />;
    }
    
    if (safeCode === 3) return <Cloud {...commonProps} className={`${commonProps.className} text-slate-400 fill-slate-400/40 animate-[pulse_4s_ease-in-out_infinite] drop-shadow-[0_0_10px_rgba(148,163,184,0.3)]`} />;
    if (safeCode >= 45 && safeCode <= 48) return <CloudFog {...commonProps} className={`${commonProps.className} text-slate-400 fill-slate-400/30 animate-pulse`} />;
    if (safeCode >= 51 && safeCode <= 55) return <CloudRain {...commonProps} className={`${commonProps.className} text-sky-300 fill-sky-300/20 drop-shadow-[0_0_8px_rgba(125,211,252,0.4)]`} />;
    if (safeCode >= 56 && safeCode <= 57) return <CloudRain {...commonProps} className={`${commonProps.className} text-cyan-300 fill-cyan-300/20 drop-shadow-[0_0_8px_rgba(103,232,249,0.5)]`} />;

    if (safeCode >= 61 && safeCode <= 65) {
        if (safeCode <= 62) return <VariableRainIcon isDay={isDaylight} {...commonProps} />;
        return <CloudRain {...commonProps} className={`${commonProps.className} text-cyan-500 fill-cyan-500/20 animate-pulse drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]`} />;
    }

    if (safeCode >= 66 && safeCode <= 67) return <CloudRain {...commonProps} className={`${commonProps.className} text-cyan-400 fill-cyan-400/20 animate-pulse drop-shadow-[0_0_15px_rgba(34,211,238,0.7)]`} />;
    if (safeCode >= 71 && safeCode <= 77) return <Snowflake {...commonProps} className={`${commonProps.className} text-white fill-white/30 animate-[spin_3s_linear_infinite] drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]`} />; 
    if (safeCode >= 80 && safeCode <= 82) return <VariableRainIcon isDay={isDaylight} {...commonProps} />;
    if (safeCode >= 85 && safeCode <= 86) return <CloudSnow {...commonProps} className={`${commonProps.className} text-white fill-white/30 animate-pulse drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]`} />;
    if (safeCode >= 95) return <VariableWeatherIcon isDay={isDaylight} {...commonProps} />;
    
    // Fallback universal tàctic
    return <Cloud {...commonProps} className={`${commonProps.className} text-slate-500 fill-slate-500/20 animate-[pulse_4s_ease-in-out_infinite]`} />;
};