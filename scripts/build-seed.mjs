import { writeFileSync } from 'node:fs'
import { buildSeed } from '../src/data.ts'

const AUTH = {
  'u-amina': 'a1111111-1111-4111-8111-111111111101',
  'u-karim': 'a1111111-1111-4111-8111-111111111102',
  'u-nusrat': 'a1111111-1111-4111-8111-111111111103',
  'u-admin': 'a1111111-1111-4111-8111-111111111104',
  'u-maint': 'a1111111-1111-4111-8111-111111111105',
  'u-elec': 'a1111111-1111-4111-8111-111111111106',
  'u-water': 'a1111111-1111-4111-8111-111111111107',
  'u-clean': 'a1111111-1111-4111-8111-111111111108',
  'u-it': 'a1111111-1111-4111-8111-111111111109',
  'u-sec': 'a1111111-1111-4111-8111-111111111110',
  'u-affairs': 'a1111111-1111-4111-8111-111111111111',
  'u-yusuf': 'a1111111-1111-4111-8111-111111111112',
  'u-farzana': 'a1111111-1111-4111-8111-111111111113',
  'u-old': 'a1111111-1111-4111-8111-111111111114',
}

function sqlText(value, empty = 'null') {
  if (value === null || value === undefined || value === '') return empty
  return `'${String(value).replaceAll("'", "''")}'`
}

function sqlBool(value) {
  return value ? 'true' : 'false'
}

function sqlJson(value) {
  if (value === null || value === undefined) return 'null'
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
}

const seed = buildSeed()
const lines = []
lines.push('-- Safely sample campus. Paste this entire file into the Supabase SQL Editor after schema.sql and press Run.')
lines.push('-- Demo password for every account below: padma1234')
lines.push('')

