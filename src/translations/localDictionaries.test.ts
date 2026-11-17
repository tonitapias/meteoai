// src/translations/localDictionaries.test.ts
// Els diccionaris locals (objectes amb claus ca/es/en/fr dins dels components i les utilitats) que validator.test.ts
// no veu (auditoria d'UX del 16/11/2026, X3). Molts no tenen tipus, o en tenen un de massa ample
// (Record<string, string>), i TypeScript no avisa si un idioma o una clau hi falta: la pantalla sortia buida o en
// un altre idioma. Es llegeix el codi amb l'analitzador de TypeScript, sense executar-lo ni exportar res.
import { describe, it, expect } from 'vitest';
import ts from 'typescript';

const LANGS = ['ca', 'es', 'en', 'fr'] as const;
type Lang = typeof LANGS[number];
const isLang = (name: string | null): name is Lang => name !== null && (LANGS as readonly string[]).includes(name);

/** Codi TS/TSX en brut (glob de Vite): tot src menys els diccionaris centrals (validator.test.ts) i les proves. */
const SOURCES = import.meta.glob<string>(
  ['/src/**/*.{ts,tsx}', '!/src/translations/**', '!**/*.test.{ts,tsx}', '!**/*.d.ts'],
  { query: '?raw', import: 'default', eager: true },
);

const nameOf = (prop: ts.ObjectLiteralElementLike): string | null => {
  const name = prop.name;
  return name && (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) ? name.text : null;
};

const unwrap = (expr: ts.Expression): ts.Expression => {
  let e = expr;
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e)) {
    e = e.expression;
  }
  return e;
};

/**
 * Les claus d'un idioma (també les niades, "aria.max") i què hi ha a cadascuna: un valor, una llista de N o un
 * spread. Una constant del mateix fitxer (`ca: CA`) es llegeix; la resta (una crida, una importació) és un valor.
 */
const shapeOf = (
  expr: ts.Expression, lang: Lang, consts: Map<string, ts.Expression>, prefix = '', out = new Map<string, string>(),
): Map<string, string> => {
  let e = unwrap(expr);
  if (ts.isIdentifier(e) && consts.has(e.text) && prefix === '') e = unwrap(consts.get(e.text) as ts.Expression);

  if (ts.isObjectLiteralExpression(e)) {
    for (const prop of e.properties) {
      if (ts.isSpreadAssignment(prop)) {
        // `...CONFIDENCE_TEXT.ca` a `ca` i `...CONFIDENCE_TEXT.es` a `es`: el mateix origen, cadascú el seu idioma.
        const text = prop.expression.getText();
        const own = /^(.*)\.(ca|es|en|fr)$/.exec(text);
        out.set(`${prefix}...${own && own[2] === lang ? `${own[1]}.<idioma>` : text}`, 'spread');
        continue;
      }
      const path = `${prefix}${nameOf(prop) ?? prop.name?.getText() ?? '?'}`;
      const value = ts.isPropertyAssignment(prop) ? unwrap(prop.initializer) : null;
      if (value && ts.isObjectLiteralExpression(value)) shapeOf(value, lang, consts, `${path}.`, out);
      else out.set(path, value && ts.isArrayLiteralExpression(value) ? `llista de ${value.elements.length}` : 'valor');
    }
  } else {
    out.set(prefix || '(valor)', ts.isArrayLiteralExpression(e) ? `llista de ${e.elements.length}` : 'valor');
  }
  return out;
};

