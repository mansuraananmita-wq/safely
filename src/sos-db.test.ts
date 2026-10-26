import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRef = 'rirqasqzdekohtqznexg'
const rateLimitMigration = path.resolve('supabase/migrations/20261025184500_sos_insert_rate_limit.sql')
const rateLimitSql = path.resolve('supabase/tests/sos_rate_limit.sql')
const deskMigration = path.resolve('supabase/migrations/20261025190000_sos_desk_notify_and_status.sql')
const rlsSql = path.resolve('supabase/tests/sos_rls_student.sql')
const anonMigration = path.resolve('supabase/migrations/20261026013000_anonymous_report_identities.sql')
const anonSql = path.resolve('supabase/tests/anonymous_reporter_rls.sql')
const supportMigration = path.resolve('supabase/migrations/20261027001500_support_contacts.sql')
const supportSql = path.resolve('supabase/tests/support_contacts_rls.sql')
const publicStatusMigration = path.resolve('supabase/migrations/20261027010000_public_status_counts.sql')
const publicStatusSql = path.resolve('supabase/tests/public_status_counts.sql')
const revealMigration = path.resolve('supabase/migrations/20261027020000_reveal_dual_control.sql')
const revealSql = path.resolve('supabase/tests/reveal_dual_control.sql')
const safeWalkMigration = path.resolve('supabase/migrations/20261027030000_safe_walks.sql')
const safeWalkSql = path.resolve('supabase/tests/safe_walks_rls.sql')
const appSettingsMigration = path.resolve('supabase/migrations/20261027040000_app_settings.sql')
const appSettingsSql = path.resolve('supabase/tests/app_settings_rls.sql')
const reportCapsMigration = path.resolve('supabase/migrations/20261027050000_report_abuse.sql')
const reportCapsSql = path.resolve('supabase/tests/report_caps.sql')
const deviceTokenMigration = path.resolve('supabase/migrations/20261027060000_device_tokens.sql')
const deviceTokenSql = path.resolve('supabase/tests/device_tokens_rls.sql')
const reportMediaMigration = path.resolve('supabase/migrations/20261027070000_report_media.sql')
const reportMediaSql = path.resolve('supabase/tests/report_media_rls.sql')

function runSqlFile(file: string) {
  try {
    return execFileSync(
      'supabase',
      ['db', 'query', '--linked', '--project-ref', projectRef, '--file', file],
      { encoding: 'utf8', cwd: path.resolve('.'), stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 },
    )
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string; code?: string }
    throw new Error([err.message, err.code, err.stdout, err.stderr].filter(Boolean).join('\n'))
  }
}

