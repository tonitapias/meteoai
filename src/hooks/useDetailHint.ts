// src/hooks/useDetailHint.ts
import { useState, useCallback } from 'react';
import { readStorage, writeStorage } from '../utils/safeStorage';

const STORAGE_KEY = 'meteoai_detail_hint';

// La targeta "Vols més detall?" de la vista essencial només surt sencera a qui encara no coneix la
// vista completa: en entrar-hi una vegada o tocar "Ara no", passa per sempre a una sola línia.
// Es desa en tocar-ho (no amb un efecte en muntar) perquè cap muntatge no torni a escriure el valor vell.
export function useDetailHint() {
  const [compact, setCompact] = useState(() => readStorage(STORAGE_KEY) === 'compact');

  const markCompact = useCallback(() => {
    setCompact(true);
    writeStorage(STORAGE_KEY, 'compact');
  }, []);

  return { compact, markCompact };
}
