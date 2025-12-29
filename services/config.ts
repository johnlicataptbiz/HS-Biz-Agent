/**
 * Utility to determine the correct API base URL.
 * In production (Surge), we point to the Vercel hosted backend.
 */
export const getApiUrl = (path: string): string => {
  // Always route API calls to the Railway backend regardless of deployment environment.
  const apiBase = 'https://web-production-249d7e.up.railway.app';
  return `${apiBase}${path}`;
};
