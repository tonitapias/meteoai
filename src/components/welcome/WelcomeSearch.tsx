// src/components/welcome/WelcomeSearch.tsx
// Cercador de la benvinguda: la mateixa cerca que la capçalera (useCitySearch) amb una llista de resultats
// accessible (combobox) i, a sota, els favorits com a botons per entrar-hi d'un toc.
// El camp és a la part de baix de la pantalla: la llista s'obre cap amunt quan a sota no hi cap (al mòbil,
// gairebé sempre, i encara més amb el teclat obert) i fa l'alçada de l'espai que queda visible.
// El camp i els favorits són blancs translúcids (sense desenfocament): es veu el cel a través. La llista, opaca.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { History, Loader2, Search, Star } from 'lucide-react';
import { useCitySearch } from '../../hooks/useCitySearch';
import type { LocationData } from '../../hooks/usePreferences';
import type { Language } from '../../translations';
import { isSamePlace } from '../../utils/geoDistance';
import { localizeCountryName } from '../../utils/countryName';

export interface WelcomeSearchLabels {
  placeholder: string;
  searching: string;
  noResults: string;
  favorites: string;
  /** Text accessible del botó "+N" ({n} = favorits amagats). */
  moreFavorites: string;
  /** Títol de la llista dels darrers llocs triats. */
  recents?: string;
}

interface WelcomeSearchProps {
  labels: WelcomeSearchLabels;
  favorites: LocationData[];
  /** Els darrers llocs triats al cercador (el més recent primer): surten en enfocar-lo sense escriure-hi res. */
  recents?: LocationData[];
  /** Un lloc triat al cercador (un resultat o un recent) passa a ser el primer dels recents. Els favorits, no. */
  onRemember?: (place: LocationData) => void;
  /** Idioma dels noms dels resultats (el de la interfície). */
  lang?: Language;
  disabled?: boolean;
  /** Ressalta el camp quan la ubicació ha fallat i la cerca passa a ser el camí principal. */
  emphasized?: boolean;
  onSelect: (lat: number, lon: number, name: string, country?: string) => void;
}

/** Favorits que es veuen d'entrada; la resta, darrere del botó "+N". */
const FAVORITES_SHOWN = 3;

/** Alçada màxima de la llista (com max-h-72) i mínima quan no hi ha gaire espai. Si a sota no hi cap la
 *  llista sencera i a dalt hi ha més lloc, s'obre cap amunt. */
const LIST_MAX = 288;
const LIST_MIN = 120;
const GAP = 12;

