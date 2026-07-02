interface WindMapProps {
  lat: number;
  lon: number;
}

export default function WindMap({ lat, lon }: WindMapProps) {
  // Integrem el widget oficial de Windy configurat per vent (wind) i model ECMWF.
  const windyUrl = `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=default&metricWind=km%2Fh&zoom=9&overlay=wind&product=ecmwf&level=surface&lat=${lat}&lon=${lon}`;

  return (
    <div className="w-full h-full bg-slate-900 relative">
      <iframe
        title="Mapa de Vent"
        src={windyUrl}
        className="absolute top-0 left-0 w-full h-full border-0"
        allowFullScreen
      ></iframe>
    </div>
  );
}