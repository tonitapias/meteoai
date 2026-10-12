// src/components/solar/useSolarScrub.test.tsx
// Motor imperatiu del control lliscant (via SolarTrajectoryCard, que hi connecta les refs). requestAnimationFrame
// és una cua manual i getBoundingClientRect retorna un rectangle fix: cada fotograma es buida a mà.
import { StrictMode, useCallback, useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { buildSolarDay, clearSolarDayCache, type SolarDayModel } from '../../utils/solar/solarDay';
import { makeZoneCtx } from '../../utils/solar/solarTime';
import { SOLAR_T } from './solarI18n';
import { SolarTrajectoryCard } from './SolarTrajectoryCard';
import { createScrubChannel, type ScrubChannel } from './scrubChannel';
import { MARKER_HALF } from './useSolarScrub';

const IDS = { trajTitle: 'traj-title', hint: 'traj-hint' };
const NOW_MIN = 967;   // 16:07 a Girona

// Mida de reserva del gràfic a jsdom (328×156): left 34, right 314.
const PLOT_LEFT = 34, PLOT_RIGHT = 314;
const RECT = {
  left: 16, top: 100, right: 344, bottom: 256, width: 328, height: 156, x: 16, y: 100, toJSON: () => ({}),
} as DOMRect;
/** clientX que cau exactament al minut m del dia (1440 min). */
const xAt = (m: number) => RECT.left + PLOT_LEFT + (m / 1440) * (PLOT_RIGHT - PLOT_LEFT);

let model: SolarDayModel;

// --- requestAnimationFrame manual ---
let frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 0;
const flushFrames = () => act(() => {
  const cbs = [...frames.values()];
  frames = new Map();
  cbs.forEach(cb => cb(0));
});

beforeEach(() => {
  clearSolarDayCache();
  model = buildSolarDay({
    dateStr: '2026-10-07', lat: 41.98, lon: 2.82, zone: makeZoneCtx('Europe/Madrid', 7200),
    omRise: '2026-10-07T07:51', omSet: '2026-10-07T19:20',
  })!;
  frames = new Map();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++nextFrameId, cb); return nextFrameId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** Com al modal: confirmar un minut el fixa (pinMinute) i React torna a pintar. */
function Harness({ nowMinute = NOW_MIN, onCommit, channel = null }: {
  nowMinute?: number | null; onCommit: (m: number | null) => void; channel?: ScrubChannel | null;
}) {
  const [pin, setPin] = useState<number | null>(null);
  const commit = useCallback((m: number | null) => { onCommit(m); setPin(m); }, [onCommit]);
  return (
    <SolarTrajectoryCard model={model} altMax={60} isLive nowMinute={nowMinute} pinMinute={pin}
      onCommit={commit} channel={channel} lang="ca" t={SOLAR_T.ca} ids={IDS} />
  );
}

/** Escriptures al valor d'un node de text (el motor hi escriu amb nodeValue). */
function spyNodeValue(node: Node): string[] {
  const writes: string[] = [];
  const desc = Object.getOwnPropertyDescriptor(Node.prototype, 'nodeValue')!;
  Object.defineProperty(node, 'nodeValue', {
    configurable: true,
    get() { return desc.get!.call(this); },
    set(v: string) { writes.push(v); desc.set!.call(this, v); },
  });
  return writes;
}

function setup(opts: { channel?: ScrubChannel; strict?: boolean } = {}) {
  const onCommit = vi.fn();
  const ui = (nowMinute: number = NOW_MIN) => <Harness nowMinute={nowMinute} onCommit={onCommit} channel={opts.channel} />;
  const r = render(opts.strict ? <StrictMode>{ui()}</StrictMode> : ui());
  const c = r.container;
  const q = <T extends Element = HTMLElement>(sel: string) => c.querySelector(sel) as T;
  const plot = q('.sm-plot');
  const rect = vi.fn(() => RECT);
  plot.getBoundingClientRect = rect;
  return {
    ...r, onCommit, plot, rect,
    card: q('.sm-traj'), marker: q('.sm-marker'), cursor: q('.sm-cursor'),
    time: () => q('.sm-time').textContent, tag: () => q('.sm-tag').textContent,
    phase: () => q('.sm-phase').textContent, coords: () => q('.sm-coords').textContent,
    rerenderNow: (m: number) => r.rerender(ui(m)),
  };
}

const touch = (clientX: number, clientY = 60) => ({ pointerType: 'touch', pointerId: 7, isPrimary: true, clientX, clientY });
const mouse = (clientX: number, buttons = 1) => ({ pointerType: 'mouse', pointerId: 1, isPrimary: true, button: 0, buttons, clientX, clientY: 60 });

describe('useSolarScrub — repòs', () => {
  it('pinta el minut confirmat (ara) amb "Ara", la fase i el marcador de 40 px centrat al punt', () => {
    const s = setup();
    expect(s.time()).toBe('16:07');
    expect(s.tag()).toBe('Ara');
    expect(s.phase()).toBe('Ple dia');
    expect(s.card.dataset.phase).toBe('day');
    expect(s.marker.dataset.tone).toBe('day');
    expect(s.coords()).toMatch(/^2\d\d° SO · \+\d+° · ombra /);
    const x = PLOT_LEFT + (NOW_MIN / 1440) * (PLOT_RIGHT - PLOT_LEFT);
    expect(MARKER_HALF).toBe(20);
    // Transformacions 2D: en repòs no són capes pròpies (el CSS només les promou mentre s'arrossega).
    expect(s.marker.style.transform).toMatch(new RegExp(`^translate\\(${(x - MARKER_HALF).toFixed(1)}px,`));
    expect(s.cursor.style.transform).toBe(`translate(${x.toFixed(1)}px,0)`);
    expect(s.card.dataset.drag).toBeUndefined();
  });

  it('StrictMode: cada lectura té un únic node de text (la ref es reaprofita)', () => {
    const s = setup({ strict: true });
    for (const sel of ['.sm-time', '.sm-tag', '.sm-coords', '.sm-phase']) {
      const el = s.container.querySelector(sel)!;
      expect(el.childNodes.length, sel).toBe(1);
      expect(el.firstChild).toBeInstanceOf(Text);
    }
    expect(s.time()).toBe('16:07');
  });
});

describe('useSolarScrub — tàctil', () => {
  it('un toc (pendent → up → click) confirma una sola vegada, al click', () => {
    const s = setup();
    fireEvent.pointerDown(s.plot, touch(xAt(600)));
    fireEvent.pointerMove(s.plot, touch(xAt(600) + 3, 62));   // tremolor < 8 px: continua sent un toc
    fireEvent.pointerUp(s.plot, touch(xAt(600) + 3, 62));
    expect(frames.size).toBe(0);
    expect(s.card.dataset.drag).toBeUndefined();
    expect(s.onCommit).not.toHaveBeenCalled();
    fireEvent.click(s.plot, { clientX: xAt(600), detail: 1 });
    expect(s.onCommit).toHaveBeenCalledTimes(1);
    expect(s.onCommit).toHaveBeenCalledWith(600);
    expect(s.time()).toBe('10:00');
    expect(s.tag()).toBe('');
    expect(s.plot).toHaveAttribute('aria-valuenow', '600');
    expect(s.card.dataset.pinned).toBe('1');
  });

  it('un arrossegament de 3 moviments escriu l\'hora 3 vegades i confirma un sol cop, a pointerup', () => {
    const s = setup();
    const timeWrites = spyNodeValue(s.container.querySelector('.sm-time')!.firstChild!);
    fireEvent.pointerDown(s.plot, touch(xAt(600)));
    expect(timeWrites).toEqual([]);
    fireEvent.pointerMove(s.plot, touch(xAt(600) + 12));   // ≥ 8 px i horitzontal: comença l'arrossegament
    expect(s.card.dataset.drag).toBe('1');
    expect(s.tag()).toBe('');
    flushFrames();
    fireEvent.pointerMove(s.plot, touch(xAt(700)));
    flushFrames();
    fireEvent.pointerMove(s.plot, touch(xAt(760)));
    flushFrames();
    expect(timeWrites).toEqual(['11:02', '11:40', '12:40']);
    expect(s.onCommit).not.toHaveBeenCalled();
    expect(s.plot).toHaveAttribute('aria-valuenow', String(NOW_MIN));   // l'aria només canvia en confirmar
    fireEvent.pointerUp(s.plot, touch(xAt(760)));
    expect(s.onCommit).toHaveBeenCalledTimes(1);
    expect(s.onCommit).toHaveBeenCalledWith(760);
    expect(s.card.dataset.drag).toBe('0');
    expect(s.plot).toHaveAttribute('aria-valuenow', '760');
    expect(s.rect).toHaveBeenCalledTimes(1);   // una sola lectura de layout per gest
  });

  it('un gest més vertical que horitzontal no arrossega: el navegador fa scroll i envia pointercancel', () => {
    const s = setup();
    fireEvent.pointerDown(s.plot, touch(xAt(600), 50));
    fireEvent.pointerMove(s.plot, touch(xAt(600) + 3, 60));
    fireEvent.pointerMove(s.plot, touch(xAt(600) + 9, 74));   // |dx| < |dy|: és scroll
    fireEvent.pointerCancel(s.plot, touch(xAt(600) + 9, 74));
    expect(frames.size).toBe(0);
    expect(s.card.dataset.drag).toBeUndefined();
    expect(s.onCommit).not.toHaveBeenCalled();
    expect(s.time()).toBe('16:07');
  });

  it('diagonal: la mateixa regla que el navegador (|dx| > |dy| arrossega; si no, és scroll)', () => {
    // ~45° amb una mica més d'horitzontal: el navegador no fa scroll (pan-y) i el gràfic l'ha d'agafar;
    // abans hi quedava una franja morta on no passava res.
    const s = setup();
    fireEvent.pointerDown(s.plot, touch(xAt(600), 50));
    fireEvent.pointerMove(s.plot, touch(xAt(600) + 10, 59));
    expect(s.card.dataset.drag).toBe('1');
    fireEvent.pointerUp(s.plot, touch(xAt(600) + 10, 59));
    expect(s.onCommit).toHaveBeenCalledTimes(1);
    s.unmount();

    const t = setup();
    fireEvent.pointerDown(t.plot, touch(xAt(600), 50));
    fireEvent.pointerMove(t.plot, touch(xAt(600) + 9, 59));   // |dx| = |dy|: és scroll
    expect(t.card.dataset.drag).toBeUndefined();
    expect(frames.size).toBe(0);
  });

  it('el lostpointercapture de l\'<svg> (captura implícita del tàctil) no desfà l\'arrossegament', () => {
    // En tàctil el navegador captura el punter a l'element tocat (l'<svg>); quan el gràfic el captura, l'<svg>
    // rep lostpointercapture, que arriba al gràfic per bombolla. Abans revertia tots els arrossegaments.
    const s = setup();
    const svg = s.container.querySelector('.sm-plot svg')!;
    fireEvent.pointerDown(svg, touch(xAt(600)));
    fireEvent.pointerMove(svg, touch(xAt(600) + 12));
    expect(s.card.dataset.drag).toBe('1');
    fireEvent.lostPointerCapture(svg, touch(xAt(600) + 12));
    expect(s.card.dataset.drag).toBe('1');
    fireEvent.pointerMove(s.plot, touch(xAt(700)));
    flushFrames();
    expect(s.time()).toBe('11:40');
    fireEvent.pointerUp(s.plot, touch(xAt(700)));
    expect(s.onCommit.mock.calls).toEqual([[700]]);
    expect(s.card.dataset.drag).toBe('0');
  });

  it('un segon dit no segresta el gest: el primer acaba i confirma, i data-drag torna a 0', () => {
    const s = setup();
    fireEvent.pointerDown(s.plot, touch(xAt(600)));
    fireEvent.pointerMove(s.plot, touch(xAt(600) + 12));
    flushFrames();
    const second = { pointerType: 'touch', pointerId: 8, isPrimary: false, clientY: 60 };
    fireEvent.pointerDown(s.plot, { ...second, clientX: xAt(900) });
    fireEvent.pointerMove(s.plot, { ...second, clientX: xAt(950) });
    fireEvent.pointerUp(s.plot, { ...second, clientX: xAt(950) });
    fireEvent.pointerCancel(s.plot, { ...second, clientX: xAt(950) });
    expect(s.card.dataset.drag).toBe('1');
    fireEvent.pointerMove(s.plot, touch(xAt(700)));
    flushFrames();
    expect(s.time()).toBe('11:40');   // continua seguint el primer dit
    fireEvent.pointerUp(s.plot, touch(xAt(700)));
    expect(s.onCommit.mock.calls).toEqual([[700]]);
    expect(s.card.dataset.drag).toBe('0');
  });

  it('pointercancel a mig arrossegament desfà la vista prèvia sense confirmar', () => {
    const s = setup();
    const before = s.marker.style.transform;
    fireEvent.pointerDown(s.plot, touch(xAt(600)));
    fireEvent.pointerMove(s.plot, touch(xAt(660)));
    flushFrames();
    expect(s.time()).toBe('11:00');
    expect(s.marker.style.transform).not.toBe(before);
    fireEvent.pointerCancel(s.plot, touch(xAt(660)));
    expect(s.time()).toBe('16:07');
    expect(s.tag()).toBe('Ara');
    expect(s.marker.style.transform).toBe(before);
    expect(s.card.dataset.drag).toBe('0');
    expect(s.onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(s.plot, touch(xAt(660)));
    expect(s.onCommit).not.toHaveBeenCalled();
  });
});

describe('useSolarScrub — ratolí i teclat', () => {
  it('diversos moviments dins d\'un fotograma pinten només l\'últim minut', () => {
    const s = setup();
    const timeWrites = spyNodeValue(s.container.querySelector('.sm-time')!.firstChild!);
    fireEvent.pointerDown(s.plot, mouse(xAt(100)));
    fireEvent.pointerMove(s.plot, mouse(xAt(200)));
    fireEvent.pointerMove(s.plot, mouse(xAt(300)));
    expect(frames.size).toBe(1);
    flushFrames();
    expect(timeWrites).toEqual(['05:00']);
    flushFrames();   // cap fotograma pendent
    fireEvent.pointerMove(s.plot, mouse(xAt(300) + 0.05));   // mateix minut: res a escriure
    flushFrames();
    expect(timeWrites).toEqual(['05:00']);
  });

  it('un click just després d\'un arrossegament no torna a confirmar', () => {
    const s = setup();
    fireEvent.pointerDown(s.plot, mouse(xAt(600)));
    fireEvent.pointerMove(s.plot, mouse(xAt(700)));
    flushFrames();
    fireEvent.pointerUp(s.plot, mouse(xAt(700), 0));
    fireEvent.click(s.plot, { clientX: xAt(700), detail: 1 });
    expect(s.onCommit.mock.calls).toEqual([[700]]);
    fireEvent.click(s.plot, { clientX: xAt(800), detail: 1 });   // un click nou sí que compta
    expect(s.onCommit.mock.calls).toEqual([[700], [800]]);
  });

  it('el rellotge de 30 s no mou el marcador durant l\'arrossegament (sí en repòs)', () => {
    const s = setup();
    const rest = s.marker.style.transform;
    s.rerenderNow(NOW_MIN + 1);   // en repòs, "ara" avança i el marcador el segueix
    expect(s.time()).toBe('16:08');
    expect(s.marker.style.transform).not.toBe(rest);
    fireEvent.pointerDown(s.plot, mouse(xAt(600)));
    flushFrames();
    const dragging = s.marker.style.transform;
    expect(s.time()).toBe('10:00');
    s.rerenderNow(NOW_MIN + 2);
    expect(s.marker.style.transform).toBe(dragging);
    expect(s.time()).toBe('10:00');
    fireEvent.pointerUp(s.plot, mouse(xAt(600), 0));
    expect(s.onCommit).toHaveBeenCalledWith(600);
    expect(s.time()).toBe('10:00');
  });

  it('lostpointercapture desfà l\'arrossegament; el pointerup posterior ja no confirma', () => {
    const s = setup();
    fireEvent.pointerDown(s.plot, mouse(xAt(600)));
    flushFrames();
    expect(s.time()).toBe('10:00');
    fireEvent.lostPointerCapture(s.plot, mouse(xAt(600)));
    expect(s.time()).toBe('16:07');
    expect(s.card.dataset.drag).toBe('0');
    fireEvent.pointerUp(s.plot, mouse(xAt(600), 0));
    expect(s.onCommit).not.toHaveBeenCalled();
  });

  it('passar el ratolí per sobre fa vista prèvia; en sortir es desfà; el click fixa', () => {
    const s = setup();
    fireEvent.pointerMove(s.plot, mouse(xAt(600), 0));
    expect(s.card.dataset.drag).toBe('1');
    flushFrames();
    expect(s.time()).toBe('10:00');
    fireEvent.pointerLeave(s.plot, mouse(xAt(600), 0));
    expect(s.time()).toBe('16:07');
    expect(s.card.dataset.drag).toBe('0');
    expect(s.onCommit).not.toHaveBeenCalled();
    fireEvent.click(s.plot, { clientX: xAt(600), detail: 1 });
    expect(s.onCommit.mock.calls).toEqual([[600]]);
  });

  it('el botó dret no comença cap gest', () => {
    const s = setup();
    fireEvent.pointerDown(s.plot, { ...mouse(xAt(600), 2), button: 2 });
    expect(frames.size).toBe(0);
    expect(s.card.dataset.drag).toBeUndefined();
  });

  it('la fase i el to del marcador segueixen el minut (nit, hora daurada)', () => {
    const s = setup();
    fireEvent.pointerDown(s.plot, mouse(xAt(120)));   // 02:00
    flushFrames();
    expect(s.card.dataset.phase).toBe('night');
    expect(s.marker.dataset.tone).toBe('below');
    expect(s.phase()).toBe('Nit');
    fireEvent.pointerMove(s.plot, mouse(xAt(1130)));   // 18:50
    flushFrames();
    expect(s.card.dataset.phase).toBe('golden');
    expect(s.marker.dataset.tone).toBe('golden');
    expect(s.phase()).toBe('Hora daurada');
  });

  it('teclat amb el ratolí quiet a sobre (vista prèvia): el pas es pinta igualment', () => {
    const s = setup();
    fireEvent.pointerMove(s.plot, mouse(xAt(600), 0));   // vista prèvia a les 10:00
    flushFrames();
    expect(s.time()).toBe('10:00');
    fireEvent.keyDown(s.plot, { key: 'ArrowRight' });
    expect(s.onCommit).toHaveBeenLastCalledWith(975);
    expect(s.time()).toBe('16:15');
    expect(s.card.dataset.drag).toBe('0');
    fireEvent.keyDown(s.plot, { key: 'PageUp' });
    expect(s.time()).toBe('17:00');
  });

  it('teclat: les fletxes fan preventDefault i confirmen; qualsevol altra tecla no', () => {
    const s = setup();
    expect(fireEvent.keyDown(s.plot, { key: 'ArrowRight' })).toBe(false);
    expect(s.onCommit).toHaveBeenLastCalledWith(975);
    expect(fireEvent.keyDown(s.plot, { key: 'PageDown' })).toBe(false);
    expect(s.onCommit).toHaveBeenLastCalledWith(960);
    expect(fireEvent.keyDown(s.plot, { key: 'End' })).toBe(false);
    expect(s.onCommit).toHaveBeenLastCalledWith(1440);
    expect(s.time()).toBe('24:00');
    expect(fireEvent.keyDown(s.plot, { key: 'a' })).toBe(true);
    expect(s.onCommit).toHaveBeenCalledTimes(3);
  });
});

describe('useSolarScrub — valor accessible', () => {
  it('amb el focus i sense fixar, el valor no avança sol cada minut (no s\'anuncia); un pas sí que l\'actualitza', () => {
    const s = setup();
    fireEvent.focus(s.plot);
    s.rerenderNow(NOW_MIN + 1);
    expect(s.time()).toBe('16:08');                                    // la lectura visual segueix l'hora
    expect(s.plot).toHaveAttribute('aria-valuenow', String(NOW_MIN));   // l'aria no
    expect(s.plot.getAttribute('aria-valuetext')).toMatch(/^16:07,/);
    fireEvent.keyDown(s.plot, { key: 'ArrowRight' });                   // un pas sí que l'actualitza
    expect(s.plot).toHaveAttribute('aria-valuenow', '975');
    fireEvent.click(s.container.querySelector('.sm-pill')!);            // torna a "ara" i hi posa el focus
    expect(s.plot).toHaveAttribute('aria-valuenow', String(NOW_MIN + 1));
    fireEvent.blur(s.plot);
    s.rerenderNow(NOW_MIN + 2);                                         // sense focus, segueix l'hora
    expect(s.plot).toHaveAttribute('aria-valuenow', String(NOW_MIN + 2));
  });
});

describe('useSolarScrub — cost per fotograma', () => {
  it('un fotograma que canvia de minut fa ≤ 5 escriptures al DOM i n\'emet una al canal', () => {
    const channel = createScrubChannel();
    const s = setup({ channel });
    const heard = vi.fn();
    channel.subscribe(heard);   // rep de seguida l'última posició confirmada
    expect(heard).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(s.plot, mouse(xAt(600)));
    flushFrames();
    expect(heard).toHaveBeenCalledTimes(2);
    const mo = new MutationObserver(() => {});
    mo.observe(s.card, { subtree: true, attributes: true, characterData: true, childList: true });
    fireEvent.pointerMove(s.plot, mouse(xAt(610)));   // mateixa fase (ple dia)
    flushFrames();
    const records = mo.takeRecords();
    mo.disconnect();
    expect(records.length).toBeGreaterThan(0);
    expect(records.length).toBeLessThanOrEqual(5);
    expect(records.filter(r => r.type === 'attributes').map(r => r.attributeName)).toEqual(['style', 'style']);
    expect(records.filter(r => r.type === 'childList')).toEqual([]);
    expect(heard).toHaveBeenCalledTimes(3);
    fireEvent.pointerMove(s.plot, mouse(xAt(610) + 0.05));   // mateix minut: cap emissió
    flushFrames();
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it('desmuntar a mig gest cancel·la el fotograma pendent', () => {
    const s = setup();
    fireEvent.pointerDown(s.plot, mouse(xAt(600)));
    expect(frames.size).toBe(1);
    s.unmount();
    expect(frames.size).toBe(0);
  });
});
