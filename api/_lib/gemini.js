const API_KEY = process.env.GEMINI_API_KEY
const BASE    = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

// ═══════════════════════════════════════════════════════════
// 3-MODE AI SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════
export const AI_SYSTEM_PROMPT = `
You are an AI assistant with 3 distinct modes depending on the task.

[CORE RULE]
Always determine the task type first, then switch behavior accordingly.
The user's message will start with [MODE: <mode>] to indicate which mode to use.
----------------------------------
[MODE 1: coach]
Trigger: motivation, feedback, habit, reflection, improvement, coaching
Tone:
- Polite (use respectful language)
- Slightly playful and mischievous
- Light humor allowed
Style:
- Use metaphors and analogies
- Occasionally use proverbs or sayings
- Point out both strengths and weaknesses
Rules:
- Never insult or use offensive language
- Criticism must feel constructive and slightly humorous
- Encourage growth, not pressure
Example behavior:
- "지금은 씨앗 단계인데 나무처럼 살려고 하시면 좀 억울하죠 🌱"
- "꾸준함은 재능을 이기는 법이라 했습니다. 지금 방향은 좋습니다."
----------------------------------
[MODE 2: alarm]
Trigger: streaks, logs, statistics, scheduled notifications, system status
Tone:
- Neutral and formal
- No humor
Style:
- Short, clear, structured
- Focus on facts and numbers
Rules:
- No metaphors, no jokes
- Prioritize clarity and accuracy
Example:
- "연속 5일 유지 중입니다."
- "전일 대비 활동 시간 12% 감소"
----------------------------------
[MODE 3: analysis]
Trigger: data analysis, summaries, reports, insights, weekly/monthly review
Tone:
- Professional and expert-level
- No playfulness
Style:
- Structured (bullet points, sections)
- Precise and objective
Rules:
- No emotional language
- Use analytical reasoning
- Provide insights, not just summaries
Example:
- "주요 패턴: 집중 시간은 오후 2~4시에 최고치"
- "비효율 구간: 오전 10~11시 반복적으로 이탈 발생"
----------------------------------
[OUTPUT RULES]
- Match the user's language (Korean by default)
- Default to coach mode if [MODE] tag is unclear
- Always prioritize clarity over creativity
`.trim()

/**
 * 모드 주입 헬퍼 — 프롬프트 앞에 [MODE: X] 태그 삽입
 * @param {'coach'|'alarm'|'analysis'} mode
 * @param {string} userPrompt
 */
export function withMode(mode, userPrompt) {
  return `[MODE: ${mode}]\n${userPrompt}`
}

/**
 * 입력 키워드로 자동 모드 감지 (명시적 mode 없을 때 fallback)
 * @param {string} text
 * @returns {'coach'|'alarm'|'analysis'}
 */
export function detectMode(text = '') {
  const t = text.toLowerCase()
  const alarmKw  = ['streak','연속','로그','통계','알림','notification','log','stat']
  const analysisKw = ['분석','리포트','요약','패턴','인사이트','summary','report','analysis','trend']
  if (alarmKw.some(k => t.includes(k)))    return 'alarm'
  if (analysisKw.some(k => t.includes(k))) return 'analysis'
  return 'coach'
}

// ═══════════════════════════════════════════════════════════
// Gemini API helpers
// ═══════════════════════════════════════════════════════════

/**
 * Gemini 2.5 Flash 호출
 * @param {string} prompt
 * @param {object} opts - { temperature, maxTokens, mode, systemPrompt }
 *   mode: 'coach'|'alarm'|'analysis' — 자동으로 [MODE:] 태그 + 시스템 프롬프트 주입
 *   systemPrompt: true(기본)/false — AI_SYSTEM_PROMPT 사용 여부
 * @returns {Promise<string>}
 */
export async function callGemini(prompt, opts = {}) {
  const {
    temperature   = 0.2,
    maxTokens     = 512,
    mode          = null,        // 'coach' | 'alarm' | 'analysis' | null
    useSystem     = true         // false 이면 시스템 프롬프트 생략
  } = opts

  // [MODE: X] 태그 삽입
  const finalPrompt = mode ? withMode(mode, prompt) : prompt

  const body = {
    contents: [{ parts: [{ text: finalPrompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'text/plain',
      thinkingConfig: { thinkingBudget: 0 }
    }
  }

  // 시스템 인스트럭션 삽입 (mode가 있을 때만, 또는 useSystem=true)
  if (useSystem && mode) {
    body.systemInstruction = { parts: [{ text: AI_SYSTEM_PROMPT }] }
  }

  const res = await fetch(`${BASE}?key=${API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemini error ${res.status}: ${err?.error?.message || res.statusText}`)
  }

  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  const textPart = parts.find(p => p.text)
  return textPart?.text?.trim() || ''
}

/**
 * JSON 응답 파싱용 래퍼
 * @param {string} prompt
 * @param {object} opts - { temperature, maxTokens, mode }
 */
export async function callGeminiJSON(prompt, opts = {}) {
  const raw = await callGemini(prompt + '\n\n반드시 JSON만 출력. 마크다운 없이.', opts)
  try {
    const clean = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/, '')
      .trim()
    return JSON.parse(clean)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch { }
    }
    return null
  }
}
