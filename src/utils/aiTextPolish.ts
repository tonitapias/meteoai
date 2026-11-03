// src/utils/aiTextPolish.ts
// Correccions mecàniques del català que escriu la IA (text de l'anàlisi +6h i consells). El prompt del worker ja
// demana un català correcte, però Flash-Lite i sobretot Groq (que respon quan Gemini triga) cometen sempre els
// mateixos errors de forma: "la temperatura és de 11 °C", "a 17:00", "plourà moderada", "en aquests moments".
// Aquí només hi ha regles sense ambigüitat, que no poden fer malbé una frase correcta; els errors de sentit
// ("plourà" quan neva, gerundis) són feina del prompt.

type Replacement = string | ((match: string, ...groups: string[]) => string);

// Sense `\b`: en JavaScript les lletres accentuades no són "de paraula" i "plourà" no hi encaixaria.
const NOT_LETTER_BEFORE = String.raw`(?<!\p{L})`;
const NOT_LETTER_AFTER = String.raw`(?!\p{L})`;
const HOUR = String.raw`\d{1,2}:\d{2}`;

const CATALAN_RULES: ReadonlyArray<readonly [RegExp, Replacement]> = [
    // L'hora porta article: "a 17:00" -> "a les 17:00", "de 09:00 fins a 14:00" -> "de les 09:00 fins a les 14:00",
    // "entre les 16:00 i 18:00" -> "... i les 18:00".
    [new RegExp(`${NOT_LETTER_BEFORE}([Aa]|[Dd]e|i|[Ee]ntre) (?=${HOUR}(?!\\d))`, 'gu'), '$1 les '],
    // La una és singular: "les 1:00" / "les 01:00" -> "la 1:00".
    [new RegExp(`${NOT_LETTER_BEFORE}([Ll])es (0?1:\\d{2})(?!\\d)`, 'gu'), (_, l: string, h: string) => `${l}a ${h}`],
    // S'apostrofa davant d'1 i d'11 ("u", "onze"): "de 11 °C" -> "d'11 °C". Les hores ja duen article (regles d'abans).
    [new RegExp(`${NOT_LETTER_BEFORE}([Dd])e (1|11)(?![\\d:])`, 'gu'), "$1'$2"],
    // L'adjectiu no fa d'adverbi: "plourà moderada" -> "plourà de manera moderada" ("plou fort" sí que és correcte).
    [new RegExp(`${NOT_LETTER_BEFORE}([Pp]lourà|[Pp]loure|[Pp]lou|plovent|plogui|[Nn]evarà|[Nn]evar|[Nn]eva|nevant|nevi) (feble|moderada|forta|intensa|torrencial)${NOT_LETTER_AFTER}`, 'gu'), '$1 de manera $2'],
    [new RegExp(`${NOT_LETTER_BEFORE}amb (feble|moderada|forta) intensitat${NOT_LETTER_AFTER}`, 'gu'), 'amb intensitat $1'],
    // Calcs del castellà ("en estos momentos", "de cara a la noche").
    [new RegExp(`${NOT_LETTER_BEFORE}en aquests moments${NOT_LETTER_AFTER}`, 'gu'), 'ara mateix'],
    [new RegExp(`${NOT_LETTER_BEFORE}([Dd])e cara (al vespre|a la nit|a la tarda|al matí|a la matinada|al migdia)${NOT_LETTER_AFTER}`, 'gu'),
        (_, d: string, when: string) => `${d === 'D' ? 'C' : 'c'}ap ${when}`],
    // Un espai entre la xifra i la unitat ("-1°C" -> "-1 °C") i la coma decimal ("4.8 mm" -> "4,8 mm"). Només davant
    // d'una unitat: "20.00 h" és una hora ben escrita.
    [/(\d)°C/g, '$1 °C'],
    [/(\d)\.(\d+)(?= ?(?:mm|°|km\/h|%|cm))/g, '$1,$2'],
];

const applyRules = (text: string, rules: ReadonlyArray<readonly [RegExp, Replacement]>): string =>
    rules.reduce((acc, [re, rep]) => (typeof rep === 'string' ? acc.replace(re, rep) : acc.replace(re, rep)), text);

/** Text de la IA amb els errors mecànics de llengua corregits. Ara només per al català; la resta d'idiomes no es toca. */
export const polishAiText = (text: string, lang: string): string =>
    lang === 'ca' ? applyRules(text, CATALAN_RULES) : text;
