import { Workflow, Sequence, DataProperty, BreezeTool } from '../types';

// Mock Database - PT Biz Context
// PT Biz sells coaching programs to PT clinic owners
// Contacts = PT clinic owners who are prospects/clients of PT Biz coaching

const workflows: Workflow[] = [
  {
    id: 'wf_123',
    name: 'New Lead Nurture (PT Owners)',
    enabled: true,
    objectType: 'Contact',
    enrolledCount: 154,
    aiScore: 88,
    issues: [],
    lastUpdated: '2024-11-01',
  },
  {
    id: 'wf_124',
    name: 'Discovery Call No-Show Follow-up',
    enabled: true,
    objectType: 'Deal',
    enrolledCount: 42,
    aiScore: 65,
    issues: ['Redundant steps detected', 'Low re-booking rate'],
    lastUpdated: '2024-10-28',
  },
  {
    id: 'wf_125',
    name: 'Webinar Registrant → Discovery Call',
    enabled: true,
    objectType: 'Contact',
    enrolledCount: 312,
    aiScore: 92,
    issues: [],
    lastUpdated: '2024-11-15',
  },
  {
    id: 'wf_126',
    name: 'Coaching Client Onboarding',
    enabled: true,
    objectType: 'Contact',
    enrolledCount: 89,
    aiScore: 85,
    issues: [],
    lastUpdated: '2024-10-20',
  },
  {
    id: 'wf_127',
    name: 'Renewal Reminder (60 Days Out)',
    enabled: true,
    objectType: 'Contact',
    enrolledCount: 34,
    aiScore: 45,
    issues: ['Missing branching logic', 'No engagement tracking'],
    lastUpdated: '2024-09-05',
  },
  {
    id: 'wf_128',
    name: 'Referral Request - Happy Clients',
    enabled: false,
    objectType: 'Contact',
    enrolledCount: 0,
    aiScore: 70,
    issues: ['Currently disabled'],
    lastUpdated: '2024-08-15',
  }
];

const sequences: Sequence[] = [
  {
    id: 'seq_01',
    name: 'Cold Outreach - PT Clinic Owners',
    active: true,
    stepsCount: 5,
    replyRate: 12.4,
    aiScore: 78,
    targetPersona: 'Cold Lead - PT Owner',
  },
  {
    id: 'seq_02',
    name: 'Post-Webinar Discovery Call Booking',
    active: true,
    stepsCount: 4,
    replyRate: 28.5,
    aiScore: 95,
    targetPersona: 'Webinar Attendee',
  },
  {
    id: 'seq_03',
    name: 'Podcast Guest Follow-up',
    active: true,
    stepsCount: 3,
    replyRate: 45.2,
    aiScore: 88,
    targetPersona: 'Podcast Listener',
  },
  {
    id: 'seq_04',
    name: 'Coaching Enrollment Nurture',
    active: true,
    stepsCount: 6,
    replyRate: 22.1,
    aiScore: 82,
    targetPersona: 'Post-Discovery Call',
  },
  {
    id: 'seq_05',
    name: 'Referral Partner Outreach',
    active: false,
    stepsCount: 4,
    replyRate: 0,
    aiScore: 60,
    targetPersona: 'Industry Partners',
  }
];

const dataProperties: DataProperty[] = [
  {
    name: 'firstname',
    label: 'First Name',
    type: 'string',
    group: 'Contact Information',
    usage: 100,
    redundant: false,
  },
  {
    name: 'email',
    label: 'Email',
    type: 'string',
    group: 'Contact Information',
    usage: 100,
    redundant: false,
  },
  {
    name: 'clinic_name',
    label: 'Clinic Name',
    type: 'string',
    group: 'Business Info',
    usage: 92,
    redundant: false,
  },
  {
    name: 'clinic_revenue',
    label: 'Annual Clinic Revenue',
    type: 'number',
    group: 'Business Info',
    usage: 78,
    redundant: false,
  },
  {
    name: 'coaching_program',
    label: 'Coaching Program',
    type: 'enumeration',
    group: 'PT Biz Engagement',
    usage: 65,
    redundant: false,
  },
  {
    name: 'niche_specialty_old',
    label: 'Niche (Legacy)',
    type: 'string',
    group: 'Business Info',
    usage: 2,
    redundant: true,
  },
  {
    name: 'annual_revenue_2022',
    label: '2022 Revenue',
    type: 'number',
    group: 'Financial',
    usage: 5,
    redundant: true,
  },
  {
    name: 'current_challenges',
    label: 'Current Challenges',
    type: 'string',
    group: 'Discovery',
    usage: 68,
    redundant: false,
  },
  {
    name: 'discovery_call_date',
    label: 'Discovery Call Date',
    type: 'datetime',
    group: 'PT Biz Engagement',
    usage: 85,
    redundant: false,
  },
  {
    name: 'lead_source',
    label: 'Lead Source',
    type: 'enumeration',
    group: 'Marketing',
    usage: 91,
    redundant: false,
  },
  {
    name: 'nps_score',
    label: 'Client NPS Score',
    type: 'number',
    group: 'PT Biz Engagement',
    usage: 42,
    redundant: false,
  },
];

