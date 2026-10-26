export const REPORT_STATUS_NOTICE = 'Your report status was updated'
export const SOS_STATUS_NOTICE = 'Your SOS status was updated'

export type NoticeKind = 'report' | 'sos'

export function statusNoticeBody(kind: NoticeKind): string {
  return kind === 'sos' ? SOS_STATUS_NOTICE : REPORT_STATUS_NOTICE
}

/** True only for the fixed status sentences. Report text must never be interpolated. */
export function noticeIsGeneric(body: string): boolean {
  return body === REPORT_STATUS_NOTICE || body === SOS_STATUS_NOTICE
}

export function missingKeys(env: Record<string, string | undefined>, keys: string[]): string[] {
  return keys.filter((key) => !(env[key] ?? '').trim())
}

export type EmailRequest = {
  url: string
  headers: Record<string, string>
  body: string
}

/** Builds a provider HTTP call. The body is only the generic status sentence. */
export function statusEmailRequest(
  provider: string,
  apiKey: string,
  from: string,
  to: string,
  kind: NoticeKind,
): EmailRequest | null {
  const text = statusNoticeBody(kind)
  const name = provider.trim().toLowerCase()
  if (name === 'sendgrid') {
    return {
      url: 'https://api.sendgrid.com/v3/mail/send',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject: text,
        content: [{ type: 'text/plain', value: text }],
      }),
    }
  }
  if (name === 'postmark') {
    return {
      url: 'https://api.postmarkapp.com/email',
      headers: { 'X-Postmark-Server-Token': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ From: from, To: to, Subject: text, TextBody: text }),
    }
  }
  if (name === 'resend') {
    return {
      url: 'https://api.resend.com/emails',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: text, text }),
    }
  }
  return null
}
