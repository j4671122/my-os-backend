'use client'
import { useState, useEffect, useRef } from 'react'
import useStore from '@/store/useStore'

const todayStr = () => new Date().toISOString().slice(0, 10)

function greeting() {
  const h = new Date().getHours()
  if (h < 6)  return '🌙 심야에도 열심이네요'
  if (h < 11) return '☀️ 좋은 아침이에요'
  if (h < 14) return '🌤 좋은 오전이에요'
  if (h < 18) return '🌅 좋은 오후예요'
  if (h < 22) return '🌆 좋은 저녁이에요'
  return '🌙 오늘도 수고했어요'
}

const WIDGET_DEFS = [
  { id: 'profile',  icon: '👤', title: '프로필',    sub: '나의 정보와 배지',     wide: false, tall: false },
  { id: 'clock',    icon: '🕐', title: '시계',      sub: '현재 시각과 날짜',     wide: false, tall: false },
  { id: 'tasks',    icon: '📋', title: '오늘 할일',  sub: '기한이 있는 할일들',   wide: false, tall: true  },
  { id: 'habits',   icon: '💪', title: '습관',      sub: '오늘의 습관 체크',    wide: false, tall: false },
  { id: 'goals',    icon: '🎯', title: '목표',      sub: '진행 중인 목표',      wide: false, tall: false },
  { id: 'stats',    icon: '📊', title: '통계',      sub: '주요 지표 한눈에',    wide: true,  tall: false },
  { id: 'memo',     icon: '📝', title: '메모',      sub: '최신 메모 미리보기',   wide: false, tall: false },
  { id: 'tracker',  icon: '⏱',  title: '타임트래커', sub: '오늘 시간 기록 현황',  wide: false, tall: false },
  { id: 'pomodoro', icon: '🍅', title: '포모도로',   sub: '집중 타이머 바로가기', wide: false, tall: false },
  { id: 'focus',    icon: '⭐', title: '집중 모드',  sub: '오늘 최우선 할일',    wide: false, tall: false },
]

const DEFAULT_WIDGETS = ['profile', 'clock', 'tasks', 'habits']

const AVATAR_BG = [
  'linear-gradient(135deg,#2c5f2e,#4a9f4d)',
  'linear-gradient(135deg,#2563eb,#60a5fa)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
  'linear-gradient(135deg,#d97706,#fbbf24)',
  'linear-gradient(135deg,#dc2626,#f87171)',
]

// ── Clock widget ──
function ClockWidget() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  return (
    <div style={{ padding: '6px 0' }}>
      <div className="clock-big">{timeStr}</div>
      <div className="clock-date">{dateStr}</div>
    </div>
  )
}

// ── Profile widget ──
function ProfileWidget({ settings }) {
  return (
    <div className="home-profile">
      <div className="home-avatar" style={{ background: settings.avatarImg ? 'transparent' : (AVATAR_BG[settings.avatarBg || 0]) }}>
        {settings.avatarImg ? <img src={settings.avatarImg} alt="" /> : (settings.avatar || '😊')}
      </div>
      <div className="home-profile-meta">
        <div style={{ fontWeight: 800, fontSize: 15 }}>{settings.name || '사용자'}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>@{settings.userTag || '…'}</div>
        {settings.bio && (
          <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 4, lineHeight: 1.4 }}>{settings.bio}</div>
        )}
        {(settings.userBadges || []).length > 0 && (
          <div className="home-badge-row">
            {settings.userBadges.map((b, i) => <span key={i} style={{ fontSize: 18 }}>{b}</span>)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tasks widget ──
function TasksWidget({ tasks }) {
  const t = todayStr()
  const items = tasks.filter(x => !x.done && x.due_date && x.due_date <= t)
  return (
    <div>
      {items.slice(0, 7).map((task, i) => (
        <div key={task.id} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
          borderBottom: i < Math.min(items.length, 7) - 1 ? '1px solid var(--border)' : 'none',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: task.priority === 'high' ? 'var(--red)' : task.priority === 'low' ? 'var(--text3)' : 'var(--accent)',
          }} />
          <span style={{ fontSize: 12.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </span>
          {task.due_date < t && (
            <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, flexShrink: 0 }}>초과</span>
          )}
        </div>
      ))}
      {items.length === 0 && <div className="home-empty">오늘 할일 없음 🎉</div>}
      {items.length > 7 && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>+{items.length - 7}개 더</div>
      )}
    </div>
  )
}

