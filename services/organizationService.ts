import { hubSpotService } from "./hubspotService";
import { getApiUrl } from "./config";

export interface SchemaReport {
  objectType: string;
  totalProperties: number;
  redundantProperties: string[];
  fillRate: number;
}

export interface AssociationHealth {
  fromObject: string;
  toObject: string;
  orphans: number;
  density: number;
}

export class OrganizationService {
  private static instance: OrganizationService;

  private constructor() {}

  public static getInstance(): OrganizationService {
    if (!OrganizationService.instance) {
      OrganizationService.instance = new OrganizationService();
    }
    return OrganizationService.instance;
  }

  public async runStructuralScan(): Promise<{
    schemas: SchemaReport[];
    associations: AssociationHealth[];
    lists: any[];
  }> {
    const [schemas, lists] = await Promise.all([
      hubSpotService.fetchSchemas(),
      hubSpotService.fetchListMetadata(),
    ]);

    const schemaReports: SchemaReport[] = [];
    const objects = ["contacts", "companies", "deals"];

    // Deep Property Audit
    for (const obj of schemas.results || []) {
      const properties = await hubSpotService.fetchProperties(); // For now, focus on contacts
      const redundant = properties
        .filter((p) => p.redundant)
        .map((p) => p.name);

      schemaReports.push({
        objectType: obj.name,
        totalProperties: properties.length,
        redundantProperties: redundant,
        fillRate: 0, // Placeholder
      });
    }

    // Association Audit
    const associations: AssociationHealth[] = [
      { fromObject: "contacts", toObject: "companies", orphans: 0, density: 0 },
    ];

    return {
      schemas: schemaReports,
      associations,
      lists,
    };
  }

  public async fetchDailyMission(metrics: any): Promise<any> {
    try {
      const prompt = `Based on the following CRM metrics, generate a 3-point 'Daily Mission Briefing' for an executive:
                            - Health Score: ${metrics.overallScore}%
                            - Redundant Props: ${metrics.redundantProps}
                            - Priority Leads Count: ${metrics.priorityLeads.length}
                            - Stalled Workflows: ${metrics.criticalWorkflows}`;

      const resp = await fetch(getApiUrl("/api/ai"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "briefing", prompt }),
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) {
      console.error("Mission failed", e);
      return null;
    }
  }

