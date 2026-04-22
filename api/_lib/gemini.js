const API_KEY = process.env.GEMINI_API_KEY
const BASE    = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

/**
 * Gemini 2.5 Flash 호출 (무료 티어)
 * thinkingBudget: 0 으로 thinking 비활성화 (JSON 파싱 안정화)
 * @param {string} prompt
 * @param {object} opts - { temperature, maxTokens }
 * @returns {Promise<string>}
 */
export async function callGemini(prompt, opts = {}) {
  const { temperature = 0.2, maxTokens = 512 } = opts

  const res = await fetch(`${BASE}?key=${API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: 'text/plain',
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemini error ${res.status}: ${err?.error?.message || res.statusText}`)
  }

  const data = await res.json()
  // thinking 파트 제외하고 text 파트만 추출
  const parts = data.candidates?.[0]?.content?.parts || []
  const textPart = parts.find(p => p.text)
  return textPart?.text?.trim() || ''
}

/**
 * JSON 응답 파싱용 래퍼
 * 프롬프트에 "JSON만 출력" 지시를 포함해야 함
 */
export async function callGeminiJSON(prompt) {
  const raw = await callGemini(prompt + '\n\n반드시 JSON만 출력. 마크다운 없이.')
  try {
    // ```json ... ``` 또는 ``` 감싸진 경우 처리
    const clean = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/, '')
      .trim()
    return JSON.parse(clean)
  } catch {
    // JSON 블록만 추출 시도
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch { }
    }
    return null
  }
}
