// src/components/welcome/MeteosatDisc.tsx
// L'última parada de l'ascensor: la Terra sencera tal com la veu ara el Meteosat-12 (GeoColour d'EUMETSAT: color real
// de dia i infraroig de nit), amb una agulla on és el dispositiu. EUMETSAT la serveix ja projectada com la veu el
// satèl·lit (ortogràfica centrada a 0°, 0°), anònima i amb CORS, en un JPEG de ~70 KB. Mentre arriba, o si no arriba
// (sense xarxa), s'hi veu un dibuix de la mateixa vista amb la mateixa projecció, i l'agulla cau al mateix lloc.
import { useId, useState } from 'react';
import { DISC_FILL, type MeteosatImage } from '../../hooks/welcome/useMeteosatImage';

interface MeteosatDiscProps {
  image: MeteosatImage;
  /** On és el dispositiu, en fraccions del radi (x cap a l'est, y cap al nord); null si el Meteosat no el veu. */
  pin: { x: number; y: number } | null;
  hereLabel: string;
}

export function MeteosatDisc({ image, pin, hereLabel }: MeteosatDiscProps) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative w-full h-full">
      {/* L'atmosfera: un anell de llum a la vora, amb un degradat (cap filtre). */}
      <div
        aria-hidden="true"
        className="absolute -inset-[8%] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, rgba(125,211,252,0) 84%, rgba(125,211,252,0.42) 91.5%, rgba(59,130,246,0.12) 95%, rgba(30,58,138,0) 100%)' }}
      />
      <div className="absolute inset-0 rounded-full overflow-hidden bg-[#081e3d]">
        <DiscDrawing />
        {image.status === 'ready' && (
          <img
            src={image.src}
            alt=""
            onLoad={() => setShown(true)}
            className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700 motion-reduce:transition-none"
            style={{ width: `${100 / DISC_FILL}%`, height: `${100 / DISC_FILL}%`, opacity: shown ? 1 : 0 }}
          />
        )}
        <div aria-hidden="true" className="absolute inset-0" style={{ background: 'radial-gradient(closest-side, rgba(0,0,0,0) 62%, rgba(0,0,0,0.18) 88%, rgba(0,0,0,0.42) 100%)' }} />
      </div>
      <div aria-hidden="true" className="absolute inset-0 rounded-full border border-sky-200/50 pointer-events-none" />

      {pin && (
        <div className="absolute" style={{ left: `${50 + pin.x * 50}%`, top: `${50 - pin.y * 50}%` }}>
          <svg aria-hidden="true" viewBox="-20 -20 40 40" className="absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 overflow-visible">
            <circle r={17} fill="none" stroke="#fde68a" strokeOpacity={0.35} strokeWidth={1.5} />
            <circle r={9.5} fill="none" stroke="#fde68a" strokeOpacity={0.65} strokeWidth={1.5} />
          </svg>
          <svg aria-hidden="true" viewBox="-10 -26 20 27" className="absolute w-[22px] h-[30px] -translate-x-1/2 -translate-y-full overflow-visible">
            <path d="M0 0C-2 -6 -9 -9 -9 -16A9 9 0 0 1 9 -16C9 -9 2 -6 0 0Z" fill="#fde68a" stroke="#0c0f17" strokeWidth={1.5} />
            <circle cy={-16} r={3.4} fill="#0c0f17" />
          </svg>
          <span className="absolute left-0 -translate-x-1/2 -translate-y-full -mt-9 whitespace-nowrap rounded-full bg-[#fde68a] px-2.5 py-1 text-[13px] font-bold text-stone-900">
            {hereLabel}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * La Terra des del Meteosat, dibuixada: la mateixa projecció ortogràfica (centre (195, 400), radi 150) amb l'Àfrica,
 * Europa, l'Atlàntic i el Brasil a grans trets i unes quantes bandes de núvols.
 */
function DiscDrawing() {
  const id = `disc${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg aria-hidden="true" viewBox="45 250 300 300" className="absolute inset-0 w-full h-full">
      <defs>
        <radialGradient id={`${id}-ocean`} gradientUnits="userSpaceOnUse" cx="172" cy="362" r="200">
          <stop offset="0" stopColor="#2563a8" />
          <stop offset="0.6" stopColor="#12396b" />
          <stop offset="1" stopColor="#081e3d" />
        </radialGradient>
        <linearGradient id={`${id}-land`} gradientUnits="userSpaceOnUse" x1="0" y1="250" x2="0" y2="550">
          <stop offset="0" stopColor="#7f8f62" />
          <stop offset="0.2" stopColor="#8f8a5c" />
          <stop offset="0.27" stopColor="#c9a768" />
          <stop offset="0.42" stopColor="#b59d60" />
          <stop offset="0.52" stopColor="#4c7a3b" />
          <stop offset="0.75" stopColor="#6c8447" />
          <stop offset="1" stopColor="#8c8a5c" />
        </linearGradient>
      </defs>
      <circle cx="195" cy="400" r="150" fill={`url(#${id}-ocean)`} />
      <path fill={`url(#${id}-land)`} d="M180 313L178 317L165 330L151 362L161 378L175 389L195 386L204 383L218 391L218 401L229 423L230 459L234 484L262 475L288 440L290 418L310 371L300 366L318 344L331 337L318 314L301 294L281 277L258 264L240 258L217 258L205 272L207 277L198 283L187 288L194 294L189 297L179 297L176 306Z" />
      <path fill="#163f72" d="M183 312L190 309L195 305L200 301L212 296L222 302L228 308L236 305L242 307L250 302L262 312L267 318L264 325L259 323L240 324L228 321L216 311L201 311L186 313Z" />
      <path d="M264 325L296 368" stroke="#163f72" strokeWidth="2.4" />
      <path fill={`url(#${id}-land)`} d="M47 374L65 374L81 387L99 404L110 412L104 434L101 459L95 475L91 488L80 496L62 470L50 440L45 410Z" />
      <path fill="#8f8a5c" d="M191 285L196 283L194 276L188 272L187 280Z" />
      <ellipse cx="182" cy="281" rx="3" ry="3.2" fill="#7f8f62" />
      <path fill="#e2e8f0" d="M146 257L170 252L174 262L160 269L150 265Z" />
      <ellipse cx="298" cy="451" rx="5" ry="14" transform="rotate(20 298 451)" fill="#6c8447" />
      {/* Els casquets de gel: el contenidor rodó retalla tot el que surt del disc. */}
      <rect x="45" y="537" width="300" height="13" fill="#f1f5f9" opacity="0.9" />
      <rect x="45" y="250" width="300" height="5" fill="#f1f5f9" opacity="0.75" />
      <g fill="#ffffff">
        <ellipse cx="70" cy="398" rx="14" ry="5" opacity="0.6" />
        <ellipse cx="100" cy="394" rx="18" ry="6" opacity="0.6" />
        <ellipse cx="140" cy="400" rx="12" ry="5" opacity="0.55" />
        <ellipse cx="232" cy="397" rx="16" ry="5" opacity="0.55" />
        <ellipse cx="262" cy="402" rx="12" ry="4" opacity="0.5" />
        <ellipse cx="214" cy="279" rx="18" ry="4.5" opacity="0.5" />
      </g>
      <g stroke="#ffffff" strokeLinecap="round" fill="none">
        <path d="M108 300q30-20 60 0q20 18-6 30q-26 10-40-6" strokeWidth="7" opacity="0.6" />
        <path d="M130 327q-30 30-62 42" strokeWidth="6" opacity="0.5" />
        <path d="M58 500q60-18 120-4q50 12 112-6" strokeWidth="7" opacity="0.5" />
        <path d="M250 460q22-8 50-2" strokeWidth="5" opacity="0.4" />
      </g>
    </svg>
  );
}
