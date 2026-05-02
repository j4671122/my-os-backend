import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'

export async function GET(request) {
  const appUrl = process.env.APP_URL || 'https://my-os-backend.vercel.app'
  const { searchParams } = new URL(request.url)
  const code       = searchParams.get('code')
  const state      = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError)
    return NextResponse.redirect(`${appUrl}/?gcal_error=${encodeURIComponent(oauthError)}`)
  if (!code || !state)
    return NextResponse.redirect(`${appUrl}/?gcal_error=missing_params`)

  let jwt
  try { jwt = Buffer.from(state, 'base64url').toString('utf8') } catch {
    return NextResponse.redirect(`${appUrl}/?gcal_error=invalid_state`)
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !user)
    return NextResponse.redirect(`${appUrl}/?gcal_error=auth_expired`)

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
    return NextResponse.redirect(`${appUrl}/?gcal_error=${encodeURIComponent(tokenData.error)}`)
  }

  const gcalTokens = {
    access_token:  tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at:    Date.now() + tokenData.expires_in * 1000,
    scope:         tokenData.scope,
  }

  const { error: saveError } = await supabase.from('profiles')
    .update({ gcal_tokens: gcalTokens }).eq('id', user.id)
  if (saveError) {
    console.error('[GCal callback] save error:', saveError.message)
    return NextResponse.redirect(`${appUrl}/?gcal_error=save_failed`)
  }

  return NextResponse.redirect(`${appUrl}/?gcal_connected=true`)
}
