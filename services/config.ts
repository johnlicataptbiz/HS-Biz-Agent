/**
 * Utility to determine the correct API base URL.
 * In production (Surge), point at the dedicated backend (e.g. Railway).
 */
export const getApiUrl = (path: string): string => {
  const rawBase =
    import.meta.env.VITE_API_BASE ||
    import.meta.env.VITE_API_URL ||
    '';
  const apiBase = rawBase ? rawBase.replace(/\/+$/, '') : '';

  if (apiBase) {
    return `${apiBase}${path}`;
  }

  // Default to same-origin if no explicit backend is configured.
  return `${window.location.origin}${path}`;
};
