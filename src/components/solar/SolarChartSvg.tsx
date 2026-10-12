// src/components/solar/SolarChartSvg.tsx
// L'únic SVG estàtic del gràfic "Alçada del sol": es pinta quan canvien el dia o la mida, mai durant
// l'arrossegament ni al rellotge de 30 s. La corba es dibuixa quatre cops amb retalls per franja d'alçada
// (nit, hora blava, hora daurada, dia): el color canvia exactament a −6°, −4° i +6°. Sense cap filtre.
import { memo, useId } from 'react';
import type { ChartGeom, ChartLabel } from '../../utils/solar/solarChart';

const CURVE = { fill: 'none', strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

const Label = ({ l, fill }: { l: ChartLabel; fill: string }) => (
  <text x={l.x} y={l.y} textAnchor={l.anchor} fill={fill}>{l.text}</text>
);

export const SolarChartSvg = memo(function SolarChartSvg({ geom }: { geom: ChartGeom }) {
  // Ids únics per si mai hi ha dos gràfics a la pàgina; sense caràcters que compliquin url(#…).
  const uid = `sm${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { W, H, clip } = geom;
  const clipRect = (id: string, c: ChartGeom['clip']['day']) => (
    <clipPath id={`${uid}${id}`}><rect x={c.x} y={c.y} width={c.w} height={c.h} /></clipPath>
  );
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      <defs>
        {clipRect('d', clip.day)}
        {clipRect('g', clip.gold)}
        {clipRect('b', clip.blue)}
        {clipRect('h', clip.halo)}
      </defs>
      {geom.stars && <path d={geom.stars} fill="#e2e8f0" fillOpacity=".55" />}
      {geom.grid.hours && <path d={geom.grid.hours} fill="none" stroke="#fff" strokeOpacity=".05" />}
      {geom.grid.alts && <path d={geom.grid.alts} fill="none" stroke="#fff" strokeOpacity=".07" strokeDasharray="2 4" />}
      <line x1={geom.horizon.x1} x2={geom.horizon.x2} y1={geom.horizon.y} y2={geom.horizon.y} stroke="#cbd5e1" strokeOpacity=".35" />
      {geom.noonLine && (
        <line x1={geom.noonLine.x} x2={geom.noonLine.x} y1={geom.noonLine.y1} y2={geom.noonLine.y2}
          stroke="#fde68a" strokeOpacity=".35" strokeDasharray="1 3" />
      )}
      {geom.curve && (
        <>
          <path d={geom.curve} {...CURVE} clipPath={`url(#${uid}h)`} stroke="#05070f" strokeOpacity=".55" strokeWidth="5.5" />
          {/* Nit: opacitat .7 (no .6) perquè la corba quedi ≥ 3:1 sobre les bandes nàutica i astronòmica */}
          <path d={geom.curve} {...CURVE} stroke="#818cf8" strokeOpacity=".7" strokeWidth="1.75" />
          <path d={geom.curve} {...CURVE} clipPath={`url(#${uid}b)`} stroke="#60a5fa" strokeWidth="2.5" />
          <path d={geom.curve} {...CURVE} clipPath={`url(#${uid}g)`} stroke="#f59e0b" strokeWidth="2.75" />
          <path d={geom.curve} {...CURVE} clipPath={`url(#${uid}d)`} stroke="#fcd34d" strokeWidth="2.5" />
        </>
      )}
      {geom.riseDot && (
        <circle data-testid="sm-rise-marker" cx={geom.riseDot.x} cy={geom.riseDot.y} r="3.5" fill="#fbbf24" stroke="#0c0f17" strokeWidth="1.5" />
      )}
      {geom.setDot && (
        <circle data-testid="sm-set-marker" cx={geom.setDot.x} cy={geom.setDot.y} r="3.5" fill="#a5b4fc" stroke="#0c0f17" strokeWidth="1.5" />
      )}
      {geom.riseLabel && <Label l={geom.riseLabel} fill="#e2e8f0" />}
      {geom.setLabel && <Label l={geom.setLabel} fill="#e2e8f0" />}
      {geom.curve && <Label l={geom.noonLabel} fill="#fde68a" />}
      {geom.yLabels.map(l => <Label key={`y${l.text}`} l={l} fill="#94a3b8" />)}
      {geom.xLabels.map(l => <Label key={`x${l.text}`} l={l} fill="#94a3b8" />)}
    </svg>
  );
});
