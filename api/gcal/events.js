/**
 * GET /api/gcal/events?timeMin=...&timeMax=...
 * Google Calendar primary 캘린더 이벤트 조회
 * access_token 만료 시 자동 갱신
 */
import supabase from '../_lib/supabase.js'
import { withCors } from '../_lib/cors.js'
import { getAuthUser } from '../_lib/auth.js'

async function refreshAccessToken(tokens) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokens.refresh_token,
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  })
  return res.json()
}

export default withCors(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: profile } = await supabase
    .from('profiles')
    .select('gcal_tokens')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.gcal_tokens) return res.json({ events: [], connected: false })

  let tokens = profile.gcal_tokens

  // access_token 만료 60초 전 자동 갱신
  if (Date.now() >= tokens.expires_at - 60_000) {
    const refreshed = await refreshAccessToken(tokens)
    if (refreshed.error) {
      // refresh_token도 만료 → 재연결 필요, DB에서 제거
      await supabase.from('profiles').update({ gcal_tokens: null }).eq('id', user.id)
      return res.json({ events: [], connected: false, reauth: true })
    }
    tokens = {
      ...tokens,
      access_token: refreshed.access_token,
      expires_at:   Date.now() + refreshed.expires_in * 1000,
    }
    await supabase.from('profiles').update({ gcal_tokens: tokens }).eq('id', user.id)
  }

  const { timeMin, timeMax } = req.query
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy:      'startTime',
    maxResults:   '250',
  })
  if (timeMin) params.set('timeMin', timeMin)
  if (timeMax) params.set('timeMax', timeMax)

  const gcalRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )
  const gcalData = await gcalRes.json()

  if (gcalData.error) {
    console.error('[GCal events] API error:', gcalData.error.message)
    return res.status(500).json({ error: gcalData.error.message })
  }

  return res.json({ events: gcalData.items || [], connected: true })
})
