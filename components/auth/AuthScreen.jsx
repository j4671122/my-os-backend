'use client'
import { useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import useStore from '@/store/useStore'

export default function AuthScreen() {
  const [tab, setTab]           = useState('login')  // 'login' | 'signup'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const signInAsGuest = useStore(s => s.signInAsGuest)

  const sb = getSupabaseBrowser()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (tab === 'login') {
        const { error } = await sb.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await sb.auth.signUp({ email, password })
        if (error) throw error
        setEmailSent(true)
      }
    } catch (err) {
      setError(err.message || '오류가 발생했어요')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  if (emailSent) {
    return (
      <div className="auth-screen">
        <div className="auth-box">
          <h2>📧 이메일을 확인해주세요</h2>
          <p>{email}로 인증 링크를 보냈어요. 링크를 클릭하면 로그인됩니다.</p>
          <button onClick={() => setEmailSent(false)}>다시 시도</button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <h1 className="auth-logo">My OS</h1>
        <p className="auth-subtitle">나만의 운영체제</p>

        <div className="auth-tabs">
          <button className={tab === 'login'  ? 'active' : ''} onClick={() => setTab('login')}>로그인</button>
          <button className={tab === 'signup' ? 'active' : ''} onClick={() => setTab('signup')}>회원가입</button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="email" placeholder="이메일" value={email} required
            onChange={e => setEmail(e.target.value)}
          />
          <input
            type="password" placeholder="비밀번호 (6자 이상)" value={password} required minLength={6}
            onChange={e => setPassword(e.target.value)}
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? '처리 중...' : tab === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>

        <div className="auth-divider">또는</div>

        <button className="auth-google" onClick={handleGoogle}>
          Google로 계속하기
        </button>

        <button className="auth-guest" onClick={signInAsGuest}>
          게스트로 둘러보기
        </button>
      </div>
    </div>
  )
}
