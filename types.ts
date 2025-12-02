
export type SpecType = 'workflow_spec' | 'sequence_spec' | 'property_migration_spec' | 'breeze_tool_spec';

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

export interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'draft' | 'completed';
  type: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  spent?: number;
  leads: number;
  conversions: number;
  aiScore: number;
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
