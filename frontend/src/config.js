// Backend base URL. Set REACT_APP_API_URL in frontend/.env (see .env.example).
// A production build is served by the backend itself, so it calls the API on its own address ('').
const fallback = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';
export const API_URL = (process.env.REACT_APP_API_URL || fallback).replace(/\/$/, '');