/** Els diccionaris d'un fitxer (objectes amb almenys dos idiomes com a clau) i el que hi falta o no quadra. */
const checkSource =(file: string, text: string): { dictionaries: number; problems: string[] } => {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);

  // Les constants del primer nivell, per seguir `{ ca: CA, es: ES, ... }`.
  const consts = new Map<string, ts.Expression>();
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const d of statement.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.initializer) consts.set(d.name.text, d.initializer);
    }
  }

  let dictionaries = 0;
  const problems: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const entries: Array<[Lang, ts.Expression]> = [];
      for (const prop of node.properties) {
        const name = nameOf(prop);
        if (!isLang(name)) continue;
        if (ts.isPropertyAssignment(prop)) entries.push([name, prop.initializer]);
        else if (ts.isShorthandPropertyAssignment(prop)) entries.push([name, prop.name]);
      }
      // Altres claus (de, it...) hi poden ser: només es demanen els quatre idiomes de l'app.
      if (entries.length >= 2) {
        dictionaries++;
        const where = `${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
        const missing = LANGS.filter(l => !entries.some(([lang]) => lang === l));
        if (missing.length) problems.push(`${where}: falta ${missing.join(', ')}`);

        const shapes = entries.map(([lang, value]) => [lang, shapeOf(value, lang, consts)] as const);
        const paths = [...new Set(shapes.flatMap(([, shape]) => [...shape.keys()]))];
        for (const [lang, shape] of shapes) {
          const absent = paths.filter(p => !shape.has(p));
          if (absent.length) problems.push(`${where} [${lang}]: falten ${absent.join(', ')}`);
        }
        for (const path of paths) {
          const kinds = new Map<string, Lang[]>();
          for (const [lang, shape] of shapes) {
            const k = shape.get(path);
            if (k) kinds.set(k, [...(kinds.get(k) ?? []), lang]);
          }
          if (kinds.size > 1) {
            problems.push(`${where} ${path}: ${[...kinds].map(([k, langs]) => `${langs.join('/')} ${k}`).join(' · ')}`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { dictionaries, problems };
};

describe('Diccionaris locals (ca/es/en/fr)', () => {
  const results = Object.entries(SOURCES).map(([file, text]) => checkSource(file, text));

  it('es troben arreu de src', () => {
    // 87 a 53 fitxers el 17/11/2026: si en surten molts menys, és el glob o l'analitzador que no mira res.
    expect(results.reduce((n, r) => n + r.dictionaries, 0)).toBeGreaterThanOrEqual(50);
    expect(results.filter(r => r.dictionaries > 0).length).toBeGreaterThanOrEqual(30);
  });

  it('cap no deixa sense traduir cap idioma ni cap clau', () => {
    expect(results.flatMap(r => r.problems)).toEqual([]);
  });
});

describe("Diccionaris locals: l'eina troba els errors", () => {
  const check = (code: string) => checkSource('exemple.ts', code);

  it('un diccionari complet no té cap problema; les altres claus (de, it) hi poden ser', () => {
    expect(check(`const T = { ca: { a: '1', b: ['x'] }, es: { a: '1', b: ['x'] }, en: { a: '1', b: ['x'] }, fr: { a: '1', b: ['x'] } };`))
      .toEqual({ dictionaries: 1, problems: [] });
    expect(check(`const L = { ca: 'Catalan', es: 'Spanish', en: 'English', fr: 'French', de: 'German' };`).problems).toEqual([]);
  });

  it("un objecte amb un sol idioma no és un diccionari", () => {
    expect(check(`const X = { ca: 1, other: 2 };`).dictionaries).toBe(0);
  });

  it('un idioma que falta', () => {
    expect(check(`const T = { ca: { a: '1' }, es: { a: '1' }, en: { a: '1' } };`).problems)
      .toEqual(['exemple.ts:1: falta fr']);
  });

  it('una clau niada que falta', () => {
    const { problems } = check(`const T = {
      ca: { aria: { max: 'a', min: 'b' } }, es: { aria: { max: 'a' } },
      en: { aria: { max: 'a', min: 'b' } }, fr: { aria: { max: 'a', min: 'b' } },
    };`);
    expect(problems).toEqual(['exemple.ts:1 [es]: falten aria.min']);
  });

  it('una llista més curta', () => {
    const { problems } = check(`const T = { ca: ['a', 'b'], es: ['a'], en: ['a', 'b'], fr: ['a', 'b'] };`);
    expect(problems).toEqual(['exemple.ts:1 (valor): ca/en/fr llista de 2 · es llista de 1']);
  });

  it("un idioma que estén el diccionari d'un altre", () => {
    const { problems } = check(`const T = {
      ca: { ...C.ca, a: '1' }, es: { ...C.ca, a: '1' }, en: { ...C.en, a: '1' }, fr: { ...C.fr, a: '1' },
    };`);
    expect(problems).toContain('exemple.ts:1 [es]: falten ...C.<idioma>');
  });

  it('segueix les constants del mateix fitxer', () => {
    const { problems } = check(`
      const CA = { a: '1', b: '2' };
      const ES = { a: '1' };
      const T = { ca: CA, es: ES, en: CA, fr: CA };`);
    expect(problems).toEqual(['exemple.ts:4 [es]: falten b']);
  });
});