describe('sos database guards', () => {
  it('rejects a second insert within 60 seconds for the same user', () => {
    expect(existsSync(rateLimitMigration)).toBe(true)
    expect(existsSync(rateLimitSql)).toBe(true)
    const output = runSqlFile(rateLimitSql)
    expect(output).not.toMatch(/expected second SOS insert within 60 seconds to fail/i)
  }, 120_000)

  it('blocks a student from reading another user’s SOS', () => {
    expect(existsSync(deskMigration)).toBe(true)
    expect(existsSync(rlsSql)).toBe(true)
    const output = runSqlFile(rlsSql)
    expect(output).not.toMatch(/student read another user SOS/i)
  }, 120_000)

  it('keeps anonymous reporter_id null for admin, security, and department selects', () => {
    expect(existsSync(anonMigration)).toBe(true)
    expect(existsSync(anonSql)).toBe(true)
    const output = runSqlFile(anonSql)
    expect(output).not.toMatch(/returned reporter for anonymous report/i)
    expect(output).not.toMatch(/read report_identities/i)
  }, 120_000)

  it('blocks a student from inserting or updating support_contacts', () => {
    expect(existsSync(supportMigration)).toBe(true)
    expect(existsSync(supportSql)).toBe(true)
    const output = runSqlFile(supportSql)
    expect(output).not.toMatch(/student inserted into support_contacts/i)
    expect(output).not.toMatch(/student updated support_contacts/i)
    expect(output).not.toMatch(/student could not read active support_contacts/i)
  }, 120_000)

  it('hides small public status counts and excludes confidential reports', () => {
    expect(existsSync(publicStatusMigration)).toBe(true)
    expect(existsSync(publicStatusSql)).toBe(true)
    const output = runSqlFile(publicStatusSql)
    expect(output).not.toMatch(/public_count_label\(3\) should be fewer than 5/i)
    expect(output).not.toMatch(/small water open count was not hidden/i)
    expect(output).not.toMatch(/confidential report changed public/i)
    expect(output).not.toMatch(/harassment\/safety must not appear/i)
  }, 120_000)

  it('requires a second desk officer for anonymous reveal and blocks unrelated roles', () => {
    expect(existsSync(revealMigration)).toBe(true)
    expect(existsSync(revealSql)).toBe(true)
    const output = runSqlFile(revealSql)
    expect(output).not.toMatch(/requester approved their own reveal request/i)
    expect(output).not.toMatch(/security requested a reveal/i)
    expect(output).not.toMatch(/unrelated department requested a reveal/i)
    expect(output).not.toMatch(/reveal_reporter returned no identity after approval/i)
  }, 120_000)

  it('keeps Safe Walk RLS strict and clears location after 24 hours', () => {
    expect(existsSync(safeWalkMigration)).toBe(true)
    expect(existsSync(safeWalkSql)).toBe(true)
    const output = runSqlFile(safeWalkSql)
    expect(output).not.toMatch(/student read another user Safe Walk/i)
    expect(output).not.toMatch(/admin read active Safe Walk/i)
    expect(output).not.toMatch(/admin could not read expired Safe Walk/i)
    expect(output).not.toMatch(/security could not read expired Safe Walk/i)
    expect(output).not.toMatch(/location was not cleared 24 hours after close/i)
    expect(output).not.toMatch(/fresh expired location should remain until 24 hours pass/i)
  }, 120_000)

  it('allows signed-in read of app_settings and blocks student writes', () => {
    expect(existsSync(appSettingsMigration)).toBe(true)
    expect(existsSync(appSettingsSql)).toBe(true)
    const output = runSqlFile(appSettingsSql)
    expect(output).not.toMatch(/student could not read security_sms_number/i)
    expect(output).not.toMatch(/student inserted into app_settings/i)
    expect(output).not.toMatch(/student updated app_settings/i)
    expect(output).not.toMatch(/admin could not update security_sms_number/i)
  }, 120_000)

  it('enforces daily report caps and hides anonymous flag counts from staff', () => {
    expect(existsSync(reportCapsMigration)).toBe(true)
    expect(existsSync(reportCapsSql)).toBe(true)
    const output = runSqlFile(reportCapsSql)
    expect(output).not.toMatch(/daily cap of 10 did not block/i)
    expect(output).not.toMatch(/tight cap of 3 did not block/i)
    expect(output).not.toMatch(/admin read account_report_flags/i)
    expect(output).not.toMatch(/authenticated called account_recent_flag_count/i)
    expect(output).not.toMatch(/anonymous flag audit exposed the reporter/i)
    expect(output).not.toMatch(/report_flags stores a reporter id/i)
  }, 120_000)

  it('lets a user write only their own device token', () => {
    expect(existsSync(deviceTokenMigration)).toBe(true)
    expect(existsSync(deviceTokenSql)).toBe(true)
    const output = runSqlFile(deviceTokenSql)
    expect(output).not.toMatch(/student wrote another user device token/i)
    expect(output).not.toMatch(/student could not read own device token/i)
    expect(output).not.toMatch(/student read another user device token/i)
  }, 120_000)

  it('hides a report voice file from an unrelated user', () => {
    expect(existsSync(reportMediaMigration)).toBe(true)
    expect(existsSync(reportMediaSql)).toBe(true)
    const output = runSqlFile(reportMediaSql)
    expect(output).not.toMatch(/unrelated user read report media/i)
    expect(output).not.toMatch(/reporter could not read own report media/i)
  }, 120_000)
})
