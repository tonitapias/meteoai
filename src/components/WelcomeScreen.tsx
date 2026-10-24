// src/components/WelcomeScreen.tsx
// Benvinguda: igual per a tothom i sense cap consulta de dades. Només canvia amb l'hora i el lloc del
// dispositiu (la columna del cel i el color del fons). "Utilitza la meva ubicació" amb un sol toc, el
// cercador i els favorits a la mateixa zona, i errors d'ubicació explicats a sota del botó, que no es queda
// mai bloquejat. Sense blur, filtres ni animacions contínues (mòbils modestos).
import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { ChevronDown, HelpCircle, Navigation } from 'lucide-react';
import { Language, TranslationType } from '../translations';
import { APP_VERSION } from '../utils/appVersion';
import type { LocateResult } from '../hooks/useAppActions';
import type { LocationData } from '../hooks/usePreferences';
import { useGeoPermission } from '../hooks/welcome/useGeoPermission';
import type { WelcomeSky } from '../utils/welcome/welcomeSky';
import { welcomeEyebrow } from '../utils/welcome/welcomeEyebrow';
import WelcomeSearch from './welcome/WelcomeSearch';
import { StarfieldBackdrop } from './StarfieldBackdrop';
import { useMinWidth } from './solar/useMinWidth';

// Carregat de manera diferida: és un modal que la immensa majoria de visites mai obren, però
// abans s'importava estàticament i inflava el bundle crític que bloqueja el primer pintat (LCP)
// de la pantalla de benvinguda — confirmat per Lighthouse.
const HowItWorksModal = lazy(() => import('./HowItWorksModal'));
// El cel (suncalc, colors del modal Solar, fase lunar) i la columna, després del primer pintat: amb ells al
// paquet inicial creixia ~25 KB comprimits, perquè fins ara només els carregaven els ginys diferits del tauler.
const SkyScene = lazy(() => import('./welcome/SkyScene'));
// Del mateix tros: quan hi ha lluna a la línia de dalt, el cel (i doncs aquest codi) ja ha arribat.
const EyebrowMoon = lazy(() => import('./welcome/SkyScene').then(m => ({ default: m.EyebrowMoon })));

interface WelcomeScreenProps {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationType;
  onLocate: () => Promise<LocateResult>;
  onSelectLocation: (lat: number, lon: number, name: string, country?: string) => void;
  favorites: LocationData[];
  loading: boolean;
  /** 5 tocs seguits a la marca: panell de depuració (com el títol de la capçalera). */
  onDebugToggle?: () => void;
}

type LocateStatus = 'idle' | 'locating' | 'error';
type FailReason = Extract<LocateResult, { ok: false }>['reason'];

const LANGS: readonly Language[] = ['ca', 'es', 'en', 'fr'];
// Al selector del mòbil, cada idioma amb el seu nom (el selector nadiu mostra tancat el text de l'opció).
const LANG_NAMES: Readonly<Record<Language, string>> = { ca: 'Català', es: 'Español', en: 'English', fr: 'Français' };
const LOCALE: Readonly<Record<Language, string>> = { ca: 'ca-ES', es: 'es-ES', en: 'en-US', fr: 'fr-FR' };
/** A partir d'aquí es diu a l'usuari que pot cercar el lloc mentre el GPS encara busca. */
const SLOW_LOCATE_MS = 5000;
/** Després d'això el botó torna a l'estat normal amb l'avís de "massa espera" (la petició pot acabar després). */
const LOCATE_GIVE_UP_MS = 30000;

