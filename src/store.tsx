import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { buildSeed } from './data'
import type { Session } from '@supabase/supabase-js'
import { DEMO_PASSWORD, isRemote, supabase } from './lib/supabase'
import { consumeSignedIn, allocateReportId, pullCampus, pullSosAlerts, pushDiff, rememberUser, takePullError } from './lib/sync'
import { allowedTransitions, assignmentBlocked, canView, isOpen, isReportOwner, nextReportId, uid } from './logic'
import { mediaProblem, stripAudioId3, videoExtension, voiceExtension } from './lib/reportMedia'
import { isPreciseFix, LIVE_SHARE_MS, normalizePhone, shouldPushLiveFix, sosMessage, watchLiveLocation, type LiveFix } from './lib/sos'
import type {
  Activity,
  Announcement,
  AppNotification,
  AppState,
  AuditEntry,
  Category,
  Department,
  Lang,
  LostItem,
  NoticeKind,
  Photo,
  Priority,
  Report,
  ReportMedia,
  Role,
  Status,
  RevealRequest,
  SupportCategory,
  SupportContact,
  User,
} from './types'

export const STORAGE_KEY = 'safely-preview-v1'
const PREFS_KEY = 'safely-prefs'

export { consumeSignedIn }

function readPrefs(): AppState['prefs'] | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AppState['prefs']
    if (parsed?.lang !== 'en' && parsed?.lang !== 'bn') return null
    return parsed
  } catch {
    return null
  }
}

function shell(): AppState {
  const seed = buildSeed()
  return {
    ...seed,
    users: [],
    reports: [],
    notifications: [],
    announcements: [],
    supportContacts: [],
    lostFound: [],
    audit: [],
    emergencyContacts: [],
    sosAlerts: [],
    safeWalks: [],
    appSettings: {},
    reportFlags: [],
    reportIdentities: {},
    identityRevealedAt: {},
    revealRequests: [],
    codes: {},
    sessionUserId: null,
    prefs: readPrefs() ?? seed.prefs,
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return buildSeed()
    const parsed = JSON.parse(raw) as { version?: number; state?: AppState }
    if (parsed.version !== 1 || !parsed.state?.reports || !parsed.state.users || !parsed.state.categories) return buildSeed()
    const state = withSampleNotices(parsed.state)
    return {
      ...state,
      emergencyContacts: state.emergencyContacts ?? [],
      sosAlerts: state.sosAlerts ?? [],
      safeWalks: state.safeWalks ?? [],
      appSettings: state.appSettings ?? {},
      reportFlags: state.reportFlags ?? [],
      reportIdentities: state.reportIdentities ?? {},
      identityRevealedAt: state.identityRevealedAt ?? {},
      revealRequests: state.revealRequests ?? [],
      supportContacts: state.supportContacts ?? [],
    }
  } catch {
    return buildSeed()
  }
}

function ownerProfileId(state: AppState, report: Report): string | undefined {
  if (report.reporterId) return report.reporterId
  return state.reportIdentities[report.id]
}

function withSampleNotices(state: AppState): AppState {
  const ids = ['n-sample-received', 'n-sample-assigned', 'n-sample-info', 'n-sample-resolved']
  const have = new Set(state.notifications.map((item) => item.id))
  if (ids.every((id) => have.has(id))) return state
  const missing = buildSeed().notifications.filter((item) => item.id.startsWith('n-sample-') && !have.has(item.id))
  if (!missing.length) return state
  const next = { ...state, notifications: [...missing, ...state.notifications] }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: next }))
  } catch {
    /* The in-memory copy still shows the notices if the saved preview is too large. */
  }
  return next
}

function persist(state: AppState) {
  const write = (value: AppState) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: value }))
  try {
    write(state)
  } catch {
    const slim: AppState = {
      ...state,
      reports: state.reports.map((report) => ({
        ...report,
        photos: report.photos.map((photo) => ({ name: photo.name })),
        resolutionPhoto: report.resolutionPhoto ? { name: report.resolutionPhoto.name } : undefined,
      })),
    }
    try {
      write(slim)
    } catch {
      /* Preview storage is full. */
    }
  }
}

