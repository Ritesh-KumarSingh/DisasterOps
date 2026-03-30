import { useKpis } from '../hooks/useMapState';

export default function KpiStrip() {
  const kpis = useKpis();
  const totalOpen = Object.values(kpis.open_by_severity).reduce((a, b) => a + b, 0);

  return (
    <div className="kpi-strip">
      <div className="kpi-card">
        <span className="kpi-value">{kpis.avg_response_time.toFixed(1)}</span>
        <span className="kpi-label">Avg ETA (min)</span>
      </div>
      <div className="kpi-card">
        <span className="kpi-value">{(kpis.utilization_rate * 100).toFixed(0)}%</span>
        <span className="kpi-label">Utilization</span>
      </div>
      <div className="kpi-card">
        <span className="kpi-value">{totalOpen}</span>
        <span className="kpi-label">Open</span>
      </div>
    </div>
  );
}
