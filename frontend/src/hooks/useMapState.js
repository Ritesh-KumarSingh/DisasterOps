import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export function useMapState(pollInterval = 5000) {
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [hazardZones, setHazardZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const fetchMapState = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/map-state`);
      setIncidents(res.data.incidents || []);
      setResources(res.data.resources || []);
      setAssignments(res.data.assignments || []);
      setHazardZones(res.data.hazard_zones || []);
      setLastUpdated(new Date());
      setError(null);
      setLoading(false);
    } catch (err) {
      setError('Connection lost — retrying...');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMapState();
    intervalRef.current = setInterval(fetchMapState, pollInterval);
    return () => clearInterval(intervalRef.current);
  }, [fetchMapState, pollInterval]);

  return { incidents, resources, assignments, hazardZones, loading, error, lastUpdated, refetch: fetchMapState };
}

export function useKpis(pollInterval = 10000) {
  const [kpis, setKpis] = useState({
    avg_response_time: 0,
    utilization_rate: 0,
    open_by_severity: {},
  });

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const res = await axios.get(`${API_BASE}/kpis`);
        setKpis(res.data);
      } catch (err) {
        // silent fail
      }
    };
    fetchKpis();
    const interval = setInterval(fetchKpis, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval]);

  return kpis;
}

export async function createIncident(data) {
  const res = await axios.post(`${API_BASE}/incidents`, data);
  return res.data;
}

export async function assignResource(incidentId) {
  const res = await axios.post(`${API_BASE}/assign`, { incident_id: incidentId });
  return res.data;
}

export async function overrideAssignment(assignmentId, resourceId) {
  const res = await axios.post(`${API_BASE}/assignments/${assignmentId}/override`, {
    resource_id: resourceId,
  });
  return res.data;
}

export async function getAssignments() {
  const res = await axios.get(`${API_BASE}/assignments`);
  return res.data;
}

export async function updateAssignmentStatus(id, status) {
  const res = await axios.post(`${API_BASE}/assignments/${id}/status?status=${status}`);
  return res.data;
}

export async function resolveAssignment(id) {
  const res = await axios.post(`${API_BASE}/assignments/${id}/resolve`);
  return res.data;
}

export async function requestBackup(incidentId) {
  const res = await axios.post(`${API_BASE}/incidents/${incidentId}/backup`);
  return res.data;
}

