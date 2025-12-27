#!/usr/bin/env node
/**
 * Verifies "Lead Magnet" submission counts against HubSpot APIs.
 *
 * Usage:
 *   HUBSPOT_ACCESS_TOKEN=... node scripts/verify-lead-magnets.mjs
 *   HUBSPOT_ACCESS_TOKEN=... node scripts/verify-lead-magnets.mjs --json
 *
 * Notes:
 * - This script intentionally mirrors the app’s `HubSpotService.fetchForms()` priority order.
 * - It never prints your token.
 */
const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");

const token = process.env.HUBSPOT_ACCESS_TOKEN;
if (!token) {
  console.error("Missing env var: HUBSPOT_ACCESS_TOKEN");
  console.error(
    "Example: HUBSPOT_ACCESS_TOKEN=... node scripts/verify-lead-magnets.mjs"
  );
  process.exit(2);
}

const apiBase = (process.env.HUBSPOT_API_BASE || "https://api.hubapi.com").replace(
  /\/$/,
  ""
);

async function hubspot(path, { method = "GET", query, body } = {}) {
  const url = new URL(apiBase + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await resp.text();
  const data = text ? JSON.parse(text) : null;

  return { ok: resp.ok, status: resp.status, data };
}

function isLeadMagnetFormName(name) {
  const nameLower = String(name || "").toLowerCase();
  return (
    nameLower.includes("guide") ||
    nameLower.includes("ebook") ||
    nameLower.includes("download") ||
    nameLower.includes("hiring") ||
    nameLower.includes("blueprint")
  );
}

function pickDeepSubmissionCount(deepData) {
  return Number(
    deepData?.performance?.submissionsCount ||
      deepData?.submissionsCount ||
      deepData?.formResponseCount ||
      0
  );
}

function pickShallowSubmissionCount(form, analyticsDataMap) {
  const guid = form?.guid ? String(form.guid) : "";
  return Number(
    analyticsDataMap[guid] ||
      form?.performance?.submissionsCount ||
      form?.submissionsCount ||
      0
  );
}

const analyticsDataMap = {};
const end = Date.now();
const start = end - 1000 * 60 * 60 * 24 * 365 * 10; // 10 years
const limit = 100;
let offset = 0;
let total = null;
let analyticsStatus = null;

while (true) {
  const analytics = await hubspot("/analytics/v2/reports/forms/total", {
    query: { limit, start, end, offset },
  });
  analyticsStatus = analytics.status;
  if (!analytics.ok) break;

  total = typeof analytics.data?.total === "number" ? analytics.data.total : total;
  const breakdowns = analytics.data?.breakdowns || [];
  for (const item of breakdowns) {
    const id = item?.breakdown || item?.id || item?.rowId;
    if (!id) continue;
    analyticsDataMap[String(id)] = Number(item?.submissions || 0);
  }

  const nextOffset =
    typeof analytics.data?.offset === "number" ? analytics.data.offset : null;
  if (!nextOffset) break;
  if (total !== null && nextOffset >= total) break;
  if (nextOffset === offset) break;
  offset = nextOffset;
}

const pageSubmissionsMap = {};
const pageFetchMeta = { landingStatus: null, siteStatus: null, pagesMapped: 0 };
try {
  const landing = await hubspot("/cms/v3/pages/landing-pages", {
    query: { limit: 100, sort: "-updatedAt" },
  });
  const site = await hubspot("/cms/v3/pages/site-pages", {
    query: { limit: 100, sort: "-updatedAt" },
  });

  pageFetchMeta.landingStatus = landing.status;
  pageFetchMeta.siteStatus = site.status;

  const landingPages = landing.ok ? landing.data?.results || [] : [];
  const sitePages = site.ok ? site.data?.results || [] : [];
  const allPages = [...landingPages, ...sitePages];

  for (const p of allPages) {
    const pName = String(p?.name || p?.htmlTitle || p?.slug || "")
      .toLowerCase()
      .trim();
    if (!pName) continue;
    const subs = Number(
      p?.stats?.submissions ||
        p?.performance?.submissionsCount ||
        p?.totalStats?.submissions ||
        0
    );
    pageSubmissionsMap[pName] = subs;
  }
  pageFetchMeta.pagesMapped = Object.keys(pageSubmissionsMap).length;
} catch {
  // Ignore correlation setup errors; we'll report status fields where possible
}

const formsResp = await hubspot("/forms/v2/forms");
if (!formsResp.ok) {
  console.error(
    `Failed to fetch forms: ${formsResp.status} (need 'forms' scope + HubSpot access token)`
  );
  process.exit(1);
}

const forms = Array.isArray(formsResp.data) ? formsResp.data : [];
const results = [];

for (const form of forms) {
  const guid = form?.guid ? String(form.guid) : "";
  const name = String(form?.name || "Unnamed Form");
  const leadMagnet = isLeadMagnetFormName(name);

  let submissions = pickShallowSubmissionCount(form, analyticsDataMap);
  let source =
    analyticsDataMap[guid] !== undefined
      ? "analytics/v2"
      : form?.performance?.submissionsCount !== undefined
        ? "forms/v2(performance)"
        : form?.submissionsCount !== undefined
          ? "forms/v2(submissionsCount)"
          : "none";

  let deepSubmissions = null;
  let deepStatus = null;

  if (submissions === 0 && leadMagnet && guid) {
    const deep = await hubspot(`/forms/v2/forms/${guid}`);
    deepStatus = deep.status;
    if (deep.ok) {
      deepSubmissions = pickDeepSubmissionCount(deep.data);
      if (deepSubmissions > 0) {
        submissions = deepSubmissions;
        source = "forms/v2(deep)";
      }
    }
  }

  results.push({
    guid,
    name,
    leadMagnet,
    submissions,
    source,
    deepSubmissions,
    deepStatus,
    matchedPageName: null,
  });
}

// Priority 3: Page fuzzy-match adoption (mirrors app logic)
for (const r of results) {
  if (r.submissions !== 0) continue;
  const nameLower = String(r.name || "").toLowerCase();
  const stopWords = [
    "form",
    "copy",
    "landing",
    "page",
    "blueprint",
    "guide",
    "lead",
    "magnet",
    "opt-in",
    "download",
    "thank",
    "you",
    "confirmation",
  ];
  const formWords = nameLower
    .split(/[^a-z0-9]/)
    .filter((w) => w.length > 3 && !stopWords.includes(w));

  const matchedName = Object.keys(pageSubmissionsMap).find((pN) => {
    const pageWords = pN
      .split(/[^a-z0-9]/)
      .filter((w) => w.length > 3 && !stopWords.includes(w));
    return (
      formWords.some((fw) => pageWords.includes(fw)) ||
      pN.includes(nameLower) ||
      nameLower.includes(pN)
    );
  });

  if (matchedName) {
    const adopted = Number(pageSubmissionsMap[matchedName] || 0);
    if (adopted > 0) {
      r.submissions = adopted;
      r.source = "cms/v3(fuzzy)";
      r.matchedPageName = matchedName;
    }
  }
}

const leadMagnets = results
  .filter((r) => r.leadMagnet)
  .sort((a, b) => b.submissions - a.submissions);

const top5 = leadMagnets.filter((r) => r.submissions > 0).slice(0, 5);

if (asJson) {
  process.stdout.write(
    JSON.stringify(
      {
        meta: {
          apiBase,
          analyticsStatus,
          analyticsMapped: Object.keys(analyticsDataMap).length,
          pagesMapped: pageFetchMeta.pagesMapped,
          landingPagesStatus: pageFetchMeta.landingStatus,
          sitePagesStatus: pageFetchMeta.siteStatus,
          formsFetched: forms.length,
          leadMagnets: leadMagnets.length,
        },
        top5,
        leadMagnets,
      },
      null,
      2
    ) + "\n"
  );
  process.exit(0);
}

const pad = (s, n) => String(s).padEnd(n).slice(0, n);
console.log(`HubSpot API base: ${apiBase}`);
console.log(`Forms fetched: ${forms.length}`);
console.log(`Analytics mapped: ${Object.keys(analyticsDataMap).length}`);
console.log(`Lead magnets detected: ${leadMagnets.length}`);
console.log("");

if (leadMagnets.length === 0) {
  console.log(
    "No lead magnets detected by name heuristic (guide/ebook/download/hiring/blueprint)."
  );
  process.exit(0);
}

console.log("Top 5 lead magnets (what Reports.tsx should chart):");
if (top5.length === 0) {
  console.log("  (none with submissions > 0)");
} else {
  for (const r of top5) {
    console.log(
      `  ${pad(r.submissions, 6)}  ${pad(r.source, 16)}  ${r.name} (${r.guid.slice(0, 8)}…)`
    );
  }
}

console.log("");
console.log("All lead magnets:");
for (const r of leadMagnets) {
  const deepNote =
    r.deepStatus && r.deepSubmissions !== null
      ? ` deep=${r.deepSubmissions} (${r.deepStatus})`
      : r.deepStatus
        ? ` deep=(${r.deepStatus})`
        : "";
  console.log(
    `  ${pad(r.submissions, 6)}  ${pad(r.source, 16)}  ${r.name} (${r.guid.slice(0, 8)}…)${deepNote}`
  );
}
