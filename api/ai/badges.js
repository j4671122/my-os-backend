/**
 * /api/ai/badges
 *
 * POST /api/ai/badges
 * body: { stats, personality }
 * → AI가 사용자 행동 기반으로 창의적 칭호 2~4개 생성
 */
import { withCors, getUserId } from '../_lib/cors.js'
import { getAuthUser } from '../_lib/auth.js'
import { callGeminiJSON } from '../_lib/gemini.js'

const PERSONALITY_HINTS = {
  default: '친절하고 균형잡힌 톤으로',
  roast:   '독하게 비꼬지만 결국 응원하는 톤으로. 약간 독설스럽게',
  sage:    '고사성어나 사자성어 스타일로, 격조있고 함축적으로',
  hype:    '극한의 에너지와 열정으로, 과장되게 칭찬하는 톤으로',
  comedian:'아재개그와 말장난을 곁들인 유머러스한 톤으로',
  drill:   '군대식 훈련 교관처럼, 짧고 강렬하게'
}

export default withCors(async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { stats = {}, personality = 'default' } = req.body || {}
  const hint = PERSONALITY_HINTS[personality] || PERSONALITY_HINTS.default

  const {
    totalCompleted = 0,
    daysSinceJoin  = 0,
    activeDays30   = 0,
    activeDays7    = 0,
    peakHour       = null,
    topTags        = [],
    highPriDone    = 0,
    totalTags      = 0,
    streak         = 0,
    delayAvg       = 0,
    weeklyCompletions = []
  } = stats

  // 시간대 설명
  let timeDesc = '시간대 불명'
  if (peakHour !== null) {
    if (peakHour >= 0  && peakHour < 5)  timeDesc = `새벽 ${peakHour}시 활동`
    else if (peakHour >= 5  && peakHour < 8)  timeDesc = `이른 아침 ${peakHour}시 활동`
    else if (peakHour >= 8  && peakHour < 12) timeDesc = `오전 ${peakHour}시 활동`
    else if (peakHour >= 12 && peakHour < 18) timeDesc = `오후 ${peakHour}시 활동`
    else if (peakHour >= 18 && peakHour < 22) timeDesc = `저녁 ${peakHour}시 활동`
    else timeDesc = `밤 ${peakHour}시 활동`
  }

  const prompt = `
당신은 개인 생산성 앱의 AI입니다.
아래 사용자의 행동 데이터를 분석해서 창의적이고 재미있는 칭호(배지)를 2~4개 생성해주세요.

[사용자 데이터]
- 가입 후 경과: ${Math.round(daysSinceJoin)}일
- 전체 완료 할일: ${totalCompleted}개
- 최근 30일 활동일: ${activeDays30}일
- 최근 7일 활동일: ${activeDays7}일
- 주요 활동 시간대: ${timeDesc}
- 연속 활동 일수: ${streak}일
- 주요 태그(분야): ${topTags.length ? topTags.join(', ') : '없음'}
- 총 사용 태그 수: ${totalTags}개
- 중요도 높은 완료: ${highPriDone}개
- 평균 미루기 일수: ${delayAvg}일
- 최근 7일 일별 완료: ${weeklyCompletions.join(', ')}개

[생성 규칙]
- 칭호는 ${hint} 작성
- 각 칭호는 이모지 1개 + 짧은 한국어 라벨(6자 이내) 조합
- description은 15자 이내의 위트있는 한 줄 설명
- 데이터에 없는 허위 내용 넣지 말 것
- 가입 7일 미만이면 반드시 하나는 "🐥 병아리"
- 칭호들이 서로 겹치지 않도록 다양하게
- 너무 뻔한 칭호(예: "열심히 하는 사람") 금지

반드시 아래 JSON 형식으로만 출력:
{
  "badges": [
    { "icon": "🔥", "label": "불꽃 수행자", "desc": "30일 개근 인정" },
    { "icon": "🦉", "label": "올빼미족", "desc": "밤에만 살아있는" }
  ]
}
`

  try {
    const result = await callGeminiJSON(prompt)
    if (!result?.badges?.length) {
      // fallback
      return res.json({ badges: [{ icon: '🌱', label: '성장 중', desc: '꾸준히 가는 중' }] })
    }
    // 최대 4개, 필드 검증
    const clean = result.badges.slice(0, 4).map(b => ({
      icon:  String(b.icon  || '🏷').slice(0, 4),
      label: String(b.label || '칭호').slice(0, 10),
      desc:  String(b.desc  || '').slice(0, 30)
    }))
    return res.json({ badges: clean })
  } catch (e) {
    console.error('[badges]', e.message)
    return res.status(500).json({ error: e.message })
  }
})
