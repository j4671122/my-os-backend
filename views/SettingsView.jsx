'use client'
import { useState } from 'react'
import useStore from '@/store/useStore'
import { api } from '@/lib/apiClient'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

const PERSONALITIES = [
  { key:'default', icon:'🤝', name:'균형',  desc:'균형 잡힌 조언' },
  { key:'coach',   icon:'💪', name:'코치',  desc:'강하게 동기부여' },
  { key:'friend',  icon:'😊', name:'친구',  desc:'편하고 친근하게' },
  { key:'mentor',  icon:'🧙', name:'멘토',  desc:'깊이 있는 조언' },
  { key:'strict',  icon:'📐', name:'엄격',  desc:'규율 중시' },
  { key:'calm',    icon:'🌿', name:'차분',  desc:'잔잔하고 여유롭게' },
]

const LANGS = [
  { key:'ko', flag:'🇰🇷', name:'한국어',  native:'한국어' },
  { key:'en', flag:'🇺🇸', name:'English', native:'English' },
  { key:'ja', flag:'🇯🇵', name:'日本語',  native:'日本語' },
]

const AVATAR_EMOJIS = ['😊','😎','🤓','🧑‍💻','👨‍🎨','🦊','🐼','🐸','🦁','🐯','🐧','🦄','🔥','⚡','🌟','🎯','🚀','💎','🌙','🌊']

const AVATAR_BGS = [
  'linear-gradient(135deg,#2c5f2e,#4a9f4d)',
  'linear-gradient(135deg,#2563eb,#3b82f6)',
  'linear-gradient(135deg,#7c3aed,#8b5cf6)',
  'linear-gradient(135deg,#dc2626,#ef4444)',
  'linear-gradient(135deg,#d97706,#f59e0b)',
  'linear-gradient(135deg,#0891b2,#06b6d4)',
  'linear-gradient(135deg,#be185d,#ec4899)',
  'linear-gradient(135deg,#374151,#6b7280)',
]

const TABS = [
  { key:'profile', label:'👤 프로필' },
  { key:'ai',      label:'🤖 AI' },
  { key:'notif',   label:'🔔 알림' },
  { key:'display', label:'⚙️ 표시' },
  { key:'data',    label:'📦 데이터' },
  { key:'notion',  label:'📓 Notion' },
]

const PERM_BADGE = {
  admin: { label:'관리자', bg:'#fef3cd', fg:'#92400e' },
  pro:   { label:'PRO',   bg:'#dbeafe', fg:'#1d4ed8' },
  user:  { label:'일반',  bg:'#f3f4f6', fg:'#6b7280' },
}

// ── 배지 자동 계산 ──
function computeUserBadges(tasks, settings) {
  const now      = Date.now()
  const joinedAt = settings.joinedAt ? new Date(settings.joinedAt).getTime() : now
  const daysSince = (now - joinedAt) / 86400000
  if (daysSince < 7) return [{ icon:'🐥', label:'병아리', bg:'#fef9c3', fg:'#78350f' }]

  const done  = tasks.filter(t => t.done && t.completed_at)
  const last30 = now - 30*86400000, last7 = now - 7*86400000
  const days30 = new Set(done.filter(t => new Date(t.completed_at).getTime() > last30).map(t => t.completed_at?.slice(0,10))).size
  const days7  = new Set(done.filter(t => new Date(t.completed_at).getTime() > last7 ).map(t => t.completed_at?.slice(0,10))).size
  const badges = []

  if      (days30 === 0)  badges.push({ icon:'🌙', label:'주간 출몰자',       bg:'#ede9fe', fg:'#4c1d95' })
  else if (days30 >= 25)  badges.push({ icon:'🔥', label:'불꽃 수행자',       bg:'#fde8e4', fg:'#9b1c1c' })
  else if (days30 <= 5)   badges.push({ icon:'🦥', label:'나태의 달인',       bg:'#f0fdf4', fg:'#14532d' })
  else if (days7  >= 6)   badges.push({ icon:'⚡', label:'이번 주 전력질주',  bg:'#fef3cd', fg:'#78350f' })

  if      (done.length >= 100) badges.push({ icon:'🏆', label:'할일 전설', bg:'#fef3cd', fg:'#78350f' })
  else if (done.length >= 50)  badges.push({ icon:'🥇', label:'완료 장인', bg:'#dcfce7', fg:'#14532d' })
  else if (done.length >= 10)  badges.push({ icon:'🌱', label:'성장 중',   bg:'#f0fdf4', fg:'#15803d' })

  const tags = new Set(tasks.flatMap(t => t.tags || []))
  if (tags.size >= 10) badges.push({ icon:'🌈', label:'멀티플레이어', bg:'#fdf2f8', fg:'#9d174d' })
  if (done.filter(t => t.priority==='high').length >= 15)
    badges.push({ icon:'⚔️', label:'중요도 사냥꾼', bg:'#fde8e4', fg:'#9b1c1c' })

  return badges.slice(0, 4)
}

