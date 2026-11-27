// src/components/dashboard/TabbedDashboard.tsx
// El tauler per pestanyes (des de la v3.58, en lloc de les vistes Essencial/Completa): Ara · Previsió · Detall · Cel, i
// el Radar a la barra. Només composició: els ginys, els seus props i els modals són els de sempre.
//
// Muntatge: Ara es munta d'entrada i ja no es desmunta (els avisos d'alerta oficial i de radar fan les seves pròpies
// peticions en muntar-se); la resta es munta la primera vegada que s'obre i després es queda muntada però amagada (el
// consens no té memòria cau: tornar-lo a muntar tornaria a demanar el model global). Mai hi ha més coses muntades que a
// l'antiga vista completa.
//
// Historial (vegeu tabs/tabHistory.ts): la pestanya va a la URL (?tab=…) i sortir d'Ara n'afegeix una sola entrada,
// de manera que l'enrere des de Previsió, Detall o Cel torna a Ara i, des d'Ara, surt com sempre. Els modals no hi
// noten res: el seu enrere i la seva Esc continuen tancant-los i la pestanya no canvia.
import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAiAnalysis, useAppContext, useModals } from '../../context/AppContext';
import { usePlanetHeadline } from '../../hooks/usePlanetHeadline';
import { buildDetailTeaser } from '../../utils/detailTeaser';
import { getSafeLatitude } from '../../utils/weatherMath';
import { findNowIndex } from '../../utils/hourlyChartSeries';
import { hoursOfDate } from '../../utils/dailyExtremes';
import { generateHourlyChartData } from '../../utils/weatherMappers';
import { isRegionalModelActive } from '../../constants/regionalModels';
import type { LocationMeta } from '../../types/weatherLogicTypes';
import type { Language } from '../../translations';
import CurrentWeather from '../CurrentWeather';
import ErrorBoundary from '../ErrorBoundary';
import OfflineSnapshotBanner from '../OfflineSnapshotBanner';
import { MinutelyPreciseChart } from '../WeatherCharts';
import TabBar from '../tabs/TabBar';
import { useMinWidth } from '../solar/useMinWidth';
import { DASHBOARD_TABS, DETAIL_TAB_WIDGETS, panelElementId, tabElementId, type DashboardTab } from '../tabs/dashboardTabs';
import { pushTabEntryIfNeeded, readTabFromSearch, replaceTabInUrl } from '../tabs/tabHistory';
import { useTextFieldFocus } from '../tabs/useTextFieldFocus';
import { SectionSkeleton } from './SectionSkeleton';
import { HighlightsRow } from './HighlightsRow';
import { PanelPlaceLine } from './PanelPlaceLine';
import { isSleetCode, isSnowCode } from '../../utils/rules/winterRules';
import { nowcastPrecipKind } from '../../utils/nowcastKind';
import { skyKindOfCode } from '../../utils/daySky';

const Forecast24h = lazy(() => import('../Forecast24h'));
const AIInsights = lazy(() => import('../AIInsights'));
const OfficialAlertBanner = lazy(() => import('../OfficialAlertBanner'));
const RadarRealityBanner = lazy(() => import('../RadarRealityBanner'));
const RadarNowcastBanner = lazy(() => import('../RadarNowcastBanner'));
const LightningBanner = lazy(() => import('../LightningBanner'));
const ForecastSection = lazy(() => import('../ForecastSection'));
const SmartForecastCharts = lazy(() => import('../SmartForecastCharts'));
const ConsensusSection = lazy(() => import('../ConsensusSection'));
const DetailWidgetsGrid = lazy(() => import('../DetailWidgetsGrid'));
const SkySection = lazy(() => import('../sky/SkySection'));
const PlanetExtremesCard = lazy(() => import('../planet/PlanetExtremesCard'));

// Detall: 1 columna al mòbil, 2 a tauleta, 3 a escriptori (la temperatura a dalt i la cota de neu a sota, totes dues a tota
// l'amplada; entremig, els 8 ginys omplen tres files).
const DETAIL_GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 grid-flow-dense';
// La pila de cada columna, amb el mateix espai que entre seccions.
const STACK = 'flex flex-col gap-6 sm:gap-8';