// ── Habits widget ──
function HabitsWidget({ habits }) {
  const t = todayStr()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {habits.slice(0, 6).map(h => {
        const done = h.checks?.includes(t)
        return (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 14 }}>{done ? '✅' : '⬜'}</span>
            <span style={{
              fontSize: 12.5, flex: 1,
              color: done ? 'var(--text3)' : 'var(--text)',
              textDecoration: done ? 'line-through' : 'none',
            }}>{h.name}</span>
            {(h.streak || 0) > 1 && (
              <span style={{ fontSize: 10.5, color: '#f59e0b', fontWeight: 700 }}>{h.streak}🔥</span>
            )}
          </div>
        )
      })}
      {habits.length === 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 12.5, padding: '8px 0' }}>습관을 추가해보세요</div>
      )}
    </div>
  )
}

// ── Goals widget ──
function GoalsWidget({ goals, tasks }) {
  const active = goals.filter(g => !g.done).slice(0, 4)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {active.map(g => {
        const rel = tasks.filter(t => t.goal_id === g.id)
        const pct = rel.length ? Math.round(rel.filter(t => t.done).length / rel.length * 100) : 0
        return (
          <div key={g.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
              <span style={{ fontSize: 10.5, color: 'var(--text3)', marginLeft: 8 }}>{pct}%</span>
            </div>
            <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: g.color || 'var(--accent)', borderRadius: 3, transition: 'width .4s' }} />
            </div>
          </div>
        )
      })}
      {active.length === 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 12.5, padding: '8px 0' }}>목표를 추가해보세요</div>
      )}
    </div>
  )
}

// ── Stats widget ──
function StatsWidget({ tasks, habits }) {
  const t = todayStr()
  const todayDone = tasks.filter(x => x.done && x.completed_at?.startsWith(t)).length
  const doneH     = habits.filter(h => h.checks?.includes(t)).length
  const maxStreak = habits.length ? Math.max(...habits.map(h => h.streak || 0)) : 0

  const stats = [
    { v: todayDone,                                              l: '오늘 완료' },
    { v: tasks.filter(x => x.done).length,                      l: '전체 완료' },
    { v: `${doneH}/${habits.length}`,                           l: '오늘 습관' },
    { v: maxStreak > 0 ? `${maxStreak}🔥` : '0',               l: '최장 스트릭' },
    { v: tasks.filter(x => !x.done).length,                     l: '남은 할일' },
    { v: tasks.filter(x => !x.done && x.priority === 'high').length, l: '중요 할일' },
  ]
  return (
    <div className="home-stats">
      {stats.map(({ v, l }) => (
        <div key={l} className="home-stat">
          <strong>{v}</strong>
          <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, display: 'block' }}>{l}</span>
        </div>
      ))}
    </div>
  )
}

// ── Tracker widget ──
function TrackerWidget({ settings, setCurrentView }) {
  const todayKey = new Date().toISOString().slice(0, 10)
  const data     = settings.timeTrackerData?.[todayKey] || {}
  const labels   = settings.timeTrackerLabels || []
  const total    = 24 * 6
  const counts   = {}
  labels.forEach(l => { counts[l.id] = 0 })
  let filled = 0
  Object.values(data).forEach(lid => {
    if (lid && counts[lid] !== undefined) { counts[lid]++; filled++ }
  })
  const pct = Math.round(filled / total * 100)
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>오늘 · {pct}% 기록됨</div>
      {labels.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>레이블을 추가해보세요</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {labels.map(l => {
          const cnt  = counts[l.id] || 0
          const lPct = Math.round(cnt / total * 100)
          return (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, border: '1px solid rgba(0,0,0,.1)', flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--text2)' }}>{l.name}</span>
              <span style={{ color: 'var(--text3)' }}>{cnt * 10}분</span>
              <div style={{ width: 60, height: 6, background: 'var(--surface2)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${lPct}%`, height: '100%', background: l.color, borderRadius: 999 }} />
              </div>
            </div>
          )
        })}
      </div>
      <button onClick={() => setCurrentView('time')} style={{ marginTop: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px', fontSize: 11.5, cursor: 'pointer', color: 'var(--text2)', width: '100%' }}>
        Time Tracker 열기 →
      </button>
    </div>
  )
}

// ── Pomodoro widget ──
function PomodoroWidget({ setCurrentView }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 38 }}>🍅</div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>집중 타이머</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[['🎯 25분', '#ef4444'], ['☕ 5분', '#3b82f6'], ['🌴 15분', '#10b981']].map(([label, color]) => (
          <button key={label} onClick={() => setCurrentView('pomodoro')}
            style={{ background: 'none', border: `1.5px solid ${color}`, borderRadius: 20, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color }}>
            {label}
          </button>
        ))}
      </div>
      <button onClick={() => setCurrentView('pomodoro')}
        style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '7px 18px', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 700 }}>
        시작하기 →
      </button>
    </div>
  )
}

