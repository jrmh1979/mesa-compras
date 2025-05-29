// src/services/api.js
import axios from 'axios';

const api = axios.create({
  // ✅ Usa variable de entorno en producción, localhost en desarrollo
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true, // Necesario para cookies y sesiones entre dominios
});

export default api;
