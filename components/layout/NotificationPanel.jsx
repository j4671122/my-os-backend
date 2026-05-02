'use client'
import { useEffect, useRef } from 'react'
import useStore from '@/store/useStore'

const TYPE_ICON = { info:'💡', warn:'⚠️', success:'✅', overdue:'🔴', tip:'🤖' }

export default function NotificationPanel() {
  const {
    notifications, notifPanelOpen, toggleNotifPanel,
    markNotifRead, clearNotifications,
  } = useStore()

  const panelRef = useRef(null)
  const today    = new Date().toISOString().slice(0, 10)
  const items    = (notifications || []).filter(n =>
    new Date(n.time).toISOString().slice(0, 10) === today
  )
  const unread   = items.filter(n => !n.read).length

  useEffect(() => {
    if (!notifPanelOpen) return
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        toggleNotifPanel()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [notifPanelOpen, toggleNotifPanel])

  if (!notifPanelOpen) return null

  return (
    <div ref={panelRef} className="notif-panel open">
      <div className="notif-panel-header">
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span className="ph-title">🔔 알림</span>
          <span className="ph-date">
            {new Date().toLocaleDateString('ko-KR', { month:'long', day:'numeric' })}
          </span>
        </div>
        <div className="notif-panel-acts">
          {unread > 0 && (
            <button onClick={() => items.forEach(n => !n.read && markNotifRead(n.id))}>
              모두 읽음
            </button>
          )}
          {items.length > 0 && (
            <button onClick={clearNotifications}>전체 삭제</button>
          )}
          <button onClick={toggleNotifPanel}>✕</button>
        </div>
      </div>

      <div className="notif-panel-body">
        {items.length === 0 ? (
          <div className="notif-panel-empty">
            <div className="nei">🔔</div>
            오늘 알림이 없어요
          </div>
        ) : (
          [...items].reverse().map(n => (
            <div key={n.id} className={`npi${n.read ? '' : ' unread'}`}
              onClick={() => markNotifRead(n.id)} style={{ cursor:'pointer' }}>
              <span className="npi-icon">{TYPE_ICON[n.type] || '🔔'}</span>
              <div className="npi-body">
                <div className="npi-msg">{n.msg}</div>
                <div className="npi-time">
                  {new Date(n.time).toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>
              {!n.read && <div className="npi-dot" />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
