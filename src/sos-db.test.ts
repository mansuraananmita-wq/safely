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
})
