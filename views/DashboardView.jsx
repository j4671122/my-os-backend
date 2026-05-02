'use client'
import useStore from '@/store/useStore'

const today = () => new Date().toISOString().slice(0,10)

// ── 마인드맵 SVG ──
function Mindmap({ goals, tasks, settings }) {
  const gpm      = settings.goalParentMap || {}
  const globals  = goals.filter(g => g.type === 'global').slice(0, 8)

  if (!globals.length) return (
    <div style={{ textAlign:'center', padding:24, color:'var(--text3)' }}>
      <div style={{ fontSize:28, marginBottom:8 }}>🎯</div>
      <div style={{ fontSize:13 }}>목표를 추가하면 마인드맵이 표시돼요</div>
    </div>
  )

  const allProjects = goals.filter(g => g.type === 'project')
  const ROW_H = 50, GAP_G = 12
  const trunc = (s, n) => s.length > n ? s.slice(0, n) + '…' : s

  const layout = []
  let curY = 24
  globals.forEach(g => {
    const myP      = allProjects.filter(p => gpm[p.id] === g.id).slice(0, 5)
    const rowCount = Math.max(1, myP.length)
    const gy       = curY + rowCount * ROW_H / 2
    const gTasks   = tasks.filter(t => t.goal_id === g.id || myP.some(p => p.id === t.goal_id))
    const gPct     = gTasks.length ? Math.round(gTasks.filter(t => t.done).length / gTasks.length * 100) : 0
    const projLayout = myP.map((p, i) => {
      const rel  = tasks.filter(t => t.goal_id === p.id)
      const ppct = rel.length ? Math.round(rel.filter(t => t.done).length / rel.length * 100) : 0
      return { goal:p, y: curY + i * ROW_H + ROW_H / 2, pct:ppct, cnt:rel.length }
    })
    layout.push({ goal:g, y:gy, projects:projLayout, pct:gPct, cnt:gTasks.length })
    curY += rowCount * ROW_H + GAP_G
  })

  const totalH = Math.max(curY + 16, 120)
  const rootY  = totalH / 2
  const W=560, RX=52, RR=26, GX=210, GW=138, GH=38, GR=9
  const PX=415, PW=122, PH=30, PR=6

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${totalH}`} width="100%" style={{ display:'block' }}>
      <circle cx={RX} cy={rootY} r={RR} fill="#2c5f2e"/>
      <text x={RX} y={rootY-5}  textAnchor="middle" fill="#fff" fontSize={11} fontWeight={800} fontFamily="inherit">나의</text>
      <text x={RX} y={rootY+9}  textAnchor="middle" fill="rgba(255,255,255,.85)" fontSize={10} fontWeight={700} fontFamily="inherit">목표</text>

      {layout.map(({ goal:g, y:gy, projects:projs, pct, cnt }) => {
        const gL=GX-GW/2, gR=GX+GW/2, mx=(RX+RR+gL)/2
        const col = g.color || '#2c5f2e'
        return (
          <g key={g.id}>
            <path d={`M ${RX+RR},${rootY} C ${mx},${rootY} ${mx},${gy} ${gL},${gy}`}
              stroke={col} strokeWidth={2.5} fill="none" opacity={.55}/>
            <rect x={gL} y={gy-GH/2} width={GW} height={GH} rx={GR} fill={col}/>
            {pct>0 && <rect x={gL} y={gy+GH/2-5} width={GW*pct/100} height={5} rx={GR} fill="rgba(255,255,255,.28)"/>}
            <text x={GX} y={gy-5}  textAnchor="middle" fill="#fff" fontSize={10.5} fontWeight={700} fontFamily="inherit">{trunc(g.name,13)}</text>
            <text x={GX} y={gy+10} textAnchor="middle" fill="rgba(255,255,255,.78)" fontSize={9} fontFamily="inherit">{pct}% · {cnt}개</text>

            {projs.map(({ goal:p, y:py, pct:ppct, cnt:pcnt }) => {
              const pL=PX-PW/2, mx2=(gR+pL)/2
              const pc = p.color || '#3b82f6'
              return (
                <g key={p.id}>
                  <path d={`M ${gR},${gy} C ${mx2},${gy} ${mx2},${py} ${pL},${py}`}
                    stroke={pc} strokeWidth={1.5} fill="none" opacity={.45}/>
                  <rect x={pL} y={py-PH/2} width={PW} height={PH} rx={PR} fill={pc} opacity={.88}/>
                  {ppct>0 && <rect x={pL} y={py+PH/2-4} width={PW*ppct/100} height={4} rx={PR} fill="rgba(255,255,255,.28)"/>}
                  <text x={PX} y={py-3} textAnchor="middle" fill="#fff" fontSize={9.5} fontWeight={600} fontFamily="inherit">{trunc(p.name,15)}</text>
                  <text x={PX} y={py+9} textAnchor="middle" fill="rgba(255,255,255,.72)" fontSize={8} fontFamily="inherit">{ppct}% · {pcnt}개</text>
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

export default function DashboardView() {
  const { tasks, goals, habits, settings } = useStore()
  const t = today()

  const totalTasks   = tasks.length
  const doneTasks    = tasks.filter(x => x.done).length
  const todayDone    = tasks.filter(x => x.done && x.due_date===t).length
  const overdue      = tasks.filter(x => !x.done && x.due_date && x.due_date<t).length
  const completionRate = totalTasks ? Math.round(doneTasks/totalTasks*100) : 0

  // Weekly completion chart (last 7 days)
  const weekDays = Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-6+i)
    return d.toISOString().slice(0,10)
  })
  const weekData = weekDays.map(d => ({
    label: ['일','월','화','수','목','금','토'][new Date(d+'T00:00').getDay()],
    val:   tasks.filter(t => t.done && t.due_date===d).length,
    isToday: d===t,
  }))
  const maxWeek = Math.max(...weekData.map(d => d.val), 1)

  // Tag distribution
  const tagMap = {}
  tasks.forEach(tk => (tk.tags||[]).forEach(tag => { tagMap[tag]=(tagMap[tag]||0)+1 }))
  const topTags = Object.entries(tagMap).sort((a,b) => b[1]-a[1]).slice(0,6)
  const maxTag = Math.max(...topTags.map(([,v]) => v), 1)

  // Priority breakdown (active tasks)
  const active = tasks.filter(t => !t.done)
  const priMap = { high:0, med:0, low:0 }
  active.forEach(t => { priMap[t.priority||'med']++ })

  // Habits summary
  const totalStreak = habits.reduce((s,h) => s+(h.streak||0), 0)
  const habitsDoneToday = habits.filter(h => h.checks?.includes(t)).length

  return (
    <div>
      <div style={{fontWeight:800,fontSize:16,marginBottom:16}}>📊 대시보드</div>

      {/* Stat cards */}
      <div className="dash-grid">
        <div className="stat-card">
          <div className="stat-num">{totalTasks}</div>
          <div className="stat-label">전체 할일</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{color:'var(--blue)'}}>{todayDone}</div>
          <div className="stat-label">오늘 완료</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{color:completionRate>=70?'var(--accent)':'var(--amber)'}}>{completionRate}%</div>
          <div className="stat-label">완료율</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{color:overdue>0?'var(--red)':'var(--text3)'}}>{overdue}</div>
          <div className="stat-label">기한 초과</div>
        </div>
      </div>

      <div className="chart-row">
        {/* Weekly bar chart */}
        <div className="chart-card">
          <div className="chart-title">📅 주간 완료 현황</div>
          <div className="bar-chart-area">
            {weekData.map((d,i) => (
              <div key={i} className="bar-col">
                <div className="bar-val">{d.val||''}</div>
                <div className="bar" style={{height:`${Math.max(d.val/maxWeek*80, d.val?4:2)}px`, background:d.isToday?'var(--accent)':'var(--accent-light)', border:d.isToday?'':'1px solid var(--border)'}}/>
                <div className="bar-label" style={{fontWeight:d.isToday?700:400,color:d.isToday?'var(--accent)':'var(--text3)'}}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority & goals */}
        <div className="chart-card">
          <div className="chart-title">🎯 목표 & 우선순위</div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <span style={{fontSize:28,fontWeight:800,color:'var(--accent)'}}>{goals.length}</span>
            <span style={{fontSize:12,color:'var(--text3)'}}>진행 중인 목표</span>
          </div>
          {[['🔴 높음','high','var(--red)'],['🟡 보통','med','var(--amber)'],['⚪ 낮음','low','var(--text3)']].map(([label,key,color]) => (
            <div key={key} className="tag-stat-row">
              <span className="tag-stat-name">{label}</span>
              <div className="tag-stat-bar">
                <div className="tag-stat-fill" style={{width:`${priMap[key]/(active.length||1)*100}%`, background:color}}/>
              </div>
              <span className="tag-stat-num">{priMap[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tag breakdown */}
      {topTags.length > 0 && (
        <div className="chart-card" style={{marginBottom:12}}>
          <div className="chart-title">🏷 태그별 할일</div>
          {topTags.map(([tag,count]) => (
            <div key={tag} className="tag-stat-row">
              <span className="tag-stat-name">#{tag}</span>
              <div className="tag-stat-bar">
                <div className="tag-stat-fill" style={{width:`${count/maxTag*100}%`}}/>
              </div>
              <span className="tag-stat-num">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Habits summary */}
      {habits.length > 0 && (
        <div className="chart-card">
          <div className="chart-title">🔁 습관 요약</div>
          <div style={{display:'flex',gap:24,flexWrap:'wrap',marginTop:4}}>
            <div>
              <strong style={{fontSize:24,color:'var(--accent)'}}>{habits.length}</strong>
              <div style={{fontSize:11,color:'var(--text3)'}}>진행 중</div>
            </div>
            <div>
              <strong style={{fontSize:24,color:'var(--amber)'}}>🔥{totalStreak}</strong>
              <div style={{fontSize:11,color:'var(--text3)'}}>누적 스트릭</div>
            </div>
            <div>
              <strong style={{fontSize:24,color:'var(--blue)'}}>{habitsDoneToday}/{habits.length}</strong>
              <div style={{fontSize:11,color:'var(--text3)'}}>오늘 완료</div>
            </div>
          </div>
        </div>
      )}

      {/* Mindmap */}
      {goals.length > 0 && (
        <div className="chart-card">
          <div className="chart-title">🗺 목표 마인드맵</div>
          <Mindmap goals={goals} tasks={tasks} settings={settings}/>
        </div>
      )}
    </div>
  )
}
