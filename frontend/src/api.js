import axios from 'axios';

// The base URL for the API. In production (unified deployment), it should be relative.
// In development, it defaults to localhost:8000.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export default api;
export { API_BASE_URL };
