import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// 환경변수 존재 여부 체크
export const isSupabaseConfigured = 
  supabaseUrl !== '' && 
  supabaseAnonKey !== '' && 
  !supabaseUrl.includes('placeholder') &&
  !supabaseAnonKey.includes('placeholder');

// createClient 시 에러가 나지 않도록 유효한 URL 형태의 플레이스홀더 설정
const finalUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co'
const finalKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key'

export const supabase = createClient(finalUrl, finalKey)
