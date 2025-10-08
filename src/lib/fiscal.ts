export type FiscalYear = {
  id?: string
  label: string
  startDate: Date
  endDate: Date
}

// Fiscal year runs Sept 1 to Aug 31
type FYParts = { startYear: number; endYear: number }

export function currentFiscalYearParts(ref = new Date()): FYParts {
  const year = ref.getUTCFullYear()
  const month = ref.getUTCMonth() // 0=Jan
  if (month >= 8) {
    // Sept..Dec => FY starts this year
    return { startYear: year, endYear: year + 1 }
  }
  // Jan..Aug => FY started last year
  return { startYear: year - 1, endYear: year }
}

export function fiscalLabel(parts: FYParts): string {
  return `${parts.startYear}/${parts.endYear}`
}

export function fiscalMonths(): { label: string; index: number }[] {
  // Sept (0) .. Aug (11)
  const labels = [
    'Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'
  ]
  return labels.map((label, i) => ({ label, index: i }))
}

export function fiscalIndexFromDate(d: Date): number {
  const m = d.getUTCMonth()
  // Map calendar month to fiscal index: Sept=0..Aug=11
  // calendar: Jan=0..Dec=11
  const map = [4,5,6,7,8,9,10,11,0,1,2,3]
  return map[m]
}
