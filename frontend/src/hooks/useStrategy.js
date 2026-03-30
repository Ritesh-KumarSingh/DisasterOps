import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export function useStrategy() {
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStrategy = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/multi-agent/strategy`);
      if (!resp.ok) throw new Error('Failed to fetch strategy');
      const data = await resp.json();
      setStrategy(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerAnalysis = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/multi-agent/trigger`, { method: 'POST' });
      if (!resp.ok) throw new Error('Failed to trigger analysis');
      const data = await resp.json();
      setStrategy(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategy();
    const interval = setInterval(fetchStrategy, 15000);
    return () => clearInterval(interval);
  }, []);

  return { strategy, loading, error, triggerAnalysis };
}
