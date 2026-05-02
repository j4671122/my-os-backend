'use client'
import useStore from '@/store/useStore'

const today = () => new Date().toISOString().slice(0,10)

export default function Sidebar() {
  const {
    currentView, setCurrentView, setSidebarOpen,
    settings, folders, tasks, isGuest,
  } = useStore()

  const t = today()
  const todayCount    = tasks.filter(x => !x.done && (x.due_date === t || x.due_date < t)).length
  const todayOnlyCount= tasks.filter(x => !x.done && x.due_date === t).length
  const allCount      = tasks.filter(x => !x.done).length
  const doneCount     = tasks.filter(x => x.done).length
  const highCount     = tasks.filter(x => !x.done && x.priority === 'high').length

  function nav(id) {
    setCurrentView(id)
    setSidebarOpen(false)
  }

  function item(id) {
    return `sb-item${currentView === id ? ' active' : ''}`
  }

  const avatarBg = ['linear-gradient(135deg,#2c5f2e,#4a9f4d)','linear-gradient(135deg,#2563eb,#60a5fa)','linear-gradient(135deg,#7c3aed,#a78bfa)','linear-gradient(135deg,#d97706,#fbbf24)','linear-gradient(135deg,#dc2626,#f87171)']

  return (
    <aside className="sidebar">
      {/* 로고 */}
      <div className="logo">
        <span className="logo-icon">✦</span>
        My OS
      </div>

      {/* 프로필 */}
      <div className={`profile-section${currentView==='settings'?' active':''}`} onClick={() => nav('settings')}>
        <div className="sb-avatar" style={{background: settings.avatarImg ? 'transparent' : avatarBg[settings.avatarBg||0]}}>
          {settings.avatarImg
            ? <img src={settings.avatarImg} alt=""/>
            : (settings.avatar || '😊')
          }
        </div>
        <div className="profile-info">
          <div className="profile-name">{settings.name || '사용자'}</div>
          <div className="profile-sub">@{settings.userTag || (isGuest ? 'guest' : '…')}</div>
        </div>
        <span className="profile-settings-ico">⚙️</span>
      </div>

      {/* 할일 섹션 */}
      <div className="sb-label">할일</div>
      <div className={item('today')} onClick={() => nav('today')}>
        <span className="ico">📋</span>전체 할일
        {todayCount > 0 && <span className="sb-badge">{todayCount}</span>}
      </div>
      <div className={item('todayonly')} onClick={() => nav('todayonly')}>
        <span className="ico">☀️</span>오늘
        {todayOnlyCount > 0 && <span className="sb-badge">{todayOnlyCount}</span>}
      </div>
      <div className={item('inbox')} onClick={() => nav('inbox')}>
        <span className="ico">📥</span>인박스
        {allCount > 0 && <span className="sb-badge gray">{allCount}</span>}
      </div>
      <div className={item('high')} onClick={() => nav('high')}>
        <span className="ico">🔴</span>중요
        {highCount > 0 && <span className="sb-badge">{highCount}</span>}
      </div>
      <div className={item('done')} onClick={() => nav('done')}>
        <span className="ico">✅</span>완료
        {doneCount > 0 && <span className="sb-badge gray">{doneCount}</span>}
      </div>

      {/* 폴더 */}
      {folders.length > 0 && (
        <>
          <div className="sb-label">폴더</div>
          {folders.map(f => (
            <div key={f.id}
              className={`folder-row${currentView===`folder-${f.id}`?' active':''}`}
              onClick={() => nav(`folder-${f.id}`)}>
              <span className="folder-dot" style={{background: f.color || 'var(--accent)'}}/>
              <span style={{flex:1,fontSize:12.5}}>{f.name}</span>
              {tasks.filter(t => t.folder_id===f.id && !t.done).length > 0 && (
                <span className="sb-badge gray">{tasks.filter(t => t.folder_id===f.id && !t.done).length}</span>
              )}
            </div>
          ))}
        </>
      )}

      {/* 도구 섹션 */}
      <div className="sb-label" style={{marginTop:8}}>도구</div>
      {[
        ['home',      '🏠', '홈'],
        ['goals',     '🎯', '목표'],
        ['habits',    '💪', '습관'],
        ['dashboard', '📊', '대시보드'],
        ['memo',      '📝', '메모'],
        ['pomodoro',  '🍅', '포모도로'],
        ['time',      '⏱',  '타임트래커'],
        ['routine',   '🌅', '루틴'],
        ['community', '💬', '커뮤니티'],
        ['calendar',  '📅', '캘린더'],
        ['search',    '🔍', '검색'],
      ].map(([id, icon, label]) => (
        <div key={id} className={item(id)} onClick={() => nav(id)}>
          <span className="ico">{icon}</span>{label}
        </div>
      ))}
    </aside>
  )
}
