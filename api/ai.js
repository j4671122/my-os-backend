/**
 * /api/ai?action=badges|report|suggest|tag
 * ai/* 4개 엔드포인트 통합 (Vercel Hobby 12함수 제한 대응)
 */
import supabase from './_lib/supabase.js'
import { callGemini, callGeminiJSON } from './_lib/gemini.js'
import { withCors, getUserId } from './_lib/cors.js'
import { getAuthUser } from './_lib/auth.js'

// ── badges ────────────────────────────────────────────────
const PERSONALITY_HINTS = {
  default: '친절하고 균형잡힌 톤으로',
  roast:   '독하게 비꼬지만 결국 응원하는 톤으로. 약간 독설스럽게',
  sage:    '고사성어나 사자성어 스타일로, 격조있고 함축적으로',
  hype:    '극한의 에너지와 열정으로, 과장되게 칭찬하는 톤으로',
  comedian:'아재개그와 말장난을 곁들인 유머러스한 톤으로',
  drill:   '군대식 훈련 교관처럼, 짧고 강렬하게'
}

async function handleBadges(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { stats = {}, personality = 'default' } = req.body || {}
  const hint = PERSONALITY_HINTS[personality] || PERSONALITY_HINTS.default
  const { totalCompleted=0,daysSinceJoin=0,activeDays30=0,activeDays7=0,peakHour=null,topTags=[],highPriDone=0,totalTags=0,streak=0,delayAvg=0,weeklyCompletions=[] } = stats
  let timeDesc = '시간대 불명'
  if (peakHour !== null) {
    if (peakHour < 5) timeDesc=`새벽 ${peakHour}시 활동`
    else if (peakHour < 8) timeDesc=`이른 아침 ${peakHour}시 활동`
    else if (peakHour < 12) timeDesc=`오전 ${peakHour}시 활동`
    else if (peakHour < 18) timeDesc=`오후 ${peakHour}시 활동`
    else if (peakHour < 22) timeDesc=`저녁 ${peakHour}시 활동`
    else timeDesc=`밤 ${peakHour}시 활동`
  }
  const prompt = `당신은 개인 생산성 앱의 AI입니다.\n아래 사용자의 행동 데이터를 분석해서 창의적이고 재미있는 칭호(배지)를 2~4개 생성해주세요.\n\n[사용자 데이터]\n- 가입 후 경과: ${Math.round(daysSinceJoin)}일\n- 전체 완료 할일: ${totalCompleted}개\n- 최근 30일 활동일: ${activeDays30}일\n- 최근 7일 활동일: ${activeDays7}일\n- 주요 활동 시간대: ${timeDesc}\n- 연속 활동 일수: ${streak}일\n- 주요 태그(분야): ${topTags.length?topTags.join(', '):'없음'}\n- 총 사용 태그 수: ${totalTags}개\n- 중요도 높은 완료: ${highPriDone}개\n- 평균 미루기 일수: ${delayAvg}일\n- 최근 7일 일별 완료: ${weeklyCompletions.join(', ')}개\n\n[생성 규칙]\n- 칭호는 ${hint} 작성\n- 각 칭호는 이모지 1개 + 짧은 한국어 라벨(6자 이내) 조합\n- description은 15자 이내의 위트있는 한 줄 설명\n- 데이터에 없는 허위 내용 넣지 말 것\n- 가입 7일 미만이면 반드시 하나는 "🐥 병아리"\n- 칭호들이 서로 겹치지 않도록 다양하게\n- 너무 뻔한 칭호(예: "열심히 하는 사람") 금지\n\n반드시 아래 JSON 형식으로만 출력:\n{"badges":[{"icon":"🔥","label":"불꽃 수행자","desc":"30일 개근 인정"}]}`
  try {
    const result = await callGeminiJSON(prompt, { mode: 'coach', temperature: 0.7 })
    if (!result?.badges?.length) return res.json({ badges: [{ icon:'🌱', label:'성장 중', desc:'꾸준히 가는 중' }] })
    const clean = result.badges.slice(0,4).map(b=>({ icon:String(b.icon||'🏷').slice(0,4), label:String(b.label||'칭호').slice(0,10), desc:String(b.desc||'').slice(0,30) }))
    return res.json({ badges: clean })
  } catch(e) { return res.status(500).json({ error: e.message }) }
}