// L'anàlisi de la IA té el seu propi context: quan arriba, només es torna a pintar aquest bloc, no tot el panell Ara.
const LiveAIInsights = ({ lang }: { lang: Language }) => <AIInsights analysis={useAiAnalysis()} lang={lang} />;

// Els quatre panells van amb memo i no reben cap prop que canviï: canviar de pestanya, o obrir i tancar un modal, ja no
// els torna a renderitzar (abans, ~195 components per canvi de pestanya). Només es tornen a pintar quan canvien les
// dades del context (previsió nova, el rellotge de cada minut, l'idioma...).

// --- Ara: la targeta principal, els avisos (només si n'hi ha), l'anàlisi, les pròximes 24 hores i els destacats -----
const NowPanel = memo(function NowPanel({ onGoTo }: { onGoTo: (tab: DashboardTab) => void }) {
    const { state, actions, flags, t } = useAppContext();
    const { weatherData, calculations } = state;
    const current = weatherData?.current;
    // El fenomen gros del dia a «Extrems del planeta» (si n'hi ha): una petició diferida, uns segons després de pintar la previsió.
    const planetHeadline = usePlanetHeadline(!!current, flags.lang);
    const nowMs = state.now.getTime();
    // Els dos avisos del radar diuen pluja, neu o totes dues amb el cel previst i la temperatura d'ara (utils/nowcastKind.ts).
    const radarPrecipKind = nowcastPrecipKind(calculations.daySky, calculations.shiftedNow ?? state.now, current?.temperature_2m ?? null);
    // La previsió ja hi posa precipitació ara (previsió immediata, o el cel d'ara és de pluja, neu o tempesta).
    const nowSky = skyKindOfCode(calculations.effectiveWeatherCode);
    const modelPrecipNow = (calculations.minutelyPreciseData?.[0] ?? 0) > 0 || nowSky === 'rain' || nowSky === 'snow' || nowSky === 'storm';
    // Els destacats: pressió, aire, lluna, visibilitat i, si n'hi ha, el fenomen del planeta (vegeu utils/detailTeaser.ts).
    const highlights = useMemo(() => {
        if (!current) return [];
        return buildDetailTeaser({
            current,
            aqiCurrent: (state.aqiData as Record<string, unknown> | null)?.current,
            effectiveCode: calculations.effectiveWeatherCode,
            nowMs,
            lang: flags.lang,
            templates: t.tabs,
            planet: planetHeadline,
        });
    }, [current, state.aqiData, calculations.effectiveWeatherCode, nowMs, flags.lang, t.tabs, planetHeadline]);

    if (!weatherData) return null;
    const loc = weatherData.location as LocationMeta | undefined;

    return (
        <>
            {/* Previsió desada (no se n'ha pogut obtenir cap de nova): abans de cap número */}
            {weatherData.offlineSnapshot && (
                <OfflineSnapshotBanner
                    info={weatherData.offlineSnapshot}
                    place={loc?.name ?? null}
                    text={t.offlineSnapshot}
                    now={state.now.getTime()}
                    onRetry={actions.refreshLoadedLocation}
                />
            )}

            {/* A partir de 1280 px: si n'hi ha, la pluja de la pròxima hora i els avisos en una fila a dalt de tot, a tota
                l'amplada (fins a tres per fila, que s'estiren a parts iguals); a sota, la targeta principal (2/3) i, al
                costat (1/3), l'anàlisi i, a baix de tot, els destacats; i a sota, les 24 hores a tota l'amplada. Les dues
                columnes fan la mateixa alçada i l'anàlisi (ja preparada per omplir l'alçada) l'omple. Abans els avisos
                anaven a la columna de la dreta: amb tres o quatre, la targeta principal s'estirava fins al doble de la
                seva alçada i quedava buida al mig.
                Més estret, una sola columna en l'ordre de sempre: targeta, pluja, avisos, anàlisi, 24 hores, destacats
                (la columna de la dreta hi és `contents`, i els destacats hi passen al final amb `order`). */}
            <div className={`${STACK} xl:grid xl:grid-cols-3`}>
                <div className="xl:col-span-2 xl:[&>*]:h-full xl:[&>*>*]:h-full">
                    <CurrentWeather
                        data={weatherData}
                        effectiveCode={calculations.effectiveWeatherCode}
                        effectiveCloudCover={calculations.effectiveCloudCover}
                        unit={flags.unit}
                        lang={flags.lang}
                        shiftedNow={calculations.shiftedNow}
                        isFavorite={!!loc && flags.isFavorite(loc)}
                        onToggleFavorite={actions.handleToggleFavorite}
                        onShare={actions.handleSharePlace}
                        sharedPlace={state.sharedPlace}
                        onShowRadar={() => actions.setShowRadar(true)}
                        onShowRegionalModel={() => actions.setShowRegionalModel(true)}
                        aqiData={state.aqiData}
                        activeRegionalModel={flags.activeRegionalModel}
                        compact
                        hideRadarButton
                    />
                </div>

                {/* Sense pluja ni avisos, cap d'ells pinta res i el contenidor queda buit: `empty:hidden` (si no, la pila hi
                    afegiria l'espai entre seccions, i a escriptori, una fila buida). */}
                <div className={`${STACK} empty:hidden xl:order-first xl:col-span-3 xl:flex-row xl:flex-wrap xl:[&>*]:flex-[1_1_20rem]`}>
                    {/* Pluja la pròxima hora (porta la seva targeta: sense pluja no pinta res) */}
                    <MinutelyPreciseChart
                        data={calculations.minutelyPreciseData}
                        label={t.preciseRain || "SCAN PRECIPITACIÓ (1H)"}
                        lang={flags.lang}
                        currentPrecip={calculations.chartData24h?.[0]?.precip || 0}
                        snow={typeof calculations.effectiveWeatherCode === 'number' && (isSnowCode(calculations.effectiveWeatherCode) || isSleetCode(calculations.effectiveWeatherCode))}
                    />

                    {/* Els avisos, per urgència: llamps, nowcast, realitat del radar, alerta oficial */}
                    <Suspense fallback={null}>
                        <LightningBanner lightning={state.lightning} lang={flags.lang} now={state.now.getTime()} onShowRadar={() => actions.setShowRadar(true)} />
                    </Suspense>
                    <Suspense fallback={null}>
                        <RadarNowcastBanner
                            lat={loc?.latitude}
                            lon={loc?.longitude}
                            lang={flags.lang}
                            kind={radarPrecipKind}
                            modelPrecipNow={modelPrecipNow}
                        />
                    </Suspense>
                    <Suspense fallback={null}>
                        <RadarRealityBanner
                            lat={loc?.latitude}
                            lon={loc?.longitude}
                            modelMmPerHourNow={(calculations.minutelyPreciseData?.[0] || 0) * 4}
                            forecastHours={calculations.chartData24h}
                            lang={flags.lang}
                            kind={radarPrecipKind}
                        />
                    </Suspense>
                    <Suspense fallback={null}>
                        <OfficialAlertBanner
                            lat={loc?.latitude}
                            lon={loc?.longitude}
                            lang={flags.lang}
                            timeZone={typeof weatherData.timezone === 'string' ? weatherData.timezone : undefined}
                            nowMs={nowMs}
                        />
                    </Suspense>
                </div>

                <div className="contents xl:flex xl:flex-col xl:gap-8 xl:[&>*:first-child]:flex-1">
                    <Suspense fallback={<SectionSkeleton />}>
                        <LiveAIInsights lang={flags.lang} />
                    </Suspense>

                    {/* Sense valors no hi ha element (al mòbil, un buit a la pila hi afegiria l'espai entre seccions). */}
                    {highlights.length > 0 && (
                        <div className="max-xl:order-last">
                            <HighlightsRow items={highlights} strings={t.tabs} onGoTo={onGoTo} onOpenPlanet={actions.setPlanetModal} />
                        </div>
                    )}
                </div>

                <div className="xl:col-span-3">
                    <Suspense fallback={<SectionSkeleton />}>
                        <Forecast24h data={weatherData} lang={flags.lang} unit={flags.unit} />
                    </Suspense>
                </div>
            </div>
        </>
    );
});

