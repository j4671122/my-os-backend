/** CORS + OPTIONS 프리플라이트 처리 */
export function withCors(handler) {
  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin',  '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-user-id')

    if (req.method === 'OPTIONS') return res.status(200).end()

    try {
      await handler(req, res)
    } catch (err) {
      console.error('[API Error]', err)
      res.status(500).json({ error: err.message || 'Internal server error' })
    }
  }
}

/** req에서 user_id 추출 — JWT 유저 우선, fallback으로 헤더/기본값 */
export function getUserId(req) {
  // req.user는 auth.js의 requireAuth 또는 getAuthUser 이후 주입됨
  if (req.user?.id) return req.user.id
  return req.headers['x-user-id'] || req.query?.user_id || null
}
