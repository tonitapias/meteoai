// readImagePixels: la lectura de les tessel·les del radar (avisos i comprovació de LibreWXR encallat) es descodifica fora
// del fil principal i es llegeix d'un canvas de CPU (INP). jsdom no té canvas: el context i createImageBitmap són falsos.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readImagePixels } from './radarSampling';

const fakeContext = () => {
    const data = new Uint8ClampedArray([1, 2, 3, 4]);
    return {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({ data })),
        data,
    };
};

const stubCanvas = (ctx: ReturnType<typeof fakeContext>) => {
    const getContext = vi.fn(() => ctx);
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        if (tag !== 'canvas') return realCreate(tag);
        return { width: 0, height: 0, getContext } as unknown as HTMLCanvasElement;
    }) as typeof document.createElement);
    return getContext;
};

describe('readImagePixels', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('descodifica i retalla amb createImageBitmap i llegeix d\'un canvas de CPU', async () => {
        const ctx = fakeContext();
        const getContext = stubCanvas(ctx);
        const bitmap = { close: vi.fn() };
        const createImageBitmap = vi.fn(async () => bitmap);
        vi.stubGlobal('createImageBitmap', createImageBitmap);
        const img = {} as HTMLImageElement;

        const data = await readImagePixels(img, 10, 20, 1, 1);

        expect(createImageBitmap).toHaveBeenCalledWith(img, 10, 20, 1, 1);
        expect(getContext).toHaveBeenCalledWith('2d', { willReadFrequently: true });
        expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
        expect(bitmap.close).toHaveBeenCalled();
        expect(data).toBe(ctx.data);
    });

    it('sense createImageBitmap, dibuixa la imatge desplaçada com abans', async () => {
        const ctx = fakeContext();
        stubCanvas(ctx);
        vi.stubGlobal('createImageBitmap', undefined);
        const img = {} as HTMLImageElement;

        await readImagePixels(img, 10, 20, 3, 4);

        expect(ctx.drawImage).toHaveBeenCalledWith(img, -10, -20);
        expect(ctx.getImageData).toHaveBeenCalledWith(0, 0, 3, 4);
    });

    it('si createImageBitmap falla, també cau al camí antic', async () => {
        const ctx = fakeContext();
        stubCanvas(ctx);
        vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('decode'); }));
        const img = {} as HTMLImageElement;

        await readImagePixels(img, 5, 6, 2, 2);

        expect(ctx.drawImage).toHaveBeenCalledWith(img, -5, -6);
    });

    it('un rectangle buit no es llegeix', async () => {
        expect(await readImagePixels({} as HTMLImageElement, 0, 0, 0, 10)).toBeNull();
    });
});
