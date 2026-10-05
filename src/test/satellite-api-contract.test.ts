import { describe, it, expect } from 'vitest';

// Test de contracte de la capa "Meteosat HD (Europa)" del radar. Avisa amb
// temps si EUMETSAT deixa d'actualitzar la capa msg_fes:ir108: el servei
// MSG 0° funciona en paral·lel amb Meteosat-12 (MTG) només fins a finals del
// primer trimestre de 2027 (pendent de confirmar), i quan s'aturi el worker
// meteo-sat-proxy servirà tessel·les transparents sense cap error visible
// ("fail-open"): la capa quedaria en blanc en silenci. El substitut previst
// és mtg_fd:ir105_hrfi (també en comprovem l'existència).

const CAPABILITIES_URL = 'https://view.eumetsat.int/geoserver/wms?service=WMS&version=1.3.0&request=GetCapabilities';
const MSG_LAYER = 'msg_fes:ir108';
const MTG_LAYER = 'mtg_fd:ir105_hrfi';
// Retard normal: ~20–35 min. Més de 2 h vol dir que la capa s'ha aturat.
const MAX_AGE_MS = 2 * 60 * 60 * 1000;
// Una tessel·la real de 512 px mai baixa d'uns pocs KB; el fallback del worker
// és un PNG transparent d'1x1 (68 bytes).
const MIN_TILE_BYTES = 4096;
// z4/8/5 (Europa central, dins el disc de Meteosat), bbox EPSG:3857 calculat
// igual que xyzToBbox al worker.
const TILE = { z: 4, x: 8, y: 5 };
const TIMEOUT_MS = 30000;

let capabilitiesPromise: Promise<string> | null = null;
function getCapabilities(): Promise<string> {
    capabilitiesPromise ??= fetch(CAPABILITIES_URL).then((res) => {
        if (!res.ok) throw new Error(`GetCapabilities d'EUMETSAT ha fallat amb status: ${res.status}`);
        return res.text();
    });
    return capabilitiesPromise;
}

// Bloc <Layer> d'una capa concreta dins del GetCapabilities.
function layerBlock(xml: string, name: string): string | null {
    const start = xml.indexOf(`<Name>${name}</Name>`);
    if (start < 0) return null;
    const end = xml.indexOf('</Layer>', start);
    return xml.slice(start, end < 0 ? undefined : end);
}

// Dimensió temps, p. ex. `default="..." nearestValue="1"` i
// `2020-09-01T00:00:00.000Z/2026-10-04T19:15:00.000Z/PT15M`.
function timeDimension(block: string): { attrs: string; extentEnd: string | null; defaultTime: string | null } {
    const match = block.match(/<Dimension name="time"([^>]*)>([^<]*)</);
    const attrs = match?.[1] ?? '';
    const extent = (match?.[2] ?? '').trim();
    const lastPeriod = extent.split(',').pop() ?? '';
    return {
        attrs,
        extentEnd: lastPeriod.split('/')[1] ?? null,
        defaultTime: attrs.match(/default="([^"]+)"/)?.[1] ?? null,
    };
}

function tileBbox({ z, x, y }: typeof TILE): string {
    const e = 20037508.34;
    const n = 2 ** z;
    return `${(x / n) * 2 * e - e},${e - ((y + 1) / n) * 2 * e},${((x + 1) / n) * 2 * e - e},${e - (y / n) * 2 * e}`;
}

function isImage(bytes: Uint8Array): boolean {
    const png = [0x89, 0x50, 0x4e, 0x47];
    const jpeg = [0xff, 0xd8, 0xff];
    return png.every((b, i) => bytes[i] === b) || jpeg.every((b, i) => bytes[i] === b);
}

