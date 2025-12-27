
export type SpecType = 'workflow_spec' | 'sequence_spec' | 'property_migration_spec' | 'breeze_tool_spec';

export type LeadStatus = 
  | 'New'
  | 'Hot'
  | 'Nurture'
  | 'Watch'
  | 'Unqualified'
  | 'Past Client'
  | 'Active Client'
  | 'Rejected'
  | 'Trash'
  | 'Unclassified';

export interface Workflow {
  id: string;
  name: string;
  enabled: boolean;
  objectType: string;
  enrolledCount: number;
  aiScore: number; // 0-100
  issues: string[];
  lastUpdated: string;
}

export interface Sequence {
  id: string;
  name: string;
  active: boolean;
  stepsCount: number;
  replyRate: number;
  openRate: number;
  aiScore: number;
  targetPersona: string;
}

export interface DataProperty {
  name: string;
  label: string;
  type: string;
  group: string;
  usage: number; // percentage
  redundant: boolean;
}

export interface BreezeTool {
  id: string;
  name: string;
  actionUrl: string;
  labels: Record<string, string>;
  inputFields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
  }>;
  aiScore: number;
}

export interface Segment {
  id: string;
  name: string;
  contactCount: number;
  isDynamic: boolean;
  filters: any[];
  lastUpdated: string;
  aiScore: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  budget: number | null;
  revenue: number | null;
  contacts: number;
  aiScore: number;
  type?: 'MARKETING_CONTAINER' | 'EMAIL_BLAST' | 'LANDING_PAGE' | 'SITE_PAGE';
}

export interface Form {
  id: string;
  name: string;
  submissions: number;
  aiScore?: number;
  leadMagnet: boolean;
  createdAt: number | string;
  guid: string;
}

export interface Metric {
  label: string;
  value: string | number;
  change?: number; // percent
  trend: 'up' | 'down' | 'neutral';
}

export interface AiResponse {
  specType: SpecType;
  spec: any;
  analysis: string;
  diff: string[];
}

// MCP / Agent Types
export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface ChatResponse {
  text: string;
  suggestions: string[];
  toolCalls?: ToolCall[]; // The AI can "call" these tools
  action?: {
    type: 'OPEN_MODAL';
    payload: {
      contextType: 'workflow' | 'sequence' | 'data' | 'breeze_tool';
      initialPrompt: string;
    };
  };
}

export interface Lead {
  id: string;
  name: string;
  stage: string;
  ownerId: string;
  companyName?: string;
  lastActivity: string;
  aiScore: number;
}

export interface PipelineStage {
  id: string;
  label: string;
  displayOrder: number;
  metadata: any;
}

export interface Pipeline {
  id: string;
  label: string;
  stages: PipelineStage[];
  displayOrder: number;
}
