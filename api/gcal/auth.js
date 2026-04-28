/**
 * POST /api/gcal/auth
 * Google OAuth URL 생성 후 반환
 * 프론트에서 window.location.href = url 로 리다이렉트
 */
import { getAuthUser } from '../_lib/auth.js'
import { withCors } from '../_lib/cors.js'

export default withCors(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'Google OAuth 환경변수 미설정 (GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI)' })
  }

  // state에 Supabase JWT 인코딩 → 콜백에서 사용자 확인용
  const jwt = (req.headers.authorization || '').replace('Bearer ', '')
  const state = Buffer.from(jwt).toString('base64url')

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/calendar.readonly',
    access_type:   'offline',
    prompt:        'consent',  // 항상 refresh_token 발급받기 위해 consent 강제
    state,
  })

  return res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
})
