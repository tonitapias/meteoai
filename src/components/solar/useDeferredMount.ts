// src/components/solar/useDeferredMount.ts
// Munta una secció pesada una mica després del modal (calendari, brúixola) perquè l'obertura no la pagui.
// setTimeout i prou: l'API d'inactivitat del navegador no existeix a Safari i en mòbils lents pot no arribar mai.
import { useEffect, useState } from 'react';

/** Retard comú de les seccions diferides (ms): just després de l'entrada del modal. */
export const DEFERRED_MOUNT_MS = 260;

export function useDeferredMount(delayMs: number): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  return ready;
}