// ── report ────────────────────────────────────────────────
async function handleReport(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const uid = getUserId(req)
  const { days = 7 } = req.body || {}
  const since = new Date(); since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString()
  const [{ data: tasks }, { data: events }] = await Promise.all([
    supabase.from('tasks').select('id,title,done,priority,tags,due_date,created_at,completed_at,delay_days,attempt_count').eq('user_id', uid).gte('created_at', sinceStr),
    supabase.from('events').select('type,hour,day_of_week,metadata,timestamp').eq('user_id', uid).gte('timestamp', sinceStr)
  ])
  if (!tasks?.length) return res.json({ summary: '이번 주 데이터가 없어요.', stats: {} })
  const total = tasks.length
  const completed = tasks.filter(t=>t.done)
  const rate = total ? Math.round(completed.length/total*100) : 0
  const overdue = tasks.filter(t=>!t.done&&t.due_date&&t.due_date<new Date().toISOString().slice(0,10))
  const delayed = tasks.filter(t=>(t.delay_days||0)>0)
  const tagStats = {}
  tasks.forEach(t=>(t.tags||[]).forEach(tag=>{ if(!tagStats[tag])tagStats[tag]={total:0,done:0}; tagStats[tag].total++; if(t.done)tagStats[tag].done++ }))
  const tagRates = Object.entries(tagStats).map(([tag,s])=>({ tag, rate:Math.round(s.done/s.total*100), total:s.total })).sort((a,b)=>b.rate-a.rate)
  const hourMap = Array(24).fill(0)
  ;(events||[]).filter(e=>e.type==='completed').forEach(e=>{ if(e.hour!=null)hourMap[e.hour]++ })
  const peakHour = hourMap.indexOf(Math.max(...hourMap))
  const dayNames=['일','월','화','수','목','금','토']
  const dayMap = Array(7).fill(0)
  ;(events||[]).filter(e=>e.type==='completed').forEach(e=>{ if(e.day_of_week!=null)dayMap[e.day_of_week]++ })
  const peakDay = dayNames[dayMap.indexOf(Math.max(...dayMap))]
  const stats = { total, completed:completed.length, rate, overdue:overdue.length, delayed:delayed.length, peakHour, peakDay, tagRates:tagRates.slice(0,5) }
  const prompt = `당신은 생산성 코치입니다. 다음 ${days}일 데이터를 분석해서 한국어로 짧고 명확하게 리포트를 작성하세요.\n\n📊 통계:\n- 전체 할일: ${total}개\n- 완료: ${completed.length}개 (${rate}%)\n- 기한 초과: ${overdue.length}개\n- 미룬 횟수 있는 할일: ${delayed.length}개\n- 집중 시간대: ${peakHour}시\n- 가장 생산적인 요일: ${peakDay}요일\n- 태그별 완료율: ${tagRates.map(t=>`#${t.tag} ${t.rate}%`).join(', ')}\n\n형식:\n1. 한 줄 요약\n2. 잘한 점 1가지\n3. 개선할 점 1가지\n4. 다음 주 핵심 행동 1가지\n\n각 항목은 1~2문장.`
  const insight = await callGemini(prompt, { mode: 'analysis', temperature: 0.3, maxTokens: 600 })
  return res.json({ stats, insight, generatedAt: new Date().toISOString() })
}

