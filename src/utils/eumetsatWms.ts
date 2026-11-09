// src/utils/eumetsatWms.ts
// Les imatges (GetMap) del WMS d'EUMETSAT es demanen a l'adreça pròpia de cada capa (/geoserver/{espai}/{capa}/ows,
// la mateixa de les capacitats), no a la general /geoserver/wms. Mesurat 2026-11-09: la general tardava 13-16 s per
// imatge, i de vegades acabava en un 504 als ~15 s; la pròpia, 0,4-1 s, amb els mateixos bytes. El worker
// meteo-sat-proxy fa el mateix per a les capes del radar (eumetsatGetMapUrl).

/** Començament d'una GetMap d'EUMETSAT per a `layer` ("espai:capa"), fins a `layers=`; la resta de paràmetres, a continuació. */
export function eumetsatGetMap(layer: string): string {
  const [workspace, name] = layer.split(':');
  return `https://view.eumetsat.int/geoserver/${workspace}/${name}/ows?service=WMS&version=1.3.0&request=GetMap&layers=${name}`;
}
