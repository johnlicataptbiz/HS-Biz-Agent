import { getApiUrl } from './config';

interface ContactAnalytics {
  leadSources: Record<string, number>;
  formSubmissions: Record<string, number>;
  landingPages: Record<string, number>;
  pageTitles: Record<string, number>;
  lifecycleBreakdown: Record<string, { count: number; avgScore: number }>;
  classificationBreakdown: Record<string, { count: number; avgScore: number }>;
  ownerDistribution: Record<string, number>;
  contactsWithDeals: number;
  activity: {
    last7Days: number;
    last30Days: number;
    last60Days: number;
    last90Days: number;
    total: number;
  };
  hotLeads: Array<{
    id: string;
    email: string;
    name: string;
    score: number;
    classification: string;
    stage: string;
    lastModified: string;
  }>;
}

let cachedAnalytics: ContactAnalytics | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Fetch contact analytics from database
 * Uses caching to avoid excessive API calls
 */
export const fetchContactAnalytics = async (): Promise<ContactAnalytics | null> => {
  // Return cached data if fresh
  if (cachedAnalytics && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedAnalytics;
  }

  try {
    const resp = await fetch(getApiUrl('/api/contacts-analytics'));
    if (!resp.ok) {
      console.warn('Contact analytics fetch failed:', resp.status);
      return cachedAnalytics; // Return stale cache on error
    }
    
    const data = await resp.json();
    if (data.success && data.analytics) {
      cachedAnalytics = data.analytics;
      cacheTimestamp = Date.now();
      return data.analytics;
    }
    return null;
  } catch (e) {
    console.error('Contact analytics error:', e);
    return cachedAnalytics; // Return stale cache on error
  }
};

/**
 * Get form submission counts from database
 * Use this to supplement HubSpot form data
 */
export const getFormSubmissionCounts = async (): Promise<Record<string, number>> => {
  const analytics = await fetchContactAnalytics();
  return analytics?.formSubmissions || {};
};

/**
 * Get lead source distribution from database
 */
export const getLeadSourceCounts = async (): Promise<Record<string, number>> => {
  const analytics = await fetchContactAnalytics();
  return analytics?.leadSources || {};
};

/**
 * Get lifecycle stage breakdown with average scores
 */
export const getLifecycleBreakdown = async () => {
  const analytics = await fetchContactAnalytics();
  return analytics?.lifecycleBreakdown || {};
};

/**
 * Get high-priority leads from database
 */
export const getHotLeads = async () => {
  const analytics = await fetchContactAnalytics();
  return analytics?.hotLeads || [];
};

/**
 * Get activity summary
 */
export const getActivitySummary = async () => {
  const analytics = await fetchContactAnalytics();
  return analytics?.activity || { last7Days: 0, last30Days: 0, last60Days: 0, last90Days: 0, total: 0 };
};

/**
 * Clear the cache (call after sync operations)
 */
export const clearAnalyticsCache = () => {
  cachedAnalytics = null;
  cacheTimestamp = 0;
};
