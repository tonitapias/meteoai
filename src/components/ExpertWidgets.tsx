// src/components/ExpertWidgets.tsx
// La part de ginys de la vista completa: el «Motor de consens» (ConsensusSection) i, a sota, la graella dels 11 ginys
// de detall (DetailWidgetsGrid). Abans tot el codi vivia aquí; ara són dues peces que es poden fer servir per separat.
import ConsensusSection from './ConsensusSection';
import DetailWidgetsGrid, { type DetailWidgetsGridProps } from './DetailWidgetsGrid';

type ExpertWidgetsProps = Omit<DetailWidgetsGridProps, 'ids' | 'className'>;

export default function ExpertWidgets(props: ExpertWidgetsProps) {
  return (
    <>
      <ConsensusSection weatherData={props.weatherData} lang={props.lang} className="w-full mb-6" />
      <DetailWidgetsGrid {...props} />
    </>
  );
}
