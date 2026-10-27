// src/utils/welcome/secretsFound.ts
// Els secrets de la benvinguda que ja s'han trobat en aquest navegador, per dir "Secret trobat: 2 de ?" en tornar de
// cada viatge. És només una comoditat local: sense localStorage (navegació privada, dades esborrades) compta des de
// zero i el viatge funciona igual.
export type SecretId = 'sky' | 'earth';

const KEY = 'meteoai_secrets_found';
const IDS: readonly SecretId[] = ['sky', 'earth'];

function readFound(): SecretId[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? IDS.filter(id => raw.includes(id)) : [];
  } catch {
    return [];
  }
}

/** Apunta el secret com a trobat i torna quants se n'han trobat (aquest inclòs). */
export function markSecretFound(id: SecretId): number {
  const found = readFound();
  if (!found.includes(id)) found.push(id);
  try {
    localStorage.setItem(KEY, JSON.stringify(found));
  } catch { /* sense emmagatzematge: el número d'aquesta vegada és igualment bo */ }
  return found.length;
}
