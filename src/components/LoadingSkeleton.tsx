// src/components/LoadingSkeleton.tsx
// L'esquelet ocupa com a mínim tota la pantalla: si era més baix, el peu de pàgina es veia a baix de tot mentre es
// carregava la previsió i, quan arribava el contingut, saltava fora de la pantalla (CLS de 0,26 a 1440 px en obrir un
// enllaç d'un lloc; auditoria d'UX del 16/11/2026, M8).
export default function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6 min-h-screen">
        <div className="h-64 bg-slate-800/50 rounded-[2.5rem] w-full"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="grid grid-cols-2 gap-4 h-48">
                {[1,2,3,4].map(i => <div key={i} className="bg-slate-800/50 rounded-2xl h-full"></div>)}
            </div>
            <div className="lg:col-span-2 bg-slate-800/50 rounded-3xl h-48"></div>
        </div>
    </div>
  );
}
