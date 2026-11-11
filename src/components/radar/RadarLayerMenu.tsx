import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import {
  Layers,
  X as CloseIcon,
  Moon,
  Camera,
  CloudRain,
  Type as TypeIcon,
  Flame,
  Mountain,
  Zap,
  MapPin
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  BaseLayerType,
  BaseLayerConfig,
  Overlays,
  CloudSource,
  HdAgency,
  OverlayToggleKey
} from '../../utils/radarPhysics';
import { countActiveLayers } from '../../utils/radarLayerPrefs';

// Menú de capes del radar, en quatre blocs que caben sense scroll: mapa de
// fons, temps ara (pluja i llamps), núvols (un sol selector, perquè l'IR
// global i els satèl·lits HD són excloents) i més capes. A mòbil és un full
// que puja des de baix i deixa el mapa visible a dalt; a partir de `sm`, un
// panell sota el botó. Sense desenfocaments ni filtres: va damunt d'un mapa
// WebGL animat i ha d'anar fluid en mòbils modestos.

interface RadarLayerMenuProps {
  showLayerMenu: boolean;
  setShowLayerMenu: (show: boolean) => void;
  activeBaseLayer: BaseLayerType;
  setActiveBaseLayer: (layer: BaseLayerType) => void;
  overlays: Overlays;
  toggleOverlay: (key: OverlayToggleKey) => void;
  cloudSource: CloudSource;
  setCloudSource: (source: CloudSource) => void;
  // Satèl·lit HD que cobreix la ubicació consultada (hdAgencyForPoint).
  homeHdAgency: HdAgency;
  baseLayers: Record<BaseLayerType, BaseLayerConfig>;
}

type Accent = 'cyan' | 'amber' | 'indigo' | 'orange' | 'emerald';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80';
const IDLE = 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08] hover:text-white';
const SELECTED = 'bg-cyan-500/15 border-cyan-400/60 text-cyan-50';

const ACCENT_ON: Record<Accent, string> = {
  cyan: 'bg-cyan-500/15 border-cyan-400/60 text-cyan-50',
  amber: 'bg-amber-500/15 border-amber-400/60 text-amber-50',
  indigo: 'bg-indigo-500/20 border-indigo-400/60 text-indigo-50',
  orange: 'bg-orange-500/15 border-orange-400/60 text-orange-50',
  emerald: 'bg-emerald-500/15 border-emerald-400/60 text-emerald-50'
};
const ACCENT_ICON: Record<Accent, string> = {
  cyan: 'text-cyan-300',
  amber: 'text-amber-300',
  indigo: 'text-indigo-300',
  orange: 'text-orange-300',
  emerald: 'text-emerald-300'
};
const ACCENT_SWITCH: Record<Accent, string> = {
  cyan: 'bg-cyan-400',
  amber: 'bg-amber-400',
  indigo: 'bg-indigo-400',
  orange: 'bg-orange-400',
  emerald: 'bg-emerald-400'
};

// Mostra de color de cada mapa de fons (com les miniatures de Google Maps).
const BASE_SWATCH: Record<BaseLayerType, string> = {
  dark: 'bg-[#1f2430]',
  light: 'bg-[#e6e8eb]',
  relief: 'bg-[#cdbf94]',
  sat_optic: 'bg-[#2e4a3b]',
  black_marble: 'bg-[#0b1026]'
};

const HD_AGENCIES: HdAgency[] = ['meteosat', 'goes', 'himawari'];
const HD_NAMES: Record<HdAgency, string> = { meteosat: 'Meteosat', goes: 'GOES', himawari: 'Himawari' };

type IconType = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="mb-1.5 px-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Switch({ on, accent }: { on: boolean; accent: Accent }) {
  return (
    <span aria-hidden="true" className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${on ? ACCENT_SWITCH[accent] : 'bg-white/15'}`}>
      <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${on ? 'translate-x-[14px]' : ''}`} />
    </span>
  );
}