export default function WelcomeScreen({ lang, setLang, t, onLocate, onSelectLocation, favorites, loading, onDebugToggle }: WelcomeScreenProps) {
  const w = t.welcome;
  const permission = useGeoPermission();
  // Arriba quan s'ha carregat SkyScene; fins llavors, fons fosc neutre i la línia de dalt sense el moment del dia.
  const [skyState, setSkyState] = useState<{ sky: WelcomeSky; now: Date } | null>(null);
  const handleSky = useCallback((sky: WelcomeSky, now: Date) => setSkyState({ sky, now }), []);
  const [mountedAt] = useState(() => new Date());
  const sky = skyState?.sky ?? null;
  const now = skyState?.now ?? mountedAt;

  const [status, setStatus] = useState<LocateStatus>('idle');
  const [failReason, setFailReason] = useState<FailReason | null>(null);
  const [slow, setSlow] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleLocate = useCallback(async () => {
    if (status === 'locating' || loading) return;
    setStatus('locating');
    setFailReason(null);
    setSlow(false);
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_LOCATE_MS);
    // El 'timeout' de la geolocalització no compta mentre el navegador espera que l'usuari respongui
    // l'avís de permís: si el deixa sense respondre, el botó no es pot quedar buscant per sempre.
    let giveUpTimer = 0;
    const giveUp = new Promise<LocateResult>(resolve => {
      giveUpTimer = window.setTimeout(() => resolve({ ok: false, reason: 'timeout' }), LOCATE_GIVE_UP_MS);
    });
    const result = await Promise.race([onLocate(), giveUp]);
    window.clearTimeout(slowTimer);
    window.clearTimeout(giveUpTimer);
    // Si ha anat bé, l'app ja passa al tauler i aquest component es desmunta.
    if (!mountedRef.current || result.ok) return;
    setStatus('error');
    setFailReason(result.reason);
    setSlow(false);
  }, [status, loading, onLocate]);

  // --- Modal "Com funciona" amb entrada d'historial (el botó enrere el tanca) ---
  const [showHelp, setShowHelp] = useState(false);
  // Ref pròpia per saber si tenim una entrada d'historial pendent de consumir,
  // en comptes de llegir window.history.state (mutable i compartit amb la resta
  // de l'app: si alguna altra part fes push/replace mentre el modal està obert,
  // window.history.state?.modal podria deixar de coincidir i l'entrada nostra
  // quedaria òrfena a la pila sense que closeHelpModal la consumís).
  const helpHistoryPushedRef = useRef(false);
  const closeHelpModal = useCallback(() => {
    if (helpHistoryPushedRef.current) {
      helpHistoryPushedRef.current = false;
      window.history.back();
    } else {
      setShowHelp(false);
    }
  }, []);
  const openHelpModal = () => {
    window.history.pushState({ modal: 'meteo_how_it_works' }, '');
    helpHistoryPushedRef.current = true;
    setShowHelp(true);
  };
  useEffect(() => {
    const handlePopState = () => {
      helpHistoryPushedRef.current = false;
      setShowHelp(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- Mode depuració: 5 tocs seguits a la marca ---
  const debugClicksRef = useRef({ count: 0, timer: 0 });
  const handleBrandClick = () => {
    if (!onDebugToggle) return;
    const d = debugClicksRef.current;
    window.clearTimeout(d.timer);
    d.count += 1;
    if (d.count >= 5) { d.count = 0; onDebugToggle(); return; }
    d.timer = window.setTimeout(() => { d.count = 0; }, 2000);
  };

  const eyebrow = useMemo(() => welcomeEyebrow(sky, now, LOCALE[lang] ?? 'ca-ES', w), [lang, now, sky, w]);

  const denied = permission === 'denied';
  const supported = permission !== 'unsupported';
  const locating = status === 'locating';
  const searchFirst = denied || !supported || (status === 'error' && (failReason === 'denied' || failReason === 'unsupported'));

  let statusText = '';
  if (locating) statusText = slow ? w.locatingSlow : (permission === 'granted' ? '' : w.permissionHint);
  else if (status === 'error') {
    statusText = failReason === 'denied' || failReason === 'unsupported' ? w.errorDenied
      : failReason === 'timeout' ? w.errorTimeout : w.errorUnavailable;
  }

  const columnLabels = {
    high: w.cloudsHigh, mid: w.cloudsMid, low: w.cloudsLow,
    east: w.cardinalEast, west: w.cardinalWest, north: w.cardinalNorth, south: w.cardinalSouth,
    caption: w.columnCaption, alt: w.columnAlt,
  };
  const columnLabelsShort = { ...columnLabels, high: w.cloudsHighShort, mid: w.cloudsMidShort, low: w.cloudsLowShort, caption: w.columnCaptionShort };
  // Una sola columna (no una per mida amagada amb CSS): és l'element més pesant de la pantalla.
  const wide = useMinWidth('(min-width: 1024px)');

  // overflow-x: clip i no hidden: hidden converteix el contenidor en una capsa amb desplaçament propi i la
  // llista del cercador, que en sobresurt, s'havia de desplaçar per dins (hidden queda per als navegadors antics).
  return (
    <div className={`relative w-full min-h-screen overflow-x-hidden supports-[overflow:clip]:overflow-x-clip bg-[#0c0f17] text-slate-100 antialiased flex flex-col ${showHelp ? 'overflow-hidden' : ''}`}>
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none transition-opacity duration-700 motion-reduce:transition-none"
        style={sky
          ? { opacity: 1, background: `linear-gradient(180deg, ${sky.colors.top} 0%, ${sky.colors.mid} 46%, ${sky.colors.bottom} 100%)` }
          : { opacity: 0 }}
      />
      {/* Estrelles només de nit: a l'alba i a la posta (sol a menys de 6° sota l'horitzó) gairebé no se'n veuen. */}
      {sky?.phase === 'nit' && (
        <StarfieldBackdrop density={70} tint="#dbe4ff" className="bottom-[40%] opacity-80" />
      )}

      <header className="relative z-10 mx-auto w-full max-w-[1440px] px-4 min-[360px]:px-5 sm:px-8 lg:px-16 pt-4 sm:pt-7 flex items-center justify-between gap-3">
        {/* La marca, amb la mateixa icona que l'app instal·lada i la capçalera del tauler. Als mòbils de 320 px,
            una mica més petita perquè no toqui el botó d'ajuda. */}
        <div className="flex shrink-0 items-center gap-2 min-[360px]:gap-2.5 sm:gap-3 select-none" onClick={handleBrandClick}>
          <img
            src={`${import.meta.env.BASE_URL}android-chrome-192x192.png`}
            alt=""
            width={192}
            height={192}
            decoding="async"
            className="w-8 h-8 min-[360px]:w-9 min-[360px]:h-9 sm:w-11 sm:h-11 lg:w-12 lg:h-12 shrink-0 rounded-[22%]"
          />
          <span className="flex items-center text-[20px] min-[360px]:text-[23px] sm:text-[28px] lg:text-[32px] font-bold tracking-[-0.015em] leading-none whitespace-nowrap">
            MeteoToni
            <span className="ml-1.5 sm:ml-2 rounded-[0.3em] border-[1.5px] sm:border-2 border-slate-100/80 px-[0.28em] pt-[0.16em] pb-[0.1em] text-[10px] min-[360px]:text-[11px] sm:text-[13px] lg:text-[14.5px] tracking-[0.08em]">AI</span>
          </span>
        </div>
        <nav aria-label={w.language} className="flex items-center gap-1 sm:gap-3">
          <button
            type="button"
            onClick={openHelpModal}
            aria-label={w.help}
            className="h-11 min-w-[44px] rounded-xl px-2.5 sm:px-3.5 flex items-center justify-center text-sm font-medium text-slate-200 hover:text-white hover:bg-white/5 transition-colors"
          >
            <HelpCircle className="w-[22px] h-[22px] sm:hidden" aria-hidden="true" />
            <span className="hidden sm:inline">{w.help}</span>
          </button>
          {/* Mòbil: el selector nadiu del sistema (els quatre botons no hi caben al costat de la marca). Tancat
              només ensenya el codi (CA, FR...): el nom sencer no hi cabia amb la marca gran; obert, la llista
              del sistema amb els noms. El selector, transparent, és a sobre i rep els tocs i el teclat. */}
          <label className={`relative sm:hidden flex h-11 items-center rounded-xl border border-slate-200/25 pl-3 pr-7 text-[13px] font-semibold uppercase text-slate-100 focus-within:border-sky-300 ${loading ? 'opacity-50' : ''}`}>
            <span className="sr-only">{w.language}</span>
            <span aria-hidden="true">{lang}</span>
            <select
              value={lang}
              disabled={loading}
              onChange={(e) => setLang(e.target.value as Language)}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
            >
              {LANGS.map(l => <option key={l} value={l} className="bg-[#0c0f17] text-slate-100">{LANG_NAMES[l]}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" aria-hidden="true" />
          </label>
          <div role="group" aria-label={w.language} className="hidden sm:flex rounded-xl border border-slate-200/25 overflow-hidden">
            {LANGS.map(l => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                disabled={loading}
                onClick={() => setLang(l)}
                className={`w-10 sm:w-11 h-11 text-[13px] font-semibold uppercase transition-colors disabled:opacity-50 ${lang === l ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* z-20, per sobre del peu (z-10): la llista del cercador hi passa per damunt quan s'obre cap avall. */}
      <main className="relative z-20 mx-auto w-full max-w-[1440px] flex-1 px-4 min-[360px]:px-5 sm:px-8 lg:px-16 pb-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 sm:gap-6 lg:gap-10">
        <div className="order-1 lg:order-2 mx-auto lg:mx-0 w-full shrink-0 max-w-[min(340px,40vh)] sm:max-w-[min(440px,46vh)] lg:max-w-[min(600px,calc(100vh_-_230px),44vw)]">
          <div className="relative w-full pt-[100%]">
            <div className="absolute inset-0">
              <Suspense fallback={null}>
                <SkyScene permission={permission} labels={wide ? columnLabels : columnLabelsShort} compact={!wide} onSky={handleSky} />
              </Suspense>
            </div>
          </div>
        </div>

        <section className="order-2 lg:order-1 w-full lg:max-w-[540px] flex flex-col gap-3 sm:gap-4 lg:py-8">
          <p className="text-[13px] sm:text-sm text-slate-300">
            {eyebrow.head}
            {eyebrow.moment && <> · {eyebrow.moon && sky && (
              <Suspense fallback={null}><EyebrowMoon phase={sky.moon.phase} south={sky.south} /></Suspense>
            )}{eyebrow.moment}</>}
          </p>
          <h1 className="text-[30px] leading-[1.06] sm:text-5xl lg:text-[clamp(40px,4vw,58px)] lg:leading-[1.03] font-semibold tracking-[-0.025em] text-balance">
            {w.headline}
          </h1>
          <p className="text-[15px] sm:text-lg leading-relaxed text-slate-200/90 text-pretty max-w-[34rem] max-lg:[@media(max-height:700px)]:hidden">
            {w.subtitle}
          </p>

          <div className="mt-2 sm:mt-5 flex flex-col gap-3 sm:max-w-[30rem]">
            {supported && (
              <button
                type="button"
                onClick={handleLocate}
                disabled={locating || loading}
                aria-busy={locating}
                className={`h-14 w-full rounded-2xl px-5 flex items-center justify-center gap-3 text-base font-semibold transition-colors disabled:cursor-wait ${searchFirst
                  ? 'border border-[#566079] text-slate-200 hover:border-slate-300 hover:text-white'
                  : 'bg-slate-100 text-slate-900 hover:bg-white shadow-[0_12px_32px_-14px_rgba(0,0,0,0.7)]'}`}
              >
                {locating ? (
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px] animate-spin motion-reduce:animate-none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity={0.2} strokeWidth={2.5} />
                    <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
                  </svg>
                ) : (
                  <Navigation className="w-5 h-5 fill-current" aria-hidden="true" />
                )}
                <span>{locating ? w.locating : denied ? w.locationOff : w.locate}</span>
              </button>
            )}
            {statusText && (
              <p role={status === 'error' ? 'alert' : 'status'} className={`text-sm leading-snug ${status === 'error' ? 'text-amber-200' : 'text-slate-300'}`}>
                {statusText}
              </p>
            )}
            <WelcomeSearch
              labels={{ placeholder: w.searchPlaceholder, searching: w.searching, noResults: w.noResults, favorites: w.favorites, moreFavorites: w.moreFavorites }}
              favorites={favorites}
              disabled={loading}
              emphasized={searchFirst}
              onSelect={onSelectLocation}
            />
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-[1440px] px-4 min-[360px]:px-5 sm:px-8 lg:px-16 py-4 flex flex-wrap justify-between gap-x-6 gap-y-1 text-xs text-slate-400">
        <span>{w.dataCredit}</span>
        <span className="font-mono">v{APP_VERSION}</span>
      </footer>

      {showHelp && (
        <Suspense fallback={null}>
          <div className="absolute z-[99999]">
            <HowItWorksModal onClose={closeHelpModal} t={t} />
          </div>
        </Suspense>
      )}
    </div>
  );
}
