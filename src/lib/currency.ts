// Currency utilities for VELA group consolidation
// Base currency: USD
// Supported: USD, ZWG, ZAR, GBP, EUR

export type Currency = 'USD' | 'ZWG' | 'ZAR' | 'GBP' | 'EUR'

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$', ZWG: 'ZWG', ZAR: 'R', GBP: '£', EUR: '€'
}

export const CURRENCY_NAMES: Record<Currency, string> = {
  USD: 'US Dollar', ZWG: 'Zimbabwe Gold (ZWG)', ZAR: 'South African Rand', GBP: 'British Pound', EUR: 'Euro'
}

export type ExchangeRate = {
  from_currency: string
  to_currency: string
  rate: number
  rate_date: string
  rate_type: 'daily' | 'monthly_avg' | 'closing'
}

// Convert amount from one currency to another using rates table
export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
  rates: ExchangeRate[]
): number {
  if (from === to) return amount

  // Find rate from->USD then USD->to
  let amountInUSD = amount
  if (from !== 'USD') {
    const rate = rates.find(r => r.from_currency === from && r.to_currency === 'USD')
    if (!rate) return amount // can't convert, return as-is
    amountInUSD = amount * rate.rate
  }

  if (to === 'USD') return amountInUSD

  const toRate = rates.find(r => r.from_currency === to && r.to_currency === 'USD')
  if (!toRate) return amountInUSD

  return amountInUSD / toRate.rate
}

// Format a currency amount for display
export function formatCurrency(amount: number, currency: Currency = 'USD', decimals = 2): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
  const prefix = amount < 0 ? '-' : ''
  if (currency === 'ZWG' || currency === 'ZAR') {
    return `${prefix}${symbol} ${formatted}`
  }
  return `${prefix}${symbol}${formatted}`
}

// Consolidation: sum amounts across entities, all converted to base (USD)
export function consolidateAmounts(
  entries: { amount: number; currency: Currency }[],
  rates: ExchangeRate[]
): number {
  return entries.reduce((sum, e) => {
    return sum + convertCurrency(e.amount, e.currency, 'USD', rates)
  }, 0)
}

// Apply minority interest to net income
export function applyMinorityInterest(
  netIncome: number,
  groupOwnershipPct: number
): { groupShare: number; minorityShare: number } {
  const groupShare = netIncome * (groupOwnershipPct / 100)
  const minorityShare = netIncome - groupShare
  return { groupShare, minorityShare }
}
