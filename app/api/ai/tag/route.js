import supabase from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { callGeminiJSON } from '@/lib/gemini'

export async function POST(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId, title, notes = '' } = await request.json()
  if (!title) return Response.json({ error: 'title required' }, { status: 400 })

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

  const result = await callGeminiJSON(prompt, { mode: 'alarm', temperature: 0.1 })
  if (!result) return Response.json({ error: 'AI parsing failed' }, { status: 500 })

  if (taskId) {
    await supabase.from('tasks')
      .update({ tags: result.tags || [], priority: result.priority || 'med', ai_tagged: true })
      .eq('id', taskId).eq('user_id', user.id)

    await supabase.from('events').insert({
      user_id:   user.id,
      type:      'ai_tagged',
      task_id:   taskId,
      timestamp: new Date().toISOString(),
      metadata:  { tags: result.tags, priority: result.priority, confidence: 'gemini-flash' },
    })
  }

  return Response.json(result)
}