describe('EUMETSAT Meteosat (msg_fes:ir108) Contract Check', () => {
    it('la capa existeix i s\'ha actualitzat fa menys de 2 h', async () => {
        const block = layerBlock(await getCapabilities(), MSG_LAYER);
        expect(block, `La capa ${MSG_LAYER} ha desaparegut del GetCapabilities d'EUMETSAT: cal migrar a ${MTG_LAYER}`).not.toBeNull();

        const { attrs, extentEnd } = timeDimension(block!);
        // El worker confia que EUMETSAT ajusti una hora no exacta a l'interval més proper.
        expect(attrs).toContain('nearestValue="1"');
        expect(extentEnd, 'No s\'ha pogut llegir el final de la dimensió temps').not.toBeNull();

        const ageMs = Date.now() - Date.parse(extentEnd!);
        const ageHours = (ageMs / 3600000).toFixed(1);
        expect(ageMs, `L'última imatge de ${MSG_LAYER} és de fa ${ageHours} h (${extentEnd}): EUMETSAT pot haver aturat el servei MSG 0° — la capa "Meteosat HD" quedarà en blanc; cal migrar a ${MTG_LAYER}`).toBeLessThan(MAX_AGE_MS);
    }, TIMEOUT_MS);

    it('serveix una imatge real sense autenticar (com el worker) per a l\'últim interval', async () => {
        const { defaultTime } = timeDimension(layerBlock(await getCapabilities(), MSG_LAYER) ?? '');
        expect(defaultTime).not.toBeNull();

        const url = `https://view.eumetsat.int/geoserver/wms?service=WMS&version=1.3.0&request=GetMap&layers=${MSG_LAYER}&styles=&crs=EPSG:3857&bbox=${tileBbox(TILE)}&width=512&height=512&format=image/vnd.jpeg-png&transparent=true&time=${defaultTime}`;
        const response = await fetch(url);
        expect(response.ok, `GetMap anònim de ${MSG_LAYER} ha fallat amb status: ${response.status} (si és 401/403, EUMETSAT torna a exigir el token)`).toBe(true);

        const bytes = new Uint8Array(await response.arrayBuffer());
        expect(isImage(bytes), `GetMap no ha tornat cap imatge (Content-Type: ${response.headers.get('content-type')})`).toBe(true);
        expect(bytes.byteLength).toBeGreaterThan(MIN_TILE_BYTES);
    }, TIMEOUT_MS);

    it('el worker de producció serveix una tessel·la real (no el fallback transparent)', async () => {
        const { defaultTime } = timeDimension(layerBlock(await getCapabilities(), MSG_LAYER) ?? '');
        expect(defaultTime).not.toBeNull();
        // Una hora abans de l'últim interval (segur que publicat) i uns segons
        // de desplaçament: el worker arrodoneix al mateix interval de 15 min,
        // però la URL no coincideix amb la de cap frame de l'app i no surt de
        // la memòria cau d'1 any — prova el camí sencer cada dia.
        const timestamp = Math.floor(Date.parse(defaultTime!) / 1000) - 3600 + 7;

        const response = await fetch(`https://meteo-sat-proxy.tonitapias.workers.dev/hd/meteosat/${timestamp}/${TILE.z}/${TILE.x}/${TILE.y}.png`, {
            headers: { Origin: 'https://tonitapias.github.io' },
        });
        expect(response.ok, `El worker ha respost amb status: ${response.status}`).toBe(true);

        const bytes = new Uint8Array(await response.arrayBuffer());
        expect(isImage(bytes)).toBe(true);
        expect(bytes.byteLength, 'El worker ha servit el fallback transparent: mira `wrangler tail` (línies "[Zero Risk] Meteosat ...")').toBeGreaterThan(MIN_TILE_BYTES);
    }, TIMEOUT_MS);

    it(`la capa de substitució ${MTG_LAYER} (Meteosat-12) existeix i s'actualitza`, async () => {
        const block = layerBlock(await getCapabilities(), MTG_LAYER);
        expect(block, `La capa ${MTG_LAYER} no és al GetCapabilities: revisa el pla de migració`).not.toBeNull();

        const { extentEnd } = timeDimension(block!);
        expect(extentEnd).not.toBeNull();
        expect(Date.now() - Date.parse(extentEnd!)).toBeLessThan(MAX_AGE_MS);
    }, TIMEOUT_MS);
});
