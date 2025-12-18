import React from 'react';
import { 
  Sun, Moon, CloudLightning, CloudRain, CloudSun, CloudMoon, 
  Cloud, CloudFog, Snowflake, CloudSnow 
} from 'lucide-react';

// --- COMPONENTS INTERNS (Helpers) ---

const VariableWeatherIcon = ({ isDay, className, ...props }) => {
  return (
    <div className={`${className} relative flex items-center justify-center`} {...props}>
      <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] z-0">
         {isDay ? (
           <Sun className="w-full h-full text-yellow-400 fill-yellow-400/30 animate-[pulse_4s_ease-in-out_infinite]" strokeWidth={2} />
         ) : (
           <Moon className="w-full h-full text-slate-300 fill-slate-300/30" strokeWidth={2} />
         )}
      </div>
      <CloudLightning className="w-full h-full text-purple-400 fill-purple-400/20 animate-pulse relative z-10" strokeWidth={2} />
    </div>
  );
};

const VariableRainIcon = ({ isDay, className, ...props }) => {
  return (
    <div className={`${className} relative flex items-center justify-center`} {...props}>
      <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] z-0">
         {isDay ? (
           <Sun className="w-full h-full text-yellow-400 fill-yellow-400/30 animate-[pulse_4s_ease-in-out_infinite]" strokeWidth={2} />
         ) : (
           <Moon className="w-full h-full text-slate-300 fill-slate-300/30" strokeWidth={2} />
         )}
      </div>
      <CloudRain className="w-full h-full text-indigo-400 fill-indigo-400/20 animate-pulse relative z-10" strokeWidth={2} />
    </div>
  );
};

// --- EXPORTS PÚBLICS ---

export const WeatherParticles = ({ code }) => {
  const isSnow = (code >= 71 && code <= 77) || code === 85 || code === 86;
  const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95);
  if (!isSnow && !isRain) return null;
  const type = isSnow ? 'snow' : 'rain';
  const count = 30; 

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {[...Array(count)].map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 5;
        const duration = Math.random() * 2 + (isSnow ? 5 : 1); 
        const opacity = Math.random() * 0.5 + 0.1;
        return (
          <div 
            key={i}
            className={`absolute top-[-20px] ${type === 'rain' ? 'w-0.5 h-6 bg-blue-300/40' : 'w-1.5 h-1.5 bg-white/60 rounded-full blur-[1px]'}`}
            style={{ left: `${left}%`, animation: `fall ${duration}s linear ${delay}s infinite`, opacity: opacity }}
          />
        );
      })}
      <style>{`@keyframes fall { to { transform: translateY(110vh); } }`}</style>
    </div>
  );
};

// --- CORRECCIÓ APLICADA AQUÍ BAIX ---
// 1. Afegim 'humidity' als paràmetres (amb valor per defecte 0)
export const getWeatherIcon = (code, className = "w-6 h-6", isDay = 1, rainProb = 0, windSpeed = 0, humidity = 0) => {
    const commonProps = {
      strokeWidth: 2, 
      className: `${className} drop-shadow-md transition-all duration-300` 
    };

    // 2. NOVA REGLA: Si plou poc però la humitat és extrema (>=95%), mostrem BOIRA
    const drizzleCodes = [51, 53, 55, 56, 57, 61, 80];
    if (drizzleCodes.includes(code) && humidity >= 95) {
       return <CloudFog {...commonProps} className={`${commonProps.className} text-gray-400 fill-gray-400/30 animate-pulse`} />;
    }
    // -----------------------------------------------------------------------

    if (rainProb > 50 && code < 50) {
       return <VariableRainIcon isDay={isDay} {...commonProps} />;
    }

    if (code === 0) return isDay 
      ? <Sun {...commonProps} className={`${commonProps.className} text-yellow-400 fill-yellow-400/30 animate-[pulse_4s_ease-in-out_infinite]`} /> 
      : <Moon {...commonProps} className={`${commonProps.className} text-slate-300 fill-slate-300/30`} />;
    
    if (code === 1 || code === 2) {
       const windClass = windSpeed > 40 ? "animate-[pulse_0.5s_ease-in-out_infinite]" : "";
       return isDay 
         ? <CloudSun {...commonProps} className={`${commonProps.className} text-orange-300 ${windClass}`} />
         : <CloudMoon {...commonProps} className={`${commonProps.className} text-slate-400 ${windClass}`} />;
    }
    
    if (code === 3) return <Cloud {...commonProps} className={`${commonProps.className} text-slate-400 fill-slate-400/40 animate-[pulse_4s_ease-in-out_infinite]`} />;

    if (code >= 45 && code <= 48) return <CloudFog {...commonProps} className={`${commonProps.className} text-gray-400 fill-gray-400/30 animate-pulse`} />;
    
    if (code >= 51 && code <= 55) return <CloudRain {...commonProps} className={`${commonProps.className} text-blue-300 fill-blue-300/20`} />;

    if (code >= 56 && code <= 57) return <CloudRain {...commonProps} className={`${commonProps.className} text-cyan-300 fill-cyan-300/20`} />;

    if (code >= 61 && code <= 65) {
        if (!isDay) return <VariableRainIcon isDay={false} {...commonProps} />;
        return <CloudRain {...commonProps} className={`${commonProps.className} text-blue-500 fill-blue-500/20 animate-pulse`} />;
    }

    if (code >= 66 && code <= 67) return <CloudRain {...commonProps} className={`${commonProps.className} text-cyan-400 fill-cyan-400/20 animate-pulse`} />;

    if (code >= 71 && code <= 77) return <Snowflake {...commonProps} className={`${commonProps.className} text-white fill-white/30 animate-[spin_3s_linear_infinite]`} />; 
    
    if (code >= 80 && code <= 82) return <VariableRainIcon isDay={isDay} {...commonProps} />;

    if (code >= 85 && code <= 86) return <CloudSnow {...commonProps} className={`${commonProps.className} text-white fill-white/30 animate-pulse`} />;

    if (code >= 95) return <VariableWeatherIcon isDay={isDay} {...commonProps} />;
    
    return <Cloud {...commonProps} className={`${commonProps.className} text-gray-300 fill-gray-300/20 animate-[pulse_4s_ease-in-out_infinite]`} />;
 };