import { LeadStatus } from '../types';
import { hubSpotService } from './hubspotService';
import { getApiUrl } from './config';

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
    inference?: string;
    deepScanned?: boolean;
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

    public async deepScanContact(contact: IntelligenceContact): Promise<IntelligenceContact> {
        try {
            // 1. Fetch deep context (Notes)
            const notes = await hubSpotService.getContactNotes(contact.id);
            
            // 2. Prepare AI Prompt
            const prompt = `Perform a Deep Brain Scan on this contact for categorization.
            
CONTACT DATA:
- Name: ${contact.name}
- Email: ${contact.email}
- Lifecycle Stage: ${contact.rawProperties.lifecyclestage}
- Lead Status: ${contact.rawProperties.hs_lead_status}
- Deals: ${contact.associatedDeals}
- Strategic Score: ${contact.rawProperties.strategic_score}

RECENT NOTES:
${notes.length > 0 ? notes.map(n => `- ${n}`).join('\n') : 'No notes found for this contact.'}

GUIDELINES:
- Hot: 0-1 month buying cycle, requires weekly follow-up. Look for words like 'urgent', 'now', 'ASAP', 'ready'.
- Nurture: 1-3 month buying cycle, monthly follow-up. Look for 'budget next quarter', 'evaluating options'.
- Watch: 3-12 month buying cycle, quarterly follow-up. Look for 'next year', 'long term'.
- Active Client: Currently a member or customer.
- Past Client: Was a customer but engagement is stale.
- Trash/Rejected: Bad data or explicit rejection.

Analyze the notes and properties deeply. If notes contradict current status, prioritize the notes.`;

            // 3. Call AI
            const response = await fetch(getApiUrl('/api/ai'), {
                method: 'POST',
                body: JSON.stringify({
                    mode: 'classify',
                    prompt,
                    contextType: 'contact_intelligence'
                })
            });

            if (!response.ok) throw new Error("AI Scan failed");
            const result = await response.json();

            // 4. Transform result back to contact
            return {
                ...contact,
                status: result.status as LeadStatus,
                tags: [...contact.tags, ...result.tags],
                inference: result.inference,
                deepScanned: true,
                rawProperties: {
                    ...contact.rawProperties,
                    strategic_score: result.strategicPriority
                }
            };
        } catch (e) {
            console.error("Deep Scan Error:", e);
            return contact; // Return original on failure
        }
    }

    private calculateIntelligence(props: any): { tags: ContactTag[], score: number, risk: 'Low' | 'Medium' | 'High' } {
        const tags: ContactTag[] = [];
        let totalScore = 0;
        let risk: 'Low' | 'Medium' | 'High' = 'Low';

        const now = Date.now();
        const created = props.createdate ? new Date(props.createdate).getTime() : now;
        const lastVisit = props.hs_analytics_last_visit_timestamp ? Number(props.hs_analytics_last_visit_timestamp) : 0;
        const lastEmail = props.hs_email_last_open_date ? new Date(props.hs_email_last_open_date).getTime() : 0;
        
        const daysSinceCreate = (now - created) / (1000 * 60 * 60 * 24);
        const daysSinceVisit = lastVisit ? (now - lastVisit) / (1000 * 60 * 60 * 24) : 1000;
        const daysSinceEmail = lastEmail ? (now - lastEmail) / (1000 * 60 * 60 * 24) : 1000;

        // 1. RECENCY OF CREATION (Weighted: 15%)
        if (daysSinceCreate < 7) totalScore += 15;
        else if (daysSinceCreate < 30) totalScore += 10;
        else if (daysSinceCreate < 90) totalScore += 5;

        // 2. ENGAGEMENT RECENCY (Weighted: 20%)
        if (daysSinceVisit < 3) totalScore += 20;
        else if (daysSinceVisit < 14) totalScore += 12;
        else if (daysSinceVisit < 30) totalScore += 5;

        // 3. PAGE VIEW DEPTH (Weighted: 15%)
        const views = Number(props.hs_analytics_num_page_views || 0);
        if (views > 50) {
            totalScore += 15;
            tags.push({ label: 'Power User', description: 'Deep site penetration (>50 views)', color: 'bg-indigo-600' });
        } else if (views > 10) totalScore += 8;

        // 4. EMAIL VOLUME (Weighted: 10%)
        const opens = Number(props.hs_email_open_count || 0);
        if (opens > 50) {
            totalScore += 10;
            tags.push({ label: 'Loyal Reader', description: 'High email engagement', color: 'bg-blue-500' });
        } else if (opens > 10) totalScore += 5;

        // 5. EMAIL RECENCY (Weighted: 10%)
        if (daysSinceEmail < 7) totalScore += 10;
        else if (daysSinceEmail < 30) totalScore += 5;

        // 6. FORM CONVERSIONS (Weighted: 15%)
        const conversions = Number(props.num_conversion_events || 0);
        if (conversions >= 3) {
            totalScore += 15;
            tags.push({ label: 'High Intent', description: 'Multiple form submissions', color: 'bg-rose-600' });
        } else if (conversions >= 1) totalScore += 8;

        // 7. SALES MOMENTUM / DEALS (Weighted: 10%)
        const deals = Number(props.num_associated_deals || 0);
        if (deals > 0) {
            totalScore += 10;
            tags.push({ label: 'Opportunity', description: 'Active deal associated', color: 'bg-emerald-600' });
        }

        // 8. LIFECYCLE MATURITY (Weighted: 5%)
        const stage = (props.lifecyclestage || '').toLowerCase();
        if (['salesqualifiedlead', 'opportunity', 'customer'].includes(stage)) totalScore += 5;

        // -- RISK & NEGATIVE WEIGHTS --
        const bounces = Number(props.hs_email_bounce || 0);
        if (bounces > 0) {
            risk = 'High';
            totalScore -= 40;
            tags.push({ label: 'Data Risk', description: 'Emails bouncing', color: 'bg-red-600' });
        } else if (daysSinceVisit > 180 && daysSinceEmail > 180) {
            risk = 'Medium';
            totalScore -= 20;
            tags.push({ label: 'Lead Decay', description: 'No activity in 6 months', color: 'bg-slate-500' });
        }

        return { tags, score: Math.max(0, Math.min(100, totalScore)), risk };
    }

    public async fetchIntelligenceContacts(limit = 100): Promise<IntelligenceContact[]> {
        const response = await hubSpotService['request'](
            `/crm/v3/objects/contacts?limit=${limit}&properties=` + 
            'lifecyclestage,hubspot_owner_id,lastmodifieddate,createdate,hs_lead_status,' + 
            'hs_email_bounce,num_associated_deals,hs_analytics_last_visit_timestamp,notes_last_updated,' + 
            'associatedcompanyid,firstname,lastname,email,hs_email_open_count,membership_type,membership_status,' +
            'num_conversion_events,hs_email_last_open_date,hs_analytics_num_page_views'
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

    // Map our classification labels to HubSpot API values (uppercase)
    private readonly STATUS_TO_HUBSPOT: Record<LeadStatus, string> = {
        'New': 'NEW',
        'Hot': 'HOT',
        'Nurture': 'NURTURE',
        'Watch': 'WATCH',
        'Unqualified': 'UNQUALIFIED',
        'Active Client': 'ACTIVE_CLIENT',
        'Past Client': 'PAST_CLIENT',
        'Rejected': 'REJECTED',
        'Trash': 'TRASH',
        'Unclassified': 'NEW' // Fallback
    };

    // Ensure our custom options exist in HubSpot
    public async ensureOptionsExist(): Promise<boolean> {
        const newOptions = [
            { label: 'Hot', value: 'HOT', displayOrder: 1 },
            { label: 'Nurture', value: 'NURTURE', displayOrder: 2 },
            { label: 'Watch', value: 'WATCH', displayOrder: 3 },
            { label: 'Active Client', value: 'ACTIVE_CLIENT', displayOrder: 5 },
            { label: 'Past Client', value: 'PAST_CLIENT', displayOrder: 6 },
            { label: 'Rejected', value: 'REJECTED', displayOrder: 7 },
            { label: 'Trash', value: 'TRASH', displayOrder: 8 }
        ];

        // Get current options
        const getResp = await hubSpotService['request']('/crm/v3/properties/contacts/hs_lead_status');
        if (!getResp.ok) return false;
        
        const current = await getResp.json();
        const existingValues = new Set((current.options || []).map((o: any) => o.value));
        
        // Merge with new options (don't duplicate)
        const allOptions = [...(current.options || [])];
        for (const opt of newOptions) {
            if (!existingValues.has(opt.value)) {
                allOptions.push({ ...opt, hidden: false });
            }
        }

        // Update the property
        const updateResp = await hubSpotService['request']('/crm/v3/properties/contacts/hs_lead_status', {
            method: 'PATCH',
            body: JSON.stringify({ options: allOptions })
        });

        return updateResp.ok;
    }

    public async syncStatusToHubSpot(contactId: string, status: LeadStatus): Promise<boolean> {
        try {
            const hubspotValue = this.STATUS_TO_HUBSPOT[status] || 'NEW';
            const response = await hubSpotService['request'](`/crm/v3/objects/contacts/${contactId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    properties: {
                        hs_lead_status: hubspotValue
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
        
        // First, ensure our options exist in HubSpot
        await this.ensureOptionsExist();
        
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
                            hs_lead_status: this.STATUS_TO_HUBSPOT[u.status] || 'NEW'
                        }
                    }))
                })
            });
            
            if (response.ok) success += chunk.length;
            else failed += chunk.length;

            // Be a good citizen - small pause between batches
            await new Promise(r => setTimeout(r, 300));
        }
        
        return { success, failed };
    }

    public async syncAllContacts(options: { dryRun?: boolean, maxRecords?: number } = {}): Promise<any> {
        const dryRun = options.dryRun !== undefined ? options.dryRun : true;
        const maxRecords = options.maxRecords || 5000;
        const PAGE_LIMIT = 100;
        const props = 'lifecyclestage,hubspot_owner_id,lastmodifieddate,createdate,hs_lead_status,' +
            'hs_email_bounce,num_associated_deals,hs_analytics_last_visit_timestamp,notes_last_updated,' +
            'associatedcompanyid,firstname,lastname,email,hs_email_open_count,membership_type,membership_status,' +
            'num_conversion_events,hs_email_last_open_date,hs_analytics_num_page_views';

        let after: string | null = null;
        let scanned = 0;
        const proposed: Array<{ id: string, email?: string, old?: string, proposed?: string }> = [];
        let page = 0;

        while (scanned < maxRecords) {
            page++;
            const url = `/crm/v3/objects/contacts?limit=${PAGE_LIMIT}&properties=${props}` + (after ? `&after=${encodeURIComponent(after)}` : '');
            const response = await hubSpotService['request'](url);
            if (!response.ok) {
                console.error('Sync scan failed at page', page, 'status:', response.status);
                break;
            }
            const data = await response.json();
            const results = data.results || [];
            for (const c of results) {
                if (scanned >= maxRecords) break;
                scanned++;
                const p = c.properties || {};
                const current = (p.hs_lead_status || '').toString().toUpperCase() || null;
                const classified = hubSpotService['classifyContact'](p);
                const proposedValue = this.STATUS_TO_HUBSPOT[classified] || 'NEW';
                if (current !== proposedValue) {
                    proposed.push({ id: c.id, email: p.email, old: current, proposed: proposedValue });
                }
            }

            if (data.paging && data.paging.next && data.paging.next.after) {
                after = data.paging.next.after;
            } else break;
        }

        const summary: any = { scanned, proposedCount: proposed.length, sample: proposed.slice(0, 10) };

        if (dryRun) return summary;

        // Execute updates in batches
        const updates = proposed.map(p => ({ id: p.id, status: (Object.keys(this.STATUS_TO_HUBSPOT).find(k => this.STATUS_TO_HUBSPOT[k as LeadStatus] === p.proposed) || 'New') as LeadStatus }));
        const result = await this.batchSync(updates);
        summary.applied = result;
        return summary;
    }
}

export const leadStatusService = LeadStatusService.getInstance();
