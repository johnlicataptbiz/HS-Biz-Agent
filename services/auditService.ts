import { Workflow, Sequence, DataProperty, LeadStatus } from '../types';
import { hubSpotService } from './hubspotService';
import { getApiUrl } from './config';

export interface AuditIssue {
    id: string;
    title: string;
    description: string;
    impact: 'Critical' | 'High' | 'Medium' | 'Low';
    category: 'Automation' | 'Data Quality' | 'Sales' | 'Marketing';
    actionLabel: string;
    actionScript?: string; // The "API Path" or "Internal Method" to trigger
}

export interface PortalAuditReport {
    overallScore: number;
    issues: AuditIssue[];
    summary: {
        automationScore: number;
        dataScore: number;
        salesScore: number;
    };
}

export class AuditService {
    private static instance: AuditService;

    private constructor() {}

    public static getInstance(): AuditService {
        if (!AuditService.instance) {
            AuditService.instance = new AuditService();
        }
        return AuditService.instance;
    }

    public async runComprehensiveAudit(): Promise<PortalAuditReport> {
        const [workflows, sequences, properties, contactHealth] = await Promise.all([
            hubSpotService.fetchWorkflows(),
            hubSpotService.fetchSequences(),
            hubSpotService.fetchProperties(),
            hubSpotService.scanContactOrganization()
        ]);

        const issues: AuditIssue[] = [];

        // 1. AUTOMATION AUDIT (Deterministic)
        const ghostWorkflows = workflows.filter(w => w.issues.includes('Ghost Workflow: Active but no enrollments'));
        if (ghostWorkflows.length > 0) {
            issues.push({
                id: 'automation-ghost',
                title: `${ghostWorkflows.length} Ghost Workflows Active`,
                description: 'These workflows are turned on but have 0 people enrolled. They consume processing power and clutter your portal.',
                impact: 'Medium',
                category: 'Automation',
                actionLabel: 'Archive Ghosts',
                actionScript: '/api/cleanup/ghost-workflows'
            });
        }

        const stalledWorkflows = workflows.filter(w => w.issues.includes('Paused with active contacts'));
        if (stalledWorkflows.length > 0) {
            issues.push({
                id: 'automation-stalled',
                title: `${stalledWorkflows.length} Stalled Automations`,
                description: 'Workflows that are paused but still contain active contacts. These leads are stuck and likely not receiving communications.',
                impact: 'Critical',
                category: 'Automation',
                actionLabel: 'Resume to Clear',
                actionScript: '/api/cleanup/stalled-workflows'
            });
        }

        // 2. DATA QUALITY AUDIT
        const redundantProps = properties.filter(p => p.redundant);
        if (redundantProps.length > 5) {
            issues.push({
                id: 'data-redundant',
                title: `${redundantProps.length} Redundant Properties`,
                description: 'Detected duplicate or legacy properties (e.g. "_old", "temp"). This leads to fragmented customer data and sync issues.',
                impact: 'High',
                category: 'Data Quality',
                actionLabel: 'Merge Properties',
                actionScript: '/api/cleanup/properties'
            });
        }

        // 3. SALES AUDIT
        const lowSequence = sequences.filter(s => s.replyRate < 0.05 && s.active);
        if (lowSequence.length > 0) {
            issues.push({
                id: 'sales-underperforming',
                title: `${lowSequence.length} Low-Yield Sequences`,
                description: 'Sales sequences with less than 5% reply rate. These are burning through your lead list with low conversion.',
                impact: 'High',
                category: 'Sales',
                actionLabel: 'Analyze Copy',
                actionScript: 'analyze-sequence'
            });
        }

        // 4. CRM FUNNEL AUDIT
        if (contactHealth.healthScore < 70) {
            issues.push({
                id: 'crm-funnel-rot',
                title: 'Deteriorating Lead Funnel',
                description: `Only ${Math.round(contactHealth.healthScore)}% of your database is correctly classified. High volume of ${contactHealth.unclassified} unclassified contacts.`,
                impact: 'High',
                category: 'Data Quality',
                actionLabel: 'Batch Classify',
                actionScript: 'batch-classify'
            });
        }

        // Calculate Scores Determinstically
        const automationScore = Math.max(0, 100 - (ghostWorkflows.length * 5) - (stalledWorkflows.length * 10));
        const dataScore = Math.max(0, 100 - (redundantProps.length * 2));
        const salesScore = Math.max(0, 100 - (lowSequence.length * 10));

        return {
            overallScore: Math.round((automationScore + dataScore + salesScore) / 3),
            issues,
            summary: {
                automationScore,
                dataScore,
                salesScore
            }
        };
    }

    public async executeAuditAction(actionScript: string): Promise<{ success: boolean; message: string }> {
        if (!actionScript) return { success: false, message: "No script defined for this action." };

        try {
            const token = hubSpotService.getToken();
            const response = await fetch(getApiUrl('/api/cleanup'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: actionScript,
                    hubspotToken: token
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Execution failed');
            }

            return await response.json();
        } catch (e: any) {
            console.error("Script Execution Failed:", e);
            return { success: false, message: e.message || "Unknown error" };
        }
    }
}

export const auditService = AuditService.getInstance();

