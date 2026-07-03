import React from 'react';

export const ConsensusInactiveWidget: React.FC = () => {
  return (
    <div className="w-full bg-gray-800/60 border border-gray-700 rounded-xl p-5 flex flex-col items-center justify-center text-center space-y-3 shadow-lg">
      <div className="text-gray-500">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-9 w-9 mx-auto mb-1" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
      </div>
      
      <div>
        <h3 className="text-gray-300 font-semibold text-sm uppercase tracking-wider mb-2">
          Giny de Consens Inactiu
        </h3>
        <p className="text-gray-400 text-xs leading-relaxed max-w-sm mx-auto">
          Estàs consultant una ubicació fora del teu fus horari local. El detector de consens requereix sincronització en temps real per garantir dades 100% tàctiques i fiables.
        </p>
      </div>
    </div>
  );
};