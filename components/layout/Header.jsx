'use client'
import { useState, useEffect, useRef } from 'react'
import useStore from '@/store/useStore'
import { api } from '@/lib/apiClient'

const VIEW_LABELS = {
  today:'오늘', inbox:'전체', done:'완료',
  home:'홈', goals:'목표', habits:'습관',
  time:'타임트래커', memo:'메모', pomodoro:'포모도로',
  routine:'루틴', community:'커뮤니티', calendar:'캘린더',
  dashboard:'대시보드', search:'검색', settings:'설정',
}

const SLOT_HOURS   = [8, 12, 18, 21]
const SLOT_WINDOW  = 30 // minutes
const RETRY_MS     = 10 * 60 * 1000

function currentSlotKey() {
  const now  = new Date()
  for (const h of SLOT_HOURS) {
    const start = new Date(now); start.setHours(h, 0, 0, 0)
    const end   = new Date(start.getTime() + SLOT_WINDOW * 60000)
    if (now >= start && now <= end) {
      return `${now.toISOString().slice(0,10)}-${String(h).padStart(2,'0')}`
    }
  }
  return null
}

export default function Header() {
  const {
    currentView, toggleSidebar, toggleNotifPanel,
    notifications, settings, setSetting, pushNotification,
  } = useStore()

  const [tip, setTip]           = useState('')
  const [dismissed, setDismissed] = useState(false)
  const fetchedRef               = useRef(false)
  const unread = (notifications || []).filter(n => !n.read).length

  useEffect(() => {
    if (fetchedRef.current) return
    if (!settings.notifCoach || !settings.notifEnabled) return

    const slot    = currentSlotKey()
    const cached  = settings._aiCoachCache
    const lastAt  = settings._aiCoachLastAttemptAt || 0
    const retryAt = settings._aiCoachRetryAfter   || 0

    // Show cached tip for this slot
    if (cached?.slotKey === slot && cached.message) {
      setTip(cached.message)
      return
    }

    if (Date.now() < retryAt) return
    if (Date.now() - lastAt < RETRY_MS) return
    if (!slot) return

    fetchedRef.current = true
    setSetting('_aiCoachLastAttemptAt', Date.now())

    api.get('/api/ai/suggest').then(r => {
      const msg = r?.message ? r.message + (r.action ? ` → ${r.action}` : '') : null
      if (!msg) return
      setTip(msg)
      setSetting('_aiCoachCache', { slotKey: slot, message: msg })
      setSetting('_aiCoachRetryAfter', 0)
      pushNotification(msg, 'tip')
    }).catch(() => {
      setSetting('_aiCoachRetryAfter', Date.now() + RETRY_MS)
    })
  }, [])

  function dismiss() {
    setDismissed(true)
    setTimeout(() => setDismissed(false), 3600000)
  }

  const showTip = tip && !dismissed

  return (
    <header className="app-header">
      <button className="header-menu-btn" onClick={toggleSidebar} aria-label="메뉴">☰</button>

      <h1 className="header-title">
        {VIEW_LABELS[currentView] || currentView}
      </h1>

      {showTip && (
        <div className="coach-tip" onClick={dismiss} title="클릭해서 닫기">
          🤖 {tip}
        </div>
      )}

      <div className="header-actions">
        <button className="header-notif-btn" onClick={toggleNotifPanel}>
          🔔
          {unread > 0 && <span className="notif-badge">{unread}</span>}
        </button>
      </div>
    </header>
  )
}
