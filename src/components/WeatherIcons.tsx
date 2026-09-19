// src/components/WeatherIcons.tsx
import React, { useState, useEffect, memo } from 'react';
import {
  Sun, Moon, CloudLightning, CloudRain, CloudSun, CloudMoon,
  Cloud, Cloudy, CloudFog, CloudDrizzle, Snowflake, CloudOff
} from 'lucide-react';
import { isMostlyCloudy } from '../utils/rules/cloudRules';

interface CommonIconProps extends React.HTMLAttributes<HTMLDivElement> {
  isDay?: number | boolean;
  className?: string;
}

interface Particle {
  id: number;
  kind: 'rain' | 'snow';
  left: number;
  delay: number;
  duration: number;
  opacity: number;
}

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

const FREEZING_BASE_ICON = { fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain } as const;

/**
 * Fenomen "engelant": la icona del fenomen base (boira, plugim o pluja) reduïda, amb un floc de
 * neu a la cantonada. És un únic llenguatge visual per a tot el que gela en tocar terra —boira
 * gebradora (48), plugim engelant (56/57) i pluja engelant (66/67)— perquè es llegeixi d'un cop
 * d'ull com "això deixa gel", i es distingeixi de la boira/pluja normals i de la neu.
 */
const FreezingIcon = ({ base, className, ...props }: CommonIconProps & { base: keyof typeof FREEZING_BASE_ICON }) => {
  const Base = FREEZING_BASE_ICON[base];

  return (
    <div className={`${className} relative flex items-center justify-center transform-gpu`} {...props}>
      <Base className="absolute bottom-[-2%] left-[-2%] w-[84%] h-[84%] text-cyan-200 fill-cyan-200/20 animate-pulse drop-shadow-[0_0_10px_rgba(165,243,252,0.4)]" strokeWidth={2} />
      <Snowflake className="absolute top-[-6%] right-[-6%] w-[50%] h-[50%] z-10 text-white fill-white/20 drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]" strokeWidth={2.2} />
    </div>
  );
};

type IntensityLevel = 1 | 2 | 3;

// Contorn del núvol de lucide (CloudRain/CloudSnow/CloudDrizzle): les marques de precipitació hi
// pengen a sota. Un únic llenguatge per a pluja, neu i aiguaneu: QUANTITAT DE MARQUES = INTENSITAT.
const CLOUD_TOP = 'M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242';

/** Ratlles de pluja: 2 (feble), 3 (moderada, com el CloudRain de lucide) i 5 (forta). */
const RAIN_STREAKS: Record<IntensityLevel, string[]> = {
  1: ['M9 15v4', 'M15 17v4'],
  2: ['M8 14v6', 'M12 16v6', 'M16 14v6'],
  3: ['M6 16v3', 'M9 14v6', 'M12 17v5', 'M15 14v6', 'M18 17v3']
};

/** Flocs de neu: 2 (feble), 4 (moderada) i 6 (forta, com el CloudSnow de lucide). */
const SNOW_FLAKES: Record<IntensityLevel, Array<[number, number]>> = {
  1: [[12, 17], [16, 19]],
  2: [[8, 15], [12, 17], [16, 15], [12, 21]],
  3: [[8, 15], [8, 19], [12, 17], [12, 21], [16, 15], [16, 19]]
};

/** Aiguaneu: una ratlla de pluja a l'esquerra i flocs a la dreta (2 o 4). */
const SLEET_FLAKES: Record<1 | 2, Array<[number, number]>> = {
  1: [[12, 17], [16, 19]],
  2: [[12, 17], [12, 21], [16, 15], [16, 19]]
};

const flakePath = ([x, y]: [number, number]) => `M${x} ${y}h.01`;

