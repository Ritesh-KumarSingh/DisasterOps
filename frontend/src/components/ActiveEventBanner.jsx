const EVENT_EMOJIS = {
  earthquake: '🏚️', flood: '🌊', cyclone: '🌀', wildfire: '🔥', tsunami: '🌊', industrial: '🏭', crime: '🚓'
};

export default function ActiveEventBanner({ activeEvents }) {
  if (!activeEvents || activeEvents.length === 0) return null;

  // If there are multiple, just show the most severe or the first one
  const primaryEvent = [...activeEvents].sort((a, b) => b.severity - a.severity)[0];
  const emoji = EVENT_EMOJIS[primaryEvent.type] || '⚠️';

  return (
    <div className="active-event-banner">
      <div className="banner-content">
        <span className="banner-icon pulse-icon">{emoji}</span>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="banner-title">
            ACTIVE DISASTER: {primaryEvent.type.toUpperCase()}
          </span>
          <span className="banner-sub">
            {primaryEvent.location_name || 'General Area'} • Severity {primaryEvent.severity}/5
          </span>
        </div>
      </div>
      <div className="banner-action">
        Stay safe and follow official instructions.
      </div>
    </div>
  );
}
