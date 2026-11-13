// src/components/ConsensusSection.tsx
// El «Motor de consens»: el model regional d'alta resolució contra el global (best_match) de les pròximes 24 hores.
// Abans vivia dins ExpertWidgets; ara és una peça a part perquè es pugui posar en un lloc diferent de la graella de
// ginys (vegeu DetailWidgetsGrid). El càlcul, la petició i els textos són els mateixos: només ha canviat de fitxer.
import { useMemo, useEffect } from 'react';
import { selectRegionalModel } from '../constants/regionalModels';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { Language } from '../translations';
import { useGlobalModel } from '../hooks/useGlobalModel';
import { calculateModelConsensus, extractComparisonSeries } from '../utils/consensusMath';
import { ConsensusWidget } from './widgets/ConsensusWidget';
import { ConsensusInactiveWidget } from './widgets/ConsensusInactiveWidget';
import { ConsensusLoadingWidget } from './widgets/ConsensusLoadingWidget';

interface ConsensusSectionProps {
  weatherData: ExtendedWeatherData;
  lang: Language;
  /** Classe del contenidor. */
  className?: string;
}

export default function ConsensusSection({ weatherData, lang, className = 'w-full' }: ConsensusSectionProps) {
  const { current, hourly, utc_offset_seconds, location } = weatherData;

  const currentTemp = typeof current?.temperature_2m === 'number' ? current.temperature_2m : undefined;
  const currentPrecip = typeof current?.precipitation === 'number' ? current.precipitation : undefined;
  const currentWindSpeed = typeof current?.wind_speed_10m === 'number' ? current.wind_speed_10m : undefined;

  const { globalData, loadingGlobalModel, fetchGlobalModelByCoords, clearGlobalModel } = useGlobalModel();

  const safeLat = location && typeof (location as Record<string, unknown>).latitude === 'number'
    ? (location as Record<string, unknown>).latitude as number
    : undefined;
  const safeLon = location && typeof (location as Record<string, unknown>).longitude === 'number'
    ? (location as Record<string, unknown>).longitude as number
    : undefined;

  // [FIX PRECISIÓ] Només demanem el model global si la població té un model regional
  // d'alta resolució (AROME/ICON-D2/HRRR/HRDPS...): fora d'aquestes zones no hi ha
  // res a comparar (no hi ha "local" diferenciat del global), així que evitem la
  // crida de xarxa sencera quan ja sabem que no pot aportar cap comparació.
  const activeRegionalModel = safeLat !== undefined && safeLon !== undefined ? selectRegionalModel(safeLat, safeLon) : null;
  const hasRegionalModel = !!activeRegionalModel;

  // Amb la previsió desada a la pantalla (sense connexió) no es demana: fallaria. Quan torna la previsió nova es torna a
  // demanar; sense aquesta dependència (la ubicació no canvia) la comparació es quedava "no disponible".
  const isOfflineSnapshot = !!weatherData?.offlineSnapshot;

  useEffect(() => {
    if (isOfflineSnapshot) return;
    if (hasRegionalModel && safeLat !== undefined && safeLon !== undefined) {
      fetchGlobalModelByCoords(safeLat, safeLon);
    } else {
      clearGlobalModel();
    }
  }, [hasRegionalModel, safeLat, safeLon, isOfflineSnapshot, fetchGlobalModelByCoords, clearGlobalModel]);

  const consensusMetrics = useMemo(() => {
    // [FIX PRECISIÓ] Passem la sèrie horària local (AROME) perquè el "Radar a
    // 3 Hores" pugui detectar convecció local pròpia, no només la del model
    // global — vegeu la nota a calculateModelConsensus.
    return calculateModelConsensus(
        currentTemp,
        currentPrecip,
        currentWindSpeed,
        globalData,
        Array.isArray(hourly?.time) ? hourly.time : [],
        Array.isArray(hourly?.precipitation) ? hourly.precipitation : [],
        Array.isArray(hourly?.wind_speed_10m) ? hourly.wind_speed_10m : [],
        typeof utc_offset_seconds === 'number' ? utc_offset_seconds : 0
    );
  }, [currentTemp, currentPrecip, currentWindSpeed, globalData, hourly, utc_offset_seconds]);

  const hasKnownOffset = typeof utc_offset_seconds === 'number';
  const targetOffsetSeconds = hasKnownOffset ? utc_offset_seconds : 0;

  // [FIX PRECISIÓ] Abans hi havia aquí un heurístic `isGlobalFallback` que
  // suspenia tot el widget quan el model regional coincidia gairebé exacte
  // amb el "best_match" (p.ex. HRRR/JMA, on Open-Meteo ja tria el mateix
  // model nacional per defecte). Però "coincidir" no vol dir "no hi ha res a
  // mostrar": l'usuari encara pot voler veure el desglossament i les
  // gràfiques ECMWF/GFS/ICON del modal complet. Ara el widget només es
  // suspèn quan realment no hi ha dades comparables (`isConsensusActive`);
  // si coincideix de debò, es mostra igualment amb Δ0 i "Alineat".
  // [NETEJA] `forceFallback` també és true durant la finestra normal de
  // càrrega (abans que `fetchGlobalModelByCoords` resolgui) — per això, més
  // avall, es comprova `loadingGlobalModel` ABANS que `forceFallback`: mentre
  // encara no hi ha resposta es mostra ConsensusLoadingWidget (neutre), no
  // ConsensusInactiveWidget (que abans deia "redundant" fins i tot quan
  // encara no s'havia rebut cap dada per comparar-hi).
  const forceFallback = !consensusMetrics.isConsensusActive;

  if (!current) return null;

  const safeHourlyTimes = Array.isArray(hourly?.time) ? (hourly.time as string[]) : [];
  const safeGloTimes = Array.isArray(globalData?.hourly?.time) ? (globalData.hourly.time as string[]) : [];

  const safeHourlyTemp = Array.isArray(hourly?.temperature_2m) ? hourly.temperature_2m : undefined;
  const safeHourlyRain = Array.isArray(hourly?.precipitation) ? hourly.precipitation : undefined;
  const safeHourlyWind = Array.isArray(hourly?.wind_speed_10m) ? hourly.wind_speed_10m : undefined;
  const safeHourlyGusts = Array.isArray(hourly?.wind_gusts_10m) ? hourly.wind_gusts_10m : undefined;

  const safeGloTemp = Array.isArray(globalData?.hourly?.temperature_2m) ? globalData.hourly.temperature_2m : undefined;
  const safeGloRain = Array.isArray(globalData?.hourly?.precipitation) ? globalData.hourly.precipitation : undefined;

  const rawGloWind = (globalData?.hourly as Record<string, unknown> | undefined)?.wind_speed_10m;
  const safeGloWind = Array.isArray(rawGloWind) ? rawGloWind : undefined;

  const rawGloGusts = (globalData?.hourly as Record<string, unknown> | undefined)?.wind_gusts_10m;
  const safeGloGusts = Array.isArray(rawGloGusts) ? rawGloGusts : undefined;

  // ECMWF/GFS/ICON: ja arriben a la mateixa crida base (API_MODELS_LIST) i
  // normData.ts ja els separa a `hourlyComparison`, alineats índex a índex
  // amb `hourly.time` — cap crida de xarxa addicional per al meteograma.
  const hourlyEcmwf = extractComparisonSeries(weatherData.hourlyComparison?.ecmwf);
  const hourlyGfs = extractComparisonSeries(weatherData.hourlyComparison?.gfs);
  const hourlyIcon = extractComparisonSeries(weatherData.hourlyComparison?.icon);
  const hourlyAifs = extractComparisonSeries(weatherData.hourlyComparison?.aifs);

  return (
    <div className={className}>
       {hasRegionalModel && loadingGlobalModel ? (
          <ConsensusLoadingWidget lang={lang} />
       ) : forceFallback ? (
          <ConsensusInactiveWidget lang={lang} reason={activeRegionalModel ? 'unavailable' : 'no-coverage'} />
       ) : (
          <ConsensusWidget
             metrics={consensusMetrics}
             localTemp={currentTemp}
             localPrecip={currentPrecip}
             localWind={currentWindSpeed}
             lang={lang}
             utcOffset={targetOffsetSeconds}
             regionalModelLabel={activeRegionalModel?.label ?? 'LOC'}
             hourlyTimes={safeHourlyTimes}
             hourlyGlobalTimes={safeGloTimes}
             hourlyLocal={{
               temp: safeHourlyTemp as (number | null)[] | undefined,
               rain: safeHourlyRain as (number | null)[] | undefined,
               wind: safeHourlyWind as (number | null)[] | undefined,
               gusts: safeHourlyGusts as (number | null)[] | undefined
             }}
             hourlyGlobal={{
               temp: safeGloTemp as (number | null)[] | undefined,
               rain: safeGloRain as (number | null)[] | undefined,
               wind: safeGloWind as (number | null)[] | undefined,
               gusts: safeGloGusts as (number | null)[] | undefined
             }}
             hourlyEcmwf={hourlyEcmwf}
             hourlyGfs={hourlyGfs}
             hourlyIcon={hourlyIcon}
             hourlyAifs={hourlyAifs}
          />
       )}
    </div>
  );
}
