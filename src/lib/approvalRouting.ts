// Central approval-routing logic for funding requests.
// Combines the two tenant-wide thresholds (petty cash / dual approval,
// configured in Admin > Group Thresholds) with any active custom rules
// from the `approval_rules` table (configured in Admin > Approval Rules).
// Previously these lived in two places that never talked to each other —
// RequestsPage hardcoded $15 / $999 and ignored approval_rules entirely.

export interface ApprovalRule {
  id: string
  rule_type: string
  amount_min: number | null
  amount_max: number | null
  categories: string[] | null
  required_rank: number | null
  required_approvers_count: number | null
  parallel_ranks: number[] | null
  escalate_after_hours: number | null
  escalate_to_rank: number | null
  is_active: boolean
  priority: number
  entity_id: string | null
  rule_name?: string
}

export interface RoutingInput {
  amount: number
  category: string
  recurring?: string
  entityId?: string | null
  pettyCashLimit: number
  dualApprovalThreshold: number
  rules: ApprovalRule[]
}

export interface RoutingResult {
  isPettyCash: boolean
  isDualApproval: boolean
  isInterEntity: boolean
  requiredApproversCount: number
  requiredRank: number | null       // lowest (= most senior) rank number required; null = any can_approve level
  parallelRanks: number[] | null    // one approval required from each rank listed
  sequential: boolean               // if true, parallelRanks must approve in listed order
  escalateAfterHours: number | null
  escalateToRank: number | null
  matchedRules: ApprovalRule[]
}

// Inter-entity transfers are Exec-only by default business rule, regardless
// of whether a tenant has configured an explicit entity_transfer rule.
const INTER_ENTITY_FLOOR_RANK = 1

export function computeRouting(input: RoutingInput): RoutingResult {
  const { amount, category, recurring = 'one-time', entityId, pettyCashLimit, dualApprovalThreshold, rules } = input
  const isInterEntity = category === 'Inter-Entity'
  const isPettyCash = amount < pettyCashLimit
  let requiredApproversCount = amount > dualApprovalThreshold ? 2 : 1
  let requiredRank: number | null = isInterEntity ? INTER_ENTITY_FLOOR_RANK : null
  let parallelRanks: number[] | null = null
  let sequential = false
  let escalateAfterHours: number | null = null
  let escalateToRank: number | null = null

  const matched = rules
    .filter(r => r.is_active !== false)
    .filter(r => !r.entity_id || r.entity_id === entityId)
    .filter(r => {
      const min = r.amount_min ?? -Infinity
      const max = r.amount_max ?? Infinity
      return amount >= min && amount <= max
    })
    .filter(r => !r.categories || r.categories.length === 0 || r.categories.includes(category))
    .filter(r => r.rule_type !== 'recurring' || recurring !== 'one-time')
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  for (const rule of matched) {
    if (rule.required_rank != null) {
      requiredRank = requiredRank == null ? rule.required_rank : Math.min(requiredRank, rule.required_rank)
    }
    if (rule.required_approvers_count != null) {
      requiredApproversCount = Math.max(requiredApproversCount, rule.required_approvers_count)
    }
    if (rule.rule_type === 'parallel' && rule.parallel_ranks?.length) {
      parallelRanks = rule.parallel_ranks
      requiredApproversCount = Math.max(requiredApproversCount, rule.parallel_ranks.length)
    }
    if (rule.rule_type === 'sequential' && rule.parallel_ranks?.length) {
      parallelRanks = rule.parallel_ranks
      sequential = true
      requiredApproversCount = Math.max(requiredApproversCount, rule.parallel_ranks.length)
    }
    if (rule.rule_type === 'dual_required') {
      requiredApproversCount = Math.max(requiredApproversCount, rule.required_approvers_count ?? 2)
    }
    if (rule.rule_type === 'entity_transfer') {
      const floor = rule.required_rank ?? INTER_ENTITY_FLOOR_RANK
      requiredRank = requiredRank == null ? floor : Math.min(requiredRank, floor)
    }
    if (rule.escalate_after_hours != null) {
      escalateAfterHours = escalateAfterHours == null ? rule.escalate_after_hours : Math.min(escalateAfterHours, rule.escalate_after_hours)
      escalateToRank = rule.escalate_to_rank ?? escalateToRank
    }
  }

  return {
    isPettyCash,
    isDualApproval: requiredApproversCount >= 2,
    isInterEntity,
    requiredApproversCount,
    requiredRank,
    parallelRanks,
    sequential,
    escalateAfterHours,
    escalateToRank,
    matchedRules: matched,
  }
}

// Determines whether the current user can approve/endorse a specific
// request, given its routing result and the approvals already recorded.
export function canUserAct(params: {
  routing: RoutingResult
  userId: string
  userRank: number | null | undefined
  userCanApprove: boolean
  userCanEndorse: boolean
  existingApprovals: { approver_id: string; action: string }[]
}): { canApprove: boolean; canEndorse: boolean; reason?: string } {
  const { routing, userId, userRank, userCanApprove, userCanEndorse, existingApprovals } = params
  const approvedBy = existingApprovals.filter(a => a.action === 'approved')
  const alreadyApproved = approvedBy.some(a => a.approver_id === userId)

  if (!userCanApprove) return { canApprove: false, canEndorse: userCanEndorse }
  if (alreadyApproved) return { canApprove: false, canEndorse: userCanEndorse, reason: 'You have already approved this request.' }
  if (userRank == null) return { canApprove: false, canEndorse: userCanEndorse, reason: 'No hierarchy level assigned.' }

  // Flat rank floor (inter-entity, entity_transfer, skip_level rules, or plain amount-based required_rank)
  if (routing.requiredRank != null && userRank > routing.requiredRank) {
    return { canApprove: false, canEndorse: userCanEndorse, reason: 'This request requires a more senior approver.' }
  }

  // Parallel/sequential: approver's rank must be one of the listed ranks.
  // True ordering enforcement for "sequential" would need the approving
  // rank stored per row in request_approvals (it isn't, today) — this
  // enforces membership in the chain; the rank-floor check above plus the
  // approvers-count gate in handleAction cover the common cases.
  if (routing.parallelRanks?.length && !routing.parallelRanks.includes(userRank)) {
    return { canApprove: false, canEndorse: userCanEndorse, reason: 'Your rank is not part of the required approval chain for this request.' }
  }

  return { canApprove: true, canEndorse: userCanEndorse }
}