// --- Previsió: els 7 dies, els gràfics horaris i el model regional contra el global -------------------------------------------------
const ForecastPanel = memo(function ForecastPanel() {
    const { state, actions, flags } = useAppContext();
    const { weatherData, calculations } = state;
    // Totes les hores d'avui des de les 00 h (chartDataFull comença ara): la fila «Avui» de la setmana en treu la
    // màxima, la mínima i la icona de tot el dia, com la targeta principal i el detall del dia.
    const todayHours = useMemo(() => {
        const today = weatherData?.daily?.time?.[0];
        if (!weatherData || typeof today !== 'string') return undefined;
        return hoursOfDate(generateHourlyChartData(weatherData, 0, flags.unit), today.slice(0, 10));
    }, [weatherData, flags.unit]);
    if (!weatherData) return null;
    const regionalModelLabel = isRegionalModelActive(weatherData.current?.source) ? (weatherData.current.source as string) : null;

    return (
        <>
            {/* A partir de 1280 px: la setmana i els gràfics horaris un al costat de l'altre (6/12 cadascun) i el model
                regional contra el global a sota, a tota l'amplada. Els gràfics porten pestanyes a totes les amplades (una
                mètrica cada vegada); les dues targetes s'estiren fins a la més alta perquè les vores quadrin. Més estret,
                un sota l'altre en l'ordre de sempre: setmana, gràfics, comparació. */}
            <div className={`${STACK} xl:grid xl:grid-cols-12`}>
                <div className="xl:col-span-6 xl:[&>*]:h-full xl:[&>*>*:first-child]:flex-1">
                    <Suspense fallback={<SectionSkeleton />}>
                        <ForecastSection
                            chartData={calculations.chartDataFull || []}
                            dailyData={weatherData.daily}
                            dayHourCodes={calculations.dayHourCodes}
                            daySky={calculations.daySky}
                            todayHours={todayHours}
                            localNow={calculations.shiftedNow ?? state.now}
                            dailyComparison={weatherData.dailyComparison}
                            regionalModelLabel={regionalModelLabel}
                            lang={flags.lang}
                            onDayClick={actions.setSelectedDayIndex}
                            latitude={getSafeLatitude(weatherData.location)}
                        />
                    </Suspense>
                </div>

                <div className="xl:col-span-6 xl:[&>*]:h-full">
                    <Suspense fallback={<SectionSkeleton />}>
                        <SmartForecastCharts
                            data={calculations.chartSeries?.primary ?? []}
                            comparisonData={calculations.chartSeries?.comparison ?? null}
                            lang={flags.lang}
                            regionalModelLabel={regionalModelLabel}
                            nowIndex={findNowIndex(calculations.chartSeries?.primary ?? [], weatherData.current?.time)}
                            updatedAt={weatherData.offlineSnapshot?.issuedAt ?? weatherData.current?.time ?? null}
                        />
                    </Suspense>
                </div>

                <div className="xl:col-span-12">
                    <Suspense fallback={<SectionSkeleton />}>
                        <ConsensusSection weatherData={weatherData} lang={flags.lang} />
                    </Suspense>
                </div>
            </div>
        </>
    );
});

