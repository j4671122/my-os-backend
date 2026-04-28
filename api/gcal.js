/**
 * /api/gcal?action=auth|callback|disconnect|events
 * gcal/* 4개 엔드포인트 통합 (Vercel Hobby 12함수 제한 대응)
 */
import supabase from './_lib/supabase.js'
import { withCors } from './_lib/cors.js'
import { getAuthUser } from './_lib/auth.js'

// ── auth ──────────────────────────────────────────────────
async function handleAuth(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'Google OAuth 환경변수 미설정 (GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI)' })
  }
  const jwt = (req.headers.authorization || '').replace('Bearer ', '')
  const state = Buffer.from(jwt).toString('base64url')
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/calendar.readonly',
    access_type:   'offline',
    prompt:        'consent',
    state,
  })
  return res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
}

// ── callback ──────────────────────────────────────────────
async function handleCallback(req, res) {
  const appUrl = process.env.APP_URL || 'https://my-os-backend.vercel.app'
  const { code, state, error: oauthError } = req.query
  if (oauthError) return res.redirect(`${appUrl}/?gcal_error=${encodeURIComponent(oauthError)}`)
  if (!code || !state) return res.redirect(`${appUrl}/?gcal_error=missing_params`)
  let jwt
  try { jwt = Buffer.from(state, 'base64url').toString('utf8') } catch {
    return res.redirect(`${appUrl}/?gcal_error=invalid_state`)
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !user) return res.redirect(`${appUrl}/?gcal_error=auth_expired`)
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
    refresh_token: tokenData.refresh_token,
    expires_at:    Date.now() + tokenData.expires_in * 1000,
    scope:         tokenData.scope,
  }
  const { error: saveError } = await supabase.from('profiles').update({ gcal_tokens: gcalTokens }).eq('id', user.id)
  if (saveError) {
    console.error('[GCal callback] save error:', saveError.message)
    return res.redirect(`${appUrl}/?gcal_error=save_failed`)
  }
  return res.redirect(`${appUrl}/?gcal_connected=true`)
}

// ── disconnect ────────────────────────────────────────────
async function handleDisconnect(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })
  const { error } = await supabase.from('profiles').update({ gcal_tokens: null }).eq('id', req.user.id)
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true })
}

// ── events ────────────────────────────────────────────────
async function handleEvents(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { data: profile } = await supabase.from('profiles').select('gcal_tokens').eq('id', req.user.id).maybeSingle()
  if (!profile?.gcal_tokens) return res.json({ events: [], connected: false })
  let tokens = profile.gcal_tokens
  if (Date.now() >= tokens.expires_at - 60_000) {
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: tokens.refresh_token,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type:    'refresh_token',
      }),
    })
    const refreshed = await refreshRes.json()
    if (refreshed.error) {
      await supabase.from('profiles').update({ gcal_tokens: null }).eq('id', req.user.id)
      return res.json({ events: [], connected: false, reauth: true })
    }
    tokens = { ...tokens, access_token: refreshed.access_token, expires_at: Date.now() + refreshed.expires_in * 1000 }
    await supabase.from('profiles').update({ gcal_tokens: tokens }).eq('id', req.user.id)
  }
  const { timeMin, timeMax } = req.query
  const params = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '250' })
  if (timeMin) params.set('timeMin', timeMin)
  if (timeMax) params.set('timeMax', timeMax)
  const gcalRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } })
  const gcalData = await gcalRes.json()
  if (gcalData.error) {
    console.error('[GCal events] API error:', gcalData.error.message)
    return res.status(500).json({ error: gcalData.error.message })
  }
  return res.json({ events: gcalData.items || [], connected: true })
}

// ── router ────────────────────────────────────────────────
export default withCors(async (req, res) => {
  const action = req.query.action
  // callback은 브라우저 리다이렉트로 호출 → auth 불필요
  if (action === 'callback') return handleCallback(req, res)

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user

  if (action === 'auth')       return handleAuth(req, res)
  if (action === 'disconnect') return handleDisconnect(req, res)
  if (action === 'events')     return handleEvents(req, res)
  return res.status(400).json({ error: 'action required: auth|callback|disconnect|events' })
})
