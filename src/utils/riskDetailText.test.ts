// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { formatRiskDetail } from './riskDetailText';
import type { RiskDetail, RiskDetailEvent } from '../services/geminiService';
import type { Language } from '../translations';

const measured = (hazard: RiskDetail['hazard'], level: RiskDetail['level'], value: number, threshold: number, hour = '17:00'): RiskDetail =>
    ({ level, hazard, hour, value, threshold, event: null });
const event = (e: RiskDetailEvent, hour: string | null = '05:00', hazard: RiskDetail['hazard'] = 'SNOW_ICE'): RiskDetail =>
    ({ level: 'AMBER', hazard, hour, value: null, threshold: null, event: e });

describe('formatRiskDetail', () => {
    it('vent AMBER en català', () => {
        expect(formatRiskDetail(measured('WIND', 'AMBER', 61.9, 50), 'ca'))
            .toBe('Ràfegues de fins a 62 km/h cap a les 17:00 (precaució a partir de 50 km/h)');
    });

    it('pluja RED amb coma decimal i "la 01:00"', () => {
        expect(formatRiskDetail(measured('RAIN', 'RED', 22.4, 20, '01:00'), 'ca'))
            .toBe('Pluja de fins a 22,4 mm en una hora cap a la 01:00 (alerta per sobre de 20 mm/h)');
    });

    it('castellà: "hacia la 01:00" i "las 17:00"', () => {
        expect(formatRiskDetail(measured('WIND', 'RED', 85, 80, '01:00'), 'es'))
            .toBe('Rachas de hasta 85 km/h hacia la 01:00 (alerta a partir de 80 km/h)');
        expect(formatRiskDetail(event('fog', '17:00', 'VISIBILITY'), 'es')).toBe('Niebla prevista a partir de las 17:00');
    });

    it('calor RED en anglès', () => {
        expect(formatRiskDetail(measured('HEAT', 'RED', 41.2, 40, '14:00'), 'en')).toBe('High of 41 °C around 14:00 (alert from 40 °C)');
    });

    it('fred AMBER en francès', () => {
        expect(formatRiskDetail(measured('COLD', 'AMBER', -2.6, 0, '06:00'), 'fr'))
            .toMatch(/^Minimale de .3 °C vers 06:00 \(risque de gel à 0 °C ou moins\)$/);
    });

    it('una mínima de -0,3 °C es diu 0 °C, no "-0 °C"', () => {
        expect(formatRiskDetail(measured('COLD', 'AMBER', -0.3, 0), 'ca')).toBe('Mínima de 0 °C cap a les 17:00 (a 0 °C o menys pot glaçar)');
    });

    it('la boira "a partir de" i la tempesta "cap a"', () => {
        expect(formatRiskDetail(event('fog', '05:00', 'VISIBILITY'), 'ca')).toBe('Boira prevista a partir de les 05:00');
        expect(formatRiskDetail(event('storm_hail', '18:00', 'CONVECTIVE'), 'ca')).toBe('Tempesta amb calamarsa prevista cap a les 18:00');
    });

    it('la calima és d\'ara mateix i no porta hora', () => {
        expect(formatRiskDetail(event('dust', null, 'AIR_QUALITY'), 'ca')).toBe('Pols en suspensió (calima) ara mateix');
    });

    it('si falta una dada, no diu res (millor que a mitges)', () => {
        expect(formatRiskDetail(event('snow', null), 'ca')).toBeNull();
        expect(formatRiskDetail({ ...measured('WIND', 'AMBER', 62, 50), value: null }, 'ca')).toBeNull();
        expect(formatRiskDetail({ ...measured('WIND', 'AMBER', 62, 50), hour: null }, 'ca')).toBeNull();
        expect(formatRiskDetail(measured('WIND', 'GREEN', 30, 50), 'ca')).toBeNull();
    });

    it('els 4 idiomes tenen tots els textos (cap plantilla per omplir)', () => {
        const langs: Language[] = ['ca', 'es', 'en', 'fr'];
        const events: RiskDetailEvent[] = ['storm', 'storm_hail', 'snow', 'sleet', 'freezing', 'rime', 'fog', 'dust', 'particles'];
        for (const lang of langs) {
            for (const e of events) {
                const text = formatRiskDetail(event(e, e === 'dust' || e === 'particles' ? null : '05:00'), lang);
                expect(text, `${lang}/${e}`).toBeTruthy();
                expect(text, `${lang}/${e}`).not.toContain('{');
            }
            for (const hazard of ['WIND', 'RAIN', 'HEAT', 'COLD'] as const) {
                for (const level of ['AMBER', 'RED'] as const) {
                    const text = formatRiskDetail(measured(hazard, level, 10, 5), lang);
                    expect(text, `${lang}/${hazard}/${level}`).toBeTruthy();
                    expect(text, `${lang}/${hazard}/${level}`).not.toContain('{');
                }
            }
        }
    });
});
