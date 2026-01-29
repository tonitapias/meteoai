// src/components/ErrorBanner.tsx
import React, { useMemo } from 'react';
import { AlertCircle, WifiOff, ServerCrash, FileWarning } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
}

export default function ErrorBanner({ message }: ErrorBannerProps) {
  
  // --- SISTEMA DE SANITITZACIÓ D'ERRORS ---
  // Analitza el missatge tècnic (lleig) i retorna un missatge d'usuari (amable)
  // i una icona adequada al context.
  const { safeMessage, Icon } = useMemo(() => {
    const raw = message.toLowerCase();

    // 1. Errors de Xarxa / Internet
    if (raw.includes('fetch') || raw.includes('network') || raw.includes('failed to connect')) {
      return { 
        safeMessage: "No s'ha pogut connectar. Comprova la teva connexió a internet.",
        Icon: WifiOff
      };
    }

    // 2. Errors de Servidor (500, 502, etc)
    if (raw.includes('500') || raw.includes('server error') || raw.includes('upstream')) {
      return { 
        safeMessage: "El servidor meteorològic no respon temporalment. Torna-ho a provar en uns minuts.",
        Icon: ServerCrash
      };
    }

    // 3. Errors de Dades (JSON mal format, etc)
    if (raw.includes('json') || raw.includes('syntax') || raw.includes('token') || raw.includes('parse')) {
      return { 
        safeMessage: "Error en processar les dades rebudes. S'ha notificat el problema.",
        Icon: FileWarning
      };
    }

    // 4. Timeouts (Lentitud)
    if (raw.includes('timeout') || raw.includes('timed out') || raw.includes('abort')) {
      return { 
        safeMessage: "La petició ha trigat massa. La xarxa sembla lenta.",
        Icon: WifiOff
      };
    }

    // 5. Fallback (Si l'error és net o desconegut, el mostrem tal qual, 
    // però netejant prefixos lletjos com 'Error:')
    return { 
      safeMessage: message.replace(/^Error:\s*/i, ''),
      Icon: AlertCircle
    };
  }, [message]);

  return (
    <div className="w-full p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 backdrop-blur-md flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-lg shadow-rose-900/5 select-none">
      <div className="p-2 rounded-full bg-rose-500/10 text-rose-400 shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      
      <div className="flex flex-col gap-1 pt-0.5">
        <h3 className="text-sm font-bold text-rose-200 uppercase tracking-wider">
            Atenció
        </h3>
        <p className="text-xs md:text-sm text-rose-300/80 font-medium leading-relaxed">
            {safeMessage}
        </p>
      </div>
    </div>
  );
}