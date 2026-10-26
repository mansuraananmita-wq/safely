import { describe, expect, it } from 'vitest'
import { missingKeys, noticeIsGeneric, statusEmailRequest, statusNoticeBody } from '../../supabase/functions/_shared/notice'

describe('status notices', () => {
  it('uses a generic body and never copies report content', () => {
    const report = {
      title: 'Broken gate after dark',
      description: 'The south lamp is out and the path is dark.',
      category: 'harassment',
      confidential: true,
      anonymous: true,
    }
    const body = statusNoticeBody('report')
    expect(body).toBe('Your report status was updated')
    expect(noticeIsGeneric(body)).toBe(true)
    for (const value of Object.values(report)) {
      expect(body.toLowerCase()).not.toContain(String(value).toLowerCase())
    }
    expect(body.toLowerCase()).not.toContain('confidential')
    expect(body.toLowerCase()).not.toContain('anonymous')
  })

  it('keeps SOS status text generic', () => {
    const body = statusNoticeBody('sos')
    expect(body).toBe('Your SOS status was updated')
    expect(body).not.toContain('maps.google')
    expect(noticeIsGeneric(body)).toBe(true)
  })

  it('names the secrets that are missing and builds only a generic email', () => {
    expect(missingKeys({ EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: '' }, ['EMAIL_PROVIDER', 'EMAIL_API_KEY', 'EMAIL_FROM'])).toEqual([
      'EMAIL_API_KEY',
      'EMAIL_FROM',
    ])
    const request = statusEmailRequest('resend', 'key', 'desk@example.com', 'amina@padma.edu', 'report')
    expect(request?.body).toContain('Your report status was updated')
    expect(request?.body).not.toContain('harassment')
    expect(statusEmailRequest('other', 'key', 'desk@example.com', 'amina@padma.edu', 'report')).toBeNull()
  })
})