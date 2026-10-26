import { DEPARTMENTS } from '../data'
import { isOpen, isPublicFeed } from '../logic'
import { supabase } from './supabase'
import type { Category, Department, Lang, Report } from '../types'

export type PublicStatusRow = {
  id: string
  en: string
  bn: string
  openCount: number | null
  openLabel: string
  resolvedCount: number | null
  resolvedLabel: string
  avgResolutionDays30d: number | null
}

export type PublicStatusSummary = {
  openCount: number | null
  openLabel: string
  resolvedCount: number | null
  resolvedLabel: string
  resolved30dCount: number | null
  resolved30dLabel: string
  avgResolutionDays30d: number | null
}

export type PublicStatusSnapshot = {
  summary: PublicStatusSummary
  categories: PublicStatusRow[]
  offices: PublicStatusRow[]
  source: 'database' | 'preview'
}

/** Mirror of public.public_count_label — used only for offline preview. */
export function publicCountLabel(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  if (n < 5) return 'fewer than 5'
  return String(Math.floor(n))
}

export function publicCountExact(n: number): number | null {
  if (!Number.isFinite(n) || n < 5) return null
  return Math.floor(n)
}

function eligible(reports: Report[]): Report[] {
  return reports.filter((report) => isPublicFeed(report) && report.category !== 'safety')
}

function avgResolutionDays30d(reports: Report[]): number | null {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const hours: number[] = []
  for (const report of reports) {
    if (!report.resolvedAt) continue
    if (report.status !== 'resolved' && report.status !== 'closed') continue
    const resolved = +new Date(report.resolvedAt)
    if (resolved < cutoff) continue
    hours.push((resolved - +new Date(report.createdAt)) / 3_600_000)
  }
  if (!hours.length) return null
  const avg = hours.reduce((sum, value) => sum + value, 0) / hours.length
  return Math.round((avg / 24) * 10) / 10
}

function rowFrom(
  id: string,
  en: string,
  bn: string,
  openRaw: number,
  resolvedRaw: number,
  avgDays: number | null,
): PublicStatusRow {
  return {
    id,
    en,
    bn,
    openCount: publicCountExact(openRaw),
    openLabel: publicCountLabel(openRaw),
    resolvedCount: publicCountExact(resolvedRaw),
    resolvedLabel: publicCountLabel(resolvedRaw),
    avgResolutionDays30d: avgDays,
  }
}

/** Offline preview only. Live /status reads SQL views. */
export function previewPublicStatus(reports: Report[], categories: Category[], departments: Department[]): PublicStatusSnapshot {
  const rows = eligible(reports)
  const open = rows.filter((report) => isOpen(report.status))
  const resolved = rows.filter((report) => report.status === 'resolved' || report.status === 'closed')
  const resolved30d = resolved.filter((report) => report.resolvedAt && +new Date(report.resolvedAt) >= Date.now() - 30 * 24 * 60 * 60 * 1000)

  const categoryRows = categories
    .filter((category) => category.id !== 'harassment' && category.id !== 'safety')
    .map((category) => {
      const mine = rows.filter((report) => report.category === category.id)
      return rowFrom(
        category.id,
        category.en,
        category.bn,
        mine.filter((report) => isOpen(report.status)).length,
        mine.filter((report) => report.status === 'resolved' || report.status === 'closed').length,
        avgResolutionDays30d(mine),
      )
    })

  const officeSource = departments.length ? departments : DEPARTMENTS
  const officeRows = officeSource
    .filter((office) => !office.sensitive)
    .map((office) => {
      const mine = rows.filter((report) => report.departmentId === office.id)
      return rowFrom(
        office.id,
        office.en,
        office.bn,
        mine.filter((report) => isOpen(report.status)).length,
        mine.filter((report) => report.status === 'resolved' || report.status === 'closed').length,
        avgResolutionDays30d(mine),
      )
    })

  return {
    source: 'preview',
    summary: {
      openCount: publicCountExact(open.length),
      openLabel: publicCountLabel(open.length),
      resolvedCount: publicCountExact(resolved.length),
      resolvedLabel: publicCountLabel(resolved.length),
      resolved30dCount: publicCountExact(resolved30d.length),
      resolved30dLabel: publicCountLabel(resolved30d.length),
      avgResolutionDays30d: avgResolutionDays30d(rows),
    },
    categories: categoryRows,
    offices: officeRows,
  }
}

function mapAggRow(row: Record<string, unknown>, idKey: string): PublicStatusRow {
  return {
    id: String(row[idKey]),
    en: String(row.en ?? ''),
    bn: String(row.bn ?? ''),
    openCount: row.open_count == null ? null : Number(row.open_count),
    openLabel: String(row.open_label ?? '0'),
    resolvedCount: row.resolved_count == null ? null : Number(row.resolved_count),
    resolvedLabel: String(row.resolved_label ?? '0'),
    avgResolutionDays30d: row.avg_resolution_days_30d == null ? null : Number(row.avg_resolution_days_30d),
  }
}

export async function loadPublicStatus(fallback: {
  reports: Report[]
  categories: Category[]
  departments: Department[]
}): Promise<PublicStatusSnapshot> {
  if (!supabase) return previewPublicStatus(fallback.reports, fallback.categories, fallback.departments)

  const [summaryRes, categoryRes, officeRes] = await Promise.all([
    supabase.from('public_status_summary').select('*').maybeSingle(),
    supabase.from('public_status_by_category').select('*'),
    supabase.from('public_status_by_office').select('*'),
  ])

  if (summaryRes.error || categoryRes.error || officeRes.error || !summaryRes.data) {
    return previewPublicStatus(fallback.reports, fallback.categories, fallback.departments)
  }

  const summaryRow = summaryRes.data as Record<string, unknown>
  return {
    source: 'database',
    summary: {
      openCount: summaryRow.open_count == null ? null : Number(summaryRow.open_count),
      openLabel: String(summaryRow.open_label ?? '0'),
      resolvedCount: summaryRow.resolved_count == null ? null : Number(summaryRow.resolved_count),
      resolvedLabel: String(summaryRow.resolved_label ?? '0'),
      resolved30dCount: summaryRow.resolved_30d_count == null ? null : Number(summaryRow.resolved_30d_count),
      resolved30dLabel: String(summaryRow.resolved_30d_label ?? '0'),
      avgResolutionDays30d: summaryRow.avg_resolution_days_30d == null ? null : Number(summaryRow.avg_resolution_days_30d),
    },
    categories: (categoryRes.data as Record<string, unknown>[]).map((row) => mapAggRow(row, 'category_id')),
    offices: (officeRes.data as Record<string, unknown>[]).map((row) => mapAggRow(row, 'office_id')),
  }
}

export function statusRowLabel(row: Pick<PublicStatusRow, 'en' | 'bn'>, lang: Lang): string {
  return lang === 'bn' ? row.bn : row.en
}

export function localizeCountLabel(label: string, lang: Lang): string {
  if (label === 'fewer than 5') return lang === 'bn' ? '৫-এর কম' : 'fewer than 5'
  return label
}

export function barRank(label: string, exact: number | null): number {
  if (exact != null) return exact
  if (label === 'fewer than 5') return 2
  return 0
}
