// src/components/sky/SkySection.tsx
// La part astronòmica de la pestanya Cel: primer «El sol» i a sota «Aquesta nit», sempre en aquest ordre (de dia, el
// compte enrere fins a la posta és la xifra gran del sol; de nit, va a la seva capçalera). A partir de 1024 px, un al
// costat de l'altre (la nit, més ampla: el seu eix de temps ho necessita) i de la mateixa alçada. Cada plafó obre el seu
// modal de sempre.
import { useMemo } from 'react';
import type { ExtendedWeatherData } from '../../types/weatherLogicTypes';
import type { Language } from '../../translations';
import type { SkyHour } from '../../utils/daySky';
import type { HourlySeries } from '../../utils/hourlyWeatherCode';
import type { SolarDaily } from '../../utils/solar/solarForecast';
import { makeZoneCtx } from '../../utils/solar/solarTime';
import { nextSunEvent } from '../../utils/solar/nextSunEvent';
import { findNightWindow } from '../../utils/sky/nightSky';
import { buildDetailCardLabel } from '../../utils/detailCardLabel';
import { preloadSolarModal } from '../solar/preloadSolarModal';
import { SunPanel } from './SunPanel';
import { NightPanel } from './NightPanel';

export interface SkySectionProps {
  weatherData: ExtendedWeatherData;
  /** calculations.daySky: el cel de cada hora (la franja de Previsió). */
  daySky?: Record<string, SkyHour[]> | null;
  lang: Language;
  /** Rellotge de l'app (ms, cada minut). */
  nowMs: number;
  onShowSolarModal: () => void;
  onShowMoonModal: () => void;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export default function SkySection({ weatherData, daySky, lang, nowMs, onShowSolarModal, onShowMoonModal }: SkySectionProps) {
  const location = weatherData.location as Record<string, unknown> | undefined;
  const lat = num(location?.latitude);
  const lon = num(location?.longitude);
  const timezone = typeof weatherData.timezone === 'string' ? weatherData.timezone : null;
  const utcOffset = num(weatherData.utc_offset_seconds) ?? 0;
  const daily = weatherData.daily as SolarDaily | undefined;
  const hourly = weatherData.hourly as HourlySeries | undefined;
  const zone = useMemo(() => makeZoneCtx(timezone, utcOffset), [timezone, utcOffset]);
  const minuteMs = Math.floor(nowMs / 60000) * 60000;

  // De nit (entre la posta i la sortida, o en una nit polar) el compte enrere del sol va a la capçalera.
  const isNight = useMemo(() => {
    if (lat === undefined || lon === undefined) return false;
    const w = findNightWindow(minuteMs, lat, lon, zone, daily);
    return w !== null && minuteMs >= w.startMs;
  }, [minuteMs, lat, lon, zone, daily]);

  // Noms accessibles: els de les targetes d'abans ("Cicle solar, posta de sol a les 17:26 · Detall").
  const sunNext = useMemo(
    () => (lat !== undefined && lon !== undefined ? nextSunEvent(minuteMs, lat, lon, timezone, utcOffset, daily) : null),
    [minuteMs, lat, lon, timezone, utcOffset, daily],
  );
  const sunLabel = buildDetailCardLabel({ id: 'sun', next: sunNext }, lang);
  const moonLabel = buildDetailCardLabel({ id: 'moon', nowMs: minuteMs }, lang);

  const sun = (
    <div key="sun" className="lg:col-span-5">
      <SunPanel
        lang={lang} lat={lat} lon={lon} timezone={timezone} utcOffset={utcOffset} daily={daily} daySky={daySky} hourly={hourly}
        hero={!isNight} onOpen={onShowSolarModal} onIntent={preloadSolarModal} label={sunLabel}
      />
    </div>
  );
  const night = (
    <div key="night" className="lg:col-span-7">
      <NightPanel
        lang={lang} lat={lat} lon={lon} timezone={timezone} utcOffset={utcOffset} daily={daily}
        daySky={daySky} hourly={hourly} nowMs={minuteMs} onOpenMoon={onShowMoonModal} moonLabel={moonLabel}
      />
    </div>
  );

  return (
    <div data-testid="sky-section" data-time={isNight ? 'night' : 'day'} className="flex flex-col gap-6 sm:gap-8 lg:grid lg:grid-cols-12 lg:gap-6">
      {sun}
      {night}
    </div>
  );
}
