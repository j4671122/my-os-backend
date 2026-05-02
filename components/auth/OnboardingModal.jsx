'use client'
import { useRef, useState } from 'react'
import { api } from '@/lib/apiClient'
import useStore from '@/store/useStore'

const AVATARS = ['😊','😎','🥳','🤓','🦊','🐼','🦁','🐯','🐧','🦄','🌟','🔥']

export default function OnboardingModal() {
  const { profile, setProfile, setSettings, setShowOnboarding } = useStore()
  const [tag, setTag]             = useState('')
  const [avatar, setAvatar]       = useState('😊')
  const [tagStatus, setTagStatus] = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const checkSeq = useRef(0)

  async function checkTag(value) {
    const clean = value.replace(/^@/, '').toLowerCase().trim()
    const seq = ++checkSeq.current
    setTag(clean)
    setError('')
    if (clean.length < 3) { setTagStatus(null); return }
    setTagStatus('checking')
    try {
      const res = await api.get(`/api/profile?check=${encodeURIComponent('@' + clean)}`)
      if (seq !== checkSeq.current) return
      setTagStatus(res.available ? 'ok' : (res.error ? 'invalid' : 'taken'))
    } catch (err) {
      if (seq !== checkSeq.current) return
      setTagStatus('invalid')
      setError(err.message || '태그 확인에 실패했어요')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (tagStatus !== 'ok') return
    setLoading(true); setError('')
    try {
      const savedProfile = profile?.id
        ? await api.patch('/api/profile', { user_tag: tag, avatar })
        : await api.post('/api/profile', { user_tag: tag, avatar })
      setProfile(savedProfile)
      setSettings({ name: savedProfile.display_name, userTag: savedProfile.user_tag, avatar: savedProfile.avatar })
      setShowOnboarding(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const tagHint = tagStatus === 'checking' ? '확인 중...'
    : tagStatus === 'ok' ? '✓ 사용 가능해요'
    : tagStatus === 'taken'   ? '이미 사용 중인 태그예요'
    : tagStatus === 'invalid' ? '형식이 올바르지 않아요'
    : ''

  return (
    <div className="onboarding-overlay">
      <div className="onb-card">
        <div className="onb-title">👋 환영해요!</div>
        <div className="onb-sub">프로필을 설정해주세요. 나중에 언제든 바꿀 수 있어요.</div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="onb-field">
            <label>
              유저 태그{' '}
              <span style={{color:'#888',fontWeight:400}}>(영문 소문자·숫자·_ / 3~20자)</span>
            </label>
            <input
              type="text" placeholder="예: allen_dev" value={tag} maxLength={20}
              onChange={e => checkTag(e.target.value)}
              style={{width:'100%',border:'1.5px solid #e0dbd4',borderRadius:9,padding:'10px 13px',fontSize:14,fontFamily:'inherit',outline:'none',textTransform:'lowercase',boxSizing:'border-box'}}
            />
            {tagHint && (
              <div className="onb-tag-hint" style={{color: tagStatus==='ok' ? '#2c5f2e' : '#dc2626', fontSize:12, marginTop:4}}>
                {tagHint}
              </div>
            )}
          </div>

          <div className="onb-field">
            <label>아바타 선택</label>
            <div className="onb-avatar-row">
              {AVATARS.map(a => (
                <div key={a} onClick={() => setAvatar(a)} style={{
                  fontSize:22, cursor:'pointer', padding:'4px 6px', borderRadius:8,
                  border: avatar===a ? '2px solid #2c5f2e' : '2px solid transparent',
                  background: avatar===a ? '#e8f5e9' : 'transparent',
                }}>
                  {a}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="onb-submit" disabled={loading || tagStatus !== 'ok'}>
            {loading ? '저장 중...' : '시작하기 🚀'}
          </button>
        </form>
      </div>
    </div>
  )
}
