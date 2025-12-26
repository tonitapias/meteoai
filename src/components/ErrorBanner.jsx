import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ErrorBanner({ message }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-6 rounded-2xl flex items-center justify-center gap-3 animate-in shake">
        <AlertTriangle className="w-6 h-6" strokeWidth={2.5}/> <span className="font-medium">{message}</span>
    </div>
  );
}