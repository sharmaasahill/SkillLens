// Backend base URL. Set REACT_APP_API_URL in frontend/.env (see .env.example).
export const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
