// src/components/dayDetail/DayAlerts.tsx
// Els avisos oficials que toquen el dia obert (utils/alertTime.ts → alertsForDay), just sota el resum. Mateixes hores i
// mateixa font que la franja d'avisos de la pestanya Ara.
import { memo } from 'react';
import { ExternalLink, ShieldAlert } from 'lucide-react';
import type { OfficialAlert } from '../../services/alertsApi';
import type { Language } from '../../translations';
import { ALERT_WHEN_TEXTS, describeAlertWhen, isSafeExternalUrl } from '../../utils/alertTime';

interface DayAlertsProps {
  alerts: ReadonlyArray<OfficialAlert>;
  lang: Language;
  timeZone?: string;
  label: string;
}

export const DayAlerts = memo(function DayAlerts({ alerts, lang, timeZone, label }: DayAlertsProps) {
  if (alerts.length === 0) return null;
  const ui = ALERT_WHEN_TEXTS[lang] ?? ALERT_WHEN_TEXTS.ca;

  return (
    <section aria-label={label} data-testid="day-alerts" className="flex flex-col gap-2 px-4 sm:px-5 pb-4">
      {alerts.map(alert => {
        const severe = alert.severity === 'Extreme' || alert.severity === 'Severe';
        const when = describeAlertWhen(alert, lang, timeZone);
        return (
          <div
            key={alert.id}
            data-testid="day-alert"
            className={`flex items-start gap-3 rounded-2xl px-3.5 py-3 ring-1 ring-inset ${severe ? 'bg-rose-400/[0.07] ring-rose-400/30' : 'bg-amber-400/[0.07] ring-amber-400/25'}`}
          >
            <ShieldAlert className={`w-5 h-5 mt-0.5 shrink-0 ${severe ? 'text-rose-400' : 'text-amber-400'}`} aria-hidden="true" />
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <p className={`text-sm font-semibold leading-snug ${severe ? 'text-rose-200' : 'text-amber-200'}`}>{alert.event}</p>
              {alert.headline && <p className="text-[12.5px] leading-snug text-slate-300 line-clamp-2">{alert.headline}</p>}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-slate-400">
                {when && <span>{when}</span>}
                {isSafeExternalUrl(alert.sourceUrl) ? (
                  <a
                    href={alert.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-slate-200"
                  >
                    {ui.source}: {alert.senderName} <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                ) : (
                  <span>{ui.source}: {alert.senderName}</span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
});
