/**
 * AI Health Score Calculation Service
 * 
 * Logic:
 * 1. Base Score: 50
 * 2. Engagement (Up to +30): Page views, visits, conversions
 * 3. Commercial (Up to +30): Active deals, lifecycle stage
 * 4. Create Recency (Up to +20): Form submission within 7 days
 * 5. Activity Recency (Up to +20): Last visit, email interaction
 * 6. Velocity (Up to +10): CRM note updates
 * 7. Penalties: Email bounce (-50), Stale (>90 days) (-20)
 */

export const calculateHealthScore = (contact) => {
    let score = 50;
    const breakdown = [];
    const props = contact.properties || {};
    
    // 1. Engagement Intent (Up to +30)
    const pageViews = parseInt(props.hs_analytics_num_page_views || 0);
    const visits = parseInt(props.hs_analytics_num_visits || 0);
    const conversions = parseInt(props.num_conversion_events || 0);

    if (pageViews > 20) {
        score += 15;
        breakdown.push('+15: High page depth (>20 views)');
    } else if (pageViews > 5) {
        score += 8;
        breakdown.push('+8: Moderate page depth');
    }

    if (visits > 5) {
        score += 10;
        breakdown.push('+10: Frequent visitor (>5 visits)');
    }

    if (conversions > 0) {
        const convBonus = Math.min(15, conversions * 5);
        score += convBonus;
        breakdown.push(`+${convBonus}: ${conversions} conversion events`);
    }

    // 2. Commercial Velocity (Up to +30)
    const deals = parseInt(props.num_associated_deals || 0);
    const stage = props.lifecyclestage || '';

    if (deals > 0) {
        score += 20;
        breakdown.push('+20: Active deal associated');
    }

    if (['marketingqualifiedlead', 'salesqualifiedlead', 'opportunity'].includes(stage)) {
        score += 10;
        breakdown.push(`+10: Mature lifecycle stage (${stage})`);
    }
    
    // 3. Create Date Recency (Up to +20)
    // New leads are extremely hot.
    const createDate = props.createdate ? new Date(props.createdate) : null;
    if (createDate && (now.getTime() - createDate.getTime()) < 7 * 24 * 60 * 60 * 1000) {
        score += 20;
        breakdown.push('+20: New Lead Bonus (Created in last 7 days)');
    } else if (createDate && (now.getTime() - createDate.getTime()) < 30 * 24 * 60 * 60 * 1000) {
        score += 10;
        breakdown.push('+10: Recent Lead Bonus (Created in last 30 days)');
    }

    // 3. Activity Recency (Up to +20)
    const now = new Date();
    const lastVisit = props.hs_analytics_last_visit_timestamp ? new Date(props.hs_analytics_last_visit_timestamp) : null;
    const lastEmailOpen = props.hs_email_last_open_date ? new Date(props.hs_email_last_open_date) : null;

    if (lastVisit && (now.getTime() - lastVisit.getTime()) < 7 * 24 * 60 * 60 * 1000) {
        score += 10;
        breakdown.push('+10: Visited in last 7 days');
    } else if (lastVisit && (now.getTime() - lastVisit.getTime()) < 30 * 24 * 60 * 60 * 1000) {
        score += 5;
        breakdown.push('+5: Visited in last 30 days');
    }

    if (lastEmailOpen && (now.getTime() - lastEmailOpen.getTime()) < 7 * 24 * 60 * 60 * 1000) {
        score += 10;
        breakdown.push('+10: Email engagement in last 7 days');
    }

    // 4. Sales Intensity (Up to +10)
    const lastNote = props.notes_last_updated ? new Date(props.notes_last_updated) : null;
    if (lastNote && (now.getTime() - lastNote.getTime()) < 14 * 24 * 60 * 60 * 1000) {
        score += 10;
        breakdown.push('+10: Recent CRM note update (Sales active)');
    }

    // 5. Penalties
    if (props.hs_email_bounce) {
        score -= 50;
        breakdown.push('-50: Hard bounce detected');
    }

    const lastModified = contact.updatedAt ? new Date(contact.updatedAt) : null;
    if (lastModified && (now.getTime() - lastModified.getTime()) > 90 * 24 * 60 * 60 * 1000) {
        score -= 20;
        breakdown.push('-20: Stale record (>90 days)');
    }

    // Clamp score
    const finalScore = Math.min(100, Math.max(0, score));
    
    return {
        score: finalScore,
        breakdown
    };
};