// Els props de la graella de ginys de Detall: els mateixos que rebia ExpertWidgets.
const useWidgetGridProps = () => {
    const { state, actions, flags } = useAppContext();
    const { calculations } = state;
    return {
        aqiData: state.aqiData,
        lang: flags.lang,
        unit: flags.unit,
        freezingLevel: calculations.currentFreezingLevel ?? null,
        chartDataFull: calculations.chartDataFull,
        effectiveCode: calculations.effectiveWeatherCode,
        onShowStormModal: () => actions.setShowStormModal(true),
        onShowAqiModal: () => actions.setShowAqiModal(true),
        onShowUvModal: () => actions.setShowUvModal(true),
        onShowPressureModal: () => actions.setShowPressureModal(true),
        onShowComfortModal: () => actions.setShowComfortModal(true),
        onShowVisibilityModal: () => actions.setShowVisibilityModal(true),
        onShowCloudLayersModal: () => actions.setShowCloudLayersModal(true),
        onShowSnowLevelModal: () => actions.setShowSnowLevelModal(true),
        onShowWindModal: () => actions.setShowWindModal(true),
        onShowTemperatureModal: () => actions.setShowTemperatureModal(true),
    };
};

// --- Detall: les condicions d'ara (temperatura, vent, UV, aire, visibilitat, núvols, pressió, rosada, CAPE, cota de neu) --
const DetailPanel = memo(function DetailPanel() {
    const { state } = useAppContext();
    const gridProps = useWidgetGridProps();
    if (!state.weatherData) return null;
    return (
        <Suspense fallback={<SectionSkeleton />}>
            <DetailWidgetsGrid weatherData={state.weatherData} ids={DETAIL_TAB_WIDGETS} className={DETAIL_GRID_CLASS} {...gridProps} />
        </Suspense>
    );
});

