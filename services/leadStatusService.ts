import { LeadStatus } from '../types';
import { hubSpotService } from './hubspotService';

export interface ContactTag {
    label: string;
    description: string;
    color: string;
}

export interface IntelligenceContact {
    id: string;
    email: string;
    name: string;
    status: LeadStatus;
    tags: ContactTag[];
    lastActivityDays: number;
    associatedDeals: number;
    associatedCompany?: string;
    rawProperties: any;
}

export class LeadStatusService {
    private static instance: LeadStatusService;

    private constructor() {}

    public static getInstance(): LeadStatusService {
        if (!LeadStatusService.instance) {
            LeadStatusService.instance = new LeadStatusService();
        }
        return LeadStatusService.instance;
    }

    private calculateIntelligence(props: any): { tags: ContactTag[], score: number, risk: 'Low' | 'Medium' | 'High' } {
        const tags: ContactTag[] = [];
        let score = 50;
        let risk: 'Low' | 'Medium' | 'High' = 'Low';

        const now = Date.now();
        const lastVisit = props.hs_analytics_last_visit_timestamp ? Number(props.hs_analytics_last_visit_timestamp) : 0;
        const daysSinceVisit = (now - lastVisit) / (1000 * 60 * 60 * 24);
        const emailOpens = Number(props.hs_email_open_count || 0);
        const bounces = Number(props.hs_email_bounce || 0);

        // 1. INTENT TRACKING
        if (daysSinceVisit < 3) {
            tags.push({ label: 'Urgent Intent', description: 'Visited site in last 72 hours', color: 'bg-rose-600' });
            score += 30;
        } else if (daysSinceVisit < 14) {
            tags.push({ label: 'Active Explorer', description: 'Recent engagement', color: 'bg-indigo-500' });
            score += 15;
        }

        // 2. ENGAGEMENT DEPTH
        if (emailOpens > 100) {
            tags.push({ label: 'Champion', description: 'Extremely high engagement (>100 opens)', color: 'bg-amber-500' });
            score += 20;
        }

        // 3. ACCOUNT CONTEXT
        if (props.associatedcompanyid) {
            tags.push({ label: 'Strategic Account', description: 'Associated with a company record', color: 'bg-blue-600' });
            score += 10;
        }

        // 4. RISK ASSESSMENT
        if (bounces > 0) {
            risk = 'High';
            score -= 40;
        } else if (daysSinceVisit > 180 && emailOpens < 5) {
            risk = 'Medium';
            score -= 10;
        }

        return { tags, score: Math.max(0, Math.min(100, score)), risk };
    }

    public async fetchIntelligenceContacts(limit = 100): Promise<IntelligenceContact[]> {
        const response = await hubSpotService['request'](
            `/crm/v3/objects/contacts?limit=${limit}&properties=` + 
            'lifecyclestage,hubspot_owner_id,lastmodifieddate,createdate,hs_lead_status,' + 
            'hs_email_bounce,num_associated_deals,hs_analytics_last_visit_timestamp,notes_last_updated,' + 
            'associatedcompanyid,firstname,lastname,email,hs_email_open_count'
        );

        if (!response.ok) return [];
        const data = await response.json();
        const contacts = data.results || [];

        return contacts.map((c: any) => {
            const props = c.properties || {};
            const status = hubSpotService['classifyContact'](props);
            const intelligence = this.calculateIntelligence(props);
            const now = Date.now();
            const lastVisit = props.hs_analytics_last_visit_timestamp ? Number(props.hs_analytics_last_visit_timestamp) : 0;
            
            return {
                id: c.id,
                email: props.email,
                name: `${props.firstname || ''} ${props.lastname || ''}`.trim() || 'Unnamed Contact',
                status,
                tags: intelligence.tags,
                lastActivityDays: Math.round((now - lastVisit) / (1000 * 60 * 60 * 24)),
                associatedDeals: Number(props.num_associated_deals) || 0,
                associatedCompany: props.associatedcompanyid,
                rawProperties: {
                    ...props,
                    strategic_score: intelligence.score,
                    risk_level: intelligence.risk
                }
            };
        });
    }

    public async syncStatusToHubSpot(contactId: string, status: LeadStatus): Promise<boolean> {
        try {
            // First, ensure the property exists (this would ideally happen once on app start)
            // For now, we'll try to update it directly.
            const response = await hubSpotService['request'](`/crm/v3/objects/contacts/${contactId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    properties: {
                        hs_lead_status: status === 'Active Client' ? 'In Progress' : status // Mapping to native field if possible
                    }
                })
            });
            return response.ok;
        } catch (e) {
            console.error("Sync failed:", e);
            return false;
        }
    }

    public async batchSync(updates: { id: string, status: LeadStatus }[]): Promise<{ success: number, failed: number }> {
        let success = 0;
        let failed = 0;
        
        // HubSpot Batch Update API
        const batchSize = 100;
        for (let i = 0; i < updates.length; i += batchSize) {
            const chunk = updates.slice(i, i + batchSize);
            const response = await hubSpotService['request']('/crm/v3/objects/contacts/batch/update', {
                method: 'POST',
                body: JSON.stringify({
                    inputs: chunk.map(u => ({
                        id: u.id,
                        properties: {
                            hs_lead_status: u.status === 'Active Client' ? 'In Progress' : u.status
                        }
                    }))
                })
            });
            
            if (response.ok) success += chunk.length;
            else failed += chunk.length;
        }
        
        return { success, failed };
    }
}

export const leadStatusService = LeadStatusService.getInstance();
