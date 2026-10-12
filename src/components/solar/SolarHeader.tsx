// src/components/solar/SolarHeader.tsx
// Capçalera fixa del modal: disc solar CSS (to de dia/nit segons el full), títol, lloc i botó de tancar.
import { memo } from 'react';
import { X } from 'lucide-react';

interface SolarHeaderProps {
  titleId: string;
  title: string;
  location: string;
  closeLabel: string;
  onClose: () => void;
}

export const SolarHeader = memo(function SolarHeader({ titleId, title, location, closeLabel, onClose }: SolarHeaderProps) {
  return (
    <header className="sm-header">
      <span className="sm-tile" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="text-[17px] leading-[22px] md:text-xl font-black uppercase tracking-tight text-white">{title}</h2>
        <p className="sm-loc text-xs leading-4 text-slate-400 truncate">{location}</p>
      </div>
      <button type="button" className="sm-btn sm-focus" aria-label={closeLabel} aria-keyshortcuts="Escape" onClick={onClose}>
        <X className="w-5 h-5" aria-hidden="true" />
      </button>
    </header>
  );
});
