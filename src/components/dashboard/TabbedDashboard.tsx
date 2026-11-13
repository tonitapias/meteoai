// src/components/dashboard/TabbedDashboard.tsx
// El tauler per pestanyes (de moment amb ?ui=tabs; la vista d'avui és DashboardContent): Ara · Previsió · Detall · Cel,
// i el Radar a la barra. Només composició: els ginys, els seus props i els modals són els de sempre.
//
// Muntatge (vegeu la proposta): Ara es munta d'entrada i ja no es desmunta (els avisos d'alerta oficial i de radar
// fan les seves pròpies peticions en muntar-se); la resta es munta la primera vegada que s'obre i després es queda
// muntada però amagada (el consens no té memòria cau: tornar-lo a muntar tornaria a demanar el model global). Mai
// hi ha més coses muntades que a la vista completa d'avui.
//
// Historial (vegeu tabs/tabHistory.ts): la pestanya va a la URL (?tab=…) i sortir d'Ara n'afegeix una sola entrada,
// de manera que l'enrere des de Previsió, Detall o Cel torna a Ara i, des d'Ara, surt com sempre. Els modals no hi
// noten res: el seu enrere i la seva Esc continuen tancant-los i la pestanya no canvia.
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAppContext } from '../../context/AppContext';
import { usePlanetHeadline } from '../../hooks/usePlanetHeadline';
import { buildDetailTeaser } from '../../utils/detailTeaser';
import { getSafeLatitude } from '../../utils/weatherMath';
import { findNowIndex } from '../../utils/hourlyChartSeries';
import { isRegionalModelActive } from '../../constants/regionalModels';
import type { LocationMeta } from '../../types/weatherLogicTypes';
import CurrentWeather from '../CurrentWeather';
import ErrorBoundary from '../ErrorBoundary';
import OfflineSnapshotBanner from '../OfflineSnapshotBanner';
import { MinutelyPreciseChart } from '../WeatherCharts';
import TabBar from '../tabs/TabBar';
import { useMinWidth } from '../solar/useMinWidth';
import { DASHBOARD_TABS, DETAIL_TAB_WIDGETS, SKY_TAB_WIDGETS, panelElementId, tabElementId, type DashboardTab } from '../tabs/dashboardTabs';
import { pushTabEntryIfNeeded, readTabFromSearch, replaceTabInUrl } from '../tabs/tabHistory';
import { useTextFieldFocus } from '../tabs/useTextFieldFocus';
import { SectionSkeleton } from './SectionSkeleton';
import { HighlightsRow } from './HighlightsRow';
import { PanelPlaceLine } from './PanelPlaceLine';

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
const PlanetExtremesCard = lazy(() => import('../planet/PlanetExtremesCard'));

// Detall: 1 columna al mòbil, 2 a tauleta, 3 a escriptori (els 9 ginys omplen tres files; la cota de neu, a sota).
const DETAIL_GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 grid-flow-dense';
// Cel: el cicle solar (doble) i la lluna en una sola fila a escriptori.
const SKY_GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 grid-flow-dense';
// La pila de cada columna, amb el mateix espai que entre seccions.
const STACK = 'flex flex-col gap-6 sm:gap-8';

