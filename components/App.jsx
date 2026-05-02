'use client'
import { useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import useStore from '@/store/useStore'
import AuthScreen from '@/components/auth/AuthScreen'
import OnboardingModal from '@/components/auth/OnboardingModal'
import MainApp from '@/components/layout/MainApp'

export default function App() {
  const {
    user, authReady, isGuest, showOnboarding,
    setUser, setToken, setAuthReady, clearAuth, loadFromServer,
  } = useStore()

  useEffect(() => {
    const sb = getSupabaseBrowser()

    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user, session.access_token)
        loadFromServer(session.access_token)
      }
      setAuthReady(true)
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user, session.access_token)
        await loadFromServer(session.access_token)
      }
      if (event === 'SIGNED_OUT')           clearAuth()
      if (event === 'TOKEN_REFRESHED' && session) setToken(session.access_token)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!authReady) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:14, color:'#888' }}>
        로딩 중...
      </div>
    )
  }

  if (!user && !isGuest) {
    return <AuthScreen />
  }

  return (
    <>
      <MainApp />
      {showOnboarding && <OnboardingModal />}
    </>
  )
}