export default function WelcomeSearch({ labels, favorites, recents = [], onRemember, lang = 'ca', disabled = false, emphasized = false, onSelect }: WelcomeSearchProps) {
  const { query, setQuery, suggestions, isSearching, selectedIndex, setSelectedIndex } = useCitySearch(lang);
  const [open, setOpen] = useState(false);
  const [allFavorites, setAllFavorites] = useState(false);
  const [placement, setPlacement] = useState<{ up: boolean; maxHeight: number }>({ up: false, maxHeight: LIST_MAX });
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showResults = open && query.trim().length >= 3;
  // Amb el camp buit, els recents (com al cercador del tauler): els que ja són favorits ja surten a sota com a botons.
  const shownRecents = recents.filter(r => !favorites.some(f => isSamePlace(f, r)));
  const showRecents = open && query.trim().length === 0 && shownRecents.length > 0 && !!labels.recents;
  const showList = showResults || showRecents;
  const optionCount = showResults ? suggestions.length : showRecents ? shownRecents.length : 0;

  // Espai visible a sobre i a sota del camp. visualViewport és l'àrea que es veu de debò: amb el teclat del
  // mòbil obert, és la meitat de dalt de la pantalla.
  const measure = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vv = window.visualViewport;
    const top = vv ? vv.offsetTop : 0;
    const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const below = bottom - r.bottom - GAP;
    const above = r.top - top - GAP;
    const up = below < LIST_MAX && above > below;
    const maxHeight = Math.max(LIST_MIN, Math.min(LIST_MAX, up ? above : below));
    setPlacement(prev => (prev.up === up && prev.maxHeight === maxHeight ? prev : { up, maxHeight }));
  }, []);

  useLayoutEffect(() => {
    if (showList) measure();
  }, [showList, measure]);

  useEffect(() => {
    if (!showList) return;
    const vv = window.visualViewport;
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    vv?.addEventListener('resize', measure);
    vv?.addEventListener('scroll', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      vv?.removeEventListener('resize', measure);
      vv?.removeEventListener('scroll', measure);
    };
  }, [showList, measure]);
  // Un resultat de la cerca o un recent: s'obre i passa a ser el primer dels recents.
  const pick = (place: LocationData) => {
    setQuery('');
    setOpen(false);
    setSelectedIndex(-1);
    onRemember?.(place);
    onSelect(place.latitude, place.longitude, place.name, place.country);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); setSelectedIndex(-1); return; }
    if (!showList || optionCount === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((selectedIndex + 1) % optionCount); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((selectedIndex - 1 + optionCount) % optionCount); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showRecents) {
      const recent = shownRecents[selectedIndex];
      if (recent) pick(recent);
      return;
    }
    const hit = suggestions[selectedIndex >= 0 ? selectedIndex : 0];
    if (hit) pick({ name: hit.name, latitude: hit.latitude, longitude: hit.longitude, country: hit.country, admin1: hit.admin1 });
  };

  const validFavorites = favorites
    .filter(f => typeof f.latitude === 'number' && typeof f.longitude === 'number' && !isNaN(f.latitude) && !isNaN(f.longitude));
  const hiddenFavorites = allFavorites ? 0 : Math.max(0, validFavorites.length - FAVORITES_SHOWN);
  const shownFavorites = hiddenFavorites > 0 ? validFavorites.slice(0, FAVORITES_SHOWN) : validFavorites;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={wrapperRef}
        className="relative"
        onBlur={(e) => { if (!wrapperRef.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
      >
        <form onSubmit={handleSubmit} role="search">
          <label htmlFor={`${listId}-input`} className="sr-only">{labels.placeholder}</label>
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true">
            {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </span>
          <input
            ref={inputRef}
            id={`${listId}-input`}
            type="search"
            role="combobox"
            aria-expanded={showList}
            aria-controls={`${listId}-list`}
            aria-autocomplete="list"
            aria-activedescendant={showList && selectedIndex >= 0 ? `${listId}-opt-${selectedIndex}` : undefined}
            autoComplete="off"
            value={query}
            disabled={disabled}
            placeholder={labels.placeholder}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(-1); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className={`w-full h-14 rounded-2xl border bg-white/[0.07] pl-12 pr-4 text-base text-slate-100 placeholder:text-slate-300/80 outline-none transition-colors hover:bg-white/[0.1] focus:bg-white/[0.1] focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 disabled:opacity-60 ${emphasized ? 'border-sky-300' : 'border-white/25'}`}
          />
        </form>

        {showList && (
          <ul
            id={`${listId}-list`}
            role="listbox"
            aria-label={showRecents ? labels.recents : labels.placeholder}
            data-placement={placement.up ? 'up' : 'down'}
            style={{ maxHeight: placement.maxHeight }}
            className={`absolute left-0 right-0 z-30 overflow-y-auto overscroll-contain rounded-2xl border border-[#2a3242] bg-[#0b0f19] py-1.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)] ${placement.up ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          >
            {showRecents && (
              <>
                <li role="presentation" className="flex items-center gap-2 px-4 pt-1.5 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <History className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                  {labels.recents}
                </li>
                {shownRecents.map((r, i) => {
                  const where = [r.admin1, localizeCountryName(r.country, lang)].filter(Boolean).join(' · ');
                  return (
                    <li
                      key={`recent-${r.name}-${r.latitude}-${r.longitude}`}
                      id={`${listId}-opt-${i}`}
                      role="option"
                      aria-selected={i === selectedIndex}
                      onMouseDown={(e) => { e.preventDefault(); pick(r); }}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={`flex min-h-[44px] cursor-pointer flex-col justify-center px-4 py-2 ${i === selectedIndex ? 'bg-white/[0.07]' : ''}`}
                    >
                      <span className="text-[15px] font-medium text-slate-100">{r.name}</span>
                      {where && <span className="text-xs text-slate-400">{where}</span>}
                    </li>
                  );
                })}
              </>
            )}
            {showResults && isSearching && suggestions.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-400">{labels.searching}</li>
            )}
            {showResults && !isSearching && suggestions.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-400">{labels.noResults}</li>
            )}
            {showResults && suggestions.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === selectedIndex}
                onMouseDown={(e) => { e.preventDefault(); pick({ name: s.name, latitude: s.latitude, longitude: s.longitude, country: s.country, admin1: s.admin1 }); }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex min-h-[44px] cursor-pointer flex-col justify-center px-4 py-2 ${i === selectedIndex ? 'bg-white/[0.07]' : ''}`}
              >
                <span className="text-[15px] font-medium text-slate-100">{s.name}</span>
                {(s.admin1 || s.country) && (
                  <span className="text-xs text-slate-400">{[s.admin1, s.country].filter(Boolean).join(' · ')}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {validFavorites.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Star className="w-[18px] h-[18px] shrink-0 fill-amber-400 text-amber-400" aria-hidden="true" />
          <span className="sr-only">{labels.favorites}:</span>
          {shownFavorites.map(f => (
            <button
              key={`${f.name}-${f.latitude}-${f.longitude}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(f.latitude, f.longitude, f.name, f.country)}
              className="h-11 max-w-[11rem] truncate rounded-xl border border-white/20 bg-white/[0.05] px-3.5 text-sm font-medium text-slate-100 transition-colors hover:border-white/40 hover:bg-white/[0.09] hover:text-white disabled:opacity-60"
            >
              {f.name}
            </button>
          ))}
          {hiddenFavorites > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setAllFavorites(true)}
              aria-label={labels.moreFavorites.replace('{n}', String(hiddenFavorites))}
              className="h-11 min-w-[44px] rounded-xl px-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-60"
            >
              +{hiddenFavorites}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
