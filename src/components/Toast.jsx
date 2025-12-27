// src/components/Toast.jsx
import React, { useEffect } from 'react';
import { Info, AlertTriangle, CheckCircle } from 'lucide-react';

export default function Toast({ message, type = 'info', onClose, duration = 3000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
        onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const styles = {
    info: "bg-slate-800/90 border-slate-600 text-slate-100",
    error: "bg-red-500/90 border-red-400 text-white",
    success: "bg-green-500/90 border-green-400 text-white"
  };

  const icons = {
    info: <Info className="w-5 h-5" />,
    error: <AlertTriangle className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5 fade-in duration-300 pointer-events-none">
       <div className={`flex items-center gap-3 px-5 py-3 rounded-full shadow-2xl backdrop-blur-md border pointer-events-auto ${styles[type] || styles.info}`}>
          {icons[type] || icons.info}
          <span className="text-sm font-medium tracking-wide">{message}</span>
       </div>
    </div>
  );
}