// Breeze Tools for PT Biz - automating sales/marketing to PT clinic owners
const breezeTools: BreezeTool[] = [
  {
    id: 'tool_01',
    name: 'Lead Scoring Calculator',
    actionUrl: 'https://api.ptbiz.com/lead-score',
    labels: { en: 'Calculate Lead Score for PT Owner' },
    inputFields: [
      { key: 'clinic_revenue', label: 'Clinic Annual Revenue', type: 'number', required: true },
      { key: 'employee_count', label: 'Number of Employees', type: 'number', required: false },
      { key: 'lead_source', label: 'Lead Source', type: 'string', required: true }
    ],
    aiScore: 92
  },
  {
    id: 'tool_02',
    name: 'Discovery Call Scheduler',
    actionUrl: 'https://api.ptbiz.com/schedule-call',
    labels: { en: 'Book Discovery Call with PT Owner' },
    inputFields: [
      { key: 'contact_email', label: 'Contact Email', type: 'string', required: true },
      { key: 'preferred_time', label: 'Preferred Time Slot', type: 'datetime', required: true },
      { key: 'timezone', label: 'Timezone', type: 'string', required: true }
    ],
    aiScore: 95
  },
  {
    id: 'tool_03',
    name: 'Coaching ROI Estimator',
    actionUrl: 'https://api.ptbiz.com/roi-estimate',
    labels: { en: 'Estimate Coaching Program ROI' },
    inputFields: [
      { key: 'current_revenue', label: 'Current Monthly Revenue', type: 'number', required: true },
      { key: 'target_growth', label: 'Target Growth %', type: 'number', required: false },
      { key: 'coaching_tier', label: 'Coaching Program Tier', type: 'string', required: true }
    ],
    aiScore: 88
  },
  {
    id: 'tool_04',
    name: 'Client Success Pulse',
    actionUrl: 'https://api.ptbiz.com/success-pulse',
    labels: { en: 'Check Coaching Client Engagement' },
    inputFields: [
      { key: 'client_id', label: 'Client HubSpot ID', type: 'string', required: true },
      { key: 'check_period', label: 'Days to Check', type: 'number', required: false }
    ],
    aiScore: 85
  },
  {
    id: 'tool_05',
    name: 'Referral Request Trigger',
    actionUrl: 'https://api.ptbiz.com/referral-ask',
    labels: { en: 'Send Referral Request to Happy Client' },
    inputFields: [
      { key: 'client_email', label: 'Client Email', type: 'string', required: true },
      { key: 'nps_score', label: 'NPS Score (min 9)', type: 'number', required: true }
    ],
    aiScore: 78
  },
  {
    id: 'tool_06',
    name: 'Webinar Registration Sync',
    actionUrl: 'https://api.ptbiz.com/webinar-sync',
    labels: { en: 'Sync Webinar Registration to HubSpot' },
    inputFields: [
      { key: 'webinar_id', label: 'Webinar ID', type: 'string', required: true },
      { key: 'registrant_email', label: 'Registrant Email', type: 'string', required: true }
    ],
    aiScore: 90
  },
  {
    id: 'tool_07',
    name: 'Renewal Forecast',
    actionUrl: 'https://api.ptbiz.com/renewal-forecast',
    labels: { en: 'Predict Client Renewal Likelihood' },
    inputFields: [
      { key: 'client_id', label: 'Client ID', type: 'string', required: true },
      { key: 'engagement_score', label: 'Engagement Score', type: 'number', required: false }
    ],
    aiScore: 82
  },
  {
    id: 'tool_08',
    name: 'Personalized Outreach Generator',
    actionUrl: 'https://api.ptbiz.com/personalize',
    labels: { en: 'Generate Personalized Email for PT Owner' },
    inputFields: [
      { key: 'contact_id', label: 'Contact ID', type: 'string', required: true },
      { key: 'template_type', label: 'Template Type', type: 'string', required: true },
      { key: 'personalization_level', label: 'Personalization Level (1-5)', type: 'number', required: false }
    ],
    aiScore: 91
  }
];

export const getWorkflows = async (): Promise<Workflow[]> => {
  return new Promise((resolve) => setTimeout(() => resolve(workflows), 500));
};

export const getSequences = async (): Promise<Sequence[]> => {
  return new Promise((resolve) => setTimeout(() => resolve(sequences), 500));
};

export const getDataProperties = async (): Promise<DataProperty[]> => {
  return new Promise((resolve) => setTimeout(() => resolve(dataProperties), 500));
};

export const getBreezeTools = async (): Promise<BreezeTool[]> => {
  return new Promise((resolve) => setTimeout(() => resolve(breezeTools), 500));
};