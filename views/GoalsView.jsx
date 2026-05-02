'use client'
import { useState } from 'react'
import useStore from '@/store/useStore'
import { api } from '@/lib/apiClient'

const COLORS = ['#2c5f2e','#2563eb','#7c3aed','#d97706','#dc2626','#0891b2','#be185d']

export default function GoalsView() {
  const { goals, tasks, addGoal, updateGoal, removeGoal } = useStore()
  const [expanded, setExpanded] = useState({})
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name:'', type:'global', desc:'', color:'#2c5f2e', targetDate:'' })
  const [saving, setSaving] = useState(false)

  const globals  = goals.filter(g => g.type === 'global')
  const projects = goals.filter(g => g.type === 'project')

  function goalPct(goalId) {
    const linked = tasks.filter(t => t.goal_id === goalId)
    if (!linked.length) return 0
    return Math.round(linked.filter(t => t.done).length / linked.length * 100)
  }

  function openAdd(type) {
    setForm({ name:'', type, desc:'', color: type==='global'?'#2c5f2e':'#2563eb', targetDate:'' })
    setModal({ mode:'add' })
  }

  function openEdit(goal) {
    setForm({ name:goal.name, type:goal.type, desc:goal.description||'', color:goal.color||'#2c5f2e', targetDate:goal.target_date||'' })
    setModal({ mode:'edit', goal })
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      if (modal.mode === 'add') {
        const g = await api.post('/api/goals', { name:form.name.trim(), type:form.type, desc:form.desc, color:form.color, targetDate:form.targetDate })
        addGoal(g)
      } else {
        const g = await api.put(`/api/goals?id=${modal.goal.id}`, { name:form.name.trim(), type:form.type, desc:form.desc, color:form.color, targetDate:form.targetDate })
        updateGoal(modal.goal.id, g)
      }
      setModal(null)
    } catch(e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('목표를 삭제할까요?')) return
    removeGoal(id)
    await api.del(`/api/goals?id=${id}`)
  }

  return (
    <div className="gh-wrap">
      <div className="gh-toolbar">
        <span style={{fontWeight:800,fontSize:16}}>🎯 목표</span>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={() => openAdd('project')}>+ 프로젝트</button>
          <button className="btn btn-primary btn-sm" onClick={() => openAdd('global')}>+ 큰 목표</button>
        </div>
      </div>

      {goals.length === 0 && (
        <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text3)'}}>
          목표를 추가해서 할일을 연결해보세요 🎯
        </div>
      )}

      {/* Global goals */}
      {globals.map(g => {
        const isOpen = expanded[g.id] !== false
        const p = goalPct(g.id)
        return (
          <div key={g.id} className="gh-global">
            <div className="gh-global-hdr" onClick={() => setExpanded(e => ({...e, [g.id]: !isOpen}))}>
              <span className="gh-chevron" style={{transform:isOpen?'rotate(90deg)':'rotate(0deg)'}}>▶</span>
              <span className="gh-gl-ico">🌐</span>
              <div className="gh-gl-info">
                <div className="gh-gl-name">{g.name}</div>
                {g.description && <div className="gh-gl-desc">{g.description}</div>}
                <div className="gh-prog-row">
                  <div className="gh-prog-track">
                    <div className="gh-prog-fill" style={{width:`${p}%`, background:g.color||'var(--accent)'}}/>
                  </div>
                  <span className="gh-prog-pct">{p}%</span>
                </div>
              </div>
              <div className="gh-gl-acts" onClick={e => e.stopPropagation()}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(g)}>✏️</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(g.id)}>🗑</button>
              </div>
            </div>
            {isOpen && (
              <div className="gh-body">
                {tasks.filter(t => t.goal_id === g.id).length > 0 ? (
                  tasks.filter(t => t.goal_id === g.id).map(t => (
                    <div key={t.id} className={`gh-task-row ${t.done?'task-done':''}`}>
                      <div className={`gh-check ${t.done?'done':''}`} style={{background:t.done?g.color||'var(--accent)':'',borderColor:t.done?g.color||'var(--accent)':'var(--border)'}}>
                        {t.done?'✓':''}
                      </div>
                      <span className={`gh-task-title ${t.done?'done':''}`}>{t.title}</span>
                      {t.priority==='high' && <span className="gh-badge pr-high">높음</span>}
                    </div>
                  ))
                ) : (
                  <div className="gh-empty">연결된 할일 없음 — 할일 편집에서 목표를 연결하세요</div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Project goals */}
      {projects.length > 0 && (
        <div className="gh-unlinked" style={{marginTop:12}}>
          <div className="gh-unlinked-hdr" onClick={() => setExpanded(e => ({...e, _projects: !e._projects}))}>
            📁 프로젝트 ({projects.length})
          </div>
          {expanded._projects !== false && projects.map(g => {
            const p = goalPct(g.id)
            return (
              <div key={g.id} className="gh-project">
                <div className="gh-proj-hdr">
                  <span style={{width:9,height:9,borderRadius:'50%',background:g.color||'var(--blue)',flexShrink:0,display:'inline-block'}}/>
                  <span className="gh-proj-name">{g.name}</span>
                  <span style={{fontSize:11,color:'var(--text3)',marginRight:6}}>{p}%</span>
                  <div className="gh-proj-acts">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(g)}>✏️</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(g.id)}>🗑</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div className="overlay show" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{modal.mode==='add' ? '목표 추가' : '목표 수정'}</h3>
            <div className="modal-field">
              <label>유형</label>
              <div style={{display:'flex',gap:8,marginTop:4}}>
                {[['global','🌐 큰 목표'],['project','📁 프로젝트']].map(([k,l]) => (
                  <button key={k} className={`btn ${form.type===k?'btn-primary':'btn-ghost'} btn-sm`} onClick={() => setForm(f => ({...f, type:k}))}>{l}</button>
                ))}
              </div>
            </div>
            <div className="modal-field">
              <label>이름</label>
              <input autoFocus value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} onKeyDown={e => e.key==='Enter' && handleSave()} placeholder="목표 이름"/>
            </div>
            <div className="modal-field">
              <label>설명 (선택)</label>
              <textarea value={form.desc} onChange={e => setForm(f => ({...f, desc:e.target.value}))} placeholder="목표에 대한 설명"/>
            </div>
            <div className="modal-field">
              <label>마감일</label>
              <input type="date" value={form.targetDate} onChange={e => setForm(f => ({...f, targetDate:e.target.value}))}/>
            </div>
            <div className="modal-field">
              <label>색상</label>
              <div className="color-row">
                {COLORS.map(c => (
                  <div key={c} className={`color-dot ${form.color===c?'sel':''}`} style={{background:c}} onClick={() => setForm(f => ({...f, color:c}))}/>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>취소</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'저장 중…':'저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
