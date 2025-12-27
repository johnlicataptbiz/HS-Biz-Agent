/**
 * Utility to determine the correct API base URL.
 * In production (Surge), we point to the Vercel hosted backend.
 */
export const getApiUrl = (path: string): string => {
  const host = window.location.hostname;
  const isSurge = host.includes('surge.sh');
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  
  // If on Surge or Local, use the Vercel production backend for API calls.
  // This allows the static frontend to talk to the serverless backend.
  if (isSurge || isLocal) {
    const apiBase = 'https://hubspot-ai-optimizer-murex.vercel.app';
    return `${apiBase}${path}`;
  }
  
  // On Vercel, keep using relative paths.
  return path;
};