// ── 주간 리포트 생성 ──
function generateReport(tasks, habits) {
  const week7     = Date.now() - 7*86400000
  const t         = new Date().toISOString().slice(0,10)
  const completed = tasks.filter(x => x.done && x.completed_at && new Date(x.completed_at).getTime() > week7)
  const created   = tasks.filter(x => new Date(x.created_at||0).getTime() > week7)
  const rate      = created.length ? Math.round(completed.length/created.length*100) : 0
  const topTags   = {}
  completed.forEach(tk => (tk.tags||[]).forEach(tg => { topTags[tg]=(topTags[tg]||0)+1 }))
  const sortedTags = Object.entries(topTags).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const doneH = habits.filter(h => h.checks?.includes(t)).length

  return [
    `# 📊 주간 리포트 — ${new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric'})}`,
    '', `## 📈 요약`,
    `- 완료한 작업: **${completed.length}개**`,
    `- 신규 작업: **${created.length}개**`,
    `- 완료율: **${rate}%**`,
    '', `## ✅ 완료한 주요 작업`,
    ...completed.slice(0,10).map(tk=>`- ${tk.title}${(tk.tags||[]).length?' ['+(tk.tags.map(tg=>'#'+tg).join(' '))+']':''}`),
    '', `## 🏷 주요 태그`,
    ...sortedTags.map(([tg,n])=>`- #${tg}: ${n}개`),
    '', `## 💪 오늘 습관: ${doneH}/${habits.length}개`,
    '', `---`,
    `_${new Date().toLocaleString('ko-KR')} 자동 생성_`,
  ].join('\n')
}

// ── Notion 업로드 ──
async function notionUpload(key, dbId, title, content) {
  if (!key)  { alert('Notion API Key를 먼저 저장하세요'); return }
  if (!dbId) { alert('Notion Database ID를 먼저 저장하세요'); return }
  try {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: { Authorization:'Bearer '+key, 'Content-Type':'application/json', 'Notion-Version':'2022-06-28' },
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties: { Name:{ title:[{ text:{ content:title } }] } },
        children: [{ object:'block', type:'code', code:{ rich_text:[{ type:'text', text:{ content } }], language:'markdown' } }],
      }),
    })
    const data = await res.json()
    if (data?.id) alert('✅ Notion에 업로드됨!')
    else alert('업로드 실패: ' + (data?.message || '알 수 없는 오류'))
  } catch { alert('Notion 연결 실패 (CORS 문제일 수 있어요)') }
}

