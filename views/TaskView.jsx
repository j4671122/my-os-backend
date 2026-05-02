'use client'
import { useState, useRef } from 'react'
import useStore from '@/store/useStore'
import { api } from '@/lib/apiClient'

const today = () => new Date().toISOString().slice(0,10)
const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2,5)

const VIEW_TITLES = {
  today:     '📋 전체 할일',
  todayonly: '☀️ 오늘',
  inbox:     '📥 인박스',
  high:      '🔴 중요',
  done:      '✅ 완료',
}

export default function TaskView() {
  const { tasks, currentView, folders, goals, addTask, updateTask, removeTask, settings } = useStore()
  const [newTitle, setNewTitle]   = useState('')
  const [adding, setAdding]       = useState(false)
  const [openIds, setOpenIds]     = useState(new Set())
  const saveTimers = useRef({})

  // ── 뷰별 필터 ──
  const t = today()
  const visibleTasks = tasks.filter(tk => {
    if (currentView === 'done')      return tk.done
    if (currentView === 'inbox')     return !tk.done
    if (currentView === 'high')      return !tk.done && tk.priority === 'high'
    if (currentView === 'todayonly') return !tk.done && tk.due_date === t
    if (currentView === 'today')     return !tk.done && (tk.due_date === t || (tk.due_date && tk.due_date < t))
    if (currentView?.startsWith('folder-')) {
      return tk.folder_id === currentView.replace('folder-','') && !tk.done
    }
    return !tk.done
  })

  const overdue = tasks.filter(tk => !tk.done && tk.due_date && tk.due_date < t)

  // ── 할일 추가 ──
  async function handleAdd(e) {
    e.preventDefault()
    if (!newTitle.trim() || adding) return
    setAdding(true)
    try {
      const task = await api.post('/api/tasks', {
        title:    newTitle.trim(),
        priority: settings.defaultPriority || 'med',
        dueDate:  (currentView === 'today' || currentView === 'todayonly') ? t : null,
      })
      addTask(task)
      setNewTitle('')
    } catch(err) { alert(err.message) }
    finally { setAdding(false) }
  }

  // ── 완료 토글 ──
  async function toggleDone(task, e) {
    e?.stopPropagation()
    const done = !task.done
    updateTask(task.id, { done })
    await api.put(`/api/tasks?id=${task.id}`, { done, completedAt: done ? new Date().toISOString() : null })
  }

  // ── 삭제 ──
  async function handleDelete(id, e) {
    e?.stopPropagation()
    removeTask(id)
    await api.del(`/api/tasks?id=${id}`)
  }

  // ── accordion 토글 ──
  function toggleOpen(id) {
    setOpenIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── 필드 즉시 반영 + 디바운스 저장 ──
  function updateField(id, field, value) {
    updateTask(id, { [field]: value })
    clearTimeout(saveTimers.current[`${id}-${field}`])
    saveTimers.current[`${id}-${field}`] = setTimeout(() => {
      api.put(`/api/tasks?id=${id}`, { [field]: value }).catch(console.error)
    }, 600)
  }

  // ── 서브태스크 ──
  function addSubtask(task, text) {
    if (!text.trim()) return
    const subtasks = [...(task.subtasks||[]), { id:uid(), text:text.trim(), done:false }]
    updateField(task.id, 'subtasks', subtasks)
  }

  function toggleSubtask(task, sid) {
    const subtasks = (task.subtasks||[]).map(s => s.id===sid ? {...s, done:!s.done} : s)
    updateField(task.id, 'subtasks', subtasks)
  }

  function deleteSubtask(task, sid) {
    const subtasks = (task.subtasks||[]).filter(s => s.id!==sid)
    updateField(task.id, 'subtasks', subtasks)
  }

  // ── 태그 ──
  function addTag(task, tag) {
    const clean = tag.trim().replace(/^#/, '')
    if (!clean || (task.tags||[]).includes(clean)) return
    updateField(task.id, 'tags', [...(task.tags||[]), clean])
  }

  function removeTag(task, tag) {
    updateField(task.id, 'tags', (task.tags||[]).filter(t => t!==tag))
  }

  // ── 링크 ──
  function addLink(task, url) {
    if (!url.trim()) return
    const label = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
    const links = [...(task.links||[]), { id:uid(), url:url.trim(), label }]
    updateField(task.id, 'links', links)
  }

  function deleteLink(task, lid) {
    updateField(task.id, 'links', (task.links||[]).filter(l => l.id!==lid))
  }

  const prClass = { high:'pr-high', med:'pr-med', low:'pr-low' }

  return (
    <div className="task-view">
      {/* 기한 초과 배너 */}
      {(currentView==='today'||currentView==='todayonly') && overdue.length>0 && (
        <div style={{background:'#fde8e4',color:'var(--red)',borderRadius:'var(--r)',padding:'8px 14px',marginBottom:14,fontSize:12.5,fontWeight:600}}>
          ⚠️ 기한 초과 {overdue.length}개
        </div>
      )}

      {/* 할일 추가 */}
      {currentView!=='done' && (
        <form className="add-bar" onSubmit={handleAdd}>
          <input
            placeholder="+ 할일 추가…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
          />
          <button type="submit" className="add-btn" disabled={adding}>+</button>
        </form>
      )}

      {/* 할일 목록 */}
      {visibleTasks.length===0 && (
        <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text3)'}}>
          {currentView==='done' ? '완료한 할일이 없어요' : '할일이 없어요 🎉'}
        </div>
      )}

      {visibleTasks.map(task => {
        const isOpen = openIds.has(task.id)
        const subtasks = task.subtasks || []
        const subDone  = subtasks.filter(s => s.done).length
        const subPct   = subtasks.length ? Math.round(subDone/subtasks.length*100) : null

        return (
          <div key={task.id} className={`task-card ${task.done?'done-card':''} ${isOpen?'open':''}`}>
            {/* 카드 헤더 */}
            <div className="task-head" onClick={() => toggleOpen(task.id)}>
              <button className={`check-btn ${task.done?'chk':''}`} onClick={e => toggleDone(task, e)}>
                {task.done && '✓'}
              </button>
              <span className="task-title-text">{task.title}</span>
              <div className="task-right">
                {task.tags?.length>0 && (
                  <div className="task-tags">
                    {task.tags.slice(0,2).map(tg => (
                      <span key={tg} className="ttag" style={{background:'var(--surface2)',color:'var(--text3)'}}>#{tg}</span>
                    ))}
                  </div>
                )}
                {task.due_date && (
                  <span className={`due-label ${!task.done&&task.due_date<t?'overdue':''}`}>
                    {task.due_date===t?'오늘':task.due_date}
                  </span>
                )}
                <span className={`ttag ${prClass[task.priority||'med']}`}>
                  {task.priority==='high'?'높음':task.priority==='low'?'낮음':'보통'}
                </span>
                <span className="chevron">›</span>
              </div>
            </div>

            {/* 서브태스크 진행바 */}
            {subPct!==null && (
              <div className="sub-prog-bar">
                <div className="prog-track"><div className="prog-fill" style={{width:`${subPct}%`}}/></div>
              </div>
            )}

            {/* 상세 accordion */}
            <div className="task-detail">
              <div className="detail-inner">
                {/* 제목 편집 */}
                <input className="task-title-edit-inp"
                  defaultValue={task.title}
                  onChange={e => updateField(task.id, 'title', e.target.value)}
                  onClick={e => e.stopPropagation()}
                  placeholder="할일 이름"
                />

                {/* 옵션 행 */}
                <div className="opts-row">
                  <div className="opt-item">
                    <label>📅</label>
                    <input type="date" value={task.due_date||''} onChange={e => updateField(task.id,'due_date',e.target.value||null)}/>
                    {task.due_date && <button onClick={() => updateField(task.id,'due_date',null)} style={{border:'none',background:'none',cursor:'pointer',color:'var(--text3)',fontSize:11,padding:'2px 4px'}}>✕날짜</button>}
                  </div>
                  <div className="opt-item">
                    <label>🚦</label>
                    <select value={task.priority||'med'} onChange={e => updateField(task.id,'priority',e.target.value)}>
                      <option value="high">높음</option>
                      <option value="med">보통</option>
                      <option value="low">낮음</option>
                    </select>
                  </div>
                  {folders.length>0 && (
                    <div className="opt-item">
                      <label>📁</label>
                      <select value={task.folder_id||''} onChange={e => updateField(task.id,'folder_id',e.target.value||null)}>
                        <option value="">없음</option>
                        {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  )}
                  {goals.length>0 && (
                    <div className="opt-item">
                      <label>🎯</label>
                      <select value={task.goal_id||''} onChange={e => updateField(task.id,'goal_id',e.target.value||null)}>
                        <option value="">없음</option>
                        {goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                  )}
                  <button className="del-task-btn" onClick={e => handleDelete(task.id, e)}>🗑 삭제</button>
                </div>

                {/* 체크리스트 */}
                <SubtaskSection task={task} onToggle={toggleSubtask} onDelete={deleteSubtask} onAdd={addSubtask}/>

                {/* 태그 */}
                <TagSection task={task} onAdd={addTag} onRemove={removeTag}/>

                {/* 메모 */}
                <div>
                  <div className="ds-label">메모</div>
                  <textarea className="note-area"
                    defaultValue={task.notes||''}
                    onChange={e => updateField(task.id,'notes',e.target.value)}
                    onClick={e => e.stopPropagation()}
                    placeholder="메모를 입력하세요…"
                  />
                </div>

                {/* 링크 */}
                <LinkSection task={task} onAdd={addLink} onDelete={deleteLink}/>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 체크리스트 섹션 ──
function SubtaskSection({ task, onToggle, onDelete, onAdd }) {
  const [inp, setInp] = useState('')
  const subtasks = task.subtasks || []
  return (
    <div>
      <div className="ds-label">체크리스트 {subtasks.length>0&&`${subtasks.filter(s=>s.done).length}/${subtasks.length}`}</div>
      <div className="sub-list">
        {subtasks.map(s => (
          <div key={s.id} className="sub-item">
            <button className={`sub-ck ${s.done?'chk':''}`} onClick={e => { e.stopPropagation(); onToggle(task,s.id) }}>{s.done?'✓':''}</button>
            <span className={`sub-text ${s.done?'dk':''}`}>{s.text}</span>
            <button className="sub-del" onClick={e => { e.stopPropagation(); onDelete(task,s.id) }}>✕</button>
          </div>
        ))}
      </div>
      <div className="add-sub">
        <input value={inp} onChange={e => setInp(e.target.value)}
          onKeyDown={e => { if(e.key==='Enter'&&!e.nativeEvent.isComposing){onAdd(task,inp);setInp('')} }}
          onClick={e => e.stopPropagation()}
          placeholder="항목 추가…"/>
        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onAdd(task,inp); setInp('') }}>추가</button>
      </div>
    </div>
  )
}

// ── 태그 섹션 ──
function TagSection({ task, onAdd, onRemove }) {
  const [inp, setInp] = useState('')
  const tags = task.tags || []
  return (
    <div>
      <div className="ds-label">태그</div>
      <div className="task-tags" style={{marginBottom:6}}>
        {tags.map(tg => (
          <span key={tg} style={{display:'inline-flex',alignItems:'center',gap:3}}>
            <span className="ttag" style={{background:'var(--accent-light)',color:'var(--accent)'}}>#{tg}</span>
            <button onClick={e => { e.stopPropagation(); onRemove(task,tg) }}
              style={{border:'none',background:'none',cursor:'pointer',fontSize:10,color:'var(--text3)',padding:'0 1px'}}>✕</button>
          </span>
        ))}
      </div>
      <div className="tag-input-row">
        <input value={inp} onChange={e => setInp(e.target.value)}
          onKeyDown={e => { if(e.key==='Enter'&&!e.nativeEvent.isComposing){onAdd(task,inp);setInp('')} }}
          onClick={e => e.stopPropagation()}
          placeholder="#태그 추가"/>
      </div>
    </div>
  )
}

// ── 링크 섹션 ──
function LinkSection({ task, onAdd, onDelete }) {
  const [inp, setInp] = useState('')
  const links = task.links || []
  return (
    <div>
      <div className="ds-label">링크</div>
      <div className="link-list">
        {links.map(l => (
          <div key={l.id} className="link-item">
            <span>🔗</span>
            <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label||l.url}</a>
            <button className="link-del" onClick={e => { e.stopPropagation(); onDelete(task,l.id) }}>✕</button>
          </div>
        ))}
      </div>
      <div className="add-link">
        <input value={inp} onChange={e => setInp(e.target.value)}
          onKeyDown={e => { if(e.key==='Enter'&&!e.nativeEvent.isComposing){onAdd(task,inp);setInp('')} }}
          onClick={e => e.stopPropagation()}
          placeholder="https://…"/>
        <button onClick={e => { e.stopPropagation(); onAdd(task,inp); setInp('') }}>추가</button>
      </div>
    </div>
  )
}
