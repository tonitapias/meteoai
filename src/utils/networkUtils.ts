// src/utils/networkUtils.ts

// [NETEJA] Abans hi havia dues còpies gairebé idèntiques d'aquest mateix helper
// (weatherApi.ts i useRadarData.ts), que ja havien començat a divergir (una
// tancava el timeout dins d'una constant de mòdul, l'altra el rebia com a
// paràmetre). Centralitzat amb la versió parametritzada, més general.
export const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error: unknown) {
        clearTimeout(id);
        throw error;
    }
};