export default function SettingsView() {
  const {
    tasks, habits, settings, token, loadFromServer,
    setSetting, setSettings, clearAuth,
    setTasks, setGoals, setFolders, setHabits,
    notifications, clearNotifications,
  } = useStore()

  const [tab,          setTab]          = useState('profile')
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [form,         setForm]         = useState({ name:settings.name||'', bio:settings.bio||'', goal:settings.goal||'' })
  const [report,       setReport]       = useState('')
  const [showReport,   setShowReport]   = useState(false)
  const [notionKey,    setNotionKey]    = useState(settings.notionKey||'')
  const [notionDb,     setNotionDb]     = useState(settings.notionDb ||'')
  const [notionSaved,  setNotionSaved]  = useState(false)
  const [loadingBadges,setLoadingBadges]= useState(false)

  async function saveProfile() {
    setSaving(true)
    try {
      await api.patch('/api/profile', {
        display_name: form.name, bio: form.bio,
        ai_personality: settings.aiPersonality,
        preferences: {
          lang: settings.lang, defaultPriority: settings.defaultPriority,
          notifEnabled: settings.notifEnabled, notifCoach: settings.notifCoach,
          notifOverdue: settings.notifOverdue, goal: form.goal,
          weekStart: settings.weekStart, showDoneInToday: settings.showDoneInToday,
          theme: settings.theme, alarmSound: settings.alarmSound,
          overdueColor: settings.overdueColor, upcomingColor: settings.upcomingColor,
          notionKey: settings.notionKey, notionDb: settings.notionDb,
        },
      })
      setSettings({ name:form.name, bio:form.bio, goal:form.goal })
      setSaved(true); setTimeout(()=>setSaved(false), 2000)
    } catch(e) { alert('저장 실패: '+e.message) }
    finally { setSaving(false) }
  }

  function setAvatar(emoji) {
    setSetting('avatar', emoji)
    api.patch('/api/profile', { avatar:emoji }).catch(()=>{})
  }

  function setAvatarBg(idx) {
    setSetting('avatarBg', idx)
    setSetting('avatarBgGrad', AVATAR_BGS[idx])
    api.patch('/api/profile', { preferences:{ avatarBg:idx, avatarBgGrad:AVATAR_BGS[idx] } }).catch(()=>{})
  }

  async function loadAIBadges() {
    setLoadingBadges(true)
    try {
      const tagStats = tasks.reduce((a, t) => { (t.tags||[]).forEach(tg=>{a[tg]=(a[tg]||0)+1}); return a }, {})
      const res = await api.post('/api/ai/badges', {
        stats: {
          done: tasks.filter(t=>t.done).length,
          total: tasks.length,
          streak: 0,
          topTags: Object.entries(tagStats).sort((x,y)=>y[1]-x[1]).slice(0,3).map(([t])=>t),
        },
        personality: settings.aiPersonality || 'default',
        mode: 'coach',
      })
      if (res?.badges?.length) setSetting('userBadges', res.badges)
    } catch { /* silent */ }
    finally { setLoadingBadges(false) }
  }

  async function reloadServerData() {
    if (!token) return alert('로그인 후 서버 데이터를 불러올 수 있어요')
    await loadFromServer(token)
    alert('✅ 서버 데이터로 새로고침 완료')
  }

  async function handleReset() {
    if (!confirm('정말 전체 초기화할까요?\n모든 할일·목표·습관이 삭제됩니다.')) return
    if (!confirm('이 작업은 되돌릴 수 없어요. 계속할까요?')) return
    try {
      await Promise.allSettled([
        api.del('/api/tasks?all=1'),
        api.del('/api/goals?all=1'),
        api.del('/api/habits?all=1'),
        api.del('/api/folders?all=1'),
      ])
      setTasks([]); setGoals([]); setHabits([]); setFolders([])
      alert('초기화 완료')
    } catch { alert('오류가 발생했어요') }
  }

  function saveNotionSettings() {
    setSetting('notionKey', notionKey)
    setSetting('notionDb',  notionDb)
    api.patch('/api/profile', { preferences:{ notionKey, notionDb } }).catch(()=>{})
    setNotionSaved(true); setTimeout(()=>setNotionSaved(false), 2000)
  }

  const computedBadges = computeUserBadges(tasks, settings)
  const pb = PERM_BADGE[settings.permission||'user'] || PERM_BADGE.user
  const todayNotifs = (notifications||[]).filter(n => new Date(n.time).toISOString().slice(0,10) === new Date().toISOString().slice(0,10))

  return (
    <div className="settings-view">
      <div className="settings-tabs">
        {TABS.map(t => (
          <div key={t.key} className={`stab ${tab===t.key?'active':''}`} onClick={()=>setTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* ── 프로필 ── */}
      {tab==='profile' && (<>
        <div className="settings-card" style={{marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
            <span className="pbadge" style={{background:pb.bg,color:pb.fg}}>{pb.label}</span>
            {computedBadges.map((b,i)=>(
              <span key={i} title={b.label} style={{fontSize:18}}>{b.icon}</span>
            ))}
            <button className="btn btn-ghost btn-sm" style={{marginLeft:'auto',fontSize:11}}
              onClick={loadAIBadges} disabled={loadingBadges}>
              {loadingBadges?'로딩…':'🤖 AI 배지'}
            </button>
          </div>
          {(settings.userBadges||[]).length>0 && (
            <div style={{fontSize:11,color:'var(--text3)'}}>
              AI 배지: {(settings.userBadges||[]).map((b,i)=><span key={i} style={{fontSize:16,marginRight:2}}>{b}</span>)}
            </div>
          )}
        </div>

        <div className="settings-card">
          <h4>기본 정보</h4>
          <div className="sf">
            <label>표시 이름</label>
            <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="이름"/>
          </div>
          <div className="sf">
            <label>@태그</label>
            <input value={settings.userTag||''} disabled style={{opacity:.6}}/>
            <div className="sf-hint">태그는 온보딩 화면에서만 설정 가능합니다</div>
          </div>
          <div className="sf">
            <label>소개</label>
            <textarea value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} placeholder="한 줄 소개"/>
          </div>
          <div className="sf">
            <label>이번 달 목표</label>
            <input value={form.goal} onChange={e=>setForm(f=>({...f,goal:e.target.value}))} placeholder="예: 독서 5권 완독"/>
          </div>
          <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
            {saving?'저장 중…':saved?'✅ 저장됨':'저장'}
          </button>
        </div>

        <div className="settings-card">
          <h4>아바타 배경</h4>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
            {AVATAR_BGS.map((g,i)=>(
              <div key={i} onClick={()=>setAvatarBg(i)} style={{
                width:22,height:22,borderRadius:'50%',background:g,cursor:'pointer',
                border:`2.5px solid ${(settings.avatarBg||0)===i?'var(--text)':'transparent'}`,
                boxSizing:'border-box',transition:'all .12s',
              }}/>
            ))}
          </div>
          <h4>아바타 이모지</h4>
          <div className="emoji-picker-row">
            {AVATAR_EMOJIS.map(e=>(
              <div key={e} className={`ep-item${settings.avatar===e?' sel':''}`} onClick={()=>setAvatar(e)}>{e}</div>
            ))}
          </div>
        </div>
      </>)}

      {/* ── AI ── */}
      {tab==='ai' && (<>
        <div className="settings-card">
          <h4>AI 코치 성격</h4>
          <div className="personality-grid">
            {PERSONALITIES.map(p=>(
              <div key={p.key} className={`pcard ${settings.aiPersonality===p.key?'sel':''}`}
                onClick={()=>setSetting('aiPersonality',p.key)}>
                <div className="pcard-icon">{p.icon}</div>
                <div className="pcard-name">{p.name}</div>
                <div className="pcard-desc">{p.desc}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" style={{marginTop:14}} onClick={saveProfile} disabled={saving}>
            {saving?'저장 중…':saved?'✅ 저장됨':'저장'}
          </button>
        </div>

        <div className="settings-card">
          <h4>📊 주간 리포트</h4>
          <p style={{fontSize:12.5,color:'var(--text3)',marginBottom:10,lineHeight:1.6}}>
            지난 7일 완료 작업·태그·습관 요약을 마크다운으로 생성합니다.
          </p>
          <button className="btn btn-ghost btn-sm" onClick={()=>{setReport(generateReport(tasks,habits));setShowReport(true)}}>
            📋 리포트 생성
          </button>
          {showReport && report && (
            <div style={{marginTop:12}}>
              <pre style={{fontSize:11.5,background:'var(--surface2)',padding:12,borderRadius:10,
                overflowX:'auto',whiteSpace:'pre-wrap',lineHeight:1.7,maxHeight:300,overflowY:'auto'}}>
                {report}
              </pre>
              <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
                <button className="btn btn-ghost btn-sm"
                  onClick={()=>navigator.clipboard.writeText(report).then(()=>alert('📋 복사됨!'))}>
                  복사
                </button>
                <button className="btn btn-ghost btn-sm"
                  onClick={()=>notionUpload(settings.notionKey,settings.notionDb,'주간 리포트 '+new Date().toLocaleDateString('ko-KR'),report)}>
                  📓 Notion 업로드
                </button>
                <button className="btn btn-ghost btn-sm" onClick={()=>setShowReport(false)}>닫기</button>
              </div>
            </div>
          )}
        </div>
      </>)}

      {/* ── 알림 ── */}
      {tab==='notif' && (<>
        <div className="settings-card">
          <h4>알림 설정</h4>
          {[
            { key:'notifEnabled', label:'알림 활성화',    sub:'모든 알림 on/off' },
            { key:'notifCoach',   label:'AI 코치 메시지', sub:'생산성 팁, 패턴 분석' },
            { key:'notifOverdue', label:'기한 초과 알림', sub:'마감이 지난 할일 경고' },
          ].map(({key,label,sub})=>(
            <div key={key} className="toggle-row">
              <div className="toggle-info">
                <div className="toggle-label">{label}</div>
                <div className="toggle-sub">{sub}</div>
              </div>
              <label className="tog">
                <input type="checkbox" checked={!!settings[key]} onChange={e=>setSetting(key,e.target.checked)}/>
                <span className="tog-slider"/>
              </label>
            </div>
          ))}
        </div>

        <div className="settings-card">
          <h4>알람 소리</h4>
          <div className="select-row">
            <div className="toggle-info">
              <div className="toggle-label">포모도로·루틴 효과음</div>
            </div>
            <select value={settings.alarmSound||'beep'} onChange={e=>setSetting('alarmSound',e.target.value)}
              style={{fontSize:12,padding:'4px 8px',border:'1px solid var(--border)',borderRadius:8,background:'var(--surface)'}}>
              <option value="beep">📣 비프</option>
              <option value="chime">🎵 차임</option>
              <option value="bell">🔔 벨</option>
              <option value="alarm">🚨 알람</option>
              <option value="none">🔇 없음</option>
            </select>
          </div>
        </div>

        <div className="settings-card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <h4 style={{marginBottom:2}}>알림 히스토리</h4>
              <div style={{fontSize:12,color:'var(--text3)'}}>오늘 {todayNotifs.length}개</div>
            </div>
            {todayNotifs.length>0 && (
              <button className="btn btn-ghost btn-sm" onClick={clearNotifications}>전체 삭제</button>
            )}
          </div>
        </div>
      </>)}

      {/* ── 표시 ── */}
      {tab==='display' && (<>
        <div className="settings-card">
          <h4>언어</h4>
          <div className="lang-grid">
            {LANGS.map(l=>(
              <div key={l.key} className={`lang-card ${settings.lang===l.key?'sel':''}`}
                onClick={()=>setSetting('lang',l.key)}>
                <div className="lang-flag">{l.flag}</div>
                <div className="lang-name">{l.name}</div>
                <div className="lang-native">{l.native}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-card">
          <h4>테마</h4>
          <div style={{display:'flex',gap:10}}>
            {[['light','☀️ 라이트'],['dark','🌙 다크']].map(([k,label])=>(
              <button key={k} className={`btn ${settings.theme===k?'btn-primary':'btn-ghost'}`}
                onClick={()=>{ setSetting('theme',k); document.body.classList.toggle('dark',k==='dark') }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-card">
          <h4>기본 설정</h4>
          <div className="select-row">
            <div className="toggle-info"><div className="toggle-label">새 할일 기본 우선순위</div></div>
            <select value={settings.defaultPriority||'med'} onChange={e=>setSetting('defaultPriority',e.target.value)}>
              <option value="high">높음</option>
              <option value="med">보통</option>
              <option value="low">낮음</option>
            </select>
          </div>
          <div className="select-row" style={{marginTop:6}}>
            <div className="toggle-info"><div className="toggle-label">주 시작일</div></div>
            <select value={settings.weekStart??1} onChange={e=>setSetting('weekStart',Number(e.target.value))}>
              <option value={1}>월요일</option>
              <option value={0}>일요일</option>
            </select>
          </div>
          <div className="toggle-row" style={{marginTop:6}}>
            <div className="toggle-info">
              <div className="toggle-label">완료 항목 오늘 탭에 표시</div>
            </div>
            <label className="tog">
              <input type="checkbox" checked={!!settings.showDoneInToday} onChange={e=>setSetting('showDoneInToday',e.target.checked)}/>
              <span className="tog-slider"/>
            </label>
          </div>
          <div className="select-row" style={{marginTop:6}}>
            <div className="toggle-info"><div className="toggle-label">기한 초과 색상</div></div>
            <input type="color" value={settings.overdueColor||'#dc2626'}
              onChange={e=>setSetting('overdueColor',e.target.value)}
              style={{width:40,height:32,border:'none',borderRadius:6,cursor:'pointer',background:'none'}}/>
          </div>
          <div className="select-row" style={{marginTop:6}}>
            <div className="toggle-info"><div className="toggle-label">예정 날짜 색상</div></div>
            <input type="color" value={settings.upcomingColor||'#2563eb'}
              onChange={e=>setSetting('upcomingColor',e.target.value)}
              style={{width:40,height:32,border:'none',borderRadius:6,cursor:'pointer',background:'none'}}/>
          </div>
        </div>
      </>)}

      {/* ── 데이터 ── */}
      {tab==='data' && (<>
        <div className="settings-card">
          <h4>데이터 관리</h4>
          <div style={{fontSize:12.5,color:'var(--text3)',marginBottom:10}}>
            할일 {tasks.length}개 · 완료 {tasks.filter(t=>t.done).length}개 · 습관 {habits.length}개
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button className="btn btn-ghost btn-sm" onClick={reloadServerData}>서버에서 다시 불러오기</button>
            <button className="btn btn-sm btn-danger" onClick={handleReset}>⚠️ 전체 초기화</button>
          </div>
          <p style={{fontSize:11.5,color:'var(--text3)',marginTop:10,lineHeight:1.6}}>
            데이터는 서버에 저장됩니다. 초기화는 서버 데이터도 삭제됩니다.
          </p>
        </div>

        <div className="settings-card" style={{borderColor:'#fca5a5',background:'var(--surface)'}}>
          <h4 style={{color:'var(--red)'}}>계정</h4>
          <div style={{fontSize:12.5,color:'var(--text2)',marginBottom:10}}>
            {settings.name||'이름 없음'} · {settings.userTag?'@'+settings.userTag:''}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={async()=>{
              if(!confirm('로그아웃 하시겠어요?')) return
              const sb=getSupabaseBrowser()
              await sb.auth.signOut()
              clearAuth()
            }}>🚪 로그아웃</button>
          </div>
        </div>

        <div className="settings-card" style={{background:'var(--surface2)'}}>
          <h4>앱 정보</h4>
          <p style={{fontSize:12,color:'var(--text3)',lineHeight:1.8}}>
            <strong>My OS</strong> v1.0<br/>
            Supabase · Vercel · Gemini AI
          </p>
        </div>
      </>)}

      {/* ── Notion ── */}
      {tab==='notion' && (
        <div className="settings-card">
          <h4>Notion 연동</h4>
          <p style={{fontSize:12.5,color:'var(--text3)',marginBottom:12,lineHeight:1.6}}>
            Notion Integration API 키와 데이터베이스 ID를 입력하면<br/>
            AI 탭에서 생성한 리포트를 Notion에 직접 업로드할 수 있어요.
          </p>
          <div className="sf">
            <label>Notion API Key</label>
            <input type="password" value={notionKey} onChange={e=>setNotionKey(e.target.value)} placeholder="secret_..."/>
          </div>
          <div className="sf">
            <label>Database ID</label>
            <input value={notionDb} onChange={e=>setNotionDb(e.target.value)} placeholder="32자리 ID"/>
            <div className="sf-hint">Notion → 데이터베이스 페이지 URL에서 복사하세요</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveNotionSettings}>
            {notionSaved?'✅ 저장됨':'저장'}
          </button>
          {settings.notionKey && (
            <div style={{marginTop:12,padding:'10px 12px',background:'var(--accent-light)',borderRadius:8,fontSize:12.5}}>
              ✅ 연동됨 — AI 탭 → 리포트 생성 → Notion 업로드
            </div>
          )}
        </div>
      )}
    </div>
  )
}
