import { createClient } from 'npm:@supabase/supabase-js@2'
import { missingKeys, statusNoticeBody, type NoticeKind } from '../_shared/notice.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

type Row = Record<string, unknown>

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const hookSecret = Deno.env.get('NOTIFY_WEBHOOK_SECRET') ?? ''
  if (!hookSecret) {
    console.log('notify-status: NOTIFY_WEBHOOK_SECRET is not set. Continuing without webhook authentication.')
  } else {
    const header = req.headers.get('x-webhook-secret') ?? ''
    const auth = req.headers.get('Authorization') ?? ''
    const allowed = header === hookSecret || auth === `Bearer ${hookSecret}` || (service && auth === `Bearer ${service}`)
    if (!allowed) {
      console.log('notify-status skipped: webhook secret did not match.')
      return json({ skipped: true, reason: 'Webhook secret did not match.' }, 200)
    }
  }

  const payload = await req.json().catch(() => null) as { type?: string; table?: string; record?: Row; old_record?: Row } | null
  const table = payload?.table ?? ''
  const record = payload?.record ?? {}
  const previous = payload?.old_record ?? {}
  const kind = noticeKind(table)
  if (!kind || !statusChanged(table, payload?.type ?? '', record, previous)) {
    console.log('notify-status skipped: not a report or SOS status change.')
    return json({ skipped: true, reason: 'Not a status change.' }, 200)
  }
  if (!service || !url) {
    console.log('notify-status skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.')
    return json({ skipped: true, reason: 'Supabase service credentials are missing.' }, 200)
  }

  const admin = createClient(url, service)
  const userId = await recipientId(admin, table, record)
  if (!userId) {
    console.log('notify-status skipped: no recipient for this status change.')
    return json({ skipped: true, reason: 'No recipient.' }, 200)
  }

  const { data: profile } = await admin.from('profiles').select('notify_push').eq('id', userId).maybeSingle()
  if (profile?.notify_push) {
    await sendPush(admin, userId, kind)
  } else {
    console.log('notify-status push skipped: push preference is off.')
  }

  try {
    const emailed = await fetch(`${url}/functions/v1/send-status-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, kind }),
    })
    if (!emailed.ok) {
      console.log(`notify-status email call returned ${emailed.status}. Push result is unchanged.`)
    }
  } catch (error) {
    console.log(`notify-status email call skipped: ${error instanceof Error ? error.message : 'request failed'}.`)
  }

  return json({ skipped: false }, 200)
})

function noticeKind(table: string): NoticeKind | null {
  if (table === 'reports') return 'report'
  if (table === 'sos_alerts') return 'sos'
  return null
}

function statusChanged(table: string, type: string, record: Row, previous: Row): boolean {
  if (type === 'INSERT') return true
  if (type !== 'UPDATE') return false
  if (table === 'reports') return record.status !== previous.status
  if (table === 'sos_alerts') return record.seen_at !== previous.seen_at || record.resolved_at !== previous.resolved_at
  return false
}

async function recipientId(admin: ReturnType<typeof createClient>, table: string, record: Row): Promise<string | null> {
  if (table === 'sos_alerts') return text(record.user_id)
  const direct = text(record.reporter_id)
  if (direct) return direct
  const reportId = text(record.id)
  if (!reportId) return null
  const { data } = await admin.from('report_identities').select('user_id').eq('report_id', reportId).maybeSingle()
  return text(data?.user_id)
}

async function sendPush(admin: ReturnType<typeof createClient>, userId: string, kind: NoticeKind) {
  const env = {
    FCM_PROJECT_ID: Deno.env.get('FCM_PROJECT_ID'),
    FCM_CLIENT_EMAIL: Deno.env.get('FCM_CLIENT_EMAIL'),
    FCM_PRIVATE_KEY: Deno.env.get('FCM_PRIVATE_KEY'),
  }
  const missing = missingKeys(env, ['FCM_PROJECT_ID', 'FCM_CLIENT_EMAIL', 'FCM_PRIVATE_KEY'])
  if (missing.length > 0) {
    console.log(`notify-status push skipped: missing secret ${missing.join(', ')}.`)
    return
  }
  const { data: tokens } = await admin.from('device_tokens').select('token').eq('user_id', userId)
  const list = (tokens ?? []).map((row) => String(row.token ?? '')).filter(Boolean)
  if (list.length === 0) {
    console.log('notify-status push skipped: this account has no device token.')
    return
  }
  let access = ''
  try {
    access = await fcmAccessToken(env.FCM_CLIENT_EMAIL ?? '', env.FCM_PRIVATE_KEY ?? '')
  } catch (error) {
    console.log(`notify-status push skipped: FCM access token failed (${error instanceof Error ? error.message : 'error'}).`)
    return
  }
  const body = statusNoticeBody(kind)
  for (const token of list) {
    const sent = await fetch(`https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: 'Safely', body },
          data: { kind },
        },
      }),
    })
    if (!sent.ok) {
      console.log(`notify-status push skipped for one device: ${(await sent.text()).slice(0, 160)}`)
    }
  }
}

async function fcmAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const pem = privateKeyPem.replace(/\\n/g, '\n')
  const b64 = pem.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s/g, '')
  const binary = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', binary, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))}`
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const assertion = `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const tokenJson = await tokenRes.json() as { access_token?: string }
  if (!tokenRes.ok || !tokenJson.access_token) throw new Error('Google token endpoint rejected the service account')
  return tokenJson.access_token
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function base64Url(value: string): string {
  return base64UrlBytes(new TextEncoder().encode(value))
}

function base64UrlBytes(bytes: Uint8Array): string {
  let raw = ''
  for (const byte of bytes) raw += String.fromCharCode(byte)
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
