import { createClient } from 'npm:@supabase/supabase-js@2'
import { missingKeys, statusEmailRequest, statusNoticeBody, type NoticeKind } from '../_shared/notice.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const auth = req.headers.get('Authorization') ?? ''
  if (!service || auth !== `Bearer ${service}`) {
    console.log('send-status-email skipped: service role authorization is missing or did not match.')
    return json({ skipped: true, reason: 'Not authorized.' }, 200)
  }

  const payload = await req.json().catch(() => null) as { userId?: string; kind?: string } | null
  const userId = payload?.userId ?? ''
  const kind: NoticeKind = payload?.kind === 'sos' ? 'sos' : 'report'
  if (!userId) {
    console.log('send-status-email skipped: no user id.')
    return json({ skipped: true, reason: 'No user.' }, 200)
  }

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const admin = createClient(url, service)
  const { data: profile } = await admin.from('profiles').select('email, notify_email').eq('id', userId).maybeSingle()
  if (!profile?.notify_email) {
    console.log('send-status-email skipped: email preference is off.')
    return json({ skipped: true, reason: 'Email preference off.' }, 200)
  }
  const to = String(profile.email ?? '')
  if (!to.includes('@')) {
    console.log('send-status-email skipped: profile has no email address.')
    return json({ skipped: true, reason: 'No email.' }, 200)
  }

  const env = {
    EMAIL_PROVIDER: Deno.env.get('EMAIL_PROVIDER'),
    EMAIL_API_KEY: Deno.env.get('EMAIL_API_KEY'),
    EMAIL_FROM: Deno.env.get('EMAIL_FROM'),
  }
  const missing = missingKeys(env, ['EMAIL_PROVIDER', 'EMAIL_API_KEY', 'EMAIL_FROM'])
  if (missing.length > 0) {
    console.log(`send-status-email skipped: missing secret ${missing.join(', ')}.`)
    return json({ skipped: true, reason: `Missing secret ${missing.join(', ')}.` }, 200)
  }

  const request = statusEmailRequest(env.EMAIL_PROVIDER ?? '', env.EMAIL_API_KEY ?? '', env.EMAIL_FROM ?? '', to, kind)
  if (!request) {
    console.log(`send-status-email skipped: EMAIL_PROVIDER "${env.EMAIL_PROVIDER}" is not supported. Use resend, sendgrid, or postmark.`)
    return json({ skipped: true, reason: 'Unsupported email provider.' }, 200)
  }

  const sent = await fetch(request.url, { method: 'POST', headers: request.headers, body: request.body })
  if (!sent.ok) {
    const detail = (await sent.text()).slice(0, 180)
    console.log(`send-status-email provider rejected the generic status notice: ${detail}`)
    return json({ skipped: true, reason: 'Provider rejected the message.' }, 200)
  }
  console.log(`send-status-email sent a generic status notice. Body was: ${statusNoticeBody(kind)}`)
  return json({ skipped: false, sent: true }, 200)
})

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