// ── Focus widget ──
function FocusWidget({ tasks, setCurrentView }) {
  const t   = todayStr()
  const pri = { high: 0, med: 1, low: 2 }
  const items = tasks
    .filter(x => !x.done && (x.due_date === t || !x.due_date))
    .sort((a, b) => (pri[a.priority] || 1) - (pri[b.priority] || 1))

  if (!items.length) return (
    <div className="home-empty" style={{ cursor: 'pointer' }} onClick={() => setCurrentView('today')}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>🎉</div>
      <div style={{ fontSize: 12 }}>오늘 할일 없음!</div>
    </div>
  )

  const focus  = items[0]
  const rest   = items.slice(1, 4)
  const pColor = { high: 'var(--red)', med: 'var(--accent)', low: 'var(--text3)' }[focus.priority] || 'var(--accent)'
  const pLabel = { high: '🔴 최우선', med: '• 오늘', low: '• 언제든' }[focus.priority] || '오늘'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div onClick={() => setCurrentView('today')} style={{ padding: 12, background: 'rgba(44,95,46,.08)', border: `1.5px solid ${pColor}`, borderRadius: 12, cursor: 'pointer' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: pColor, marginBottom: 4 }}>{pLabel}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{focus.title}</div>
        {!focus.due_date && <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3 }}>📌 날짜 없음</div>}
      </div>
      {rest.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {rest.map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text2)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: task.priority === 'high' ? 'var(--red)' : 'var(--text3)', fontSize: 10 }}>●</span>
              {task.title}
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
        {items.length}개 남음 · <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => setCurrentView('today')}>전체 보기 →</span>
      </div>
    </div>
  )
}

// ── Memo widget ──
function MemoWidget({ settings }) {
  const memos = settings.memos || []
  if (!memos.length) return <div className="home-empty">메모를 작성해보세요</div>
  const m = memos[0]
  return (
    <div>
      {m.title && <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{m.title}</div>}
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.65, whiteSpace: 'pre-wrap', overflow: 'hidden', maxHeight: 96 }}>{m.body}</div>
      {memos.length > 1 && (
        <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 8 }}>+{memos.length - 1}개 더</div>
      )}
    </div>
  )
}

