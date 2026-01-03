/**
 * AI Health Score Calculation Service
 * 
 * Logic:
 * 1. Base Score: 5
 * 2. Engagement (Up to +30): Page views, visits, conversions
 * 3. Commercial (Up to +30): Active deals, lifecycle stage
 * 4. Create Recency (Up to +20): Form submission within 7 days
 * 5. Activity Recency (Up to +20): Last visit, email interaction
 * 6. Velocity (Up to +10): CRM note updates
 * 7. Penalties: Email bounce (-50), Stale (>90 days) (-20)
 */

export const classifyLead = (contact) => {
    const props = contact.properties || {};
    const now = new Date();
    const email = (props.email || "").toLowerCase();
    
    // 1. TRASH/REJECTED
    if (props.hs_email_bounce > 0 || 
        (props.firstname || "").toLowerCase().includes("test") || 
        email.includes("example.com") ||
        props.hs_lead_status === 'Rejected') {
        return 'Trash';
    }

    // 2. EMPLOYEE
    if (email.endsWith("@physicaltherapybiz.com")) {
        return 'Employee';
    }

    // 3. ACTIVE CLIENT
    const stage = (props.lifecyclestage || "").toLowerCase();
    const memType = (props.membership_type || "").toLowerCase();
    const memStatus = (props.membership_status || "").toLowerCase();
    if (
        stage.includes("member") ||
        stage.includes("mm") ||
        stage.includes("crm") ||
        memType.includes("member") ||
        memType.includes("mm") ||
        memType.includes("crm") ||
        memStatus.includes("active") ||
        memStatus.includes("member") ||
        ['customer', 'evangelist', 'subscriber'].includes(stage)
    ) {
        return 'Active Client';
    }

    // 4. NEW
    const createDate = props.createdate ? new Date(props.createdate) : null;
    const daysSinceCreate = createDate ? (now.getTime() - createDate.getTime()) / (1000 * 60 * 60 * 24) : 999;
    
    // 5. ENGAGEMENT RECENCY
    const lastVisit = props.hs_analytics_last_visit_timestamp ? new Date(parseInt(props.hs_analytics_last_visit_timestamp)) : null;
    const lastEmail = props.hs_email_last_open_date ? new Date(props.hs_email_last_open_date) : null;
    const lastInteraction = lastVisit && lastEmail ? (lastVisit > lastEmail ? lastVisit : lastEmail) : (lastVisit || lastEmail);
    const daysSinceInteraction = lastInteraction ? (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24) : 999;

    if (daysSinceCreate <= 7 && daysSinceInteraction > 30) return 'New';

    // 6. UNQUALIFIED / BAD TIMING
    if (props.hs_lead_status === 'Unqualified' || 
        props.hs_lead_status === 'Bad Timing' || 
        (daysSinceCreate > 10 && daysSinceInteraction > 180) || 
        daysSinceInteraction >= 365) {
        return 'Unqualified';
    }

    // 7. HOT
    const deals = parseInt(props.num_associated_deals || 0);
    // Note: Health score calculation happens before this, but we can use the same logic
    if (daysSinceInteraction < 14 || deals > 0 || ['opportunity'].includes(stage)) {
        return 'Hot';
    }

    // 8. NURTURE
    if (daysSinceInteraction >= 14 && daysSinceInteraction < 90) {
        return 'Nurture';
    }

    // 9. WATCH
    if (daysSinceInteraction >= 90 && daysSinceInteraction < 365) {
        return 'Watch';
    }

    return 'Nurture'; // Default fallback
};

export const calculateHealthScore = (contact) => {
    const now = new Date();
    let score = 5;
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
    const createDate = props.createdate ? new Date(props.createdate) : null;
    if (createDate && (now.getTime() - createDate.getTime()) < 7 * 24 * 60 * 60 * 1000) {
        score += 20;
        breakdown.push('+20: New Lead Bonus (Created in last 7 days)');
    } else if (createDate && (now.getTime() - createDate.getTime()) < 30 * 24 * 60 * 60 * 1000) {
        score += 10;
        breakdown.push('+10: Recent Lead Bonus (Created in last 30 days)');
    }

    // 3. Activity Recency (Up to +20)
    const lastVisit = props.hs_analytics_last_visit_timestamp ? new Date(parseInt(props.hs_analytics_last_visit_timestamp)) : null;
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
    if (props.hs_email_bounce > 0) {
        score -= 50;
        breakdown.push('-50: Hard bounce detected');
    }

    const lastModified = props.lastmodifieddate ? new Date(props.lastmodifieddate) : null;
    if (lastModified && (now.getTime() - lastModified.getTime()) > 90 * 24 * 60 * 60 * 1000) {
        score -= 20;
        breakdown.push('-20: Stale record (>90 days)');
    }

    return {
        score: Math.min(100, Math.max(0, score)),
        breakdown
    };
};
