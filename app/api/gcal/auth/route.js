import { getAuthUser } from '@/lib/auth'

export async function POST(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId    = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !redirectUri)
    return Response.json({ error: 'Google OAuth 환경변수 미설정 (GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI)' }, { status: 500 })

  const jwt   = request.headers.get('authorization')?.replace('Bearer ', '') || ''
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

  return Response.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
}
