// src/components/AddressMoveNotice.tsx
// La mudança a meteotoniai.com (vegeu utils/addressMove.ts). A l'adreça antiga, una franja al capdamunt que porta a la
// nova amb els favorits i les preferències; a la nova, en arribar-hi des d'aquest enllaç, un avís que ja hi són.
import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { buildMoveLink, shouldShowMoveNotice, takeMovedHere } from '../utils/addressMove';
import { NOTIFICATION_TYPES } from '../constants/errorConstants';

// L'app instal·lada (icona a la pantalla d'inici) no es pot traspassar: cal tornar-la a instal·lar des de l'adreça nova.
const isInstalledApp = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export default function AddressMoveNotice() {
  const { t, actions } = useAppContext();
  // Es decideix en arrencar: ?pont=1 (proves) no ha de dependre de l'adreça que l'app reescriu en canviar de lloc.
  const [show] = useState(() => shouldShowMoveNotice(window.location));
  const [installed] = useState(isInstalledApp);
  const { setNotification } = actions;

  useEffect(() => {
    if (takeMovedHere()) setNotification({ type: NOTIFICATION_TYPES.SUCCESS as 'success', msg: t.movedImported });
  }, [setNotification, t]);

  if (!show) return null;

  return (
    <aside aria-label={t.movedTitle} className="relative z-[60] w-full border-b border-cyan-500/30 bg-cyan-950 text-cyan-50">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Truck className="w-5 h-5 shrink-0 text-cyan-400" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm leading-snug">
          <p className="font-bold">{t.movedTitle}</p>
          <p className="text-cyan-100/80">{t.movedText}</p>
          {installed && <p className="mt-1 text-cyan-100/80">{t.movedInstalled}</p>}
        </div>
        <button
          type="button"
          // L'enllaç es fa en el moment del toc, amb els favorits d'ara mateix.
          onClick={() => window.location.assign(buildMoveLink())}
          className="shrink-0 px-3 py-2 rounded-lg text-sm font-bold bg-cyan-500/20 border border-cyan-400/60 hover:bg-cyan-500/30 transition-colors"
        >
          {t.movedAction}
        </button>
      </div>
    </aside>
  );
}
