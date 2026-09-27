// src/components/OfflineSnapshotBanner.tsx
// Avís de previsió desada: no se n'ha pogut obtenir cap de nova (sense connexió, API caiguda o massa lenta) i la
// pantalla mostra l'última desada, avançada fins a ara (vegeu utils/offlineSnapshot.ts). Diu de quina hora és, quant fa
// i, si és d'un altre punt (el GPS s'ha mogut), de quin lloc i a quants km.
import { useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import type { OfflineSnapshotInfo } from '../types/weatherLogicTypes';
import type { TranslationType } from '../translations';

interface OfflineSnapshotBannerProps {
    info: OfflineSnapshotInfo;
    /** Nom del lloc de la previsió desada. */
    place: string | null;
    text: TranslationType['offlineSnapshot'];
    /** Instant actual (ms epoch), per dir quant fa que es va desar. */
    now: number;
    onRetry?: () => Promise<unknown>;
}

// Per sota d'1 km és el mateix lloc (el GPS no dona mai exactament les mateixes coordenades).
const MIN_DISTANCE_TO_MENTION_KM = 1;

const formatAge = (ms: number): string => {
    const minutes = Math.max(1, Math.round(ms / 60000));
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h`;
};

// Hora de la previsió desada: la del lloc ("2026-09-27T10:30" -> "10:30"); si no hi és, la del dispositiu en desar-la.
const formatIssuedTime = (info: OfflineSnapshotInfo): string =>
    info.issuedAt?.match(/T(\d{2}:\d{2})/)?.[1] ?? new Date(info.savedAt).toTimeString().slice(0, 5);

export default function OfflineSnapshotBanner({ info, place, text, now, onRetry }: OfflineSnapshotBannerProps) {
    const [retrying, setRetrying] = useState(false);

    const nearby = place !== null && info.distanceKm !== null && info.distanceKm >= MIN_DISTANCE_TO_MENTION_KM;
    const body = (nearby ? text.bodyNearby : text.body)
        .replace('{place}', place ?? '')
        .replace('{km}', String(Math.round(info.distanceKm ?? 0)))
        .replace('{time}', formatIssuedTime(info))
        .replace('{age}', formatAge(now - info.savedAt));

    const handleRetry = async () => {
        if (!onRetry || retrying) return;
        setRetrying(true);
        try {
            await onRetry();
        } finally {
            setRetrying(false);
        }
    };

    return (
        <div
            role="status"
            data-testid="offline-snapshot-banner"
            className="w-full p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-md flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-lg shadow-amber-900/10"
        >
            <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-full bg-amber-500/10 text-amber-300 shrink-0">
                    <WifiOff className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <p className="text-amber-200 font-mono font-bold text-xs uppercase tracking-widest mb-1">{text.title}</p>
                    <p className="text-slate-200 text-sm leading-relaxed">{body}</p>
                    <p className="text-slate-400 text-xs mt-1">{text.note}</p>
                </div>
            </div>
            {onRetry && (
                <button
                    type="button"
                    onClick={handleRetry}
                    disabled={retrying}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-60 text-amber-100 text-xs font-mono font-bold uppercase tracking-widest rounded-xl transition-all border border-amber-500/40 active:scale-95 min-h-[40px] w-full sm:w-auto shrink-0"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
                    {retrying ? text.retrying : text.retry}
                </button>
            )}
        </div>
    );
}
