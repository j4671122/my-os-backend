'use client'
import { useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import useStore from '@/store/useStore'

export default function AuthScreen() {
  const [tab, setTab]           = useState('login')
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
        <div className="auth-card">
          <div className="auth-logo">
            <span className="auth-logo-icon">🖥️</span>
            <div className="auth-logo-title">My OS TODO</div>
          </div>
          <p style={{textAlign:'center',color:'#555',fontSize:14,marginBottom:20}}>
            <strong>{email}</strong>로 인증 링크를 보냈어요.<br/>메일함을 확인해주세요.
          </p>
          <button className="auth-submit" onClick={() => setEmailSent(false)}>다시 시도</button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">🖥️</span>
          <div className="auth-logo-title">My OS TODO</div>
          <div className="auth-logo-sub">목표부터 할일까지, 나만의 OS</div>
        </div>

        <div className="auth-tabs">
          <div className={`auth-tab${tab === 'login'  ? ' active' : ''}`} onClick={() => setTab('login')}>로그인</div>
          <div className={`auth-tab${tab === 'signup' ? ' active' : ''}`} onClick={() => setTab('signup')}>회원가입</div>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button className="auth-btn-google" type="button" onClick={handleGoogle}>
          <svg viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google로 계속하기
        </button>

        <div className="auth-divider">또는</div>

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>이메일</label>
            <input type="email" placeholder="이메일 주소" value={email} required autoComplete="email"
              onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="auth-field">
            <label>비밀번호</label>
            <input type="password" placeholder="비밀번호 (6자 이상)" value={password} required minLength={6} autoComplete="current-password"
              onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '처리 중...' : tab === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>

        <button type="button" onClick={signInAsGuest}
          style={{width:'100%',marginTop:10,background:'none',border:'1.5px dashed #ccc',borderRadius:10,padding:11,fontSize:13,color:'#888',cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>
          👤 게스트로 둘러보기 (저장 안 됨)
        </button>
      </div>
    </div>
  )
}
