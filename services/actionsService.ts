import { authService } from './authService';

class ActionsService {
  async previewWorkflow(workflowId: string, updates: Record<string, unknown>) {
    const resp = await authService.apiRequest('/api/actions/workflows/preview', {
      method: 'POST',
      body: JSON.stringify({ workflowId, updates })
    });
    return resp.json();
  }

  async executeWorkflow(workflowId: string, updates: Record<string, unknown>) {
    const resp = await authService.apiRequest('/api/actions/workflows/execute', {
      method: 'POST',
      body: JSON.stringify({ workflowId, updates })
    });
    return resp.json();
  }

  async previewSequence(sequenceId: string, updates: Record<string, unknown>) {
    const resp = await authService.apiRequest('/api/actions/sequences/preview', {
      method: 'POST',
      body: JSON.stringify({ sequenceId, updates })
    });
    return resp.json();
  }

  async executeSequence(sequenceId: string, updates: Record<string, unknown>) {
    const resp = await authService.apiRequest('/api/actions/sequences/execute', {
      method: 'POST',
      body: JSON.stringify({ sequenceId, updates })
    });
    return resp.json();
  }

  async previewPropertyMerge(objectType: string, sourceProperty: string, targetProperty: string) {
    const resp = await authService.apiRequest('/api/actions/properties/merge/preview', {
      method: 'POST',
      body: JSON.stringify({ objectType, sourceProperty, targetProperty })
    });
    return resp.json();
  }

  async executePropertyMerge(objectType: string, sourceProperty: string, targetProperty: string) {
    const resp = await authService.apiRequest('/api/actions/properties/merge/execute', {
      method: 'POST',
      body: JSON.stringify({ objectType, sourceProperty, targetProperty })
    });
    return resp.json();
  }
}

export const actionsService = new ActionsService();