// --- Cel: el sol, aquesta nit i «Més enllà del teu cel» -----------------------------------------------------------------
const SkyPanel = memo(function SkyPanel() {
    const { state, actions, flags } = useAppContext();
    if (!state.weatherData) return null;
    return (
        <>
            <Suspense fallback={<SectionSkeleton />}>
                <SkySection
                    weatherData={state.weatherData}
                    daySky={state.calculations.daySky}
                    lang={flags.lang}
                    nowMs={state.now.getTime()}
                    onShowSolarModal={() => actions.setShowSolarModal(true)}
                    onShowMoonModal={() => actions.setShowMoonModal(true)}
                />
            </Suspense>
            <Suspense fallback={<SectionSkeleton />}>
                <PlanetExtremesCard lang={flags.lang} unit={flags.unit} nowMs={state.now.getTime()} onOpen={actions.setPlanetModal} />
            </Suspense>
        </>
    );
});

const Panel = ({ tab, onGoTo }: { tab: DashboardTab; onGoTo: (tab: DashboardTab) => void }): ReactNode => {
    switch (tab) {
        case 'now': return <NowPanel onGoTo={onGoTo} />;
        case 'forecast': return <ForecastPanel />;
        case 'detail': return <DetailPanel />;
        case 'sky': return <SkyPanel />;
    }
};

// Algun modal de l'app obert (els que viuen al context: radar, detall del dia, model HD, solar, lluna, ginys, planeta,
// compartir). Mentre n'hi ha, la barra queda inert: el modal la tapa, però amb el teclat s'hi podria arribar, i canviar
// de pestanya per sota tocaria l'historial amb l'entrada del modal a dalt.
const anyModalOpen = (modals: Record<string, unknown>): boolean =>
    typeof modals.selectedDayIndex === 'number'
    || !!modals.planetModal
    || Object.entries(modals).some(([key, value]) => key.startsWith('show') && value === true);

