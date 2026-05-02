import { createClient } from '@supabase/supabase-js'

let _client = null

const DUMMY_CLIENT = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithOAuth: async () => ({ error: { message: '환경변수 미설정' } }),
    signInWithPassword: async () => ({ error: { message: '환경변수 미설정' } }),
    signUp: async () => ({ error: { message: '환경변수 미설정' } }),
    signOut: async () => {},
  },
}

export function getSupabaseBrowser() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      console.error('[Supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 없습니다.')
      return DUMMY_CLIENT
    }
    _client = createClient(url, key)
  }
  return _client
}
