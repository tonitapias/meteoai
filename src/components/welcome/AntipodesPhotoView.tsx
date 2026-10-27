// src/components/welcome/AntipodesPhotoView.tsx
// La foto de l'arribada de l'ascensor cap avall: les tessel·les del satèl·lit (useAntipodesPhoto) amb l'agulla a les
// antípodes, les coordenades, els noms dels llocs que s'hi veuen, l'escala i d'on surt la foto. Ocupa la part de dalt
// de la pantalla; a sota hi va la targeta del temps. Mentre la foto no arriba (o si no arriba), un mar fosc.
import type { AntipodesPhoto, PhotoFrame } from '../../hooks/welcome/useAntipodesPhoto';

interface AntipodesPhotoViewProps {
  photo: AntipodesPhoto;
  /** Part de l'alçada de la pantalla que ocupa la foto: l'agulla va al mig d'aquesta franja. */
  share: number;
  /** Mida de la foto baixada (una mica més gran que la franja, perquè no s'hi vegin vores). */
  frame: PhotoFrame;
  alt: string;
  hereLabel: string;
  coords: string;
  /** Noms damunt la foto; x, y: px des de l'agulla. */
  labels: { key: string; text: string; x: number; y: number }[];
  scale: { px: number; label: string } | null;
  credit: string | null;
  failedText: string;
}

export function AntipodesPhotoView({ photo, share, frame, alt, hereLabel, coords, labels, scale, credit, failedText }: AntipodesPhotoViewProps) {
  const center = `${(share * 50).toFixed(2)}%`;
  const bottom = `${(share * 100).toFixed(2)}%`;
  const ready = photo.status === 'ready';
  return (
    <div className="absolute inset-0 bg-[#0b1220]">
      <div aria-hidden="true" className="absolute inset-x-0 top-0" style={{ height: `calc(${bottom} + 28px)`, background: 'radial-gradient(ellipse at 50% 50%, #133a5e 0%, #0c1f36 58%, #0b1220 100%)' }} />
      {ready && (
        <div
          role="img"
          aria-label={alt}
          className="absolute overflow-hidden"
          style={{ left: `calc(50% - ${frame.width / 2}px)`, top: `calc(${center} - ${frame.height / 2}px)`, width: frame.width, height: frame.height }}
        >
          {photo.tiles.map(t => (
            <img
              key={t.src}
              src={t.src}
              alt=""
              draggable={false}
              className="absolute max-w-none"
              // Un píxel de més per banda: la foto cau en mig píxel (centrada en %) i, sense, s'hi veien les juntes.
              style={{ left: t.left, top: t.top, width: photo.tilePx + 1, height: photo.tilePx + 1 }}
            />
          ))}
        </div>
      )}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-36" style={{ background: 'linear-gradient(180deg, rgba(5,10,20,0.72) 0%, rgba(5,10,20,0) 100%)' }} />

      {photo.status === 'failed' && (
        <p className="absolute inset-x-6 text-center text-[13px] text-slate-300" style={{ top: `calc(${center} + 40px)` }}>{failedText}</p>
      )}

      {labels.map(l => (
        <div key={l.key} className="absolute flex items-center gap-1.5" style={{ left: `calc(50% + ${l.x}px)`, top: `calc(${center} + ${l.y}px)`, transform: 'translate(-3.5px, -50%)' }}>
          <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full bg-white ring-1 ring-[#0b1220]" />
          <span className="rounded-md bg-[rgba(11,18,32,0.78)] px-2 py-0.5 text-[12px] font-medium text-slate-100 whitespace-nowrap">{l.text}</span>
        </div>
      ))}

      <svg aria-hidden="true" viewBox="-30 -50 60 80" className="absolute w-[60px] h-[80px]" style={{ left: 'calc(50% - 30px)', top: `calc(${center} - 50px)` }}>
        <circle r={26} fill="none" stroke="#fdba74" strokeOpacity={0.45} strokeWidth={1.5} />
        <circle r={14} fill="none" stroke="#fdba74" strokeOpacity={0.8} strokeWidth={1.5} />
        <path d="M0 0C-2.5 -7 -11 -11 -11 -20A11 11 0 0 1 11 -20C11 -11 2.5 -7 0 0Z" fill="#fdba74" stroke="#1c1917" strokeWidth={1.6} />
        <circle cy={-20} r={4.2} fill="#1c1917" />
      </svg>
      <div className="absolute flex flex-col items-start gap-1" style={{ left: 'calc(50% + 19px)', top: `calc(${center} - 42px)` }}>
        <span className="rounded-full bg-[#fdba74] px-2.5 py-1 text-[13px] font-bold text-stone-900 whitespace-nowrap">{hereLabel}</span>
        <span className="rounded-md bg-[rgba(11,18,32,0.78)] px-2 py-0.5 font-mono text-[11px] text-slate-200 whitespace-nowrap">{coords}</span>
      </div>

      <div className="absolute inset-x-3 flex items-end justify-between gap-3" style={{ top: `calc(${bottom} - 68px)` }}>
        {scale && ready ? (
          <div className="flex items-end gap-2 pl-1">
            <svg aria-hidden="true" width={scale.px + 2} height={12} className="overflow-visible">
              <path d={`M1 1V11M${scale.px + 1} 1V11M1 6H${scale.px + 1}`} stroke="#ffffff" strokeWidth={2} fill="none" />
            </svg>
            <span className="font-mono text-[11px] font-medium text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{scale.label}</span>
          </div>
        ) : <span />}
        {credit && ready && <span className="rounded-md bg-[rgba(11,18,32,0.78)] px-2 py-1 text-[11px] text-slate-300">{credit}</span>}
      </div>
    </div>
  );
}
