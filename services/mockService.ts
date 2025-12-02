import { Workflow, Sequence, DataProperty, BreezeTool } from '../types';

// Mock Database - PT Biz Context
const workflows: Workflow[] = [
  {
    id: 'wf_123',
    name: 'New Lead Nurture (PT Owners)',
    enabled: true,
    objectType: 'Contact',
    enrolledCount: 154,
    aiScore: 88,
    issues: [],
    lastUpdated: '2023-11-01',
  },
  {
    id: 'wf_124',
    name: 'Abandoned Cart Recovery',
    enabled: true,
    objectType: 'Deal',
    enrolledCount: 42,
    aiScore: 65,
    issues: ['Redundant steps detected', 'Low conversion rate'],
    lastUpdated: '2023-10-28',
  },
  {
    id: 'wf_125',
    name: 'Webinar Follow-up Sequence',
    enabled: false,
    objectType: 'Contact',
    enrolledCount: 0,
    aiScore: 92,
    issues: [],
    lastUpdated: '2023-09-15',
  },
  {
    id: 'wf_126',
    name: 'Reactivation Campaign',
    enabled: true,
    objectType: 'Contact',
    enrolledCount: 890,
    aiScore: 45,
    issues: ['Missing branching logic', 'Unused property triggers'],
    lastUpdated: '2023-10-05',
  }
];

const sequences: Sequence[] = [
  {
    id: 'seq_01',
    name: 'Cold Outreach - Clinic Owners',
    active: true,
    stepsCount: 5,
    replyRate: 12.4,
    aiScore: 78,
    targetPersona: 'Clinic Owner',
  },
  {
    id: 'seq_02',
    name: 'Post-Discovery Call Nurture',
    active: true,
    stepsCount: 4,
    replyRate: 28.5,
    aiScore: 95,
    targetPersona: 'Warm Lead',
  },
  {
    id: 'seq_03',
    name: 'Event Invitation - 2024 Summit',
    active: false,
    stepsCount: 3,
    replyRate: 0,
    aiScore: 60,
    targetPersona: 'General List',
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
    name: 'niche_specialty',
    label: 'Niche Specialty',
    type: 'enumeration',
    group: 'Business Info',
    usage: 45,
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
];

const breezeTools: BreezeTool[] = [
  {
    id: 'tool_01',
    name: 'Patient Reactivation Score',
    actionUrl: 'https://api.ptbiz.com/score',
    labels: { en: 'Calculate Reactivation Score' },
    inputFields: [
      { key: 'last_visit_date', label: 'Last Visit Date', type: 'datetime', required: true },
      { key: 'nps_score', label: 'NPS Score', type: 'number', required: false }
    ],
    aiScore: 85
  },
  {
    id: 'tool_02',
    name: 'SMS Appointment Reminder',
    actionUrl: 'https://api.ptbiz.com/sms/remind',
    labels: { en: 'Send SMS Reminder' },
    inputFields: [
      { key: 'phone_number', label: 'Phone Number', type: 'string', required: true },
      { key: 'appointment_time', label: 'Time', type: 'datetime', required: true }
    ],
    aiScore: 92
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