// --- Ara: la targeta principal, els avisos (només si n'hi ha), l'anàlisi, les pròximes 24 hores i els destacats -----
const NowPanel = ({ onGoTo }: { onGoTo: (tab: DashboardTab) => void }) => {
    const { state, actions, flags, t } = useAppContext();
    const { weatherData, calculations } = state;
    const current = weatherData?.current;
    // El fenomen gros del dia a «Extrems del planeta» (si n'hi ha): la mateixa petició diferida de la vista essencial.
    const planetHeadline = usePlanetHeadline(!!current, flags.lang);
    const nowMs = state.now.getTime();
    // Els destacats: els mateixos valors que «Vols més detall?» (vegeu DashboardContent i utils/detailTeaser.ts).
    const highlights = useMemo(() => {
        if (!current) return [];
        return buildDetailTeaser({
            current,
            aqiCurrent: (state.aqiData as Record<string, unknown> | null)?.current,
            effectiveCode: calculations.effectiveWeatherCode,
            nowMs,
            lang: flags.lang,
            templates: t.viewModes,
            planet: planetHeadline,
        });
    }, [current, state.aqiData, calculations.effectiveWeatherCode, nowMs, flags.lang, t.viewModes, planetHeadline]);

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

            {/* A partir de 1280 px: la targeta principal (2/3) i, al costat (1/3), els avisos i l'anàlisi i, a baix de tot,
                els destacats; a sota, les 24 hores a tota l'amplada. Les dues columnes fan la mateixa alçada: la fila 1fr
                s'estira i l'anàlisi (ja preparada per omplir l'alçada) l'omple; si la columna de la dreta és la més alta
                (amb avisos), és la targeta principal la que s'estira. Més estret, una sola columna en l'ordre de sempre:
                targeta, avisos, anàlisi, 24 hores, destacats. */}
            <div className={`${STACK} xl:grid xl:grid-cols-3 xl:grid-rows-[1fr_auto_auto]`}>
                <div className="xl:col-span-2 xl:row-span-2 xl:[&>*]:h-full xl:[&>*>*]:h-full">
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

                <div className={`${STACK} xl:[&>*:last-child]:flex-1`}>
                    {/* Pluja la pròxima hora (porta la seva targeta: sense pluja no pinta res) */}
                    <MinutelyPreciseChart
                        data={calculations.minutelyPreciseData}
                        label={t.preciseRain || "SCAN PRECIPITACIÓ (1H)"}
                        lang={flags.lang}
                        currentPrecip={calculations.chartData24h?.[0]?.precip || 0}
                    />

                    {/* Els avisos, en el mateix ordre que a la vista d'avui: llamps, nowcast, realitat del radar, alerta oficial */}
                    <Suspense fallback={null}>
                        <LightningBanner lightning={state.lightning} lang={flags.lang} now={state.now.getTime()} onShowRadar={() => actions.setShowRadar(true)} />
                    </Suspense>
                    <Suspense fallback={null}>
                        <RadarNowcastBanner lat={loc?.latitude} lon={loc?.longitude} lang={flags.lang} />
                    </Suspense>
                    <Suspense fallback={null}>
                        <RadarRealityBanner
                            lat={loc?.latitude}
                            lon={loc?.longitude}
                            modelMmPerHourNow={(calculations.minutelyPreciseData?.[0] || 0) * 4}
                            lang={flags.lang}
                        />
                    </Suspense>
                    <Suspense fallback={null}>
                        <OfficialAlertBanner lat={loc?.latitude} lon={loc?.longitude} lang={flags.lang} />
                    </Suspense>

                    <Suspense fallback={<SectionSkeleton />}>
                        <AIInsights analysis={state.aiAnalysis} lang={flags.lang} />
                    </Suspense>
                </div>

                <div className="xl:col-span-3 xl:row-start-3">
                    <Suspense fallback={<SectionSkeleton />}>
                        <Forecast24h data={weatherData} lang={flags.lang} unit={flags.unit} />
                    </Suspense>
                </div>

                {/* Sense valors no hi ha element (al mòbil, un buit a la pila hi afegiria l'espai entre seccions). */}
                {highlights.length > 0 && (
                    <div className="xl:col-start-3 xl:row-start-2 xl:self-end">
                        <HighlightsRow items={highlights} strings={t.tabs} onGoTo={onGoTo} onOpenPlanet={actions.setPlanetModal} />
                    </div>
                )}
            </div>
        </>
    );
};

// --- Previsió: els 7 dies, els gràfics horaris i el motor de consens -------------------------------------------------
const ForecastPanel = () => {
    const { state, actions, flags } = useAppContext();
    const { weatherData, calculations } = state;
    // A partir de 1280 px els gràfics van al costat dels 7 dies, amb pestanyes (una mètrica cada vegada).
    const isWide = useMinWidth('(min-width: 1280px)');
    if (!weatherData) return null;
    const regionalModelLabel = isRegionalModelActive(weatherData.current?.source) ? (weatherData.current.source as string) : null;

    return (
        <>
            {/* A partir de 1280 px: els 7 dies i els gràfics horaris un al costat de l'altre (6/12 cadascun) i el motor de
                consens a sota, a tota l'amplada. Els gràfics, amb pestanyes com al mòbil (en lloc de les quatre mètriques
                una sota l'altra, uns 2.100 px), fan gairebé la mateixa alçada que els dies; les dues targetes s'estiren fins
                a la més alta perquè les vores quadrin. Més estret, un sota l'altre en l'ordre de sempre: dies, gràfics, consens. */}
            <div className={`${STACK} xl:grid xl:grid-cols-12`}>
                <div className="xl:col-span-6 xl:[&>*]:h-full xl:[&>*>*:first-child]:flex-1">
                    <Suspense fallback={<SectionSkeleton />}>
                        <ForecastSection
                            chartData={calculations.chartDataFull || []}
                            dailyData={weatherData.daily}
                            dayHourCodes={calculations.dayHourCodes}
                            dailyComparison={weatherData.dailyComparison}
                            regionalModelLabel={regionalModelLabel}
                            weeklyExtremes={calculations.weeklyExtremes}
                            lang={flags.lang}
                            onDayClick={actions.setSelectedDayIndex}
                            latitude={getSafeLatitude(weatherData.location)}
                        />
                    </Suspense>
                </div>

                <div className="xl:col-span-6 bento-card p-4 sm:p-6 md:p-8 bg-[#0B0C15]/90 border border-white/10 shadow-2xl">
                    <Suspense fallback={<SectionSkeleton />}>
                        <SmartForecastCharts
                            data={calculations.chartSeries?.primary ?? []}
                            comparisonData={calculations.chartSeries?.comparison ?? null}
                            unit={flags.unit === 'F' ? '°F' : '°C'}
                            lang={flags.lang}
                            regionalModelLabel={regionalModelLabel}
                            nowIndex={findNowIndex(calculations.chartSeries?.primary ?? [], weatherData.current?.time)}
                            updatedAt={weatherData.offlineSnapshot?.issuedAt ?? weatherData.current?.time ?? null}
                            layout={isWide ? 'tabs' : 'responsive'}
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
};

// Els props comuns de la graella de ginys (Detall i Cel): els mateixos que rebia ExpertWidgets.
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
        now: state.now.getTime(),
        onShowSolarModal: () => actions.setShowSolarModal(true),
        onShowMoonModal: () => actions.setShowMoonModal(true),
        onShowStormModal: () => actions.setShowStormModal(true),
        onShowAqiModal: () => actions.setShowAqiModal(true),
        onShowUvModal: () => actions.setShowUvModal(true),
        onShowPressureModal: () => actions.setShowPressureModal(true),
        onShowComfortModal: () => actions.setShowComfortModal(true),
        onShowVisibilityModal: () => actions.setShowVisibilityModal(true),
        onShowCloudLayersModal: () => actions.setShowCloudLayersModal(true),
        onShowSnowLevelModal: () => actions.setShowSnowLevelModal(true),
        onShowWindModal: () => actions.setShowWindModal(true),
    };
};

