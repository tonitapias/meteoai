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

// Embolcallem el component amb memo() per rendiment gràfic
export const WeatherParticles = memo(({ code }: { code: number }) => {
  const isSnow = (code >= 71 && code <= 77) || code === 85 || code === 86;
  const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95);
  
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
      // setTimeout treu l'actualització del cicle síncron evitant bloquejos
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

  // SPATIAL UI: Accel·leració GPU i efectes visuals per a les partícules
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

// Assignem display name per debugging
WeatherParticles.displayName = 'WeatherParticles';

// eslint-disable-next-line react-refresh/only-export-components
export const getWeatherIcon = (
    code: number, 
    className: string = "w-6 h-6", 
    isDay: number | boolean = 1, 
    _rainProb: number = 0, 
    windSpeed: number = 0
): React.ReactNode => {
    const isDaylight = checkIsDaylight(isDay);
    
    // SPATIAL UI: Base compartida amb drop-shadow genèric per volumetria
    const commonProps = {
      strokeWidth: 2, 
      className: `${className} drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] transition-all duration-500 transform-gpu` 
    };

    if (code === 0) return isDaylight 
      ? <Sun {...commonProps} className={`${commonProps.className} text-amber-400 fill-amber-400/30 animate-[pulse_4s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]`} /> 
      : <Moon {...commonProps} className={`${commonProps.className} text-slate-300 fill-slate-300/30 drop-shadow-[0_0_15px_rgba(203,213,225,0.4)]`} />;
    
    if (code === 1) {
       const windClass = windSpeed > 40 ? "animate-[pulse_0.5s_ease-in-out_infinite]" : "";
       return isDaylight 
         ? <Sun {...commonProps} className={`${commonProps.className} text-amber-400 fill-amber-400/10 ${windClass} drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]`} />
         : <Moon {...commonProps} className={`${commonProps.className} text-slate-300 fill-slate-300/10 ${windClass} drop-shadow-[0_0_10px_rgba(203,213,225,0.2)]`} />;
    }

    if (code === 2) {
       const windClass = windSpeed > 40 ? "animate-[pulse_0.5s_ease-in-out_infinite]" : "";
       return isDaylight 
         ? <CloudSun {...commonProps} className={`${commonProps.className} text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.3)] ${windClass}`} />
         : <CloudMoon {...commonProps} className={`${commonProps.className} text-slate-400 ${windClass}`} />;
    }
    
    if (code === 3) return <Cloud {...commonProps} className={`${commonProps.className} text-slate-400 fill-slate-400/40 animate-[pulse_4s_ease-in-out_infinite] drop-shadow-[0_0_10px_rgba(148,163,184,0.3)]`} />;
    if (code >= 45 && code <= 48) return <CloudFog {...commonProps} className={`${commonProps.className} text-slate-400 fill-slate-400/30 animate-pulse`} />;
    if (code >= 51 && code <= 55) return <CloudRain {...commonProps} className={`${commonProps.className} text-sky-300 fill-sky-300/20 drop-shadow-[0_0_8px_rgba(125,211,252,0.4)]`} />;
    if (code >= 56 && code <= 57) return <CloudRain {...commonProps} className={`${commonProps.className} text-cyan-300 fill-cyan-300/20 drop-shadow-[0_0_8px_rgba(103,232,249,0.5)]`} />;

    if (code >= 61 && code <= 65) {
        if (code <= 62) return <VariableRainIcon isDay={isDaylight} {...commonProps} />;
        return <CloudRain {...commonProps} className={`${commonProps.className} text-cyan-500 fill-cyan-500/20 animate-pulse drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]`} />;
    }

    if (code >= 66 && code <= 67) return <CloudRain {...commonProps} className={`${commonProps.className} text-cyan-400 fill-cyan-400/20 animate-pulse drop-shadow-[0_0_15px_rgba(34,211,238,0.7)]`} />;
    if (code >= 71 && code <= 77) return <Snowflake {...commonProps} className={`${commonProps.className} text-white fill-white/30 animate-[spin_3s_linear_infinite] drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]`} />; 
    if (code >= 80 && code <= 82) return <VariableRainIcon isDay={isDaylight} {...commonProps} />;
    if (code >= 85 && code <= 86) return <CloudSnow {...commonProps} className={`${commonProps.className} text-white fill-white/30 animate-pulse drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]`} />;
    if (code >= 95) return <VariableWeatherIcon isDay={isDaylight} {...commonProps} />;
    
    // Fallback universal tàctic
    return <Cloud {...commonProps} className={`${commonProps.className} text-slate-500 fill-slate-500/20 animate-[pulse_4s_ease-in-out_infinite]`} />;
};