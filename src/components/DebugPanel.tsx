// src/components/DebugPanel.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Move } from 'lucide-react';
import { WeatherData } from '../types/weather';

interface DebugPanelProps {
    weatherData: WeatherData | null;
    supportsArome: boolean;
    error: string | null;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ weatherData, supportsArome, error }) => {
    // Estat per la posició (inicialment fixat a dalt a l'esquerra)
    const [position, setPosition] = useState({ x: 20, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });

    // Gestió del ratolí (Desktop)
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStartPos.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    // Gestió del dit (Mòbil)
    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        const touch = e.touches[0];
        dragStartPos.current = {
            x: touch.clientX - position.x,
            y: touch.clientY - position.y
        };
    };

    // Efecte global per moure'l
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            e.preventDefault(); // Evita seleccionar text mentre arrossegues
            setPosition({
                x: e.clientX - dragStartPos.current.x,
                y: e.clientY - dragStartPos.current.y
            });
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            setPosition({
                x: touch.clientX - dragStartPos.current.x,
                y: touch.clientY - dragStartPos.current.y
            });
        };

        const handleStopDrag = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleStopDrag);
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleStopDrag);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleStopDrag);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleStopDrag);
        };
    }, [isDragging]);

    return (
        <div 
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
            className={`fixed p-4 bg-black/90 border ${isDragging ? 'border-green-400 cursor-grabbing' : 'border-green-500/30 cursor-grab'} text-green-400 font-mono text-[10px] rounded-lg shadow-2xl z-[9999] max-w-[250px] select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-200`}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
        >
            <h4 className="font-bold border-b border-green-500/30 mb-2 pb-1 flex justify-between items-center pointer-events-none">
                <span className="flex items-center gap-2">
                    <Move className="w-3 h-3" /> DIAGNOSTICS
                </span>
                <span className={`w-2 h-2 rounded-full ${isDragging ? 'bg-green-400 shadow-[0_0_10px_#4ade80]' : 'bg-green-600'} transition-all`}></span>
            </h4>
            
            <div className="space-y-1.5 opacity-90 pointer-events-none">
                <div className="flex justify-between"><span>LAT:</span> <span className="text-white">{weatherData?.location?.latitude.toFixed(6) || "N/A"}</span></div>
                <div className="flex justify-between"><span>LON:</span> <span className="text-white">{weatherData?.location?.longitude.toFixed(6) || "N/A"}</span></div>
                <div className="flex justify-between"><span>MODEL:</span> <span className="text-white">{supportsArome ? "AROME HD" : "ECMWF STD"}</span></div>
                <div className="flex justify-between"><span>MEM:</span> <span className="text-white">{performance.memory ? (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) + ' MB' : 'N/A'}</span></div>
                <div className="flex justify-between"><span>CACHE:</span> <span className="text-white">{localStorage.getItem('weatherCache') ? 'HIT' : 'MISS'}</span></div>
                <div className="flex justify-between"><span>ERRORS:</span> <span className={error ? "text-red-400" : "text-green-400"}>{error ? "YES" : "NO"}</span></div>
            </div>
            
            <div className="mt-2 text-[9px] text-green-500/50 text-center italic">
                {isDragging ? "Deixa anar per fixar" : "Arrossega per moure"}
            </div>
        </div>
    );
};

export default DebugPanel;