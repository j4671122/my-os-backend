/**
 * /api/ai/tag  ─ 1️⃣ 입력 이해 + 2️⃣ 정보 정리
 *
 * POST /api/ai/tag
 * Body: { taskId, title, notes? }
 *
 * 동작:
 *   1. Gemini로 태그 + 우선순위 추론
 *   2. tasks 테이블 업데이트 (ai_tagged = true)
 *   3. events에 ai_tagged 이벤트 기록
 *   4. 결과 반환
 *
 * 설계 원칙: UI에서 비동기로 호출 (할일 저장 후 백그라운드)
 * UX: 태그가 ~1초 후 조용히 붙음
 */
import supabase from '../_lib/supabase.js'
import { callGeminiJSON } from '../_lib/gemini.js'
import { withCors, getUserId } from '../_lib/cors.js'
import { getAuthUser } from '../_lib/auth.js'

export default withCors(async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const uid = getUserId(req)
  const { taskId, title, notes = '' } = req.body

  if (!title) return res.status(400).json({ error: 'title required' })

  // ── Gemini 프롬프트 ─────────────────────────────────────
  const prompt = `
할일 제목: "${title}"
메모: "${notes}"

위 할일을 분석해서 JSON으로 답해라.

규칙:
- tags: 1~3개, 한국어 소문자, 맞는 것만 선택 [공부, 개발, 운동, 독서, 업무, 건강, 재무, 창작, 습관, 소통, 생활]
- priority: "high" (마감 긴박 / 중요) | "med" (일반) | "low" (여유)
- category: 한 단어로 이 할일의 성격 (예: "학습", "건강관리", "프로젝트")
- due_hint: null | "today" | "tomorrow" | "this_week" (제목에서 마감 힌트가 있으면)

JSON 예시:
{"tags":["개발","공부"],"priority":"high","category":"학습","due_hint":"tomorrow"}
`

  const result = await callGeminiJSON(prompt)

  if (!result) return res.status(500).json({ error: 'AI parsing failed' })

  // ── DB 업데이트 ─────────────────────────────────────────
  if (taskId) {
    await supabase.from('tasks')
      .update({ tags: result.tags || [], priority: result.priority || 'med', ai_tagged: true })
      .eq('id', taskId)
      .eq('user_id', uid)

    await supabase.from('events').insert({
      user_id:  uid,
      type:     'ai_tagged',
      task_id:  taskId,
      timestamp: new Date().toISOString(),
      metadata: { tags: result.tags, priority: result.priority, confidence: 'gemini-flash' }
    })
  }

  return res.json(result)
})
