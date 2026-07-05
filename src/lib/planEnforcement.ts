// Plan enforcement utility
// Starter: 1 company, 5 branches, 50 employees
// Group: 5 companies, 50 branches, unlimited employees
// Enterprise: unlimited everything
//
// Differentiation is now centred on GOVERNANCE depth (approval rules, audit
// retention, branding, integrations) rather than financial/accounting
// features — VELA hands off to the customer's existing accounting tools.

export type Plan = 'starter' | 'group' | 'enterprise'

export interface PlanLimits {
  companies: number      // -1 = unlimited
  branches: number
  employees: number
  hasWhiteLabel: boolean          // entity-level white labelling (Enterprise)
  hasAPI: boolean                 // REST API + webhooks for syncing to QuickBooks/Sage/payroll bureaus
  hasDedicatedDB: boolean
  hasCustomReports: boolean       // custom report builder on governance data
  hasGroupOversight: boolean      // multi-entity hierarchy, oversight dashboards, inter-entity transfer requests
  hasInsightsDashboard: boolean   // visual analytics dashboard (approval cycle times, compliance health, etc.)
  hasCSVExport: boolean           // CSV export on requests, payroll runs, etc. — available on every plan
  documentRetentionDays: number   // audit log / document retention: enterprise = 7 years, group = 90 days, starter = 30 days
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  starter: {
    companies: 1, branches: 5, employees: 50,
    hasWhiteLabel: false, hasAPI: false, hasDedicatedDB: false,
    hasCustomReports: false, hasGroupOversight: false, hasInsightsDashboard: false,
    hasCSVExport: true,
    documentRetentionDays: 30
  },
  group: {
    companies: 5, branches: 50, employees: -1,
    hasWhiteLabel: false, hasAPI: false, hasDedicatedDB: false,
    hasCustomReports: false, hasGroupOversight: true, hasInsightsDashboard: false,
    hasCSVExport: true,
    documentRetentionDays: 90
  },
  enterprise: {
    companies: -1, branches: -1, employees: -1,
    hasWhiteLabel: true, hasAPI: true, hasDedicatedDB: true,
    hasCustomReports: true, hasGroupOversight: true, hasInsightsDashboard: true,
    hasCSVExport: true,
    documentRetentionDays: 365 * 7
  }
}

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.starter
}

export function isAtLimit(plan: Plan, type: 'employees' | 'branches' | 'companies', current: number): boolean {
  const limits = getPlanLimits(plan)
  const limit = limits[type]
  return limit !== -1 && current >= limit
}

export function isNearLimit(plan: Plan, type: 'employees' | 'branches' | 'companies', current: number): boolean {
  const limits = getPlanLimits(plan)
  const limit = limits[type]
  if (limit === -1) return false
  return current >= limit * 0.9
}

export function getUpgradeMessage(plan: Plan, type: 'employees' | 'branches' | 'companies'): string {
  const limits = getPlanLimits(plan)
  const limit = limits[type]
  const nextPlan = plan === 'starter' ? 'Group' : 'Enterprise'
  const label = { employees: 'employees', branches: 'branches', companies: 'companies' }[type]
  return `You've reached the ${plan} plan limit of ${limit} ${label}. Upgrade to ${nextPlan} to add more.`
}

export function requiresPlan(required: Plan, current: Plan): boolean {
  const order: Plan[] = ['starter', 'group', 'enterprise']
  return order.indexOf(current) < order.indexOf(required)
}

export function getFeatureGateMessage(feature: string): string {
  return `${feature} is available on the Enterprise plan. Contact your administrator to upgrade.`
}
