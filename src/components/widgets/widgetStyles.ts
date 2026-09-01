// src/components/widgets/widgetStyles.ts

export const WIDGET_BASE_STYLE = "bg-gradient-to-br from-[#1a1d2d] to-[#11131f] border border-white/10 p-5 md:p-6 rounded-[2rem] relative group transition-all duration-500 hover:border-indigo-500/30 hover:shadow-[0_15px_40px_-10px_rgba(0,0,0,0.6)] h-full flex flex-col justify-between overflow-hidden ring-1 ring-white/5";

export const TITLE_STYLE = "text-[10px] font-black text-indigo-200/60 uppercase tracking-[0.25em] mb-4 flex items-center gap-2 relative z-10";

// [NETEJA] Abans hi havia 19 còpies idèntiques d'aquesta mateixa capa de fons
// ("matriu" tàctica) escampades per components i widgets. Centralitzades aquí;
// les variants d'opacitat/mida úniques (una sola aparició cadascuna) es queden
// com a constants locals allà on viuen, ja que no estan duplicades enlloc més.
export const MATRIX_BG = "absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]";
export const MATRIX_BG_RESPONSIVE = "absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px] md:bg-[size:16px_16px]";