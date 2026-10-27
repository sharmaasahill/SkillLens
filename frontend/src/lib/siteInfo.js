import { useEffect, useState } from 'react';
import api from '../api';

// Public facts from the server (is Google sign-in on, the contact email), asked once per page load
let request = null;
const EMPTY = { google_sign_in: false, contact_email: null, loaded: false };

export function loadSiteInfo() {
  if (!request) {
    request = api.get('/api/site')
      .then(({ data }) => ({ ...EMPTY, ...data, loaded: true }))
      .catch(() => ({ ...EMPTY, loaded: true }));
  }
  return request;
}

export function useSiteInfo() {
  const [info, setInfo] = useState(EMPTY);
  useEffect(() => {
    let alive = true;
    loadSiteInfo().then((data) => { if (alive) setInfo(data); });
    return () => { alive = false; };
  }, []);
  return info;
}
