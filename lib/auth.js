import supabase from './supabase.js'

export async function getAuthUser(request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return null
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch (e) {
    console.warn('[Auth] getUser error:', e.message)
    return null
  }
}
