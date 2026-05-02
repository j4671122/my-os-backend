'use client'
import { useState } from 'react'
import useStore from '@/store/useStore'
import { api } from '@/lib/apiClient'

const EMOJIS = ['🔥','💪','🧘','📚','🏃','💧','🎯','🌟','✍️','🎵','🍎','😴','🧹','🎨','🤸']
const DAY_LABELS = ['일','월','화','수','목','금','토']
const today = () => new Date().toISOString().slice(0,10)

function last7() {
  return Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-6+i)
    return d.toISOString().slice(0,10)
  })
}

function calcStreak(checks) {
  let s = 0
  const d = new Date()
  while (true) {
    const ds = d.toISOString().slice(0,10)
    if (checks.includes(ds)) { s++; d.setDate(d.getDate()-1) } else break
  }
  return s
}

export default function HabitsView() {
  const { habits, addHabit, updateHabit, removeHabit } = useStore()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name:'', emoji:'🔥' })
  const [saving, setSaving] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      const h = await api.post('/api/habits', { name:`${form.emoji} ${form.name.trim()}`, sortOrder:habits.length })
      addHabit(h)
      setForm({ name:'', emoji:'🔥' })
      setAdding(false)
    } catch(e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function toggleToday(habit) {
    const t = today()
    const checks = habit.checks?.includes(t)
      ? habit.checks.filter(d => d!==t)
      : [...(habit.checks||[]), t]
    const streak = calcStreak(checks)
    updateHabit(habit.id, { checks, streak })
    await api.put(`/api/habits?id=${habit.id}`, { checks, streak })
  }

  async function handleDelete(id) {
    removeHabit(id)
    await api.del(`/api/habits?id=${id}`)
  }

  const days = last7()
  const t = today()

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <span style={{fontWeight:800,fontSize:16}}>🔁 습관</span>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(v => !v)}>
          {adding ? '취소' : '+ 습관 추가'}
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
            {EMOJIS.map(e => (
              <span key={e} onClick={() => setForm(f => ({...f,emoji:e}))}
                style={{fontSize:22,cursor:'pointer',opacity:form.emoji===e?1:.3,transition:'opacity .15s',lineHeight:1}}>
                {e}
              </span>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}>
            <input
              style={{flex:1,border:'1.5px solid var(--border)',borderRadius:8,padding:'8px 12px',fontSize:13.5,fontFamily:'inherit',outline:'none',background:'var(--surface)',color:'var(--text)'}}
              placeholder="습관 이름 (예: 물 2리터 마시기)"
              value={form.name}
              onChange={e => setForm(f => ({...f,name:e.target.value}))}
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={saving}>추가</button>
          </div>
        </form>
      )}

      {habits.length === 0 && !adding && (
        <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text3)'}}>
          습관을 추가해 매일 꾸준히 해보세요 💪
        </div>
      )}

      <div className="habit-grid">
        {habits.map(h => {
          const isDone = h.checks?.includes(t)
          const streak = h.streak || 0
          const streakColor = streak>=14?'#f59e0b':streak>=7?'#ef4444':streak>=3?'#3b82f6':'var(--accent)'
          return (
            <div key={h.id} className="habit-row">
              <div className="habit-header">
                <span className="habit-name">{h.name}</span>
                {streak>0 && <span className="streak-badge" style={{background:streakColor}}>🔥 {streak}일</span>}
                <button onClick={() => handleDelete(h.id)}
                  style={{border:'none',background:'none',cursor:'pointer',fontSize:13,color:'var(--text3)',marginLeft:4}}>🗑</button>
              </div>

              <div className="habit-days" style={{justifyContent:'space-between'}}>
                {days.map(d => {
                  const done = h.checks?.includes(d)
                  const isToday = d===t
                  const dow = new Date(d+'T00:00').getDay()
                  return (
                    <div key={d} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,flex:1}}>
                      <div className={`hd-cell vine ${done?'done':''} ${isToday?'today':''}`}
                        onClick={() => isToday && toggleToday(h)}
                        style={{cursor:isToday?'pointer':'default'}}>
                        {done?'✓':isToday?'·':''}
                      </div>
                      <span style={{fontSize:9,color:isToday?'var(--accent)':'var(--text3)',fontWeight:isToday?700:400}}>
                        {DAY_LABELS[dow]}
                      </span>
                    </div>
                  )
                })}
              </div>

              <button className={`habit-today-btn ${isDone?'done':''}`} style={{marginTop:10,width:'100%'}} onClick={() => toggleToday(h)}>
                {isDone?'✅ 오늘 완료!':'오늘 체크하기'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