/** Núvol amb pluja, neu o aiguaneu i la intensitat com a nombre de marques. */
const PrecipCloudIcon = ({ kind, level, className }: { kind: 'rain' | 'snow' | 'sleet'; level: IntensityLevel; className: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d={CLOUD_TOP} />
    {kind === 'rain' && RAIN_STREAKS[level].map(d => <path key={d} d={d} />)}
    {kind === 'snow' && SNOW_FLAKES[level].map(f => <path key={flakePath(f)} d={flakePath(f)} strokeWidth={3} />)}
    {kind === 'sleet' && (
      <>
        <path d={level === 1 ? 'M8 15v4' : 'M8 14v6'} />
        {SLEET_FLAKES[level === 1 ? 1 : 2].map(f => <path key={flakePath(f)} d={flakePath(f)} strokeWidth={3} />)}
      </>
    )}
  </svg>
);

/** Tempesta amb calamarsa (96/99): el CloudLightning de lucide amb pedres de calamarsa al voltant. */
const HailStormIcon = ({ className }: { className: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973" />
    <path d="m13 12-3 5h4l-3 5" />
    <g stroke="white" strokeWidth={3}>
      <path d="M5.5 19.5h.01" />
      <path d="M8 22h.01" />
      <path d="M17 20h.01" />
      <path d="M20 17.5h.01" />
    </g>
  </svg>
);

/** Majorment serè (codi 1, 15-45 % de núvols): sol o lluna amb un núvol petit, no el sol sol del codi 0. */
const FewCloudsIcon = ({ isDay, className, windClass }: { isDay: boolean; className: string; windClass: string }) => (
  <div className={`${className} relative flex items-center justify-center transform-gpu ${windClass}`}>
    <div className="absolute top-[-8%] left-[-8%] w-[76%] h-[76%]">
      {isDay ? (
        <Sun className="w-full h-full text-amber-400 fill-amber-400/10 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]" strokeWidth={2} />
      ) : (
        <Moon className="w-full h-full text-slate-300 fill-slate-300/10 drop-shadow-[0_0_10px_rgba(203,213,225,0.25)]" strokeWidth={2} />
      )}
    </div>
    <Cloud className="absolute bottom-[-2%] right-[-2%] w-[52%] h-[52%] z-10 text-slate-200 fill-slate-600/80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" strokeWidth={2.2} />
  </div>
);

export const WeatherParticles = memo(({ code, temp: _t, precipAmt: _p = 0 }: { code: number, temp?: number | null, precipAmt?: number }) => {
  // L'Orquestrador ja ens envia el codi net i purificat. Confiança cega.
  const safeCode = code; 
  
  const isSnow = (safeCode >= 71 && safeCode <= 77) || safeCode === 85 || safeCode === 86;
  const isSleet = safeCode === 68 || safeCode === 69;
  const isRain = (safeCode >= 51 && safeCode <= 67) || (safeCode >= 80 && safeCode <= 82) || (safeCode >= 95);
  
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
      const timer = setTimeout(() => {
          if (!isSnow && !isRain && !isSleet) {
              setParticles([]);
              return;
          }
          
          const count = 30; 
          const newParticles: Particle[] = [...Array(count)].map((_, i) => {
              // Aiguaneu: gotes i flocs alternats.
              const kind: Particle['kind'] = isSleet ? (i % 2 === 0 ? 'rain' : 'snow') : isSnow ? 'snow' : 'rain';
              return {
                  id: i,
                  kind,
                  left: Math.random() * 100,
                  delay: Math.random() * 5,
                  duration: Math.random() * 2 + (kind === 'snow' ? 5 : 1),
                  opacity: Math.random() * 0.5 + 0.1
              };
          });
          setParticles(newParticles);
      }, 0);

      return () => clearTimeout(timer);
  }, [isSnow, isRain, isSleet]);

  if (!isSnow && !isRain && !isSleet) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 transform-gpu" style={{ transform: 'translateZ(0)' }}>
      {particles.map((p) => (
          <div 
            key={p.id}
            className={`absolute top-[-20px] ${p.kind === 'rain' ? 'w-[1.5px] h-6 bg-gradient-to-b from-transparent to-cyan-400/60' : 'w-1.5 h-1.5 bg-white/80 rounded-full blur-[1px] shadow-[0_0_4px_white]'}`}
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
    code: number | null,
    className: string = "w-6 h-6",
    isDay: number | boolean = 1,
    _rainProb: number = 0,
    windSpeed: number = 0,
    _temp?: number | null,
    _precipAmt: number = 0,
    // % de núvols que va decidir el codi (efectiu a hores i a "ara", mitjana diürna al diari).
    // Només serveix per triar la variant "molt ennuvolat" del codi 2; sense ell es pinta el 2 de sempre.
    cloudCover?: number | null
): React.ReactNode => {
    const isDaylight = checkIsDaylight(isDay);

    // SPATIAL UI: Base compartida amb drop-shadow genèric per volumetria
    const commonProps = {
      strokeWidth: 2,
      className: `${className} drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] transition-all duration-500 transform-gpu`
    };

    // DOCTRINA RISC ZERO: sense codi real (p.ex. temperatura absent a
    // l'Orquestrador), mostrem un estat explícit de "sense dades" en lloc
    // d'una icona de sol/núvol que fingiria una lectura que no tenim.
    if (code === null) return <CloudOff {...commonProps} className={`${commonProps.className} text-slate-600 opacity-60`} />;

    // L'Orquestrador dicta sentència. Single Source of Truth tancat.
    const safeCode = code;

    if (safeCode === 0) return isDaylight
      ? <Sun {...commonProps} className={`${commonProps.className} text-amber-400 fill-amber-400/30 animate-[pulse_4s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]`} /> 
      : <Moon {...commonProps} className={`${commonProps.className} text-slate-300 fill-slate-300/30 drop-shadow-[0_0_15px_rgba(203,213,225,0.4)]`} />;
    
    // Majorment serè: sol/lluna amb un núvol petit (abans era el sol sol amb menys farciment, gairebé
    // idèntic al codi 0).
    if (safeCode === 1) {
       const windClass = windSpeed > 40 ? "animate-[pulse_0.5s_ease-in-out_infinite]" : "";
       return <FewCloudsIcon isDay={isDaylight} className={commonProps.className} windClass={windClass} />;
    }

    if (safeCode === 2) {
       const windClass = windSpeed > 40 ? "animate-[pulse_0.5s_ease-in-out_infinite]" : "";
       // Molt ennuvolat (70-85 % de núvols): dos núvols, sense sol a la vista.
       if (isMostlyCloudy(safeCode, cloudCover)) return <Cloudy {...commonProps} className={`${commonProps.className} text-slate-300 fill-slate-400/30 drop-shadow-[0_0_8px_rgba(148,163,184,0.3)] ${windClass}`} />;
       return isDaylight
         ? <CloudSun {...commonProps} className={`${commonProps.className} text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.3)] ${windClass}`} />
         : <CloudMoon {...commonProps} className={`${commonProps.className} text-slate-400 ${windClass}`} />;
    }
    
    if (safeCode === 3) return <Cloud {...commonProps} className={`${commonProps.className} text-slate-400 fill-slate-400/40 animate-[pulse_4s_ease-in-out_infinite] drop-shadow-[0_0_10px_rgba(148,163,184,0.3)]`} />;
    if (safeCode === 48) return <FreezingIcon base="fog" className={commonProps.className} />;
    if (safeCode >= 45 && safeCode <= 47) return <CloudFog {...commonProps} className={`${commonProps.className} text-slate-400 fill-slate-400/30 animate-pulse`} />;
    // Plugim: gotetes fines (CloudDrizzle), no les ratlles de la pluja.
    if (safeCode >= 51 && safeCode <= 55) return <CloudDrizzle {...commonProps} className={`${commonProps.className} text-sky-300 fill-sky-300/20 drop-shadow-[0_0_8px_rgba(125,211,252,0.4)]`} />;
    if (safeCode >= 56 && safeCode <= 57) return <FreezingIcon base="drizzle" className={commonProps.className} />;

    // Pluja estratiforme: la intensitat és el nombre de ratlles (2 / 3 / 5). Abans la pluja feble
    // (61) portava la icona de ruixat amb sol, i la moderada (63) i la forta (65) eren idèntiques.
    if (safeCode === 61) return <PrecipCloudIcon kind="rain" level={1} className={`${commonProps.className} text-sky-300 fill-sky-300/20 drop-shadow-[0_0_8px_rgba(125,211,252,0.4)]`} />;
    if (safeCode >= 62 && safeCode <= 63) return <PrecipCloudIcon kind="rain" level={2} className={`${commonProps.className} text-cyan-400 fill-cyan-400/20 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]`} />;
    if (safeCode >= 64 && safeCode <= 65) return <PrecipCloudIcon kind="rain" level={3} className={`${commonProps.className} text-cyan-500 fill-cyan-500/20 animate-pulse drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]`} />;

    if (safeCode >= 66 && safeCode <= 67) return <FreezingIcon base="rain" className={commonProps.className} />;

    // Aiguaneu (68 feble, 69 moderat/fort): pluja i neu barrejades.
    if (safeCode === 68 || safeCode === 69) return <PrecipCloudIcon kind="sleet" level={safeCode === 68 ? 1 : 2} className={`${commonProps.className} text-sky-200 fill-sky-200/20 drop-shadow-[0_0_10px_rgba(186,230,253,0.5)]`} />;

    // Neu: mateix llenguatge que la pluja (2 / 4 / 6 flocs). Els grans de neu (77) són el cas feble
    // i els ruixats de neu (85/86) només arriben pel codi diari cru: moderat i fort.
    if ((safeCode >= 71 && safeCode <= 77) || safeCode === 85 || safeCode === 86) {
        const snowLevel: IntensityLevel = (safeCode === 71 || safeCode === 72 || safeCode === 77) ? 1 : (safeCode === 73 || safeCode === 74 || safeCode === 85) ? 2 : 3;
        return <PrecipCloudIcon kind="snow" level={snowLevel} className={`${commonProps.className} text-white fill-white/30 ${snowLevel === 3 ? 'animate-pulse' : ''} drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]`} />;
    }

    if (safeCode >= 80 && safeCode <= 82) return <VariableRainIcon isDay={isDaylight} {...commonProps} />;
    if (safeCode === 95) return <VariableWeatherIcon isDay={isDaylight} {...commonProps} />;
    // Tempesta amb calamarsa (96, 99): l'etiqueta ja ho deia però la icona era la de la tempesta normal.
    if (safeCode >= 96) return <HailStormIcon className={`${commonProps.className} text-fuchsia-400 fill-fuchsia-400/20 animate-pulse drop-shadow-[0_0_15px_rgba(192,38,211,0.8)]`} />;
    
    return <Cloud {...commonProps} className={`${commonProps.className} text-slate-500 fill-slate-500/20 animate-[pulse_4s_ease-in-out_infinite]`} />;
};