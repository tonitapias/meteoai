// src/components/sky/skyStyles.ts
// El llenguatge dels plafons de la pestanya Cel: el mateix de Previsió (ForecastSection, SmartForecastCharts) i del
// detall del dia: plafó fosc amb la quadrícula, etiqueta mono fina a dalt, línies primes entre files, cap capsa dins
// d'una altra. Sense blur, filtres ni animacions infinites (mòbils de gama baixa).

/** El plafó (s'hi afegeix MATRIX_BG a dins). */
export const SKY_PANEL = 'relative flex flex-col overflow-hidden rounded-[2rem] border border-white/[0.07] bg-gradient-to-b from-[#0e1018] to-[#0a0b11]';
/** Marges laterals de les files, els de Previsió. */
export const SKY_PAD = 'px-4 sm:px-5 md:px-6';
/** Etiqueta de dalt del plafó. */
export const SKY_EYEBROW = 'font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400';
/** Etiqueta petita d'un valor (SORTIDA, NÚVOLS...). */
export const SKY_LABEL = 'font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a879b]';
/** Línia de separació entre files. */
export const SKY_RULE = 'border-t border-white/[0.06]';
/** Pista d'una franja (la de Previsió). */
export const SKY_TRACK = 'relative block rounded-full overflow-hidden bg-white/[0.05]';
/** Vora interior de la franja, per sobre dels colors. */
export const SKY_TRACK_EDGE = 'absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]';
/** El tram ja passat d'una franja, apagat (com les hores passades d'avui a Previsió). */
export const SKY_PAST = 'absolute inset-y-0 left-0 bg-[#0a0b11]/60';
/** La marca d'ara sobre una franja (la de Previsió). */
export const SKY_NOW_TICK = 'absolute -top-1 w-0.5 -ml-px rounded-full bg-slate-50';
/** Regle d'hores sota una franja. */
export const SKY_RULER = 'relative block h-4 font-mono text-[10px] leading-none text-[#7a879b] tabular-nums';