for (const place of (await import('../src/data.ts')).PLACES) {
  lines.push(
    `insert into public.places (id, en, bn, short, lat, lng) values (${sqlText(place.id)}, ${sqlText(place.en)}, ${sqlText(place.bn)}, ${sqlText(place.short)}, ${place.lat}, ${place.lng}) on conflict (id) do update set en = excluded.en, bn = excluded.bn, short = excluded.short, lat = excluded.lat, lng = excluded.lng;`,
  )
}
lines.push('')
for (const department of seed.departments) {
  lines.push(
    `insert into public.departments (id, en, bn, lead, email, sensitive) values (${sqlText(department.id)}, ${sqlText(department.en)}, ${sqlText(department.bn)}, ${sqlText(department.lead)}, ${sqlText(department.email)}, ${sqlBool(department.sensitive)}) on conflict (id) do update set en = excluded.en, bn = excluded.bn, lead = excluded.lead, email = excluded.email, sensitive = excluded.sensitive;`,
  )
}
lines.push('')
for (const category of seed.categories) {
  lines.push(
    `insert into public.categories (id, en, bn, hint_en, hint_bn, sensitive, sla_hours, suggested_department_id, active) values (${sqlText(category.id)}, ${sqlText(category.en)}, ${sqlText(category.bn)}, ${sqlText(category.hintEn)}, ${sqlText(category.hintBn)}, ${sqlBool(category.sensitive)}, ${category.slaHours}, ${sqlText(category.suggestedDepartmentId)}, ${sqlBool(category.active)}) on conflict (id) do update set en = excluded.en, bn = excluded.bn, hint_en = excluded.hint_en, hint_bn = excluded.hint_bn, sensitive = excluded.sensitive, sla_hours = excluded.sla_hours, suggested_department_id = excluded.suggested_department_id, active = excluded.active;`,
  )
}
lines.push('')
for (const user of seed.users) {
  const authId = AUTH[user.id]
  if (!authId) throw new Error(`Missing auth id for ${user.id}`)
  lines.push(
    `select public.seed_demo_account(${sqlText(authId)}::uuid, ${sqlText(user.id)}, ${sqlText(user.email)}, ${sqlText(user.name)}, ${sqlText(user.role)}, ${sqlText(user.departmentId ?? '')}, ${sqlText(user.unit, "''")}, ${sqlText(user.identifier, "''")}, ${sqlBool(user.suspended)}, ${sqlBool(user.notifyInApp)}, ${sqlBool(user.notifyEmail)}, ${sqlBool(user.notifyPush)});`,
  )
}
lines.push('')
for (const report of seed.reports) {
  lines.push(
    `insert into public.reports (id, title, description, category, subcategory, location_id, location_detail, lat, lng, photos, confidential, anonymous, status, priority, department_id, assignee, reporter_id, created_at, updated_at, due_at, resolved_at, closed_at, rating, feedback, resolution_note, resolution_photo, info_requested, reject_reason, blocks_access, contact_window) values (${[
      sqlText(report.id),
      sqlText(report.title),
      sqlText(report.description, "''"),
      sqlText(report.category),
      sqlText(report.subcategory),
      sqlText(report.locationId),
      sqlText(report.locationDetail, "''"),
      report.lat ?? 'null',
      report.lng ?? 'null',
      sqlJson(report.photos ?? []),
      sqlBool(report.confidential),
      sqlBool(report.anonymous),
      sqlText(report.status),
      sqlText(report.priority),
      sqlText(report.departmentId),
      sqlText(report.assignee),
      sqlText(report.reporterId),
      sqlText(report.createdAt),
      sqlText(report.updatedAt),
      sqlText(report.dueAt),
      sqlText(report.resolvedAt),
      sqlText(report.closedAt),
      report.rating ?? 'null',
      sqlText(report.feedback),
      sqlText(report.resolutionNote),
      sqlJson(report.resolutionPhoto),
      sqlBool(report.infoRequested),
      sqlText(report.rejectReason),
      sqlBool(report.blocksAccess),
      sqlText(report.contactWindow, "''"),
    ].join(', ')}) on conflict (id) do nothing;`,
  )
  for (const activity of report.activities) {
    lines.push(
      `insert into public.report_activities (id, report_id, at, actor, visibility, kind, message) values (${sqlText(activity.id)}, ${sqlText(report.id)}, ${sqlText(activity.at)}, ${sqlText(activity.actor)}, ${sqlText(activity.visibility)}, ${sqlText(activity.kind)}, ${sqlText(activity.message)}) on conflict (id) do nothing;`,
    )
  }
  for (const userId of report.confirmations) {
    lines.push(
      `insert into public.report_confirmations (report_id, user_id) values (${sqlText(report.id)}, ${sqlText(userId)}) on conflict do nothing;`,
    )
  }
}
lines.push('')
for (const note of seed.notifications) {
  lines.push(
    `insert into public.notifications (id, user_id, title, body, href, read, created_at, kind) values (${sqlText(note.id)}, ${sqlText(note.userId)}, ${sqlText(note.title)}, ${sqlText(note.body)}, ${sqlText(note.href)}, ${sqlBool(note.read)}, ${sqlText(note.createdAt)}, ${sqlText(note.kind)}) on conflict (id) do nothing;`,
  )
}
lines.push('')
for (const item of seed.announcements) {
  lines.push(
    `insert into public.announcements (id, title, body, kind, location_id, active, created_at) values (${sqlText(item.id)}, ${sqlText(item.title)}, ${sqlText(item.body)}, ${sqlText(item.kind)}, ${sqlText(item.locationId)}, ${sqlBool(item.active)}, ${sqlText(item.createdAt)}) on conflict (id) do nothing;`,
  )
}
lines.push('')
for (const item of seed.lostFound) {
  lines.push(
    `insert into public.lost_found (id, title, place, detail, kind, contact, reporter_id, status, created_at) values (${sqlText(item.id)}, ${sqlText(item.title)}, ${sqlText(item.place)}, ${sqlText(item.detail, "''")}, ${sqlText(item.kind)}, ${sqlText(item.contact)}, ${sqlText(item.reporterId)}, ${sqlText(item.status)}, ${sqlText(item.createdAt)}) on conflict (id) do nothing;`,
  )
}
lines.push('')
for (const item of seed.audit) {
  lines.push(
    `insert into public.audit_log (id, at, actor, action, target) values (${sqlText(item.id)}, ${sqlText(item.at)}, ${sqlText(item.actor)}, ${sqlText(item.action)}, ${sqlText(item.target)}) on conflict (id) do nothing;`,
  )
}
lines.push('')

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), lines.join('\n'))
console.log(`Wrote ${lines.length} lines`)
