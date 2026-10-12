import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
const placeholder = !url || !anonKey || url.includes('YOUR_PROJECT_REF') || anonKey.includes('YOUR_ANON_KEY')

export const isRemote = Boolean(url && anonKey && !placeholder)

export const supabase: SupabaseClient | null = isRemote ? createClient(url!, anonKey!) : null

export const DEMO_PASSWORD = 'padma1234'