// ── suggest ───────────────────────────────────────────────
async function handleSuggest(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  const uid = getUserId(req)
  const today = new Date().toISOString().slice(0,10)
  const hour = new Date().getHours()
  const [{ data: todayTasks }, { data: recentEvents }] = await Promise.all([
    supabase.from('tasks').select('id,title,done,priority,tags,due_date,delay_days,attempt_count').eq('user_id',uid).eq('done',false),
    supabase.from('events').select('type,hour,metadata,timestamp').eq('user_id',uid).gte('timestamp',new Date(Date.now()-7*86400000).toISOString()).order('timestamp',{ascending:false}).limit(100)
  ])
  const overdue = (todayTasks||[]).filter(t=>t.due_date&&t.due_date<today)
  const dueToday = (todayTasks||[]).filter(t=>t.due_date===today)
  const highPri = (todayTasks||[]).filter(t=>t.priority==='high')
  const hourMap = Array(24).fill(0)
  ;(recentEvents||[]).filter(e=>e.type==='completed').forEach(e=>{ if(e.hour!=null)hourMap[e.hour]++ })
  const isPeakHour = hourMap[hour]>=2
  if (!(todayTasks?.length)) return res.json({ message:'오늘 할일을 모두 완료했어요! 🎉', type:'success' })
  const context = { hour, isPeakHour, overdueCount:overdue.length, todayCount:dueToday.length, highPriCount:highPri.length, totalPending:todayTasks?.length||0, overdueTitle:overdue[0]?.title||null, highPriTitle:highPri[0]?.title||null }
  const prompt = `당신은 생산성 코치입니다.\n현재: ${hour}시, 집중시간: ${isPeakHour?'예':'아니오'}, 기한초과: ${context.overdueCount}개${context.overdueTitle?` ("${context.overdueTitle}")`:''},오늘마감: ${context.todayCount}개, 중요: ${context.highPriCount}개${context.highPriTitle?` ("${context.highPriTitle}")`:''}.\n\nmessage(20자이내 행동으로끝),type(urgent|focus|encourage|habit),action(5단어이내)만 JSON으로 출력.`
  const result = await callGeminiJSON(prompt, { mode:'coach', temperature:0.5 })
  if (!result) {
    if (context.overdueCount>0) return res.json({ message:`기한 초과 ${context.overdueCount}개, 지금 하나만 해결하세요`, type:'urgent', action:'기한 초과 확인' })
    if (isPeakHour) return res.json({ message:'지금이 집중 시간입니다. 중요한 것부터', type:'focus', action:'중요 할일 시작' })
    return res.json({ message:`남은 할일 ${context.totalPending}개. 작은 것 하나부터`, type:'encourage', action:'할일 목록 확인' })
  }
  return res.json(result)
}

// ── tag ───────────────────────────────────────────────────
async function handleTag(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const uid = getUserId(req)
  const { taskId, title, notes='' } = req.body
  if (!title) return res.status(400).json({ error: 'title required' })
  const prompt = `할일 제목: "${title}"\n메모: "${notes}"\n\n위 할일을 분석해서 JSON으로 답해라.\n규칙:\n- tags: 1~3개, 한국어 소문자 [공부,개발,운동,독서,업무,건강,재무,창작,습관,소통,생활]\n- priority: "high"|"med"|"low"\n- category: 한 단어\n- due_hint: null|"today"|"tomorrow"|"this_week"\n\nJSON만 출력: {"tags":[],"priority":"med","category":"","due_hint":null}`
  const result = await callGeminiJSON(prompt, { mode:'alarm', temperature:0.1 })
  if (!result) return res.status(500).json({ error: 'AI parsing failed' })
  if (taskId) {
    await supabase.from('tasks').update({ tags:result.tags||[], priority:result.priority||'med', ai_tagged:true }).eq('id',taskId).eq('user_id',uid)
    await supabase.from('events').insert({ user_id:uid, type:'ai_tagged', task_id:taskId, timestamp:new Date().toISOString(), metadata:{ tags:result.tags, priority:result.priority, confidence:'gemini-flash' } })
  }
  return res.json(result)
}

