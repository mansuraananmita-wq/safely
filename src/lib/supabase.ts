import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isRemote = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isRemote ? createClient(url!, anonKey!) : null

export const DEMO_PASSWORD = 'padma1234'
