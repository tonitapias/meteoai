/**
 * Executa `callback` en una tasca nova just després del proper pintat i torna la funció que l'anul·la.
 *
 * Per a l'INP: tot el que es fa dins d'un clic o d'un «enrere», i també els efectes de React que hi pengen (React els
 * executa abans de pintar quan l'actualització ve d'una interacció), retarda el frame on l'usuari veu la resposta.
 * Amb això la part cara va després: primer es pinta la resposta (el modal obert, o ja amagat en tancar-lo) i la resta
 * corre en una tasca a part, que ja no compta a la interacció.
 *
 * requestAnimationFrame corre just abans de pintar, i el setTimeout que s'hi programa, després del pintat. Amb la
 * pestanya amagada no hi ha frames (el rAF no correria fins que tornés a ser visible): llavors n'hi ha prou amb el
 * setTimeout.
 */
export function afterNextPaint(callback: () => void): () => void {
  let frame: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    frame = null;
    timer = setTimeout(() => {
      timer = null;
      callback();
    }, 0);
  };

  const canWaitForFrame = typeof requestAnimationFrame === 'function'
    && typeof document !== 'undefined'
    && document.visibilityState !== 'hidden';
  if (canWaitForFrame) frame = requestAnimationFrame(schedule);
  else schedule();

  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    if (timer !== null) clearTimeout(timer);
    frame = null;
    timer = null;
  };
}