// ── Main HomeView ──
export default function HomeView() {
  const { tasks, habits, goals, settings, setSetting, setCurrentView } = useStore()
  const [showPicker, setShowPicker] = useState(false)
  const [localOrder, setLocalOrder] = useState(null)
  const dragIdxRef = useRef(null)

  const t       = todayStr()
  const name    = settings.name?.split(' ')[0] || ''
  const baseOrder  = settings.homeWidgets?.length > 0 ? settings.homeWidgets : DEFAULT_WIDGETS
  const widgetIds  = localOrder ?? baseOrder

  function handleDragStart(i) {
    dragIdxRef.current = i
  }
  function handleDragOver(e, i) {
    e.preventDefault()
    const from = dragIdxRef.current
    if (from === null || from === i) return
    const next = [...widgetIds]
    const [removed] = next.splice(from, 1)
    next.splice(i, 0, removed)
    dragIdxRef.current = i
    setLocalOrder(next)
  }
  function handleDragEnd() {
    if (localOrder) {
      setSetting('homeWidgets', localOrder)
      setLocalOrder(null)
    }
    dragIdxRef.current = null
  }

  function addWidget(id) {
    setSetting('homeWidgets', [...baseOrder, id])
    setShowPicker(false)
  }
  function removeWidget(id) {
    setSetting('homeWidgets', baseOrder.filter(w => w !== id))
  }

  function renderWidgetContent(id) {
    switch (id) {
      case 'clock':   return <ClockWidget />
      case 'profile': return <ProfileWidget settings={settings} />
      case 'tasks':   return <TasksWidget tasks={tasks} />
      case 'habits':  return <HabitsWidget habits={habits} />
      case 'goals':   return <GoalsWidget goals={goals} tasks={tasks} />
      case 'stats':    return <StatsWidget tasks={tasks} habits={habits} />
      case 'memo':     return <MemoWidget settings={settings} />
      case 'tracker':  return <TrackerWidget settings={settings} setCurrentView={setCurrentView} />
      case 'pomodoro': return <PomodoroWidget setCurrentView={setCurrentView} />
      case 'focus':    return <FocusWidget tasks={tasks} setCurrentView={setCurrentView} />
      default:         return null
    }
  }

  const overdue  = tasks.filter(x => !x.done && x.due_date && x.due_date < t)
  const addable  = WIDGET_DEFS.filter(d => !baseOrder.includes(d.id))

  return (
    <div className="home-view" style={{ paddingBottom: 90 }}>
      {/* Greeting banner */}
      <div className="home-greeting">
        <div className="home-greeting-text">{greeting()}{name ? `, ${name}` : ''}!</div>
        <div className="home-greeting-stats">
          <span>📋 오늘 <strong>{tasks.filter(x => !x.done && x.due_date === t).length}</strong>개</span>
          <span>✅ 완료 <strong>{tasks.filter(x => x.done).length}</strong>개</span>
          {overdue.length > 0 && (
            <span style={{ color: 'var(--red)' }}>⚠️ 초과 <strong>{overdue.length}</strong>개</span>
          )}
        </div>
      </div>

      {/* Widget grid */}
      <div className="home-grid">
        {widgetIds.map((id, i) => {
          const def = WIDGET_DEFS.find(d => d.id === id)
          if (!def) return null
          return (
            <div
              key={id}
              className={`home-card${def.wide ? ' wide' : ''}${def.tall ? ' tall' : ''}`}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
            >
              <div className="home-card-head">
                <span style={{ fontSize: 16 }}>{def.icon}</span>
                <span className="home-card-title">{def.title}</span>
                <span className="home-card-grab">⠿</span>
                <button
                  onClick={() => removeWidget(id)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, padding: '2px 4px' }}
                  title="제거"
                >✕</button>
              </div>
              {renderWidgetContent(id)}
            </div>
          )
        })}

        {widgetIds.length === 0 && (
          <div className="home-card wide" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 140, gap: 12 }}>
            <span style={{ fontSize: 28 }}>🏠</span>
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>위젯을 추가해서 홈을 꾸며보세요</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPicker(true)}>+ 위젯 추가</button>
          </div>
        )}
      </div>

      {/* FAB button */}
      <button className="home-fab show" onClick={() => setShowPicker(p => !p)}>
        {showPicker ? '×' : '+'}
      </button>

      {/* Picker close overlay */}
      {showPicker && <div className="wfp-close-area show" onClick={() => setShowPicker(false)} />}

      {/* Widget picker panel */}
      <div className={`wfp${showPicker ? ' show' : ''}`}>
        <div className="wfp-header">위젯 추가</div>
        {addable.map(d => (
          <div key={d.id} className="wfp-item" onClick={() => addWidget(d.id)}>
            <span className="wfp-icon">{d.icon}</span>
            <div>
              <div className="wfp-title">{d.title}</div>
              <div className="wfp-sub">{d.sub}</div>
            </div>
          </div>
        ))}
        {addable.length === 0 && (
          <div style={{ padding: '10px 14px', fontSize: 11.5, color: 'var(--text3)' }}>모든 위젯이 추가되었어요</div>
        )}
      </div>
    </div>
  )
}
