/**
 * api/lib/auth.js
 * JWT 인증 미들웨어
 * Authorization: Bearer <supabase_jwt> 헤더를 검증합니다
 */
import supabase from './supabase.js'

/**
 * 요청에서 Supabase 유저를 추출합니다.
 * 실패 시 null 반환 (에러를 던지지 않음)
 */
export async function getAuthUser(req) {
  const auth = req.headers.authorization
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

/**
 * 인증이 필요한 핸들러를 래핑합니다.
 * 인증 실패 시 401 반환, 성공 시 req.user에 유저 정보 주입
 */
export function requireAuth(handler) {
  return async (req, res) => {
    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized — 로그인이 필요합니다' })
    req.user = user
    return handler(req, res)
  }
}
