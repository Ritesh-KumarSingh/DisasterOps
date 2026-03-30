import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export function useDisasterEvents(pollInterval = 5000) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/disaster-events`);
      setEvents(res.data || []);
      setError(null);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch disaster events');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    intervalRef.current = setInterval(fetchEvents, pollInterval);
    return () => clearInterval(intervalRef.current);
  }, [fetchEvents, pollInterval]);

  const activeEvents = events.filter(e => e.status === 'active');

  return { events, activeEvents, loading, error, refetch: fetchEvents };
}

export async function createDisasterEvent(data) {
  const res = await axios.post(`${API_BASE}/disaster-events`, data);
  return res.data;
}

export async function resolveDisasterEvent(eventId) {
  const res = await axios.patch(`${API_BASE}/disaster-events/${eventId}`, { status: 'resolved' });
  return res.data;
}

export async function getDisasterEventDetails(eventId) {
  const res = await axios.get(`${API_BASE}/disaster-events/${eventId}`);
  return res.data;
}

export async function addEventZone(eventId, data) {
  const res = await axios.post(`${API_BASE}/disaster-events/${eventId}/zones`, data);
  return res.data;
}

export async function deleteEventZone(eventId, zoneId) {
  const res = await axios.delete(`${API_BASE}/disaster-events/${eventId}/zones/${zoneId}`);
  return res.data;
}

export async function addEventTask(eventId, data) {
  const res = await axios.post(`${API_BASE}/disaster-events/${eventId}/tasks`, data);
  return res.data;
}

export async function updateEventTask(eventId, taskId, data) {
  const res = await axios.patch(`${API_BASE}/disaster-events/${eventId}/tasks/${taskId}`, data);
  return res.data;
}
