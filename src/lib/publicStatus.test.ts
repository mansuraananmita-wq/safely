import { describe, expect, it } from 'vitest'
import { publicCountExact, publicCountLabel, previewPublicStatus } from './publicStatus'
import type { Category, Department, Report } from '../types'

function report(partial: Partial<Report> & Pick<Report, 'id' | 'category' | 'status'>): Report {
  return {
    title: 'A campus problem that needs a look',
    description: 'Enough detail for the desk to understand the place.',
    locationId: 'library',
    locationDetail: 'North door',
    photos: [],
    confidential: false,
    anonymous: false,
    priority: 'medium',
    reporterId: 'u-amina',
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
    dueAt: '2026-10-16T00:00:00.000Z',
    confirmations: [],
    infoRequested: false,
    blocksAccess: false,
    contactWindow: '',
    activities: [],
    ...partial,
  }
}

const categories: Category[] = [
  {
    id: 'water',
    en: 'Water',
    bn: 'পানি',
    hintEn: '',
    hintBn: '',
    sensitive: false,
    slaHours: 48,
    suggestedDepartmentId: 'd-water',
    active: true,
  },
  {
    id: 'harassment',
    en: 'Harassment',
    bn: 'হয়রানি',
    hintEn: '',
    hintBn: '',
    sensitive: true,
    slaHours: 24,
    suggestedDepartmentId: 'd-sec',
    active: true,
  },
]

const departments: Department[] = [
  { id: 'd-water', en: 'Water', bn: 'পানি', lead: 'A', email: 'a@x', sensitive: false },
  { id: 'd-sec', en: 'Security', bn: 'নিরাপত্তা', lead: 'B', email: 'b@x', sensitive: true },
]

describe('public status count labels', () => {
  it('hides exact counts below 5', () => {
    expect(publicCountLabel(0)).toBe('0')
    expect(publicCountLabel(1)).toBe('fewer than 5')
    expect(publicCountLabel(4)).toBe('fewer than 5')
    expect(publicCountLabel(5)).toBe('5')
    expect(publicCountExact(4)).toBeNull()
    expect(publicCountExact(5)).toBe(5)
  })

  it('excludes confidential, harassment, anonymous, and safety from preview aggregates', () => {
    const snapshot = previewPublicStatus(
      [
        report({ id: '1', category: 'water', status: 'submitted', departmentId: 'd-water' }),
        report({ id: '2', category: 'water', status: 'submitted', departmentId: 'd-water' }),
        report({ id: '3', category: 'water', status: 'submitted', confidential: true, departmentId: 'd-sec' }),
        report({ id: '4', category: 'harassment', status: 'submitted', confidential: true, departmentId: 'd-sec' }),
        report({ id: '5', category: 'water', status: 'submitted', anonymous: true, departmentId: 'd-water' }),
        report({ id: '6', category: 'safety', status: 'submitted', departmentId: 'd-sec' }),
      ],
      categories,
      departments,
    )
    const water = snapshot.categories.find((row) => row.id === 'water')
    expect(water?.openLabel).toBe('fewer than 5')
    expect(water?.openCount).toBeNull()
    expect(snapshot.categories.some((row) => row.id === 'harassment')).toBe(false)
    expect(snapshot.offices.some((row) => row.id === 'd-sec')).toBe(false)
    const office = snapshot.offices.find((row) => row.id === 'd-water')
    expect(office?.openLabel).toBe('fewer than 5')
  })
})
