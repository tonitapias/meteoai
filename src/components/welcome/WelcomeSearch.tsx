// src/components/welcome/WelcomeSearch.tsx
// Cercador de la benvinguda: la mateixa cerca que la capçalera (useCitySearch) amb una llista de resultats
// accessible (combobox) i, a sota, els favorits com a botons per entrar-hi d'un toc.
import { forwardRef, useId, useRef, useState } from 'react';
import { Loader2, Search, Star } from 'lucide-react';
import { useCitySearch } from '../../hooks/useCitySearch';
import type { LocationData } from '../../hooks/usePreferences';

export interface WelcomeSearchLabels {
  placeholder: string;
  searching: string;
  noResults: string;
  favorites: string;
}

interface WelcomeSearchProps {
  labels: WelcomeSearchLabels;
  favorites: LocationData[];
  disabled?: boolean;
  /** Ressalta el camp quan la ubicació ha fallat i la cerca passa a ser el camí principal. */
  emphasized?: boolean;
  onSelect: (lat: number, lon: number, name: string, country?: string) => void;
}

const WelcomeSearch = forwardRef<HTMLInputElement, WelcomeSearchProps>(function WelcomeSearch(
  { labels, favorites, disabled = false, emphasized = false, onSelect },
  inputRef,
) {
  const { query, setQuery, suggestions, isSearching, selectedIndex, setSelectedIndex } = useCitySearch();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const showList = open && query.trim().length >= 3;
  const pick = (lat: number, lon: number, name: string, country?: string) => {
    setQuery('');
    setOpen(false);
    setSelectedIndex(-1);
    onSelect(lat, lon, name, country);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); setSelectedIndex(-1); return; }
    if (!showList || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((selectedIndex + 1) % suggestions.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((selectedIndex - 1 + suggestions.length) % suggestions.length); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hit = suggestions[selectedIndex >= 0 ? selectedIndex : 0];
    if (hit) pick(hit.latitude, hit.longitude, hit.name, hit.country);
  };

  const validFavorites = favorites
    .filter(f => typeof f.latitude === 'number' && typeof f.longitude === 'number' && !isNaN(f.latitude) && !isNaN(f.longitude))
    .slice(0, 3);

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
            className={`w-full h-14 rounded-2xl border bg-[#121722] pl-12 pr-4 text-base text-slate-100 placeholder:text-slate-400 outline-none transition-colors focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 disabled:opacity-60 ${emphasized ? 'border-sky-300' : 'border-[#566079]'}`}
          />
        </form>

        {showList && (
          <ul
            id={`${listId}-list`}
            role="listbox"
            aria-label={labels.placeholder}
            className="absolute left-0 right-0 top-full mt-2 z-30 max-h-72 overflow-y-auto rounded-2xl border border-[#2a3242] bg-[#0b0f19] py-1.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)]"
          >
            {isSearching && suggestions.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-400">{labels.searching}</li>
            )}
            {!isSearching && suggestions.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-400">{labels.noResults}</li>
            )}
            {suggestions.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === selectedIndex}
                onMouseDown={(e) => { e.preventDefault(); pick(s.latitude, s.longitude, s.name, s.country); }}
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
          {validFavorites.map(f => (
            <button
              key={`${f.name}-${f.latitude}-${f.longitude}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(f.latitude, f.longitude, f.name, f.country)}
              className="h-11 max-w-[11rem] truncate rounded-xl border border-[#566079] px-3.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-300 hover:text-white disabled:opacity-60"
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default WelcomeSearch;
