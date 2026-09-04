// src/hooks/welcome/useWeatherParticles.ts
import { useState, useEffect } from 'react';

export interface Particle { id: number; left: string; top: string; size: string; duration: string; delay: string; drift: string; }
export interface Drop { id: number; left: string; delay: string; z: string; }
export interface Cloud { id: number; y: string; delay: string; z: string; }

/**
 * Genera l'animació de fons atmosfèrica de WelcomeScreen: partícules
 * ascendents, gotes de pluja i núvols amb posicions/temporitzacions
 * aleatòries generades un cop en muntar-se, més el cicle tempesta/sol
 * cada 8 segons que en tenyeix el color (isStorm).
 */
export function useWeatherParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [precipDrops, setPrecipDrops] = useState<Drop[]>([]);
  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  const [weatherPhase, setWeatherPhase] = useState<'storm' | 'sun'>('storm');
  const isStorm = weatherPhase === 'storm';

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

      setParticles(Array.from({ length: isMobile ? 12 : 30 }).map((_, i) => ({
        id: i, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
        size: `${Math.random() * 2 + 1}px`, duration: `${5 + Math.random() * 15}s`,
        delay: `-${Math.random() * 15}s`, drift: `${(Math.random() - 0.5) * 80}px`
      })));

      setPrecipDrops(Array.from({ length: isMobile ? 15 : 40 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 140 + 10}px`,
        delay: `-${Math.random() * 5}s`,
        z: `${Math.random() * 140 - 70}px`
      })));

      setClouds(Array.from({ length: isMobile ? 3 : 8 }).map((_, i) => ({
        id: i,
        y: `${Math.random() * 120 + 20}px`,
        delay: `-${Math.random() * 15}s`,
        z: `${Math.random() * 140 - 70}px`
      })));
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWeatherPhase(prev => prev === 'storm' ? 'sun' : 'storm');
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return { particles, precipDrops, clouds, isMounted, isStorm };
}
