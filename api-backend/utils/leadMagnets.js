const LEAD_MAGNET_MATCHERS = [
  "bloodhound",
  "5-day challenge",
  "5 day challenge",
  "discovery call",
  "field manual",
  "killing comfort",
  "what race are you running",
  "what-race-are-you-running",
  "what-race-are-you-running-lm",
  "employee scorecard",
  "employee-scorecard",
  "employee-scorecard-lm",
  "side hustle guide",
  "cash-based-side-hustle-guide",
  "standalone space setup guide",
  "standalone clinic guide",
  "standalone-space-setup-guide",
  "the 86",
  "pl/165799",
  "workshop playbook",
  "workshop-playbook",
  "clinic startup checklist",
  "clinic-startup-checklist",
  "resource_redirect/landing_pages/2149086302",
  "physicaltherapybiz.com/bloodhound",
  "physicaltherapybiz.com/challenge",
  "vip.physicaltherapybiz.com/discovery-call",
  "amazon.com/killing-comfort",
];

const normalize = (value = "") => value.toLowerCase().trim();

export const isLeadMagnet = (value = "") => {
  const normalized = normalize(value);
  if (!normalized) return false;
  return LEAD_MAGNET_MATCHERS.some((matcher) => normalized.includes(matcher));
};

export const filterLeadMagnets = (items, getValue) => {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => isLeadMagnet(getValue(item)));
};

export const leadMagnetMatchers = [...LEAD_MAGNET_MATCHERS];
