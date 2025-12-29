import { hubSpotService } from './hubspotService';

export interface LeakageReport {
    stalledDeals: number;
    potentialRevenueAtRisk: number;
    coldLeads: number;
    avgDaysInStage: Record<string, number>;
}

export class PerformanceService {
    private static instance: PerformanceService;

    private constructor() {}

    public static getInstance(): PerformanceService {
        if (!PerformanceService.instance) {
            PerformanceService.instance = new PerformanceService();
        }
        return PerformanceService.instance;
    }

    public async detectRevenueLeakage(): Promise<LeakageReport> {
        const deals = await hubSpotService.fetchDeals();
        const now = Date.now();
        const cycleThreshold = 1000 * 60 * 60 * 24 * 21; // 21 days for early stages

        const stalled = deals.filter(d => {
            const lastUpdated = new Date(d.closeDate).getTime(); // Using closeDate as proxy for activity in this context
            return (now - lastUpdated) > cycleThreshold && !['Closed Won', 'Closed Lost'].includes(d.stage);
        });

        const totalRisk = stalled.reduce((acc, d) => acc + (d.amount || 0), 0);

        // Cold leads detection
        const contactHealth = await hubSpotService.scanContactOrganization();
        const coldLeads = contactHealth.inactive || 0;

        return {
            stalledDeals: stalled.length,
            potentialRevenueAtRisk: totalRisk,
            coldLeads,
            avgDaysInStage: {} // Future refinement
        };
    }
}

export const performanceService = PerformanceService.getInstance();
