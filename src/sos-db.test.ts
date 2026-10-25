import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRef = 'rirqasqzdekohtqznexg'
const rateLimitMigration = path.resolve('supabase/migrations/20261025184500_sos_insert_rate_limit.sql')
const rateLimitSql = path.resolve('supabase/tests/sos_rate_limit.sql')
const deskMigration = path.resolve('supabase/migrations/20261025190000_sos_desk_notify_and_status.sql')
const rlsSql = path.resolve('supabase/tests/sos_rls_student.sql')

function runSqlFile(file: string) {
  try {
    return execFileSync(
      'supabase',
      ['db', 'query', '--linked', '--project-ref', projectRef, '--file', file],
      { encoding: 'utf8', cwd: path.resolve('.'), stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 },
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
})
