import { NextResponse } from 'next/server'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-user-id',
}

export function middleware(request) {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: CORS })
  }
  const response = NextResponse.next()
  Object.entries(CORS).forEach(([k, v]) => response.headers.set(k, v))
  return response
}

export const config = { matcher: '/api/:path*' }
