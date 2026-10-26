// src/hooks/useCitySearch.ts
// Cerca de ciutats compartida pel cercador de la capçalera i el de la benvinguda: espera 300 ms després
// de l'última tecla, bloqueja caràcters perillosos i descarta respostes velles ("últim guanyador").
import { useEffect, useRef, useState } from 'react';
import { searchCity, GeoSearchResult } from '../services/geocodingService';
import type { Language } from '../translations';

// DOCTRINA RISC ZERO: Regex de llista negra per sanitejar inputs
const DANGEROUS_CHARS = /[<>{}[\]\\/]/;

/** `lang`: idioma dels noms dels resultats (el de la interfície). */
export function useCitySearch(lang: Language = 'ca') {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeoSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  // [FIX PRECISIÓ] "Últim guanyador": evita que una cerca anterior i més lenta
  // sobreescrigui els suggeriments d'una de posterior i més ràpida.
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const cleanQuery = query.trim();

      if (cleanQuery.length < 3) {
        setSuggestions([]);
        return;
      }

      if (DANGEROUS_CHARS.test(cleanQuery)) {
        console.warn("Input sanitization blocked dangerous characters");
        setSuggestions([]);
        return;
      }

      const requestId = ++searchRequestIdRef.current;
      setIsSearching(true);
      try {
        const results = await searchCity(cleanQuery, lang);
        // Una cerca més recent ja ha començat mentrestant: descartem aquest
        // resultat obsolet en lloc de sobreescriure els suggeriments actuals.
        if (searchRequestIdRef.current !== requestId) return;
        setSuggestions(results || []);
      } catch (err) {
        console.error("Error en la cerca de ciutat:", err);
        if (searchRequestIdRef.current === requestId) setSuggestions([]);
      } finally {
        if (searchRequestIdRef.current === requestId) {
          setSelectedIndex(-1);
          setIsSearching(false);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, lang]);

  return { query, setQuery, suggestions, isSearching, selectedIndex, setSelectedIndex };
}