  public async autoRepairAssociations(): Promise<{
    fixed: number;
    failed: number;
  }> {
    try {
      // 1. Fetch orphaned contacts (no primary company)
      const resp = await hubSpotService.request(
        "/crm/v3/objects/contacts?limit=50&properties=email,website&associations=companies"
      );
      if (!resp.ok) return { fixed: 0, failed: 0 };
      const data = await resp.json();

      const orphans = (data.results || []).filter(
        (c: any) => !c.associations?.companies
      );
      let fixed = 0;
      let failed = 0;

      for (const contact of orphans) {
        const domain = contact.properties.email?.split("@")[1];
        if (
          !domain ||
          ["gmail.com", "outlook.com", "yahoo.com"].includes(domain)
        )
          continue;

        // 2. Search for company by domain
        const searchResp = await hubSpotService.request(
          "/crm/v3/objects/companies/search",
          {
            method: "POST",
            body: JSON.stringify({
              filterGroups: [
                {
                  filters: [
                    { propertyName: "domain", operator: "EQ", value: domain },
                  ],
                },
              ],
            }),
          }
        );
        const searchData = await searchResp.json();
        const matchedCompany = searchData.results?.[0];

        if (matchedCompany) {
          // 3. Verify with AI
          const aiVerify = await fetch(getApiUrl("/api/ai"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "repair",
              prompt: `Verify if contact ${contact.properties.email} should be associated with company ${matchedCompany.properties.name} (${matchedCompany.properties.domain}).`,
            }),
          });
          const aiData = await aiVerify.json();

          if (aiData.matchFound && aiData.confidence > 0.8) {
            // 4. Create association
            await hubSpotService.request(
              `/crm/v3/associations/contacts/companies/batch/create`,
              {
                method: "POST",
                body: JSON.stringify({
                  inputs: [
                    {
                      from: { id: contact.id },
                      to: { id: matchedCompany.id },
                      type: "contact_to_company",
                    },
                  ],
                }),
              }
            );
            fixed++;
          } else {
            failed++;
          }
        }
      }
      return { fixed, failed };
    } catch (e) {
      console.error("Repair failed", e);
      return { fixed: 0, failed: 0 };
    }
  }

  public async fetchStrategicForecast(metrics: any): Promise<any> {
    try {
      const prompt = `Based on current CRM data:
                            - Overall Health: ${metrics.overallScore}%
                            - Funnel Velocity: ${metrics.velocityScore}
                            - Open Deals: ${metrics.dealsCount}
                            - Priority Leads: ${metrics.priorityLeadsCount}
                            
                            Predict revenue growth for next month and identify the top strategic lever.`;

      const resp = await fetch(getApiUrl("/api/ai"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "forecast", prompt }),
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) {
      console.error("Forecast failed", e);
      return null;
    }
  }

  public async discoverPersonas(): Promise<any> {
    try {
      const [contacts, schemas] = await Promise.all([
        hubSpotService.listNewestContacts(20),
        hubSpotService.fetchSchemas(),
      ]);

      const context = {
        sampleContacts: contacts.map((c: any) => ({
          title: c.properties.jobtitle,
          industry: c.properties.industry,
          stage: c.properties.lifecyclestage,
        })),
        availableObjects: schemas.results?.map((s: any) => s.name),
      };

      const resp = await fetch(getApiUrl("/api/ai"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "persona",
          prompt: `Analyze these CRM samples and available schemas: ${JSON.stringify(context)}. 
                             Identify 3 high-value sales personas and provide HubSpot list criteria for each.`,
        }),
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) {
      console.error("Persona discovery failed", e);
      return null;
    }
  }

  public async createStrategicList(
    personaName: string,
    criteria: string
  ): Promise<any> {
    try {
      // Step 1: Translate English criteria to HubSpot Filter JSON
      const translationResp = await fetch(getApiUrl("/api/ai"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "translate_filter",
          prompt: `Translate this target audience into a HubSpot list filter: "${criteria}". 
                             Focus on jobtitle, industry, and lifecyclestage properties.`,
        }),
      });
      if (!translationResp.ok) return null;
      const { filterBranch } = await translationResp.json();

      // Step 2: Create the list via proxy
      const token = localStorage.getItem("hubspot_access_token");
      const resp = await fetch(getApiUrl("/api/proxy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/crm/v3/lists",
          method: "POST",
          hubspotToken: token,
          payload: {
            name: `[Strategic] ${personaName}`,
            objectTypeId: "0-1", // Contact object
            filterBranch,
          },
        }),
      });
      return await resp.json();
    } catch (e) {
      console.error("Strategic list creation failed", e);
      return null;
    }
  }

  public async auditRevenueArchitecture(): Promise<any> {
    try {
      const [pipelines, owners, deals] = await Promise.all([
        hubSpotService.fetchPipelines("deals"),
        hubSpotService.fetchOwners(),
        hubSpotService.fetchDeals(),
      ]);

      const context = {
        pipelines: pipelines.map((p) => ({
          label: p.label,
          stageCount: p.stages.length,
        })),
        ownerCount: owners.length,
        dealCount: deals.length,
        unassignedDeals: deals.filter((d) => !d.properties?.hubspot_owner_id)
          .length,
        stalledDeals: deals.filter((d) => {
          if (!d.properties?.hs_lastmodifieddate) return false;
          const lastMod = new Date(d.properties.hs_lastmodifieddate).getTime();
          return Date.now() - lastMod > 30 * 24 * 60 * 60 * 1000;
        }).length,
      };

      const resp = await fetch(getApiUrl("/api/ai"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "revops",
          prompt: `Analyze this revenue architecture context: ${JSON.stringify(context)}. 
                             Identify bottlenecks in the pipeline and evaluate ownership health.`,
        }),
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) {
      console.error("RevOps Audit failed", e);
      return null;
    }
  }

  public detectGhostDeals(deals: any[]): any[] {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return deals.filter((d) => {
      const lastModStr = d.properties?.hs_lastmodifieddate;
      if (!lastModStr) return false;
      const lastMod = new Date(lastModStr).getTime();
      return lastMod < thirtyDaysAgo;
    });
  }
}

export const organizationService = OrganizationService.getInstance();
