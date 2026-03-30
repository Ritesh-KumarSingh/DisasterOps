import { useState, useEffect, useCallback } from 'react';
import { createIncident } from '../hooks/useMapState';
import axios from 'axios';

export default function SosForm({ onClose, onSubmit, userLoc }) {
  const [formData, setFormData] = useState({
    type: 'flood',
    severity: 3,
    lat: userLoc?.lat?.toFixed(4) || '',
    lng: userLoc?.lng?.toFixed(4) || '',
    location_desc: '',
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [nlpFeedback, setNlpFeedback] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Gemini NLP Triage
  // ---------------------------------------------------------------------------
  const runNlpTriage = useCallback(async (text) => {
    if (!text || text.length < 5) return;
    setNlpLoading(true);
    setNlpFeedback('🧠 AI is analyzing your report...');
    try {
      const res = await axios.post('/nlp-triage', { text });
      const triage = res.data;
      setFormData(prev => ({
        ...prev,
        type: triage.type || prev.type,
        severity: triage.severity || prev.severity,
        location_desc: text,
      }));
      const src = triage.source === 'gemini' ? '🤖 Gemini AI' : '⚡ Keyword Fallback';
      setNlpFeedback(`${src} → ${triage.type.toUpperCase()} | Severity ${triage.severity}/5 | Skills: ${triage.required_skills.join(', ')}`);
      speakConfirmation(triage.type, triage.severity);
    } catch (err) {
      console.error('NLP triage failed:', err);
      setNlpFeedback('⚠ AI triage unavailable. Please select type manually.');
    }
    setNlpLoading(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Speech Tools (STT & TTS)
  // ---------------------------------------------------------------------------
  const speakConfirmation = (type, severity) => {
    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance();
      msg.text = `I've recorded a level ${severity} ${type} at your location. Please confirm and submit.`;
      window.speechSynthesis.speak(msg);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const text = event.results[current][0].transcript;
      setTranscript(text);
      if (event.results[current].isFinal) {
        runNlpTriage(text);
      }
    };

    recognition.start();
  };

  // ---------------------------------------------------------------------------
  // Standard Form Logic
  // ---------------------------------------------------------------------------
  const handleGeolocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData(prev => ({
            ...prev,
            lat: pos.coords.latitude.toFixed(4),
            lng: pos.coords.longitude.toFixed(4),
          }));
        },
        () => alert('Geolocation failed. Please enter coordinates manually.'),
      );
    }
  };

  useEffect(() => {
    // Auto-geolocate on mount for SOS
    handleGeolocate();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.lat || !formData.lng) {
      alert('Please provide location coordinates.');
      return;
    }
    setLoading(true);
    try {
      const data = {
        type: formData.type,
        severity: parseInt(formData.severity),
        lat: parseFloat(formData.lat),
        lng: parseFloat(formData.lng),
        location_desc: formData.location_desc,
      };
      const incident = await createIncident(data);
      setResult(incident);
      if (onSubmit) onSubmit(incident);
    } catch (err) {
      alert('Failed to submit report. Try again.');
    }
    setLoading(false);
  };

  // Debounced text input triage
  const [triageTimer, setTriageTimer] = useState(null);
  const handleDescChange = (text) => {
    setFormData(prev => ({ ...prev, location_desc: text }));
    setTranscript(text);
    if (triageTimer) clearTimeout(triageTimer);
    if (text.length > 10) {
      const t = setTimeout(() => runNlpTriage(text), 1500);
      setTriageTimer(t);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="sos-modal">
        <button className="drawer-close" onClick={onClose}>×</button>
        <div className="sos-header">
          <span className="sos-icon">🆘</span>
          <h2>Crisis Report</h2>
        </div>

        {result ? (
          <div className="sos-success">
            <div className="success-icon">✅</div>
            <h3>Critical Message Sent</h3>
            <p>Verification ID: <strong>{result.id}</strong></p>
            <p>Priority Tier: <strong>{result.priority_score}</strong></p>
            <button className="action-btn" onClick={onClose}>Finish</button>
          </div>
        ) : (
          <div className="sos-stack">
            {/* Voice Mode */}
            <div className="voice-sos-container">
              <button 
                className={`mic-btn ${isListening ? 'listening' : ''}`} 
                onClick={toggleListening}
                type="button"
              >
                {isListening ? '🛑' : '🎤'}
              </button>
              <p className="transcript-preview">
                {isListening ? 'Listening...' : (transcript || 'Tap the mic and describe what\'s happening.')}
              </p>
            </div>

            {/* NLP Feedback */}
            {nlpFeedback && (
              <div style={{
                padding: '10px 14px',
                background: nlpLoading ? 'var(--blue-lt)' : 'var(--green-lt)',
                border: `1px solid ${nlpLoading ? '#bfdbfe' : '#bbf7d0'}`,
                borderRadius: 'var(--r-sm)',
                fontSize: '12px',
                fontWeight: 600,
                color: nlpLoading ? 'var(--blue)' : 'var(--green)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                {nlpLoading && <span className="spinner-small" />}
                {nlpFeedback}
              </div>
            )}

            <div className="divider"><span>DESCRIBE OR MANUAL ENTRY</span></div>

            <form onSubmit={handleSubmit} className="sos-form">
              {/* Free-text description — triggers AI triage */}
              <div className="form-group">
                <label>Describe the Emergency</label>
                <textarea
                  rows={3}
                  placeholder='e.g. "I see flames coming out of the second floor, people are screaming"'
                  value={formData.location_desc}
                  onChange={e => handleDescChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'var(--bg-subtle)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontFamily: 'Inter, sans-serif',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>
              
              <div className="form-group">
                <label>Incident Type {nlpFeedback && <span style={{ fontSize: '10px', color: 'var(--blue)', fontWeight: 700 }}>AI FILLED</span>}</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                >
                  <option value="flood">Flood</option>
                  <option value="fire">Fire</option>
                  <option value="medical">Medical</option>
                  <option value="structural">Structural</option>
                  <option value="crime">Crime</option>
                </select>
              </div>

              <div className="form-group">
                <label>Severity Level {nlpFeedback && <span style={{ fontSize: '10px', color: 'var(--blue)', fontWeight: 700 }}>AI FILLED</span>}</label>
                <div className="severity-radios">
                  {[1, 2, 3, 4, 5].map(s => (
                    <label key={s} className={`severity-radio ${formData.severity === s ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="severity"
                        value={s}
                        checked={formData.severity === s}
                        onChange={() => setFormData(prev => ({ ...prev, severity: s }))}
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Location Context</label>
                <div className="coord-row">
                  <input
                    type="number"
                    placeholder="Lat"
                    step="any"
                    value={formData.lat}
                    onChange={e => setFormData(prev => ({ ...prev, lat: e.target.value }))}
                  />
                  <input
                    type="number"
                    placeholder="Lng"
                    step="any"
                    value={formData.lng}
                    onChange={e => setFormData(prev => ({ ...prev, lng: e.target.value }))}
                  />
                </div>
              </div>

              <button type="submit" className="action-btn sos-submit" disabled={loading}>
                {loading ? 'Transmitting...' : '🚀 SEND SOS SIGNAL'}
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