// --- Detall: les condicions d'ara (vent, UV, aire, visibilitat, núvols, pressió, rosada, CAPE, cota de neu) --------
const DetailPanel = () => {
    const { state } = useAppContext();
    const gridProps = useWidgetGridProps();
    if (!state.weatherData) return null;
    return (
        <Suspense fallback={<SectionSkeleton />}>
            <DetailWidgetsGrid weatherData={state.weatherData} ids={DETAIL_TAB_WIDGETS} className={DETAIL_GRID_CLASS} {...gridProps} />
        </Suspense>
    );
};

// --- Cel: el cicle solar, la lluna i «Més enllà del teu cel» ----------------------------------------------------------
const SkyPanel = () => {
    const { state, actions, flags } = useAppContext();
    const gridProps = useWidgetGridProps();
    if (!state.weatherData) return null;
    return (
        <>
            <Suspense fallback={<SectionSkeleton />}>
                <DetailWidgetsGrid weatherData={state.weatherData} ids={SKY_TAB_WIDGETS} className={SKY_GRID_CLASS} {...gridProps} />
            </Suspense>
            <Suspense fallback={<SectionSkeleton />}>
                <PlanetExtremesCard lang={flags.lang} unit={flags.unit} nowMs={state.now.getTime()} onOpen={actions.setPlanetModal} />
            </Suspense>
        </>
    );
};

const PANELS: Record<DashboardTab, (goTo: (tab: DashboardTab) => void) => ReactNode> = {
    now: (goTo) => <NowPanel onGoTo={goTo} />,
    forecast: () => <ForecastPanel />,
    detail: () => <DetailPanel />,
    sky: () => <SkyPanel />,
};

// Algun modal de l'app obert (els que viuen al context: radar, detall del dia, model HD, solar, lluna, ginys, planeta,
// compartir). Mentre n'hi ha, la barra queda inert: el modal la tapa, però amb el teclat s'hi podria arribar, i canviar
// de pestanya per sota tocaria l'historial amb l'entrada del modal a dalt.
const anyModalOpen = (modals: Record<string, unknown>): boolean =>
    typeof modals.selectedDayIndex === 'number'
    || !!modals.planetModal
    || Object.entries(modals).some(([key, value]) => key.startsWith('show') && value === true);

export const TabbedDashboard = () => {
    const { state, actions, modals, t } = useAppContext();
    // La pestanya ve de la URL (?tab=…): un refresc o l'avís d'actualització (que recarrega) hi tornen. L'app instal·lada
    // i els enllaços compartits no en porten, així que s'obren a Ara.
    const [active, setActive] = useState<DashboardTab>(() => readTabFromSearch(window.location.search));
    // Ara sempre muntada, i la pestanya d'entrada si és una altra.
    const [mounted, setMounted] = useState<ReadonlySet<DashboardTab>>(() => new Set<DashboardTab>(['now', active]));
    const modalOpen = anyModalOpen((modals ?? {}) as unknown as Record<string, unknown>);

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
        if (modalOpen) return;
        // Sortint d'Ara, l'única entrada d'historial de les pestanyes (vegeu tabHistory.ts); la resta, a l'efecte de sota.
        pushTabEntryIfNeeded(tab);
        show(tab);
        // Cada pestanya comença a dalt. scrollTo(0, 0) és immediat (l'app no té scroll-behavior: smooth).
        window.scrollTo(0, 0);
    }, [modalOpen, show]);

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
                        <ErrorBoundary>{PANELS[tab](select)}</ErrorBoundary>
                    </section>
                );
            })}
            {!isDesktop && tabBar}
        </div>
    );
};