export function RadarLayerMenu({
  showLayerMenu,
  setShowLayerMenu,
  activeBaseLayer,
  setActiveBaseLayer,
  overlays,
  toggleOverlay,
  cloudSource,
  setCloudSource,
  homeHdAgency,
  baseLayers
}: RadarLayerMenuProps) {
  const { t } = useTranslation();
  const uid = useId();
  const ids = {
    panel: `${uid}-panel`,
    title: `${uid}-title`,
    base: `${uid}-base`,
    weather: `${uid}-weather`,
    clouds: `${uid}-clouds`,
    more: `${uid}-more`
  };

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Últim satèl·lit HD triat: "HD" hi torna; si no n'hi ha, el de la ubicació.
  const lastHdRef = useRef<HdAgency | null>(null);
  const isHd = cloudSource !== 'none' && cloudSource !== 'global';
  useEffect(() => {
    if (cloudSource !== 'none' && cloudSource !== 'global') lastHdRef.current = cloudSource;
  }, [cloudSource]);

  // Explicació d'una línia de l'última capa de "Més capes" tocada.
  const [hintKey, setHintKey] = useState<OverlayToggleKey | null>(null);

  // Easter egg: tres tocs a "Nit" en menys d'un segon → Terra de Nit (NASA).
  const nightClickCountRef = useRef(0);
  const nightClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNightEasterEgg = () => {
    toggleOverlay('night');

    nightClickCountRef.current += 1;

    if (nightClickCountRef.current >= 3) {
      if (activeBaseLayer === 'black_marble') {
        setActiveBaseLayer('dark');
      } else {
        setActiveBaseLayer('black_marble');
      }
      setShowLayerMenu(false);
      nightClickCountRef.current = 0;
    }

    if (nightClickTimerRef.current) {
      clearTimeout(nightClickTimerRef.current);
    }
    nightClickTimerRef.current = setTimeout(() => {
      nightClickCountRef.current = 0;
    }, 1000);
  };

  useEffect(() => {
    if (!showLayerMenu) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setShowLayerMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      if (nightClickTimerRef.current) clearTimeout(nightClickTimerRef.current);
    };
  }, [showLayerMenu, setShowLayerMenu]);

  // Focus: en obrir, al panell (el teclat hi entra directament); en tancar,
  // si s'ha perdut (el panell ja no hi és), torna al botó de capes.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (showLayerMenu) {
      menuRef.current?.focus({ preventScroll: true });
    } else if (wasOpenRef.current && (!document.activeElement || document.activeElement === document.body)) {
      buttonRef.current?.focus({ preventScroll: true });
    }
    wasOpenRef.current = showLayerMenu;
  }, [showLayerMenu]);

  // A mòbil, lliscar el full cap avall des de la capçalera el tanca.
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const onHeaderTouchStart = (e: ReactTouchEvent) => {
    const touch = e.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };
  const onHeaderTouchEnd = (e: ReactTouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const touch = e.changedTouches[0];
    const dy = touch.clientY - start.y;
    if (dy > 48 && Math.abs(touch.clientX - start.x) < dy) setShowLayerMenu(false);
  };

  const baseKeys = (Object.keys(baseLayers) as BaseLayerType[]).filter((key) => key !== 'black_marble'); // l'easter egg no surt al menú

  const cloudOptions: { value: 'none' | 'global' | 'hd'; label: string }[] = [
    { value: 'none', label: t('cloudsNone', 'Cap') },
    { value: 'global', label: t('cloudsGlobal', 'Global') },
    { value: 'hd', label: t('cloudsHd', 'HD') }
  ];
  const cloudOption = isHd ? 'hd' : cloudSource;
  const cloudDesc = {
    none: t('cloudsNoneDesc', 'Sense imatge de satèl·lit'),
    global: t('cloudsGlobalDesc', 'Tot el món en infraroig, una imatge cada hora'),
    hd: t('cloudsHdDesc', 'Més nitidesa, una imatge cada 10 minuts')
  }[cloudOption];
  const hdRegions: Record<HdAgency, string> = {
    meteosat: t('hdRegionMeteosat', 'Europa i Àfrica'),
    goes: t('hdRegionGoes', 'Amèrica'),
    himawari: t('hdRegionHimawari', 'Àsia i Pacífic')
  };

  const weatherItems: { key: OverlayToggleKey; icon: IconType; label: string; accent: Accent }[] = [
    { key: 'precip', icon: CloudRain, label: t('layerRain', 'Pluja'), accent: 'cyan' },
    { key: 'lightning', icon: Zap, label: t('layerLightningShort', 'Llamps'), accent: 'amber' }
  ];

  const moreItems: { key: OverlayToggleKey; icon: IconType; label: string; desc: string; accent: Accent }[] = [
    { key: 'night', icon: Moon, label: t('layerNightShort', 'Nit'), desc: t('layerNightDesc', 'Enfosqueix on ja és de nit'), accent: 'indigo' },
    { key: 'labels', icon: TypeIcon, label: t('layerLabelsShort', 'Noms'), desc: t('layerLabelsDesc', 'Noms de ciutats, regions i països'), accent: 'cyan' },
    { key: 'terrain3D', icon: Mountain, label: t('layerTerrainShort', 'Relleu 3D'), desc: t('layerTerrainDesc', 'Aixeca les muntanyes i inclina el mapa'), accent: 'emerald' },
    { key: 'nasaFires', icon: Flame, label: t('layerFiresShort', 'Focs'), desc: t('layerFiresDesc', 'Incendis detectats per satèl·lit el dia abans'), accent: 'orange' },
    { key: 'nasaReal', icon: Camera, label: t('layerNasaShort', 'Foto NASA'), desc: t('layerNasaDesc', 'Color real del darrer dia complet, no en directe'), accent: 'cyan' }
  ];
  const hintItem = moreItems.find((item) => item.key === hintKey);

  const hdModeAvailable = cloudSource === 'meteosat' || cloudSource === 'goes';

  // Número al botó: quantes capes hi ha enceses (els núvols, una).
  const activeCount = countActiveLayers(overlays);
  const activeLabel = t('layersActiveCount', {
    count: activeCount,
    defaultValue_one: '{{count}} capa activa',
    defaultValue_other: '{{count}} capes actives'
  });

  return (
    // Mòbil: aquest contenidor no es posiciona; el botó i el full es col·loquen
    // respecte del mapa. A partir de `sm`: a dalt a la dreta, el panell a
    // l'esquerra del botó i alineat amb ell (sota, en un portàtil de 768 px
    // d'alt, no hi cabia sense scroll); a `xl` pot baixar fins a baix perquè
    // ja no toca els controls de reproducció, que van centrats.
    <div className="sm:absolute sm:top-[max(env(safe-area-inset-top,16px),16px)] sm:right-[max(env(safe-area-inset-right,16px),16px)] sm:bottom-[110px] xl:bottom-[max(env(safe-area-inset-bottom,16px),16px)] sm:z-[1010] sm:flex sm:flex-row-reverse sm:items-start sm:gap-2 sm:pointer-events-none">
      <button
        ref={buttonRef}
        onClick={() => setShowLayerMenu(!showLayerMenu)}
        className={`absolute top-[max(env(safe-area-inset-top,16px),16px)] right-[max(env(safe-area-inset-right,16px),16px)] z-[1010] sm:relative sm:z-auto shrink-0 pointer-events-auto p-3.5 sm:p-4 rounded-2xl backdrop-blur-2xl border transition-colors duration-200 shadow-[0_8px_32px_rgba(0,0,0,0.8)] active:scale-95 ${FOCUS} ${
          showLayerMenu
            ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300'
            : 'bg-black/65 border-white/15 text-slate-200 hover:bg-black/80 hover:text-white hover:border-white/30'
        }`}
        title={t('layerControl')}
        aria-label={`${t('layerControl')} · ${activeLabel}`}
        aria-expanded={showLayerMenu}
        aria-controls={showLayerMenu ? ids.panel : undefined}
      >
        <Layers className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
        {activeCount > 0 && (
          <span
            aria-hidden="true"
            data-testid="layers-active-count"
            className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-cyan-400 text-slate-950 text-[11px] font-black leading-5 text-center shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
          >
            {activeCount}
          </span>
        )}
      </button>

      {showLayerMenu && (
        <div
          ref={menuRef}
          id={ids.panel}
          role="dialog"
          aria-labelledby={ids.title}
          tabIndex={-1}
          className="absolute inset-x-0 bottom-0 z-[1010] max-h-[calc(100%-76px)] sm:static sm:z-auto sm:w-[384px] sm:max-w-[calc(100vw-120px)] sm:max-h-full sm:min-h-0 pointer-events-auto flex flex-col bg-slate-950 sm:bg-slate-950/95 border-t sm:border border-white/15 rounded-t-2xl sm:rounded-2xl shadow-[0_-16px_48px_rgba(0,0,0,0.55)] sm:shadow-[0_24px_64px_rgba(0,0,0,0.7)] outline-none animate-in fade-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 sm:origin-top-right duration-200"
        >
          {/* Capçalera (a mòbil, també la nansa per lliscar avall) */}
          <div className="shrink-0 px-4 pt-2 sm:pt-1.5" onTouchStart={onHeaderTouchStart} onTouchEnd={onHeaderTouchEnd}>
            <div className="mx-auto mb-0.5 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <h2 id={ids.title} className="flex items-center gap-2 text-sm font-bold text-white">
                <Layers className="w-4 h-4 text-cyan-300" aria-hidden="true" />
                {t('layersTitle', 'Capes')}
              </h2>
              <button
                onClick={() => setShowLayerMenu(false)}
                className={`-mr-2 w-11 h-11 sm:w-9 sm:h-9 sm:-mr-1.5 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors ${FOCUS}`}
                aria-label={t('closeLayerMenu', 'Tancar menú de capes')}
              >
                <CloseIcon className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-[max(env(safe-area-inset-bottom,14px),14px)] sm:pb-2.5 space-y-3.5 sm:space-y-2.5 [scrollbar-width:thin] [scrollbar-color:rgba(6,182,212,0.4)_transparent]">

            {/* 1. Mapa de fons */}
            <Section id={ids.base} title={t('layersBaseTitle', 'Mapa de fons')}>
              <div role="radiogroup" aria-labelledby={ids.base} className="grid grid-cols-4 gap-1.5">
                {baseKeys.map((key) => {
                  const active = activeBaseLayer === key;
                  return (
                    <button
                      key={key}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setActiveBaseLayer(key)}
                      className={`h-10 sm:h-9 px-1 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-colors ${FOCUS} ${active ? SELECTED : IDLE}`}
                    >
                      <span aria-hidden="true" className={`shrink-0 w-2.5 h-2.5 rounded-[3px] border border-white/30 ${BASE_SWATCH[key]}`} />
                      <span className="truncate">{baseLayers[key].name}</span>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* 2. Temps ara */}
            <Section id={ids.weather} title={t('layersWeatherTitle', 'Temps ara')}>
              <div className="grid grid-cols-2 gap-1.5">
                {weatherItems.map(({ key, icon: Icon, label, accent }) => {
                  const on = overlays[key];
                  return (
                    <button
                      key={key}
                      aria-pressed={on}
                      onClick={() => toggleOverlay(key)}
                      className={`h-11 sm:h-10 pl-3 pr-2.5 flex items-center justify-between gap-2 rounded-xl border text-[13px] font-semibold transition-colors ${FOCUS} ${on ? ACCENT_ON[accent] : IDLE}`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${on ? ACCENT_ICON[accent] : 'text-slate-400'}`} aria-hidden="true" />
                        <span className="truncate">{label}</span>
                      </span>
                      <Switch on={on} accent={accent} />
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* 3. Núvols: Cap · Global · HD */}
            <Section id={ids.clouds} title={t('layersCloudsTitle', 'Núvols')}>
              <div role="radiogroup" aria-labelledby={ids.clouds} className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10">
                {cloudOptions.map(({ value, label }) => {
                  const selected = cloudOption === value;
                  return (
                    <button
                      key={value}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        if (selected) return;
                        setCloudSource(value === 'hd' ? (lastHdRef.current ?? homeHdAgency) : value);
                      }}
                      className={`h-9 sm:h-8 rounded-lg border text-xs font-semibold transition-colors ${FOCUS} ${
                        selected ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-50' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 px-0.5 text-[11px] leading-snug text-slate-400">{cloudDesc}</p>

              {isHd && (
                <div className="mt-2 space-y-1.5">
                  <div role="radiogroup" aria-label={t('hdSatelliteLabel', 'Satèl·lit HD')} className="grid grid-cols-3 gap-1.5">
                    {HD_AGENCIES.map((agency) => {
                      const selected = cloudSource === agency;
                      const isHome = agency === homeHdAgency;
                      return (
                        <button
                          key={agency}
                          role="radio"
                          aria-checked={selected}
                          onClick={() => { if (!selected) setCloudSource(agency); }}
                          title={isHome ? t('hdCoversYou', 'Cobreix la teva zona') : undefined}
                          className={`min-h-[44px] sm:min-h-[40px] px-1.5 py-1 sm:py-0.5 flex flex-col items-center justify-center rounded-xl border leading-tight transition-colors ${FOCUS} ${selected ? SELECTED : IDLE}`}
                        >
                          <span className="flex items-center gap-1 text-xs font-semibold">
                            {HD_NAMES[agency]}
                            {isHome && (
                              <>
                                <MapPin className="w-3 h-3 text-cyan-300" aria-hidden="true" />
                                <span className="sr-only">{`, ${t('hdCoversYou', 'Cobreix la teva zona')},`}</span>
                              </>
                            )}
                          </span>
                          {' '}
                          <span className={`text-[11px] ${selected ? 'text-cyan-200/80' : 'text-slate-500'}`}>{hdRegions[agency]}</span>
                        </button>
                      );
                    })}
                  </div>

                  {hdModeAvailable ? (
                    <div role="radiogroup" aria-label={t('hdModeLabel', 'Mode del satèl·lit HD')} className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10">
                      {([false, true] as const).map((colour) => {
                        const selected = overlays.hdColour === colour;
                        return (
                          <button
                            key={colour ? 'colour' : 'ir'}
                            role="radio"
                            aria-checked={selected}
                            onClick={() => { if (!selected) toggleOverlay('hdColour'); }}
                            className={`h-8 sm:h-7 rounded-lg border text-xs font-semibold transition-colors ${FOCUS} ${
                              selected ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-50' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.06]'
                            }`}
                          >
                            {colour ? t('hdModeColour', 'Color') : t('hdModeIr', 'Infraroig')}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="px-0.5 text-[11px] leading-snug text-slate-400">{t('hdIrOnly', 'Himawari només té infraroig')}</p>
                  )}
                </div>
              )}
            </Section>

            {/* 4. Més capes */}
            <Section id={ids.more} title={t('layersMoreTitle', 'Més capes')}>
              <div className="grid grid-cols-5 gap-1.5">
                {moreItems.map(({ key, icon: Icon, label, desc, accent }) => {
                  const on = overlays[key];
                  return (
                    <button
                      key={key}
                      aria-pressed={on}
                      title={desc}
                      onClick={() => {
                        if (key === 'night') handleNightEasterEgg();
                        else toggleOverlay(key);
                        setHintKey(key);
                      }}
                      className={`min-h-[56px] sm:min-h-[50px] px-0.5 py-1.5 sm:py-1 flex flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-semibold leading-tight text-center transition-colors ${FOCUS} ${on ? ACCENT_ON[accent] : IDLE}`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${on ? ACCENT_ICON[accent] : 'text-slate-400'}`} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
              <p aria-live="polite" className="mt-1.5 px-0.5 text-[11px] leading-snug text-slate-400">
                {hintItem ? (
                  <><span className="font-semibold text-slate-200">{hintItem.label}:</span> {hintItem.desc}</>
                ) : (
                  t('layersMoreHint', 'Toca una capa: aquí veuràs què mostra')
                )}
              </p>
            </Section>

          </div>
        </div>
      )}
    </div>
  );
}
