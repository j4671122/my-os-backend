const API_KEY = process.env.GEMINI_API_KEY
const BASE    = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

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
----------------------------------
[OUTPUT RULES]
- Match the user's language (Korean by default)
- Default to coach mode if [MODE] tag is unclear
- Always prioritize clarity over creativity
`.trim()

export function withMode(mode, userPrompt) {
  return `[MODE: ${mode}]\n${userPrompt}`
}

export function detectMode(text = '') {
  const t = text.toLowerCase()
  const alarmKw    = ['streak','연속','로그','통계','알림','notification','log','stat']
  const analysisKw = ['분석','리포트','요약','패턴','인사이트','summary','report','analysis','trend']
  if (alarmKw.some(k => t.includes(k)))    return 'alarm'
  if (analysisKw.some(k => t.includes(k))) return 'analysis'
  return 'coach'
}

export async function callGemini(prompt, opts = {}) {
  const { temperature = 0.2, maxTokens = 512, mode = null, useSystem = true } = opts

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

  if (useSystem && mode) {
    body.systemInstruction = { parts: [{ text: AI_SYSTEM_PROMPT }] }
  }

  const res = await fetch(`${BASE}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemini error ${res.status}: ${err?.error?.message || res.statusText}`)
  }

  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  return parts.find(p => p.text)?.text?.trim() || ''
}

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
