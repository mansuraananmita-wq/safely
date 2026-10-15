import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Contact = { name?: string; phone?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const auth = req.headers.get('Authorization') ?? ''
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Sign in required.' }, 401)

    const body = await req.json().catch(() => null) as { alertId?: string } | null
    const alertId = body?.alertId
    if (!alertId) return json({ error: 'Missing alert.' }, 400)

    const admin = createClient(url, service)
    const { data: profile } = await admin.from('profiles').select('id').eq('auth_user_id', userData.user.id).maybeSingle()
    const { data: alert } = await admin.from('sos_alerts').select('*').eq('id', alertId).maybeSingle()
    if (!profile || !alert || alert.user_id !== profile.id) return json({ error: 'That SOS is not yours.' }, 403)

    const age = Date.now() - new Date(String(alert.created_at)).getTime()
    if (age > 5 * 60 * 1000) return json({ error: 'That SOS is too old to text.' }, 400)

    const { data: recent } = await admin
      .from('sos_alerts')
      .select('id')
      .eq('user_id', profile.id)
      .neq('id', alertId)
      .gt('created_at', new Date(Date.now() - 60_000).toISOString())
    if (recent && recent.length > 0) {
      await admin.from('sos_alerts').update({ sms_status: 'skipped', sms_detail: 'Another SOS was sent in the last minute.' }).eq('id', alertId)
      return json({ status: 'skipped', detail: 'Another SOS was sent in the last minute.' }, 200)
    }

    const sid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
    const token = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
    const from = Deno.env.get('TWILIO_FROM_NUMBER') ?? ''
    if (!sid || !token || !from) {
      await admin.from('sos_alerts').update({ sms_status: 'skipped', sms_detail: 'Twilio secrets are not set.' }).eq('id', alertId)
      return json({ status: 'skipped', detail: 'Twilio secrets are not set.' }, 200)
    }

    const saved = Array.isArray(alert.contacts) ? (alert.contacts as Contact[]) : []
    const desk = (Deno.env.get('SOS_DESK_NUMBERS') ?? '').split(',').map((item) => item.trim()).filter(Boolean)
    const targets = [...new Set([...saved.map((item) => item.phone ?? ''), ...desk])].filter((phone) => /^\+[1-9]\d{7,14}$/.test(phone)).slice(0, 8)
    const failures: string[] = []
    for (const to of targets) {
      const payload = new URLSearchParams({ To: to, From: from, Body: String(alert.message) })
      const sent = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload,
      })
      if (!sent.ok) {
        const text = await sent.text()
        failures.push(text.slice(0, 140))
      }
    }
    const status = targets.length === 0 ? 'skipped' : failures.length === 0 ? 'sent' : failures.length === targets.length ? 'failed' : 'partial'
    const detail = (targets.length === 0 ? 'No valid phone numbers.' : failures.join(' | ')).slice(0, 500)
    await admin.from('sos_alerts').update({ sms_status: status, sms_detail: detail }).eq('id', alertId)
    return json({ status, detail }, 200)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'SOS send failed.' }, 500)
  }
})

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
