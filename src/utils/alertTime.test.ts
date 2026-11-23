import { describe, it, expect } from 'vitest';
import { alertsForDay, describeAlertWhen, isAlertStillValid, isSafeExternalUrl, localDateKey } from './alertTime';
import type { OfficialAlert } from '../services/alertsApi';

const TZ = 'Europe/Madrid';
// Dilluns 23/11/2026 a les 10:00 (hora de Barcelona).
const NOW = Date.parse('2026-11-23T10:00:00+01:00');

const alert = (extra: Partial<OfficialAlert>): OfficialAlert => ({
    id: 'a', event: 'Vent', severity: 'Moderate', headline: 'Ratxes fortes', description: '', instruction: null,
    senderName: 'Meteocat', expires: null, sourceName: 'Meteocat', sourceUrl: 'https://meteo.cat', textLang: 'ca', ...extra
});

describe('alertsForDay', () => {
    it("un avís amb inici i final només toca els dies que travessa", () => {
        const a = alert({ onset: '2026-11-24T12:00:00+01:00', expires: '2026-11-24T21:00:00+01:00' });
        expect(alertsForDay([a], '2026-11-23', TZ, NOW)).toHaveLength(0);
        expect(alertsForDay([a], '2026-11-24', TZ, NOW)).toHaveLength(1);
        expect(alertsForDay([a], '2026-11-25', TZ, NOW)).toHaveLength(0);
    });

    it('sense inici compta des d\'ara fins al final', () => {
        const a = alert({ expires: '2026-11-25T23:59:00+01:00' });
        expect(alertsForDay([a], '2026-11-23', TZ, NOW)).toHaveLength(1);
        expect(alertsForDay([a], '2026-11-25', TZ, NOW)).toHaveLength(1);
        expect(alertsForDay([a], '2026-11-26', TZ, NOW)).toHaveLength(0);
    });

    it("un final a mitjanit no toca el dia que comença", () => {
        const a = alert({ onset: '2026-11-24T18:00:00+01:00', expires: '2026-11-25T00:00:00+01:00' });
        expect(alertsForDay([a], '2026-11-24', TZ, NOW)).toHaveLength(1);
        expect(alertsForDay([a], '2026-11-25', TZ, NOW)).toHaveLength(0);
    });

    it('sense final només compta per al dia on comença', () => {
        const a = alert({ onset: '2026-11-24T06:00:00+01:00' });
        expect(alertsForDay([a], '2026-11-24', TZ, NOW)).toHaveLength(1);
        expect(alertsForDay([a], '2026-11-25', TZ, NOW)).toHaveLength(0);
    });

    it('un avís que ja ha acabat no surt enlloc', () => {
        const a = alert({ onset: '2026-11-22T06:00:00+01:00', expires: '2026-11-23T08:00:00+01:00' });
        expect(alertsForDay([a], '2026-11-23', TZ, NOW)).toHaveLength(0);
    });

    it('el dia és el del lloc, no el del mòbil (UTC)', () => {
        // 23:30 a Barcelona és el mateix instant que les 22:30 UTC: el dia de Barcelona és el 24 a les 00:30.
        expect(localDateKey(new Date('2026-11-24T00:30:00+01:00'), TZ)).toBe('2026-11-24');
        expect(localDateKey(new Date('2026-11-24T00:30:00+01:00'), 'UTC')).toBe('2026-11-23');
    });
});

describe('describeAlertWhen i companyia', () => {
    it('amb inici i final diu el tram amb el dia de la setmana', () => {
        const a = alert({ onset: '2026-11-24T12:00:00+01:00', expires: '2026-11-24T21:00:00+01:00' });
        expect(describeAlertWhen(a, 'ca', TZ)).toMatch(/^De dt\.? 12:00 a dt\.? 21:00$/);
    });

    it('només amb el final diu fins quan és vàlid', () => {
        expect(describeAlertWhen(alert({ expires: '2026-11-24T21:00:00+01:00' }), 'en', TZ)).toMatch(/^Valid until: /);
        expect(describeAlertWhen(alert({}), 'ca', TZ)).toBeNull();
    });

    it('val fins al darrer minut', () => {
        const a = alert({ expires: '2026-11-23T10:00:00+01:00' });
        expect(isAlertStillValid(a, NOW)).toBe(true);
        expect(isAlertStillValid(a, NOW + 60_000)).toBe(false);
    });

    it("només accepta enllaços https", () => {
        expect(isSafeExternalUrl('https://meteo.cat')).toBe(true);
        expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeExternalUrl(null)).toBe(false);
    });
});