function pin(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function nowIso(): string {
  return new Date().toISOString()
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString()
}

function activity(actor: string, visibility: Activity['visibility'], kind: Activity['kind'], message: string): Activity {
  return { id: uid('a'), at: nowIso(), actor, visibility, kind, message }
}

function withNotes(state: AppState, users: User[], title: string, body: string, href: string, kind?: NoticeKind): AppState {
  const notes: AppNotification[] = users
    .filter((user) => user.notifyInApp && !user.suspended)
    .map((user) => ({ id: uid('n'), userId: user.id, title, body, href, read: false, createdAt: nowIso(), kind }))
  return { ...state, notifications: [...notes, ...state.notifications].slice(0, 200) }
}

export type ReportClip = { file: Blob; mime: string; seconds: number; name: string }

async function storeClip(reportId: string, kind: 'voice' | 'video', clip: ReportClip, remote: boolean): Promise<ReportMedia | string> {
  const problem = mediaProblem(kind, clip.mime, clip.file.size, clip.seconds)
  if (problem) return problem
  const ext = kind === 'voice' ? voiceExtension(clip.mime) : videoExtension(clip.mime)
  if (!ext) return 'Unsupported file.'
  let body = clip.file
  if (clip.mime === 'audio/mpeg') {
    const stripped = stripAudioId3(new Uint8Array(await clip.file.arrayBuffer()))
    body = new Blob([stripped.slice()], { type: clip.mime })
  }
  if (!remote || !supabase) {
    return { path: '', name: clip.name, mime: clip.mime, seconds: Math.round(clip.seconds), bytes: body.size, url: URL.createObjectURL(body) }
  }
  const path = `${reportId}/${kind}.${ext}`
  const uploaded = await supabase.storage.from('report-media').upload(path, body, { contentType: clip.mime, upsert: true })
  if (uploaded.error) return uploaded.error.message
  const media: ReportMedia = { path, name: clip.name, mime: clip.mime, seconds: Math.round(clip.seconds), bytes: body.size }
  const column = kind === 'voice' ? 'voice_note' : 'video'
  const saved = await supabase.from('reports').update({ [column]: media }).eq('id', reportId)
  if (saved.error) return saved.error.message
  return media
}

async function attachReportClips(reportId: string, clips: { voice?: ReportClip; video?: ReportClip }, remote: boolean) {
  const voice = clips.voice ? await storeClip(reportId, 'voice', clips.voice, remote) : undefined
  const video = clips.video ? await storeClip(reportId, 'video', clips.video, remote) : undefined
  return {
    voice: typeof voice === 'string' ? undefined : voice,
    video: typeof video === 'string' ? undefined : video,
    error: typeof voice === 'string' || typeof video === 'string',
  }
}

function withAudit(state: AppState, actor: string, action: string, target: string): AppState {
  const entry: AuditEntry = { id: uid('au'), at: nowIso(), actor, action, target }
  return { ...state, audit: [entry, ...state.audit].slice(0, 300) }
}

function deskAudience(state: AppState, report: Pick<Report, 'confidential' | 'category'>): User[] {
  if (report.confidential || report.category === 'harassment') {
    return state.users.filter((user) => user.role === 'admin' || user.role === 'security' || user.departmentId === 'd-affairs')
  }
  if (report.category === 'safety') return state.users.filter((user) => user.role === 'admin' || user.role === 'security')
  return state.users.filter((user) => user.role === 'admin')
}

function replaceReport(state: AppState, report: Report): AppState {
  const exists = state.reports.some((item) => item.id === report.id)
  return {
    ...state,
    reports: exists ? state.reports.map((item) => (item.id === report.id ? report : item)) : [report, ...state.reports],
  }
}

export type ReportInput = {
  id?: string
  title: string
  description: string
  category: Report['category']
  subcategory?: string
  locationId: string
  locationDetail: string
  lat?: number
  lng?: number
  photos: Photo[]
  confidential: boolean
  anonymous: boolean
  priority: Priority
  blocksAccess: boolean
  contactWindow: string
}

type Toast = { id: string; text: string }

type Api = {
  state: AppState
  currentUser: User | null
  lang: Lang
  tx: (en: string, bn: string) => string
  toasts: Toast[]
  toast: (text: string) => void
  remote: boolean
  ready: boolean
  login: (email: string, password: string) => Promise<'unknown' | 'suspended' | 'unverified' | 'password' | null>
  loginDirect: (email: string) => Promise<'unknown' | 'suspended' | 'unverified' | 'password' | null>
  logout: () => void
  register: (input: { name: string; email: string; role: Role; unit: string; identifier: string; password: string }) => Promise<'email' | 'exists' | 'role' | 'signed-in' | null>
  verify: (email: string, code: string) => boolean
  resend: (email: string) => void
  requestReset: (email: string) => Promise<boolean>
  completeReset: (email: string, code: string) => boolean
  setLang: (lang: Lang) => void
  setTextSize: (size: 'default' | 'large') => void
  setContrast: (on: boolean) => void
  saveDraft: (input: ReportInput) => Promise<string | null>
  submitReport: (input: ReportInput, clips?: { voice?: ReportClip; video?: ReportClip }) => Promise<string | null>
  deleteDraft: (id: string) => void
  addComment: (reportId: string, body: string, visibility: 'public' | 'internal') => void
  setStatus: (reportId: string, status: Status, note: string, resolutionPhoto?: Photo) => boolean
  assign: (reportId: string, departmentId: string, assignee: string, priority: Priority) => boolean
  setPriority: (ids: string[], priority: Priority) => void
  requestInfo: (reportId: string, body: string) => void
  requestReveal: (reportId: string, reason: string) => Promise<string | null>
  decideReveal: (requestId: string, decision: 'approved' | 'rejected') => Promise<string | null>
  revealReporter: (reportId: string, reason: string) => Promise<{ name: string; email: string } | string>
  rate: (reportId: string, rating: number, feedback: string) => void
  reopen: (reportId: string, reason: string) => void
  confirm: (reportId: string) => void
  markRead: (id: string) => void
  markAllRead: () => void
  publishAnnouncement: (input: { title: string; body: string; kind: Announcement['kind']; locationId?: string }) => void
  setAnnouncementActive: (id: string, active: boolean) => void
  saveSupportContact: (input: {
    id?: string
    nameEn: string
    nameBn: string
    category: SupportCategory
    phone: string
    email: string
    hours: string
    descriptionEn: string
    descriptionBn: string
    sortOrder: number
    isActive: boolean
  }) => void
  setSupportContactActive: (id: string, isActive: boolean) => void
  saveAppSetting: (key: string, value: string) => void
  flagReport: (reportId: string, kind: 'invalid' | 'malicious', reason: string) => Promise<string | null>
  addLost: (input: { title: string; place: string; detail: string; kind: LostItem['kind']; contact: string }) => void
  setLostStatus: (id: string, status: LostItem['status']) => void
  updateUser: (id: string, patch: Partial<Pick<User, 'role' | 'suspended' | 'departmentId'>>) => void
  updateDepartment: (id: string, patch: Partial<Pick<Department, 'lead' | 'email'>>) => void
  updateCategory: (id: string, patch: Partial<Pick<Category, 'active' | 'slaHours'>>) => void
  extendDue: (reportId: string) => void
  updateProfile: (patch: Partial<Pick<User, 'name' | 'unit' | 'identifier' | 'notifyInApp' | 'notifyEmail' | 'notifyPush'>>) => Promise<string | null>
  changePassword: (password: string) => Promise<boolean>
  recordExport: () => void
  resetDemo: () => void
  addEmergencyContact: (name: string, phone: string) => Promise<'ok' | 'name' | 'phone' | 'limit' | 'duplicate' | 'rejected'>
  removeEmergencyContact: (id: string) => Promise<string | null>
  sendSos: (place: { lat: number; lng: number; accuracy: number } | null) => Promise<{ status: 'sent' | 'desk' | 'sms-failed' | 'soon' | 'empty' | 'rejected'; id: string | null; detail?: string | null }>
  refineSosLocation: (id: string, place: { lat: number; lng: number; accuracy: number }) => Promise<string | null>
  startSosLiveShare: (id: string, place: LiveFix) => void
  refreshSosAlerts: () => Promise<void>
  resolveSos: (id: string) => Promise<string | null>
  markSosSeen: () => Promise<string | null>
}

const Ctx = createContext<Api | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const remote = isRemote
  const [state, setState] = useState<AppState>(() => (remote ? shell() : load()))
  const [ready, setReady] = useState(!remote)
  const [dbError, setDbError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const stateRef = useRef(state)
  const readyRef = useRef(!remote)
  const epoch = useRef(0)
  const writing = useRef(0)
  stateRef.current = state

  useEffect(() => {
    if (remote) {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs))
      } catch {
        /* Preferences stay in memory for this tab. */
      }
      return
    }
    persist(state)
  }, [state, remote])

  useEffect(() => {
    document.documentElement.lang = state.prefs.lang === 'bn' ? 'bn' : 'en'
    document.documentElement.classList.toggle('text-large', state.prefs.textSize === 'large')
    document.documentElement.classList.toggle('contrast', state.prefs.contrast)
  }, [state.prefs])

  useEffect(() => {
    if (!remote || !supabase) return
    const client = supabase
    let alive = true
    const apply = (session: Session | null) => {
      const seen = epoch.current
      if (writing.current > 0) return
      void pullCampus(session).then((next) => {
        if (!alive || seen !== epoch.current || writing.current > 0) return
        next.prefs = stateRef.current.prefs
        readyRef.current = true
        setReady(true)
        setDbError(takePullError())
        stateRef.current = next
        setState(next)
      }).catch((error: unknown) => {
        if (!alive) return
        readyRef.current = true
        setReady(true)
        setDbError(error instanceof Error ? error.message : 'The campus database did not respond.')
      })
    }
    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN' && event !== 'SIGNED_OUT' && event !== 'TOKEN_REFRESHED') return
      window.setTimeout(() => apply(session), 0)
    })
    const onFocus = () => {
      if (document.visibilityState === 'hidden') return
      void client.auth.getSession().then(({ data }) => apply(data.session))
    }
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      alive = false
      subscription.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [remote])

  useEffect(() => {
    if (remote) return
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      try {
        const parsed = JSON.parse(event.newValue) as { state?: AppState }
        if (parsed.state) setState(parsed.state)
      } catch {
        /* Ignore unreadable preview data from another tab. */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toast = (text: string) => {
    const id = uid('t')
    setToasts((prev) => [...prev, { id, text }].slice(-4))
    window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 4200)
  }

  const say = (en: string, bn: string) => toast(stateRef.current.prefs.lang === 'bn' ? bn : en)
  const sosShare = useRef<{ stop: () => void } | null>(null)

  const stopSosLiveShare = () => {
    sosShare.current?.stop()
    sosShare.current = null
  }

  useEffect(() => () => stopSosLiveShare(), [])

  const update = (fn: (current: AppState) => AppState): Promise<string | null> => {
    const prev = stateRef.current
    const next = fn(prev)
    epoch.current += 1
    stateRef.current = next
    setState(next)
    if (!(remote && readyRef.current && supabase)) return Promise.resolve(null)
    const seen = epoch.current
    writing.current += 1
    return pushDiff(prev, next).then((error) => {
      writing.current = Math.max(0, writing.current - 1)
      if (!error) return null
      if (epoch.current === seen) {
        stateRef.current = prev
        setState(prev)
      }
      const detail = error.length > 180 ? `${error.slice(0, 180)}…` : error
      toast(stateRef.current.prefs.lang === 'bn' ? `ক্যাম্পাস ডেটাবেস এই পরিবর্তন নেয়নি। ${detail}` : `The campus database rejected that change. ${detail}`)
      return error
    })
  }

  const refineSosLocation = (id: string, place: { lat: number; lng: number; accuracy: number }) => {
    const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
    if (!user) return Promise.resolve('rejected')
    const current = (stateRef.current.sosAlerts ?? []).find((item) => item.id === id && item.userId === user.id && !item.resolvedAt)
    if (!current) return Promise.resolve(null)
    const next: LiveFix = { lat: place.lat, lng: place.lng, accuracy: place.accuracy, at: Date.now() }
    if (!isPreciseFix(next)) return Promise.resolve(null)
    const sent = typeof current.lat === 'number' && typeof current.lng === 'number'
      ? { lat: current.lat, lng: current.lng, accuracy: current.accuracyM ?? next.accuracy, at: 0 }
      : null
    if (sent && !shouldPushLiveFix(sent, next)) return Promise.resolve(null)
    return update((state) => ({
      ...state,
      sosAlerts: (state.sosAlerts ?? []).map((item) => (
        item.id === id
          ? { ...item, lat: place.lat, lng: place.lng, accuracyM: place.accuracy, message: sosMessage(item.senderName, place) }
          : item
      )),
    }))
  }

  const startSosLiveShare = (id: string, place: LiveFix) => {
    stopSosLiveShare()
    const initial: LiveFix = { ...place, at: place.at || Date.now() }
    if (!isPreciseFix(initial)) return
    let last: LiveFix = initial
    const stopWatch = watchLiveLocation((fix) => {
      if (!shouldPushLiveFix(last, fix)) return
      last = fix
      void refineSosLocation(id, { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy })
    })
    const timer = window.setTimeout(() => stopSosLiveShare(), LIVE_SHARE_MS)
    sosShare.current = {
      stop: () => {
        stopWatch()
        window.clearTimeout(timer)
      },
    }
  }

  const refreshSosAlerts = async () => {
    if (!remote || !supabase || writing.current > 0) return
    const rows = await pullSosAlerts()
    if (!rows) return
    setState((current) => {
      const next = { ...current, sosAlerts: rows }
      stateRef.current = next
      return next
    })
  }

  const userByEmail = (email: string) =>
    stateRef.current.users.find((user) => user.email.toLowerCase() === email.trim().toLowerCase())

  const startSession = (email: string): 'unknown' | 'suspended' | 'unverified' | null => {
    const user = userByEmail(email)
    if (!user) return 'unknown'
    if (user.suspended) return 'suspended'
    if (!user.verified) return 'unverified'
    rememberUser(user)
    update((current) => ({ ...current, sessionUserId: user.id }))
    return null
  }

  const signInRemote = async (email: string, password: string): Promise<'unknown' | 'suspended' | 'unverified' | 'password' | null> => {
    if (!supabase) return 'unknown'
    const address = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({ email: address, password })
    if (error || !data.session) return 'password'
    const next = await pullCampus(data.session)
    next.prefs = stateRef.current.prefs
    const user = next.users.find((item) => item.email.toLowerCase() === address)
    if (!user) {
      await supabase.auth.signOut()
      return 'unknown'
    }
    if (user.suspended) {
      await supabase.auth.signOut()
      return 'suspended'
    }
    rememberUser(user)
    readyRef.current = true
    epoch.current += 1
    stateRef.current = next
    setReady(true)
    setState(next)
    return null
  }

  const buildReport = (current: AppState, user: User, input: ReportInput, status: Status): Report => {
    const existing = input.id ? current.reports.find((report) => report.id === input.id) : undefined
    const stamp = nowIso()
    const sla = current.categories.find((category) => category.id === input.category)?.slaHours ?? 72
    const confidential = input.category === 'harassment' ? true : input.confidential
    let priority = input.priority
    if ((input.category === 'harassment' || input.category === 'safety') && (priority === 'low' || priority === 'medium')) {
      priority = 'high'
    }
    return {
      confirmations: [],
      infoRequested: false,
      activities: [],
      resolutionNote: '',
      ...existing,
      id: existing?.id || input.id || nextReportId(current.reports),
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      subcategory: input.subcategory || '',
      locationId: input.locationId,
      locationDetail: input.locationDetail.trim(),
      lat: input.lat,
      lng: input.lng,
      photos: input.photos.slice(0, 3),
      confidential,
      anonymous: input.anonymous,
      status,
      priority,
      // Anonymous reports keep the link in reportIdentities, not on the report row staff can select.
      reporterId: input.anonymous ? '' : user.id,
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
      dueAt: status === 'draft' ? (existing?.dueAt ?? addHours(stamp, sla)) : addHours(stamp, sla),
      blocksAccess: input.blocksAccess,
      contactWindow: confidential && !input.anonymous ? input.contactWindow.trim() : '',
      departmentId: status === 'draft' ? undefined : existing?.departmentId,
      assignee: status === 'draft' ? undefined : existing?.assignee,
    }
  }

  const api: Api = {
    state,
    currentUser: state.users.find((user) => user.id === state.sessionUserId) ?? null,
    lang: state.prefs.lang,
    tx: (en, bn) => (state.prefs.lang === 'bn' ? bn : en),
    toasts,
    toast,
    remote,
    ready,
    login: async (email, password) => {
      if (password.trim().length < 8) return 'password'
      if (remote) return signInRemote(email, password)
      return startSession(email)
    },
    loginDirect: async (email) => {
      if (remote) return signInRemote(email, DEMO_PASSWORD)
      return startSession(email)
    },
    logout: () => {
      stopSosLiveShare()
      if (remote && supabase) {
        void supabase.auth.signOut()
        return
      }
      update((current) => ({ ...current, sessionUserId: null }))
    },
    register: async ({ name, email, role, unit, identifier, password }) => {
      const clean = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return 'email'
      if (role !== 'student' && role !== 'teacher' && role !== 'staff') return 'role'
      if (password.trim().length < 8) {
        say('Use at least 8 characters.', 'কমপক্ষে ৮ অক্ষর দিন।')
        return 'email'
      }
      if (remote && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: clean,
          password,
          options: { data: { name: name.trim(), role, unit: unit.trim(), identifier: identifier.trim() } },
        })
        if (error) {
          if (!error.message.toLowerCase().includes('already')) say(error.message, error.message)
          return 'exists'
        }
        if (data.session) {
          const next = await pullCampus(data.session)
          next.prefs = stateRef.current.prefs
          const user = next.users.find((item) => item.email.toLowerCase() === clean)
          if (user) rememberUser(user)
          readyRef.current = true
          epoch.current += 1
          stateRef.current = next
          setReady(true)
          setState(next)
          return 'signed-in'
        }
        return null
      }
      if (stateRef.current.users.some((user) => user.email === clean)) return 'exists'
      const user: User = {
        id: uid('u'),
        name: name.trim(),
        email: clean,
        role,
        unit: unit.trim(),
        identifier: identifier.trim(),
        verified: true,
        suspended: false,
        notifyInApp: true,
        notifyEmail: true,
        notifyPush: false,
      }
      rememberUser(user)
      update((current) => ({
        ...current,
        users: [...current.users, user],
        sessionUserId: user.id,
      }))
      return 'signed-in'
    },
    verify: (email, code) => {
      const key = `verify:${email.trim().toLowerCase()}`
      const expected = stateRef.current.codes[key]
      if (!expected || expected !== code.trim()) {
        say('That code does not match the demo inbox.', 'কোডটি ডেমো ইনবক্সের সাথে মেলেনি।')
        return false
      }
      update((current) => ({
        ...current,
        users: current.users.map((user) => (user.email === email.trim().toLowerCase() ? { ...user, verified: true } : user)),
        codes: { ...current.codes, [key]: '' },
      }))
      say('Email marked verified for this preview.', 'এই প্রিভিউতে ইমেইল যাচাই হয়েছে।')
      return true
    },
    resend: (email) => {
      const key = `verify:${email.trim().toLowerCase()}`
      update((current) => ({ ...current, codes: { ...current.codes, [key]: pin() } }))
    },
    requestReset: async (email) => {
      const address = email.trim().toLowerCase()
      if (remote && supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(address)
        if (error) say('The reset email could not be sent.', 'রিসেট ইমেইল যায়নি।')
        else say('If that email has an account, a reset link is on its way.', 'এই ইমেইলে অ্যাকাউন্ট থাকলে রিসেট লিংক যাবে।')
        return !error
      }
      const user = userByEmail(address)
      if (!user) return false
      const key = `reset:${user.email}`
      update((current) => ({ ...current, codes: { ...current.codes, [key]: pin() } }))
      return true
    },
    completeReset: (email, code) => {
      const key = `reset:${email.trim().toLowerCase()}`
      if (stateRef.current.codes[key] !== code.trim()) {
        say('That reset code does not match.', 'রিসেট কোড মেলেনি।')
        return false
      }
      update((current) => ({ ...current, codes: { ...current.codes, [key]: '' } }))
      say('Password reset recorded. Sign in with any 8+ character password in this preview.', 'পাসওয়ার্ড রিসেট হয়েছে। এই প্রিভিউতে ৮ অক্ষরের যেকোনো পাসওয়ার্ডে ঢুকতে পারবেন।')
      return true
    },
    setLang: (lang) => update((current) => ({ ...current, prefs: { ...current.prefs, lang } })),
    setTextSize: (textSize) => update((current) => ({ ...current, prefs: { ...current.prefs, textSize } })),
    setContrast: (contrast) => update((current) => ({ ...current, prefs: { ...current.prefs, contrast } })),
    saveDraft: async (input) => {
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      if (!user) return null
      if (!input.category || input.title.trim().length < 4) {
        say('Add a category and a short title before saving a draft.', 'খসড়া সেভ করতে বিভাগ ও ছোট একটি শিরোনাম দিন।')
        return null
      }
      const existing = input.id ? current.reports.find((report) => report.id === input.id) : undefined
      if (existing && (existing.status !== 'draft' || !isReportOwner(user, existing, current.reportIdentities))) return null
      const issued = input.id || !remote ? input : { ...input, id: (await allocateReportId()) ?? undefined }
      const report = buildReport(current, user, issued, 'draft')
      const error = await update((prev) => {
        const built = buildReport(prev, user, { ...issued, id: report.id }, 'draft')
        let next = replaceReport(prev, built)
        if (built.anonymous) next = { ...next, reportIdentities: { ...next.reportIdentities, [built.id]: user.id } }
        return next
      })
      if (error) return null
      say(remote ? 'Draft saved to the campus database.' : 'Draft saved in this browser.', remote ? 'খসড়া ক্যাম্পাস ডেটাবেসে সেভ হয়েছে।' : 'খসড়া এই ব্রাউজারে সেভ হয়েছে।')
      return report.id
    },
    submitReport: async (input, clips) => {
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      if (!user) return null
      if (input.title.trim().length < 8 || input.description.trim().length < 20 || !input.locationId) {
        say('Add a title, a fuller description, and a campus place.', 'শিরোনাম, বিস্তারিত বিবরণ এবং ক্যাম্পাসের স্থান দিন।')
        return null
      }
      const existing = input.id ? current.reports.find((report) => report.id === input.id) : undefined
      if (existing && (existing.status !== 'draft' || !isReportOwner(user, existing, current.reportIdentities))) return null
      const dayAgo = Date.now() - 86_400_000
      const recent = current.reports.filter(
        (report) => isReportOwner(user, report, current.reportIdentities) && report.status !== 'draft' && new Date(report.createdAt).getTime() > dayAgo,
      )
      if (recent.length >= 10) {
        say('One account can file ten reports a day.', 'একটি অ্যাকাউন্ট থেকে দিনে দশটি রিপোর্ট যায়।')
        return null
      }
      const issued = input.id || !remote ? input : { ...input, id: (await allocateReportId()) ?? undefined }
      const created = buildReport(current, user, issued, 'submitted')
      const submitted: Report = {
        ...created,
        activities: [...created.activities, activity('Safely', 'public', 'system', created.anonymous ? 'Anonymous report submitted.' : 'Report submitted.')],
      }
      const error = await update((prev) => {
        let next = replaceReport(prev, submitted)
        if (submitted.anonymous) next = { ...next, reportIdentities: { ...next.reportIdentities, [submitted.id]: user.id } }
        const audience = deskAudience(next, submitted).filter((item) => item.id !== user.id)
        const href = `/admin/reports/${submitted.id}`
        const title = submitted.confidential ? 'Confidential report submitted' : 'New campus report'
        const body = submitted.confidential ? `${submitted.id} is in the restricted queue.` : `${submitted.id}: ${submitted.title}`
        next = withNotes(next, audience, title, body, href)
        if (user.notifyInApp) {
          next = withNotes(next, [user], 'Your report has been received.', `${submitted.id} is with the campus desk.`, `/app/reports/${submitted.id}`, 'received')
        }
        return next
      })
      if (error) return null
      if (clips?.voice || clips?.video) {
        const saved = await attachReportClips(submitted.id, clips, Boolean(remote && supabase))
        if (saved.voice || saved.video) {
          update((prev) => {
            const current = prev.reports.find((item) => item.id === submitted.id) ?? submitted
            return replaceReport(prev, { ...current, voiceNote: saved.voice ?? current.voiceNote, video: saved.video ?? current.video })
          })
        }
        if (saved.error) say('The report was saved, but a recording was not stored.', 'রিপোর্ট সেভ হয়েছে, কিন্তু রেকর্ডিং সেভ হয়নি।')
      }
      say(`Submitted ${submitted.id}.`, `${submitted.id} জমা হয়েছে।`)
      return submitted.id
    },
    deleteDraft: (id) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      update((current) => ({
        ...current,
        reports: current.reports.filter((report) => !(report.id === id && report.status === 'draft' && user && isReportOwner(user, report, current.reportIdentities))),
        reportIdentities: Object.fromEntries(Object.entries(current.reportIdentities).filter(([reportId]) => reportId !== id)),
      }))
      say('Draft deleted.', 'খসড়া মুছে ফেলা হয়েছে।')
    },
    addComment: (reportId, body, visibility) => {
      const text = body.trim()
      if (text.length < 2) return
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      const report = current.reports.find((item) => item.id === reportId)
      if (!user || !report || !canView(user, report, current.reportIdentities)) return
      const internal = visibility === 'internal'
      const owner = isReportOwner(user, report, current.reportIdentities)
      const actorLabel = !internal && report.anonymous && owner ? 'Reporter' : user.name
      const nextReport: Report = {
        ...report,
        updatedAt: nowIso(),
        infoRequested: internal ? report.infoRequested : false,
        activities: [...report.activities, activity(actorLabel, internal ? 'internal' : 'public', internal ? 'internal' : 'reply', text)],
      }
      update((prev) => {
        let next = replaceReport(prev, nextReport)
        const ownerId = ownerProfileId(next, report)
        if (!internal && ownerId && ownerId !== user.id) {
          const reporter = next.users.find((item) => item.id === ownerId)
          if (reporter) next = withNotes(next, [reporter], 'New update on your report', `${report.id} has a new reply.`, `/app/reports/${report.id}`)
          else if (remote && report.anonymous && supabase) {
            void supabase.rpc('notify_report_owner', {
              p_report_id: report.id,
              p_title: 'New update on your report',
              p_body: `${report.id} has a new reply.`,
              p_href: `/app/reports/${report.id}`,
              p_kind: null,
            })
          }
        }
        if (!internal && owner) {
          next = withNotes(
            next,
            deskAudience(next, report).filter((item) => item.id !== user.id),
            'Reporter replied',
            `${report.id} has a reply from the reporter.`,
            `/admin/reports/${report.id}`,
          )
        }
        return next
      })
    },
    setStatus: (reportId, status, note, resolutionPhoto) => {
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      const report = current.reports.find((item) => item.id === reportId)
      if (!user || !report) return false
      if (!allowedTransitions(user, report, current.reportIdentities).includes(status)) {
        say('That status change is not available for this account.', 'এই অ্যাকাউন্ট থেকে এই স্ট্যাটাস বদলানো যাবে না।')
        return false
      }
      if ((status === 'rejected' || status === 'resolved' || status === 'reopened') && note.trim().length < 8) {
        say('Add a short note so the next person knows why.', 'কেন বদলালেন, ছোট একটি নোট দিন।')
        return false
      }
      const stamp = nowIso()
      const nextReport: Report = {
        ...report,
        status,
        updatedAt: stamp,
        rejectReason: status === 'rejected' ? note.trim() : report.rejectReason,
        resolutionNote: status === 'resolved' ? note.trim() : report.resolutionNote,
        resolutionPhoto: status === 'resolved' && resolutionPhoto ? resolutionPhoto : report.resolutionPhoto,
        resolvedAt: status === 'resolved' ? stamp : report.resolvedAt,
        closedAt: status === 'closed' ? stamp : report.closedAt,
        infoRequested: false,
        activities: [
          ...report.activities,
          activity('Safely', 'public', 'system', note.trim() ? `Status set to ${status.replaceAll('_', ' ')}. ${note.trim()}` : `Status set to ${status.replaceAll('_', ' ')}.`),
        ],
      }
      update((prev) => {
        let next = replaceReport(prev, nextReport)
        next = withAudit(next, user.name, `Set status to ${status.replaceAll('_', ' ')}`, report.id)
        const ownerId = ownerProfileId(next, report)
        const reporter = ownerId ? next.users.find((item) => item.id === ownerId) : undefined
        const href = `/app/reports/${report.id}`
        if (reporter && reporter.id !== user.id) {
          if (status === 'resolved') {
            next = withNotes(next, [reporter], 'Your report has been resolved.', `${report.id} is marked resolved. You can rate the work.`, href, 'resolved')
          } else {
            next = withNotes(next, [reporter], 'Report status changed', `${report.id} is now ${status.replaceAll('_', ' ')}.`, href)
          }
        } else if (remote && report.anonymous && supabase && ownerId !== user.id) {
          void supabase.rpc('notify_report_owner', {
            p_report_id: report.id,
            p_title: status === 'resolved' ? 'Your report has been resolved.' : 'Report status changed',
            p_body: status === 'resolved' ? `${report.id} is marked resolved. You can rate the work.` : `${report.id} is now ${status.replaceAll('_', ' ')}.`,
            p_href: href,
            p_kind: status === 'resolved' ? 'resolved' : null,
          })
        }
        return next
      })
      say('Status updated.', 'স্ট্যাটাস আপডেট হয়েছে।')
      return true
    },
    assign: (reportId, departmentId, assignee, priority) => {
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      const report = current.reports.find((item) => item.id === reportId)
      const department = current.departments.find((item) => item.id === departmentId)
      if (!user || !report || !department) return false
      if (user.role !== 'admin') {
        say('Only the operations desk can assign a department.', 'বিভাগ বরাদ্দ করতে পারবে অপারেশন ডেস্ক।')
        return false
      }
      if (!isOpen(report.status)) {
        say('Reopen the report before assigning it.', 'বরাদ্দের আগে রিপোর্টটি আবার খুলুন।')
        return false
      }
      if (assignmentBlocked(report, departmentId)) {
        say('Confidential reports stay with Security or Student Affairs.', 'গোপন রিপোর্ট শুধু নিরাপত্তা বা শিক্ষার্থী বিষয়ক দপ্তরে যাবে।')
        return false
      }
      const status: Status = report.status === 'submitted' || report.status === 'under_review' || report.status === 'reopened' ? 'assigned' : report.status
      const lead = assignee.trim() || department.lead
      const nextReport: Report = {
        ...report,
        departmentId,
        assignee: lead,
        priority,
        status,
        updatedAt: nowIso(),
        activities: [...report.activities, activity(user.name, 'public', 'system', `Assigned to ${department.en}. Priority: ${priority}.`)],
      }
      update((prev) => {
        let next = replaceReport(prev, nextReport)
        next = withAudit(next, user.name, `Assigned report to ${department.en}`, report.id)
        const office = next.users.filter((item) => item.departmentId === departmentId && item.id !== user.id)
        next = withNotes(next, office, 'Report assigned to your office', `${report.id} is on the ${department.en} desk.`, `/admin/reports/${report.id}`)
        const ownerId = ownerProfileId(next, report)
        const reporter = ownerId ? next.users.find((item) => item.id === ownerId) : undefined
        if (reporter && reporter.id !== user.id) {
          next = withNotes(next, [reporter], 'Your report has been assigned.', `${report.id} went to ${department.en}.`, `/app/reports/${report.id}`, 'assigned')
        } else if (remote && report.anonymous && supabase && ownerId !== user.id) {
          void supabase.rpc('notify_report_owner', {
            p_report_id: report.id,
            p_title: 'Your report has been assigned.',
            p_body: `${report.id} went to ${department.en}.`,
            p_href: `/app/reports/${report.id}`,
            p_kind: 'assigned',
          })
        }
        return next
      })
      say('Department assigned.', 'বিভাগ বরাদ্দ হয়েছে।')
      return true
    },
    setPriority: (ids, priority) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user || (user.role !== 'admin' && user.role !== 'security')) return
      update((current) => {
        const reports = current.reports.map((report) => (ids.includes(report.id) && report.status !== 'draft' ? { ...report, priority, updatedAt: nowIso() } : report))
        return withAudit({ ...current, reports }, user.name, `Set priority to ${priority} on ${ids.length} reports`, ids.join(', '))
      })
      say('Priority updated.', 'অগ্রাধিকার আপডেট হয়েছে।')
    },
    requestInfo: (reportId, body) => {
      const text = body.trim()
      if (text.length < 8) {
        say('Write the question you need answered.', 'যে প্রশ্নটির উত্তর দরকার, তা লিখুন।')
        return
      }
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      const report = current.reports.find((item) => item.id === reportId)
      if (!user || !report || user.role !== 'admin') return
      const channel = ownerProfileId(current, report)
      if (report.anonymous && !channel && !remote) {
        say('This anonymous report has no reply channel.', 'এই বেনামি রিপোর্টে উত্তর দেওয়ার পথ নেই।')
        return
      }
      const nextReport: Report = {
        ...report,
        infoRequested: true,
        updatedAt: nowIso(),
        activities: [...report.activities, activity(user.name, 'public', 'reply', text)],
      }
      update((prev) => {
        let next = replaceReport(prev, nextReport)
        next = withAudit(next, user.name, 'Asked the reporter for more information', report.id)
        const ownerId = ownerProfileId(next, report)
        const reporter = ownerId ? next.users.find((item) => item.id === ownerId) : undefined
        if (reporter) next = withNotes(next, [reporter], 'More information is needed.', `${report.id} needs a reply.`, `/app/reports/${report.id}`, 'info')
        else if (remote && report.anonymous && supabase) {
          void supabase.rpc('notify_report_owner', {
            p_report_id: report.id,
            p_title: 'More information is needed.',
            p_body: `${report.id} needs a reply.`,
            p_href: `/app/reports/${report.id}`,
            p_kind: 'info',
          })
        }
        return next
      })
      say('Question sent to the reporter.', 'প্রশ্ন রিপোর্টকারীর কাছে গেছে।')
    },
    requestReveal: async (reportId, reason) => {
      const text = reason.trim()
      if (text.length < 8) return 'Write a short reason for the audit log.'
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      const report = current.reports.find((item) => item.id === reportId)
      if (!user || !report || !report.anonymous) return 'That report is not anonymous.'
      if (user.role !== 'admin' && user.departmentId !== 'd-affairs') return 'Only operations or Student Affairs can request a reveal.'
      if (report.category !== 'harassment' && report.category !== 'safety') return 'Reveal is only for harassment or safety emergencies.'
      if (current.revealRequests.some((item) => item.reportId === reportId && item.status === 'pending')) {
        return 'A reveal request is already pending for this report.'
      }
      if (current.revealRequests.some((item) => item.reportId === reportId && item.status === 'approved')) {
        return 'This report already has an approved reveal request.'
      }
      if (remote && supabase) {
        const { error } = await supabase.rpc('request_reveal', { p_report_id: reportId, p_reason: text })
        if (error) return error.message
        const next = await pullCampus((await supabase.auth.getSession()).data.session)
        setState(next)
        say('Reveal request submitted for a second approval.', 'রিভিল অনুরোধ দ্বিতীয় অনুমোদনের জন্য জমা হয়েছে।')
        return null
      }
      const item: RevealRequest = {
        id: uid('rr'),
        reportId,
        requestedBy: user.id,
        reason: text,
        status: 'pending',
        createdAt: nowIso(),
      }
      update((prev) => withAudit({ ...prev, revealRequests: [item, ...prev.revealRequests] }, user.name, `Requested anonymous reveal (${text})`, reportId))
      say('Reveal request submitted for a second approval.', 'রিভিল অনুরোধ দ্বিতীয় অনুমোদনের জন্য জমা হয়েছে।')
      return null
    },
    decideReveal: async (requestId, decision) => {
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      const request = current.revealRequests.find((item) => item.id === requestId)
      if (!user || !request) return 'Reveal request not found.'
      if (user.role !== 'admin' && user.departmentId !== 'd-affairs') return 'Only operations or Student Affairs can decide a reveal request.'
      if (request.status !== 'pending') return 'This reveal request is already decided.'
      if (request.requestedBy === user.id) return 'You cannot approve or reject your own reveal request.'
      if (remote && supabase) {
        const { error } = await supabase.rpc('decide_reveal_request', { p_request_id: requestId, p_decision: decision })
        if (error) return error.message
        const next = await pullCampus((await supabase.auth.getSession()).data.session)
        setState(next)
        say(decision === 'approved' ? 'Reveal request approved.' : 'Reveal request rejected.', decision === 'approved' ? 'রিভিল অনুরোধ অনুমোদিত।' : 'রিভিল অনুরোধ প্রত্যাখ্যাত।')
        return null
      }
      update((prev) => withAudit({
        ...prev,
        revealRequests: prev.revealRequests.map((item) =>
          item.id === requestId
            ? { ...item, status: decision, approvedBy: user.id, decidedAt: nowIso() }
            : item,
        ),
      }, user.name, decision === 'approved' ? `Approved anonymous reveal (${request.reason})` : `Rejected anonymous reveal (${request.reason})`, request.reportId))
      say(decision === 'approved' ? 'Reveal request approved.' : 'Reveal request rejected.', decision === 'approved' ? 'রিভিল অনুরোধ অনুমোদিত।' : 'রিভিল অনুরোধ প্রত্যাখ্যাত।')
      return null
    },
    revealReporter: async (reportId, reason) => {
      const text = reason.trim()
      if (text.length < 8) return 'Write a short reason for the audit log.'
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      const report = current.reports.find((item) => item.id === reportId)
      if (!user || !report || !report.anonymous) return 'That report is not anonymous.'
      if (user.role !== 'admin' && user.departmentId !== 'd-affairs') return 'Only operations or Student Affairs can reveal a reporter.'
      if (report.category !== 'harassment' && report.category !== 'safety') return 'Reveal is only for harassment or safety emergencies.'
      const approved = current.revealRequests.find((item) => item.reportId === reportId && item.status === 'approved')
      if (!approved) return 'Reveal needs an approved request from a second desk officer.'
      if (remote && supabase) {
        const { data, error } = await supabase.rpc('reveal_reporter', { p_report_id: reportId, p_reason: text })
        if (error) return error.message
        const row = Array.isArray(data) ? data[0] : data
        if (!row || typeof row !== 'object') return 'No identity is stored for this report.'
        const revealed = row as { name?: string; email?: string }
        const next = await pullCampus((await supabase.auth.getSession()).data.session)
        setState(next)
        return { name: String(revealed.name ?? ''), email: String(revealed.email ?? '') }
      }
      const ownerId = ownerProfileId(current, report)
      const owner = ownerId ? current.users.find((item) => item.id === ownerId) : undefined
      if (!owner) return 'No identity is stored for this report.'
      const stamp = nowIso()
      await update((prev) => {
        const stamped = {
          ...prev,
          identityRevealedAt: { ...prev.identityRevealedAt, [reportId]: stamp },
          revealRequests: prev.revealRequests.map((item) =>
            item.reportId === reportId && item.status === 'approved' && !item.openedAt
              ? { ...item, openedAt: stamp }
              : item,
          ),
          notifications: [
            {
              id: uid('n'),
              userId: owner.id,
              title: 'Your anonymous identity was revealed',
              body: `Campus operations revealed your identity on ${reportId} after a two-person approval.`,
              href: `/app/reports/${reportId}`,
              read: false,
              createdAt: stamp,
              kind: 'info' as const,
            },
            ...prev.notifications,
          ],
        }
        return withAudit(stamped, user.name, `Revealed anonymous reporter (${text})`, reportId)
      })
      return { name: owner.name, email: owner.email }
    },
    rate: (reportId, rating, feedback) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      update((current) => ({
        ...current,
        reports: current.reports.map((report) =>
          report.id === reportId && user && isReportOwner(user, report, current.reportIdentities) && (report.status === 'resolved' || report.status === 'closed')
            ? { ...report, rating, feedback: feedback.trim(), updatedAt: nowIso() }
            : report,
        ),
      }))
      say('Thanks. The rating is on the report.', 'ধন্যবাদ। রেটিং রিপোর্টে যোগ হয়েছে।')
    },
    reopen: (reportId, reason) => {
      const text = reason.trim()
      if (text.length < 8) {
        say('Say what is still wrong.', 'কী এখনও ঠিক হয়নি, তা লিখুন।')
        return
      }
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      const report = current.reports.find((item) => item.id === reportId)
      if (!user || !report || !isReportOwner(user, report, current.reportIdentities)) return
      if (report.status !== 'resolved' && report.status !== 'closed') return
      const nextReport: Report = {
        ...report,
        status: 'reopened',
        updatedAt: nowIso(),
        activities: [...report.activities, activity(user.name, 'public', 'system', `Reopened: ${text}`)],
      }
      update((prev) => {
        let next = replaceReport(prev, nextReport)
        const office = next.users.filter((item) => item.role === 'admin' || (report.departmentId && item.departmentId === report.departmentId))
        next = withNotes(next, office, 'Report reopened', `${report.id} was reopened by the reporter.`, `/admin/reports/${report.id}`)
        return withAudit(next, user.name, 'Reopened report', report.id)
      })
      say('Reopen request sent.', 'পুনরায় খোলার অনুরোধ গেছে।')
    },
    confirm: (reportId) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user) return
      const report = stateRef.current.reports.find((item) => item.id === reportId)
      if (!report || isReportOwner(user, report, stateRef.current.reportIdentities) || report.confirmations.includes(user.id)) return
      if (report.confidential || report.anonymous || report.category === 'harassment' || report.category === 'safety') return
      update((current) => ({
        ...current,
        reports: current.reports.map((item) =>
          item.id === reportId ? { ...item, confirmations: [...item.confirmations, user.id], updatedAt: nowIso() } : item,
        ),
      }))
      say('You are counted on this report.', 'আপনাকে এই রিপোর্টের সাথে যোগ করা হয়েছে।')
    },
    markRead: (id) =>
      update((current) => ({
        ...current,
        notifications: current.notifications.map((item) => (item.id === id ? { ...item, read: true } : item)),
      })),
    markAllRead: () => {
      const userId = stateRef.current.sessionUserId
      update((current) => ({
        ...current,
        notifications: current.notifications.map((item) => (item.userId === userId ? { ...item, read: true } : item)),
      }))
    },
    publishAnnouncement: (input) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user || (user.role !== 'admin' && user.role !== 'security')) return
      const item: Announcement = {
        id: uid('an'),
        title: input.title.trim(),
        body: input.body.trim(),
        kind: input.kind,
        locationId: input.locationId || undefined,
        active: true,
        createdAt: nowIso(),
      }
      if (item.title.length < 4 || item.body.length < 8) return
      update((current) => {
        const next = withAudit({ ...current, announcements: [item, ...current.announcements] }, user.name, 'Published a campus alert', item.id)
        return withNotes(next, next.users.filter((account) => account.id !== user.id), item.title, item.body, '/app/alerts')
      })
      say('Alert published.', 'সতর্কতা প্রকাশ হয়েছে।')
    },
    setAnnouncementActive: (id, active) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user || user.role !== 'admin') return
      update((current) => withAudit({
        ...current,
        announcements: current.announcements.map((item) => (item.id === id ? { ...item, active } : item)),
      }, user.name, active ? 'Restored a campus alert' : 'Hid a campus alert', id))
    },
    saveSupportContact: (input) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user || user.role !== 'admin') return
      const nameEn = input.nameEn.trim()
      const nameBn = input.nameBn.trim()
      const phone = input.phone.trim()
      if (nameEn.length < 2 || nameBn.length < 2 || phone.length < 3) return
      const item: SupportContact = {
        id: input.id?.trim() || uid('sc'),
        nameEn,
        nameBn,
        category: input.category,
        phone,
        email: input.email.trim(),
        hours: input.hours.trim(),
        descriptionEn: input.descriptionEn.trim(),
        descriptionBn: input.descriptionBn.trim(),
        isActive: input.isActive,
        sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : 0,
      }
      update((current) => {
        const exists = current.supportContacts.some((row) => row.id === item.id)
        const supportContacts = exists
          ? current.supportContacts.map((row) => (row.id === item.id ? item : row))
          : [...current.supportContacts, item]
        return withAudit(
          {
            ...current,
            supportContacts: [...supportContacts].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
          },
          user.name,
          exists ? 'Updated a help contact' : 'Added a help contact',
          item.id,
        )
      })
      say('Help contact saved.', 'সহায়তা যোগাযোগ সেভ হয়েছে।')
    },
    setSupportContactActive: (id, isActive) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user || user.role !== 'admin') return
      update((current) => withAudit({
        ...current,
        supportContacts: current.supportContacts.map((item) => (item.id === id ? { ...item, isActive } : item)),
      }, user.name, isActive ? 'Restored a help contact' : 'Hid a help contact', id))
    },
    saveAppSetting: (key, value) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user || user.role !== 'admin') return
      const trimmed = value.trim()
      update((current) => withAudit({
        ...current,
        appSettings: { ...(current.appSettings ?? {}), [key]: trimmed },
      }, user.name, 'Updated app setting', key))
      say('Setting saved.', 'সেটিং সেভ হয়েছে।')
    },
    flagReport: async (reportId, kind, reason) => {
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      if (!user || user.role !== 'admin') return 'Only the operations desk can flag a report.'
      const text = reason.trim()
      if (text.length < 3) return 'Add a short reason.'
      const report = current.reports.find((item) => item.id === reportId)
      if (!report) return 'Report not found.'
      if ((current.reportFlags ?? []).some((item) => item.reportId === reportId)) return 'This report is already flagged.'
      const action = report.anonymous
        ? `Flagged anonymous report as ${kind}: ${text}`
        : `Flagged report as ${kind}: ${text}`
      if (remote && supabase) {
        const { error } = await supabase.rpc('flag_report', { p_report_id: reportId, p_kind: kind, p_reason: text })
        if (error) return error.message
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          const next = await pullCampus(data.session)
          next.prefs = stateRef.current.prefs
          stateRef.current = next
          setState(next)
        }
        say('Report flagged.', 'রিপোর্ট ফ্ল্যাগ হয়েছে।')
        return null
      }
      const flag = {
        id: uid('rf'),
        reportId,
        kind,
        reason: text,
        flaggedBy: user.id,
        createdAt: nowIso(),
      }
      update((prev) => withAudit({
        ...prev,
        reportFlags: [flag, ...(prev.reportFlags ?? [])],
      }, user.name, action, reportId))
      say('Report flagged.', 'রিপোর্ট ফ্ল্যাগ হয়েছে।')
      return null
    },
    addLost: (input) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user) return
      if (input.title.trim().length < 3 || input.place.trim().length < 2) return
      const item: LostItem = {
        id: uid('lf'),
        title: input.title.trim(),
        place: input.place.trim(),
        detail: input.detail.trim(),
        kind: input.kind,
        contact: input.contact.trim() || user.name,
        reporterId: user.id,
        status: 'open',
        createdAt: nowIso(),
      }
      update((current) => ({ ...current, lostFound: [item, ...current.lostFound] }))
      say('Posted on lost and found.', 'হারানো ও পাওয়া তালিকায় যোগ হয়েছে।')
    },
    setLostStatus: (id, status) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      update((current) => ({
        ...current,
        lostFound: current.lostFound.map((item) =>
          item.id === id && (item.reporterId === user?.id || user?.role === 'admin') ? { ...item, status } : item,
        ),
      }))
    },
    updateUser: (id, patch) => {
      const actor = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!actor || actor.role !== 'admin' || actor.id === id && patch.suspended) return
      update((current) => withAudit({
        ...current,
        users: current.users.map((user) => (user.id === id ? { ...user, ...patch } : user)),
      }, actor.name, patch.suspended ? 'Suspended an account' : 'Updated an account role', id))
      say('Account updated.', 'অ্যাকাউন্ট আপডেট হয়েছে।')
    },
    updateDepartment: (id, patch) => {
      const actor = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!actor || actor.role !== 'admin') return
      update((current) => withAudit({
        ...current,
        departments: current.departments.map((department) => (department.id === id ? { ...department, ...patch } : department)),
      }, actor.name, 'Updated a department', id))
    },
    updateCategory: (id, patch) => {
      const actor = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!actor || actor.role !== 'admin') return
      update((current) => ({
        ...current,
        categories: current.categories.map((category) => (category.id === id ? { ...category, ...patch } : category)),
      }))
    },
    extendDue: (reportId) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      const report = stateRef.current.reports.find((item) => item.id === reportId)
      if (!user || !report || user.role !== 'admin' || !isOpen(report.status)) return
      const dueAt = addHours(report.dueAt, 24)
      const nextReport: Report = {
        ...report,
        dueAt,
        updatedAt: nowIso(),
        activities: [...report.activities, activity(user.name, 'internal', 'internal', 'Target time extended by 24 hours.')],
      }
      update((prev) => withAudit(replaceReport(prev, nextReport), user.name, 'Extended the target time by 24 hours', report.id))
      say('Target time extended by 24 hours.', 'লক্ষ্য সময় ২৪ ঘণ্টা বাড়ানো হয়েছে।')
    },
    updateProfile: (patch) => {
      const userId = stateRef.current.sessionUserId
      return update((current) => ({
        ...current,
        users: current.users.map((user) => {
          if (user.id !== userId) return user
          return {
            ...user,
            ...patch,
            name: patch.name !== undefined ? (patch.name.trim() || user.name) : user.name,
            unit: patch.unit !== undefined ? patch.unit.trim() : user.unit,
            identifier: patch.identifier !== undefined ? patch.identifier.trim() : user.identifier,
          }
        }),
      }))
    },
    changePassword: async (next) => {
      if (next.trim().length < 8) {
        say('Use at least 8 characters.', 'কমপক্ষে ৮ অক্ষর দিন।')
        return false
      }
      if (!remote || !supabase) {
        say('Choose a password when you create the account. This browser preview does not keep a separate password.', 'অ্যাকাউন্ট খোলার সময় পাসওয়ার্ড দিন। এই ব্রাউজার প্রিভিউ আলাদা পাসওয়ার্ড রাখে না।')
        return false
      }
      const { error } = await supabase.auth.updateUser({ password: next })
      if (error) {
        say(error.message, error.message)
        return false
      }
      say('Password updated.', 'পাসওয়ার্ড আপডেট হয়েছে।')
      return true
    },
    recordExport: () => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user) return
      update((current) => withAudit(current, user.name, 'Exported a report CSV', 'reports.csv'))
    },
    addEmergencyContact: (name, phone) => {
      const userId = stateRef.current.sessionUserId
      if (!userId) return Promise.resolve('rejected')
      const cleanName = name.trim()
      if (cleanName.length < 2) return Promise.resolve('name')
      const normalized = normalizePhone(phone)
      if (!normalized) return Promise.resolve('phone')
      const mine = (stateRef.current.emergencyContacts ?? []).filter((item) => item.userId === userId)
      if (mine.length >= 5) return Promise.resolve('limit')
      if (mine.some((item) => item.phone === normalized)) return Promise.resolve('duplicate')
      const contact = { id: uid('ec'), userId, name: cleanName.slice(0, 80), phone: normalized }
      return update((current) => ({ ...current, emergencyContacts: [...(current.emergencyContacts ?? []), contact] })).then((error) => (error ? 'rejected' : 'ok'))
    },
    removeEmergencyContact: (id) => {
      const userId = stateRef.current.sessionUserId
      return update((current) => ({
        ...current,
        emergencyContacts: (current.emergencyContacts ?? []).filter((item) => !(item.id === id && item.userId === userId)),
      }))
    },
    sendSos: async (place) => {
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      if (!user) return { status: 'rejected', id: null }
      const contacts = (current.emergencyContacts ?? []).filter((item) => item.userId === user.id)
      const latest = (current.sosAlerts ?? [])
        .filter((item) => item.userId === user.id)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]
      if (latest && Date.now() - new Date(latest.createdAt).getTime() < 60_000) {
        return { status: 'soon', id: null, detail: 'Wait a minute before sending another SOS' }
      }
      const id = uid('sos')
      const message = sosMessage(user.name, place)
      const createdAt = nowIso()
      const alert = {
        id,
        userId: user.id,
        senderName: user.name,
        lat: place?.lat,
        lng: place?.lng,
        accuracyM: place?.accuracy,
        message,
        contacts: contacts.map((item) => ({ name: item.name, phone: item.phone })),
        smsStatus: 'pending' as const,
        smsDetail: '',
        createdAt,
      }
      // Remote inserts get desk notifications from the DB trigger. Preview mode fans them out here.
      const deskNotes = remote
        ? []
        : current.users
          .filter((item) => (item.role === 'admin' || item.role === 'security') && !item.suspended && item.id !== user.id)
          .map((item) => ({
            id: uid('n'),
            userId: item.id,
            title: 'SOS help request',
            body: message,
            href: '/admin/sos',
            read: false,
            createdAt,
          }))
      const saved = await update((state) => withAudit({
        ...state,
        sosAlerts: [alert, ...(state.sosAlerts ?? [])].slice(0, 100),
        notifications: deskNotes.length ? [...deskNotes, ...state.notifications].slice(0, 200) : state.notifications,
      }, user.name, 'Sent an SOS alert', id))
      if (saved) {
        const detail = saved.trim()
        if (/wait a minute/i.test(detail)) return { status: 'soon', id: null, detail }
        return { status: 'rejected', id: null, detail }
      }
      if (!remote || !supabase) return { status: 'desk', id }
      const { data, error } = await supabase.functions.invoke('send-sos', { body: { alertId: id } })
      const payload = (data ?? null) as { status?: string; detail?: string } | null
      let smsStatus: 'sent' | 'partial' | 'skipped' | 'failed' = 'skipped'
      let smsDetail = error?.message?.slice(0, 180) ?? 'The texting service did not answer.'
      if (!error && payload?.status === 'sent') {
        smsStatus = 'sent'
        smsDetail = ''
      } else if (!error && (payload?.status === 'partial' || payload?.status === 'failed' || payload?.status === 'skipped')) {
        smsStatus = payload.status
        smsDetail = (payload.detail ?? '').slice(0, 180)
      }
      await update((state) => ({
        ...state,
        sosAlerts: (state.sosAlerts ?? []).map((item) => (item.id === id ? { ...item, smsStatus, smsDetail } : item)),
      }))
      if (smsStatus === 'sent') return { status: 'sent', id }
      if (smsStatus === 'failed' || smsStatus === 'partial') return { status: 'sms-failed', id }
      return { status: 'desk', id }
    },
    refineSosLocation,
    startSosLiveShare,
    refreshSosAlerts,
    resolveSos: (id) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user || (user.role !== 'admin' && user.role !== 'security')) return Promise.resolve('rejected')
      const current = (stateRef.current.sosAlerts ?? []).find((item) => item.id === id)
      if (!current || current.resolvedAt) return Promise.resolve(null)
      const solvedAt = nowIso()
      return update((state) => withAudit({
        ...state,
        sosAlerts: (state.sosAlerts ?? []).map((item) => (
          item.id === id
            ? { ...item, seenAt: item.seenAt ?? solvedAt, resolvedAt: solvedAt }
            : item
        )),
      }, user.name, 'Marked an SOS as solved', id))
    },
    markSosSeen: () => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user || (user.role !== 'admin' && user.role !== 'security')) return Promise.resolve(null)
      const open = (stateRef.current.sosAlerts ?? []).filter((item) => !item.resolvedAt && !item.seenAt)
      if (!open.length) return Promise.resolve(null)
      const seenAt = nowIso()
      return update((state) => ({
        ...state,
        sosAlerts: (state.sosAlerts ?? []).map((item) => (
          !item.resolvedAt && !item.seenAt ? { ...item, seenAt } : item
        )),
      }))
    },
    resetDemo: () => {
      if (remote && supabase) {
        void supabase.auth.getSession().then(async ({ data }) => {
          const next = await pullCampus(data.session)
          next.prefs = stateRef.current.prefs
          epoch.current += 1
          stateRef.current = next
          setState(next)
          say('Reloaded from the campus database.', 'ক্যাম্পাস ডেটাবেস থেকে আবার লোড হয়েছে।')
        })
        return
      }
      const fresh = buildSeed()
      setState(fresh)
      say('Preview data restored.', 'প্রিভিউ ডেটা ফিরিয়ে আনা হয়েছে।')
    },
  }

  return (
    <Ctx.Provider value={api}>
      {dbError ? <p className="bg-clay/10 px-4 py-2 text-sm text-clay">{dbError}</p> : null}
      {children}
      <div className="no-print fixed bottom-24 right-4 z-[70] flex w-[min(100%-2rem,22rem)] flex-col gap-2 md:bottom-4">
        {toasts.map((item) => (
          <button key={item.id} onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== item.id))} className="rounded-xl bg-ink px-4 py-3 text-left text-sm text-paper shadow-card">
            {item.text}
          </button>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useApp(): Api {
  const value = useContext(Ctx)
  if (!value) throw new Error('useApp must be used inside StoreProvider')
  return value
}
