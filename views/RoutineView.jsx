'use client'
import { useState } from 'react'
import useStore from '@/store/useStore'

const DAYS = ['일','월','화','수','목','금','토']
const today = () => new Date().toISOString().slice(0,10)
const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2,5)

function RoutineSection({ title, icon, items, period, onAdd, onToggle, onDelete }) {
  const t = today()
  const todayDay = new Date().getDay()
  const todayItems = items.filter(r => r.days?.includes(todayDay))
  const done = todayItems.filter(r => r.checks?.includes(t)).length

  return (
    <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:16,marginBottom:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontWeight:800,fontSize:15}}>{icon} {title}</span>
          {todayItems.length>0 && (
            <span style={{fontSize:11,color:'var(--text3)',background:'var(--surface2)',padding:'2px 8px',borderRadius:10}}>
              {done}/{todayItems.length} 완료
            </span>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => onAdd(period)}>+ 추가</button>
      </div>

      {items.length===0 && (
        <div style={{color:'var(--text3)',fontSize:12,padding:'8px 0'}}>
          루틴을 추가해 매일 규칙적으로 해보세요
        </div>
      )}

      {items.map(r => {
        const isScheduledToday = r.days?.includes(todayDay)
        const isDone = r.checks?.includes(t)
        return (
          <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
            <button
              onClick={() => isScheduledToday && onToggle(r.id)}
              style={{
                width:22,height:22,borderRadius:'50%',flexShrink:0,
                border:`2px solid ${isDone?'var(--accent)':isScheduledToday?'var(--border2)':'var(--border)'}`,
                background:isDone?'var(--accent)':'none',
                cursor:isScheduledToday?'pointer':'default',
                display:'flex',alignItems:'center',justifyContent:'center',
                color:'#fff',fontSize:11,transition:'all .15s',
              }}>
              {isDone?'✓':''}
            </button>
            <div style={{flex:1}}>
              <div style={{
                fontSize:13.5,fontWeight:500,
                color:isDone?'var(--text3)':'var(--text)',
                textDecoration:isDone?'line-through':'none',
                marginBottom:4,
              }}>
                {r.name}
              </div>
              <div style={{display:'flex',gap:3}}>
                {DAYS.map((d,i) => (
                  <span key={i} style={{
                    width:18,height:18,borderRadius:4,
                    background:r.days?.includes(i)?'var(--accent-light)':'var(--surface2)',
                    color:r.days?.includes(i)?(i===todayDay?'var(--accent)':'var(--accent)'):'var(--text3)',
                    fontSize:9,fontWeight:r.days?.includes(i)?700:400,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    border:i===todayDay&&r.days?.includes(i)?'1px solid var(--accent)':'none',
                  }}>
                    {d}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={() => onDelete(r.id)}
              style={{border:'none',background:'none',cursor:'pointer',color:'var(--text3)',fontSize:13,padding:'2px 4px'}}>
              🗑
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default function RoutineView() {
  const { settings, setSetting } = useStore()
  const routines = settings.routines || []
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name:'', period:'morning', days:[1,2,3,4,5] })

  function openAdd(period) {
    setForm({ name:'', period, days:[1,2,3,4,5] })
    setModal(true)
  }

  function handleSave() {
    if (!form.name.trim()) return
    const r = { id:uid(), name:form.name.trim(), period:form.period, days:form.days, checks:[] }
    setSetting('routines', [...routines, r])
    setModal(null)
  }

  function toggleDay(d) {
    setForm(f => ({ ...f, days: f.days.includes(d) ? f.days.filter(x => x!==d) : [...f.days, d] }))
  }

  function toggleCheck(id) {
    const t = today()
    setSetting('routines', routines.map(r => {
      if (r.id!==id) return r
      const checks = r.checks?.includes(t) ? r.checks.filter(c => c!==t) : [...(r.checks||[]), t]
      return { ...r, checks }
    }))
  }

  function deleteRoutine(id) {
    setSetting('routines', routines.filter(r => r.id!==id))
  }

  return (
    <div style={{maxWidth:560,margin:'0 auto'}}>
      <div style={{fontWeight:800,fontSize:16,marginBottom:16}}>🔄 루틴</div>

      <RoutineSection
        title="아침 루틴" icon="🌅"
        items={routines.filter(r => r.period==='morning')}
        period="morning"
        onAdd={openAdd} onToggle={toggleCheck} onDelete={deleteRoutine}
      />
      <RoutineSection
        title="저녁 루틴" icon="🌙"
        items={routines.filter(r => r.period==='evening')}
        period="evening"
        onAdd={openAdd} onToggle={toggleCheck} onDelete={deleteRoutine}
      />

      {modal && (
        <div className="overlay show" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>루틴 추가</h3>
            <div className="modal-field">
              <label>이름</label>
              <input autoFocus value={form.name} onChange={e => setForm(f => ({...f,name:e.target.value}))}
                onKeyDown={e => e.key==='Enter' && handleSave()} placeholder="루틴 이름"/>
            </div>
            <div className="modal-field">
              <label>유형</label>
              <div style={{display:'flex',gap:8,marginTop:4}}>
                {[['morning','🌅 아침'],['evening','🌙 저녁']].map(([k,l]) => (
                  <button key={k} className={`btn ${form.period===k?'btn-primary':'btn-ghost'} btn-sm`}
                    onClick={() => setForm(f => ({...f,period:k}))}>{l}</button>
                ))}
              </div>
            </div>
            <div className="modal-field">
              <label>반복 요일</label>
              <div style={{display:'flex',gap:5,marginTop:6}}>
                {DAYS.map((d,i) => (
                  <button key={i} onClick={() => toggleDay(i)} style={{
                    width:32,height:32,borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,
                    border:`1.5px solid ${form.days.includes(i)?'var(--accent)':'var(--border)'}`,
                    background:form.days.includes(i)?'var(--accent-light)':'var(--surface)',
                    color:form.days.includes(i)?'var(--accent)':'var(--text3)',
                  }}>{d}</button>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>취소</button>
              <button className="btn btn-primary" onClick={handleSave}>추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
