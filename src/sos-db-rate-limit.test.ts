import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sqlPath = path.resolve('supabase/tests/sos_rate_limit.sql')
const migrationPath = path.resolve('supabase/migrations/20261025184500_sos_insert_rate_limit.sql')
const projectRef = 'rirqasqzdekohtqznexg'

function runSqlFile(file: string) {
  return execFileSync(
    'supabase',
    ['db', 'query', '--linked', '--project-ref', projectRef, '--file', file],
    { encoding: 'utf8', cwd: path.resolve('.'), stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

describe('sos insert rate limit (database)', () => {
  it('rejects a second insert within 60 seconds for the same user, bypassing the UI', () => {
    expect(existsSync(migrationPath)).toBe(true)
    expect(existsSync(sqlPath)).toBe(true)
    runSqlFile(migrationPath)
    const output = runSqlFile(sqlPath)
    expect(output).not.toMatch(/expected second SOS insert within 60 seconds to fail/i)
  }, 90_000)
})
