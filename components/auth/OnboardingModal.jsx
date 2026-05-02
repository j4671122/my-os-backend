'use client'
import { useState } from 'react'
import { api } from '@/lib/apiClient'
import useStore from '@/store/useStore'

const AVATARS = ['😊','😎','🥳','🤓','🦊','🐼','🦁','🐯','🐧','🦄','🌟','🔥']

export default function OnboardingModal() {
  const { setProfile, setSettings, setShowOnboarding } = useStore()
  const [tag, setTag]           = useState('')
  const [name, setName]         = useState('')
  const [avatar, setAvatar]     = useState('😊')
  const [bio, setBio]           = useState('')
  const [tagStatus, setTagStatus] = useState(null) // null | 'ok' | 'taken' | 'invalid'
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function checkTag(value) {
    const clean = value.replace(/^@/, '').toLowerCase()
    setTag(clean)
    if (clean.length < 3) { setTagStatus(null); return }
    const res = await api.get(`/api/profile?check=@${clean}`)
    setTagStatus(res.available ? 'ok' : (res.error ? 'invalid' : 'taken'))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (tagStatus !== 'ok') return
    setLoading(true); setError('')
    try {
      const profile = await api.post('/api/profile', {
        user_tag: tag, display_name: name, avatar, bio,
      })
      setProfile(profile)
      setSettings({ name: profile.display_name, userTag: profile.user_tag, avatar: profile.avatar, bio: profile.bio })
      setShowOnboarding(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal onboarding-modal">
        <h2>👋 환영해요!</h2>
        <p>프로필을 설정하고 시작해볼까요?</p>
        <form onSubmit={handleSubmit}>
          <div className="avatar-picker">
            {AVATARS.map(a => (
              <button key={a} type="button"
                className={avatar === a ? 'selected' : ''}
                onClick={() => setAvatar(a)}>{a}</button>
            ))}
          </div>
          <input
            placeholder="이름 (닉네임)"
            value={name} onChange={e => setName(e.target.value)} required
          />
          <div className="tag-input-wrap">
            <span>@</span>
            <input
              placeholder="유저태그 (영문소문자, 숫자, _)"
              value={tag}
              onChange={e => checkTag(e.target.value)}
              minLength={3} maxLength={20} required
            />
            {tagStatus === 'ok'      && <span className="tag-ok">✓ 사용 가능</span>}
            {tagStatus === 'taken'   && <span className="tag-err">이미 사용 중</span>}
            {tagStatus === 'invalid' && <span className="tag-err">형식 오류</span>}
          </div>
          <textarea placeholder="한 줄 소개 (선택)" value={bio} onChange={e => setBio(e.target.value)} rows={2} />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={loading || tagStatus !== 'ok'}>
            {loading ? '저장 중...' : '시작하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
