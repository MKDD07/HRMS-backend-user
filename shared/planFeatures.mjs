export const PLAN_RANK = { starter: 1, team: 2, business: 3, enterprise: 4 };
const core = ['dashboard','employees','departments','attendance','shifts','leave','company-calendar','documents','helpdesk','mail','settings','dashboard-users'];
const team = [...core,'payroll','salary-structure','expenses','recruitment','onboarding','offboarding','assets','reports'];
export const PLAN_FEATURES = { starter: core, team, business: null, enterprise: null };
export function planPages(id, allPages) { return PLAN_FEATURES[id] || allPages; }
export const PLAN_HIGHLIGHTS = {
 starter: ['People, attendance & leave','Company calendar & document vault','HR Connect & workspace settings'],
 team: ['Everything in Starter','Payroll, expenses & reports','Recruitment, onboarding & assets'],
 business: ['Everything in Team','Analytics, appraisals & performance','Benefits, learning, surveys & timesheets'],
 enterprise: ['All Business modules','Custom capacity & commercial terms','Workspace access controls']
};
