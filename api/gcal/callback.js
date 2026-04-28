/**
 * GET /api/gcal/callback
 * Google OAuth 콜백 — code를 토큰으로 교환 후 Supabase에 저장
 * 이 엔드포인트는 브라우저 리다이렉트(full navigation)로 호출되므로
 * JSON 응답이 아닌 redirect로 처리
 */
import supabase from '../_lib/supabase.js'

export default async function handler(req, res) {
  const appUrl = process.env.APP_URL || 'https://my-os-backend.vercel.app'
  const { code, state, error: oauthError } = req.query

  if (oauthError) {
    return res.redirect(`${appUrl}/?gcal_error=${encodeURIComponent(oauthError)}`)
  }
  if (!code || !state) {
    return res.redirect(`${appUrl}/?gcal_error=missing_params`)
  }

  // state 디코딩 → JWT 복원
  let jwt
  try {
    jwt = Buffer.from(state, 'base64url').toString('utf8')
  } catch {
    return res.redirect(`${appUrl}/?gcal_error=invalid_state`)
  }

  // JWT로 Supabase 사용자 확인 (만료/위조 방어)
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !user) {
    return res.redirect(`${appUrl}/?gcal_error=auth_expired`)
  }

  // Authorization code → access_token + refresh_token 교환
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  })
  const tokenData = await tokenRes.json()

  if (tokenData.error) {
    console.error('[GCal callback] token exchange error:', tokenData.error)
    return res.redirect(`${appUrl}/?gcal_error=${encodeURIComponent(tokenData.error)}`)
  }

  const gcalTokens = {
    access_token:  tokenData.access_token,
    refresh_token: tokenData.refresh_token,  // 첫 연결 시에만 발급
    expires_at:    Date.now() + tokenData.expires_in * 1000,
    scope:         tokenData.scope,
  }

  const { error: saveError } = await supabase
    .from('profiles')
    .update({ gcal_tokens: gcalTokens })
    .eq('id', user.id)

  if (saveError) {
    console.error('[GCal callback] save error:', saveError.message)
    return res.redirect(`${appUrl}/?gcal_error=save_failed`)
  }

  return res.redirect(`${appUrl}/?gcal_connected=true`)
}