export const TabbedDashboard = () => {
    const { state, actions, t } = useAppContext();
    const modals = useModals();
    // La pestanya ve de la URL (?tab=…): un refresc o una versió nova (que recarrega) hi tornen. L'app instal·lada
    // i els enllaços compartits no en porten, així que s'obren a Ara.
    const [active, setActive] = useState<DashboardTab>(() => readTabFromSearch(window.location.search));
    // Ara sempre muntada, i la pestanya d'entrada si és una altra.
    const [mounted, setMounted] = useState<ReadonlySet<DashboardTab>>(() => new Set<DashboardTab>(['now', active]));
    const modalOpen = anyModalOpen(modals as unknown as Record<string, unknown>);
    // `select` arriba a Ara (els destacats): si depengués de modalOpen, obrir o tancar un modal canviaria el prop i
    // tornaria a renderitzar tot el panell. Es llegeix d'una ref i `select` no canvia mai.
    const modalOpenRef = useRef(modalOpen);
    useLayoutEffect(() => {
        modalOpenRef.current = modalOpen;
    }, [modalOpen]);

    // Un lloc nou (cercador, favorit, GPS) s'obre a Ara: a les altres pestanyes no hi ha la targeta principal i no se
    // sabria de quin lloc són les dades. Un refresc del mateix lloc no hi compta.
    const loc = state.weatherData?.location as LocationMeta | undefined;
    const placeKey = loc ? `${loc.latitude},${loc.longitude}` : '';
    const [shownPlace, setShownPlace] = useState(placeKey);
    if (placeKey !== shownPlace) {
        setShownPlace(placeKey);
        setActive('now');
    }

    const show = useCallback((tab: DashboardTab) => {
        setActive(tab);
        setMounted((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
    }, []);

    // L'usuari tria una pestanya (barra, fletxes o un destacat).
    const select = useCallback((tab: DashboardTab) => {
        if (modalOpenRef.current) return;
        // Sortint d'Ara, l'única entrada d'historial de les pestanyes (vegeu tabHistory.ts); la resta, a l'efecte de sota.
        pushTabEntryIfNeeded(tab);
        show(tab);
        // Cada pestanya comença a dalt. scrollTo(0, 0) és immediat (l'app no té scroll-behavior: smooth).
        window.scrollTo(0, 0);
    }, [show]);

    // La URL segueix la pestanya, sempre reescrivint l'entrada actual (mai n'afegeix cap): entre pestanyes, tornant a Ara
    // amb la barra o amb un lloc nou. Després d'un enrere ja hi coincideix i no fa res.
    useEffect(() => {
        replaceTabInUrl(active);
    }, [active]);

    // Enrere i endavant del navegador: la pestanya és la que diu la URL de l'entrada on s'aterra. Tancar un modal
    // aterra en una entrada amb la mateixa pestanya (els modals hi posen la URL del moment): no canvia res.
    useEffect(() => {
        const onPopState = () => show(readTabFromSearch(window.location.search));
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [show]);

    // En sortir del tauler (botó Inici, un error), la URL perd la pestanya: un lloc nou s'ha d'obrir a Ara.
    useEffect(() => () => replaceTabInUrl('now'), []);

    // I un cop el panell nou ja és al DOM (abans de pintar), per si el canvi de contingut ha mogut l'scroll. No en
    // obrir el tauler: allà mana el navegador (en recarregar, torna on eres).
    // (Es compara amb la pestanya anterior i no amb un "primer cop": React.StrictMode torna a executar l'efecte.)
    const lastTabRef = useRef(active);
    useLayoutEffect(() => {
        if (lastTabRef.current === active) return;
        lastTabRef.current = active;
        window.scrollTo(0, 0);
    }, [active]);

    // A partir de 1024 px la barra va a dalt (enganxada); més estret, fixa a baix. Una sola barra alhora (ids únics).
    const isDesktop = useMinWidth('(min-width: 1024px)');
    // Al mòbil, mentre s'escriu al cercador, la barra de baix s'amaga (el teclat la faria pujar damunt dels resultats).
    const typing = useTextFieldFocus(!isDesktop);
    const tabBar = (
        <TabBar
            active={active}
            mounted={mounted}
            onSelect={select}
            onRadar={() => actions.setShowRadar(true)}
            strings={t.tabs}
            placement={isDesktop ? 'top' : 'bottom'}
            inert={modalOpen}
            concealed={typing}
        />
    );

    return (
        <div className="relative z-10 w-full max-w-7xl mx-auto">
            {isDesktop && tabBar}
            {DASHBOARD_TABS.filter((tab) => mounted.has(tab)).map((tab) => {
                const isActive = tab === active;
                return (
                    <section
                        key={tab}
                        id={panelElementId(tab)}
                        role="tabpanel"
                        aria-labelledby={tabElementId(tab)}
                        hidden={!isActive}
                        // `hidden` sol no n'hi ha prou: la classe `flex` guanyaria el display:none del navegador.
                        className={isActive ? 'flex flex-col gap-6 sm:gap-8' : 'hidden'}
                    >
                        {/* Sense la targeta principal, de quin lloc són les dades (el nom i l'hora de la targeta). */}
                        {tab !== 'now' && <PanelPlaceLine name={loc?.name} localTime={state.calculations.shiftedNow ?? state.now} />}
                        <ErrorBoundary><Panel tab={tab} onGoTo={select} /></ErrorBoundary>
                    </section>
                );
            })}
            {!isDesktop && tabBar}
        </div>
    );
};
