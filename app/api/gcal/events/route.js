import supabase from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

export async function GET(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles')
    .select('gcal_tokens').eq('id', user.id).maybeSingle()
  if (!profile?.gcal_tokens) return Response.json({ events: [], connected: false })

  let tokens = profile.gcal_tokens

  // 액세스 토큰 만료 시 갱신
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
      await supabase.from('profiles').update({ gcal_tokens: null }).eq('id', user.id)
      return Response.json({ events: [], connected: false, reauth: true })
    }
    tokens = {
      ...tokens,
      access_token: refreshed.access_token,
      expires_at:   Date.now() + refreshed.expires_in * 1000,
    }
    await supabase.from('profiles').update({ gcal_tokens: tokens }).eq('id', user.id)
  }

  const { searchParams } = new URL(request.url)
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy:      'startTime',
    maxResults:   '250',
  })
  if (searchParams.get('timeMin')) params.set('timeMin', searchParams.get('timeMin'))
  if (searchParams.get('timeMax')) params.set('timeMax', searchParams.get('timeMax'))

  const gcalRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )
  const gcalData = await gcalRes.json()
  if (gcalData.error) {
    console.error('[GCal events] API error:', gcalData.error.message)
    return Response.json({ error: gcalData.error.message }, { status: 500 })
  }

  return Response.json({ events: gcalData.items || [], connected: true })
}