// ── agent ─────────────────────────────────────────────────
async function handleAgent(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { message, fileContent, fileType, isImage, context = {}, history = [] } = req.body || {}
  if (!message && !fileContent) return res.status(400).json({ error: 'message or file required' })

  const today = new Date().toISOString().slice(0, 10)

  const systemPrompt = `당신은 개인 생산성 OS의 AI 에이전트입니다.
사용자의 자연어 요청을 분석해서 할일/루틴/습관/목표/이벤트/메모/설정을 관리해주세요.

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 없이 순수 JSON):
{"reply":"...","actions":[{"type":"...","label":"...","data":{...}}]}

사용 가능한 action 타입과 data 형식:
- add_task: {title, dueDate:"YYYY-MM-DD"|"", priority:"high"|"med"|"low", tags:[], notes:"", subtasks:[{text:""}]}
- update_task: {id:"task-id-if-known", titleMatch:"제목 일부(id 없을 때)", newTitle:"", done:bool, dueDate:"", priority:"", tags:[], notes:""}
- delete_task: {id:"task-id-if-known", titleMatch:"제목 일부(id 없을 때)"}
- add_habit: {name:""}
- add_routine: {period:"morning"|"afternoon"|"evening", name:"", time:"HH:MM", days:[0-6, 0=일요일]}
- add_goal: {name:"", type:"global"|"project", desc:"", targetDate:"YYYY-MM-DD"|"", color:"#16a34a"}
- add_event: {title:"", date:"YYYY-MM-DD", time:"HH:MM"|""}
- update_settings: {key:"", value:any, description:""}
- add_memo: {content:""}
- show_tasks: {tasks:[{id:"", title:"", reason:"짧은 이유"}]} — 추천/하이라이트용, 데이터 변경 없음

규칙:
- reply는 친절한 한국어, 어떤 작업을 할지 1~2줄로 설명
- actions가 없으면 빈 배열 []
- 파일이 첨부된 경우 내용을 분석해서 할일로 정리
- "오늘 할거 추천해줘", "뭐부터 해?" 같은 추천 요청 → show_tasks로 구체적 할일 3~5개 선정해서 이유와 함께 표시
- "어디다 추가하면 좋을까?" 같은 조언 요청 → reply에 구체적 설명 + 적절한 action도 함께 제안
- 오늘 날짜: ${today}`

  const ctx = context
  const todoList = (ctx.tasks?.todo || [])
  const todoStr = todoList.length
    ? todoList.map(t => `  - [${t.id?.slice(0,8)||'?'}] "${t.title}"${t.dueDate?' 마감:'+t.dueDate:''} 우선순위:${t.priority||'med'}${t.tags?.length?' 태그:'+t.tags.join(','):''}`).join('\n')
    : '  없음'
  const contextStr = `오늘: ${today}
현재 화면: ${ctx.currentView||'today'}
미완료 할일 (${todoList.length}개):
${todoStr}
완료된 할일(최근): ${(ctx.tasks?.recentDone||[]).join(', ')||'없음'}
습관: ${(ctx.habits||[]).join(', ')||'없음'}
루틴: ${(ctx.routines||[]).map(r=>`${r.name}(${r.period} ${r.time||''})`).join(', ')||'없음'}
목표: ${(ctx.goals||[]).map(g=>g.name).join(', ')||'없음'}
메모: ${ctx.memoPreview||'없음'}`

  const historyStr = history.slice(-6).map(h=>`${h.role==='user'?'사용자':'AI'}: ${h.content}`).join('\n')

  let userPrompt = `[현재 앱 데이터]\n${contextStr}\n`
  if (historyStr) userPrompt += `\n[이전 대화]\n${historyStr}\n`
  if (fileContent && !isImage) userPrompt += `\n[첨부 파일 내용]\n${String(fileContent).slice(0, 4000)}\n`
  userPrompt += `\n[사용자 요청]\n${message || '첨부 파일을 분석해서 할일을 정리해줘'}`

  try {
    let result
    if (isImage && fileContent) {
      // 이미지: Gemini multimodal parts
      const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
      const body = {
        contents: [{ parts: [
          { inlineData: { mimeType: fileType, data: fileContent } },
          { text: systemPrompt + '\n\n' + userPrompt }
        ]}],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } }
      }
      const r = await fetch(`${BASE}?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      const raw = await r.json()
      const text = raw.candidates?.[0]?.content?.parts?.find(p=>p.text)?.text?.trim() || ''
      try { result = JSON.parse(text.replace(/^```json\s*/i,'').replace(/```\s*$/,'').trim()) }
      catch { const m=text.match(/\{[\s\S]*\}/); result=m?JSON.parse(m[0]):null }
    } else {
      const raw = await callGemini(systemPrompt + '\n\n' + userPrompt + '\n\n반드시 JSON만 출력. 마크다운 없이.', { temperature: 0.3, maxTokens: 1024, useSystem: false })
      try {
        const clean = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/,'').trim()
        result = JSON.parse(clean)
      } catch {
        const m = raw.match(/\{[\s\S]*\}/)
        if (m) { try { result = JSON.parse(m[0]) } catch {} }
        // Gemini answered conversationally — wrap raw text as reply
        if (!result && raw) result = { reply: raw, actions: [] }
      }
    }

    if (!result) return res.json({ reply: '죄송해요, 처리 중 문제가 생겼어요. 다시 시도해주세요.', actions: [] })
    return res.json({
      reply: String(result.reply || ''),
      actions: Array.isArray(result.actions) ? result.actions.slice(0, 20) : []
    })
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}

// ── router ────────────────────────────────────────────────
export default withCors(async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user

  const action = req.query.action
  if (action === 'badges')  return handleBadges(req, res)
  if (action === 'report')  return handleReport(req, res)
  if (action === 'suggest') return handleSuggest(req, res)
  if (action === 'tag')     return handleTag(req, res)
  if (action === 'agent')   return handleAgent(req, res)
  return res.status(400).json({ error: 'action required: badges|report|suggest|tag|agent' })
})
