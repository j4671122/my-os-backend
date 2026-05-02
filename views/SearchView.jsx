'use client'
import { useState } from 'react'
import useStore from '@/store/useStore'

const FILTERS = [
  { key:'all',  label:'전체' },
  { key:'task', label:'📋 할일' },
  { key:'goal', label:'🎯 목표' },
  { key:'memo', label:'📝 메모' },
]

export default function SearchView() {
  const { tasks, goals, settings } = useStore()
  const memos = settings.memos || []
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')

  const qLow = q.toLowerCase().trim()
  const show  = qLow.length > 0

  const results = []
  if (show) {
    if (filter==='all'||filter==='task') {
      tasks
        .filter(t => t.title.toLowerCase().includes(qLow) || (t.notes||'').toLowerCase().includes(qLow))
        .forEach(t => results.push({ type:'task', id:t.id, title:t.title, sub:t.due_date||'', done:t.done, priority:t.priority }))
    }
    if (filter==='all'||filter==='goal') {
      goals
        .filter(g => g.name.toLowerCase().includes(qLow) || (g.description||'').toLowerCase().includes(qLow))
        .forEach(g => results.push({ type:'goal', id:g.id, title:g.name, sub:g.description||'' }))
    }
    if (filter==='all'||filter==='memo') {
      memos
        .filter(m => (m.title||'').toLowerCase().includes(qLow) || (m.body||'').toLowerCase().includes(qLow))
        .forEach(m => results.push({ type:'memo', id:m.id, title:m.title||'(제목 없음)', sub:(m.body||'').slice(0,60) }))
    }
  }

  const typeLabel = { task:'할일', goal:'목표', memo:'메모' }
  const typeIcon  = { task:'📋', goal:'🎯', memo:'📝' }
  const priBadge  = { high:'pr-high', med:'pr-med', low:'pr-low' }

  return (
    <div>
      <div className="search-bar">
        <span style={{fontSize:16,color:'var(--text3)'}}>🔍</span>
        <input
          autoFocus
          placeholder="할일, 목표, 메모 검색…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        {q && (
          <button onClick={() => setQ('')}
            style={{border:'none',background:'none',cursor:'pointer',color:'var(--text3)',fontSize:14,padding:'0 2px'}}>
            ✕
          </button>
        )}
      </div>

      <div className="filter-bar">
        {FILTERS.map(f => (
          <button key={f.key} className={`filter-btn ${filter===f.key?'active':''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {!show && (
        <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text3)'}}>
          검색어를 입력하세요
        </div>
      )}
      {show && results.length===0 && (
        <div style={{textAlign:'center',padding:'40px 20px',color:'var(--text3)'}}>
          &ldquo;{q}&rdquo;에 대한 결과가 없어요
        </div>
      )}

      {results.map(r => (
        <div key={`${r.type}-${r.id}`}
          style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'11px 14px',marginBottom:6,display:'flex',gap:10,alignItems:'flex-start'}}>
          <span style={{fontSize:16,flexShrink:0,lineHeight:'1.6'}}>{typeIcon[r.type]}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13.5,fontWeight:500,color:r.done?'var(--text3)':'var(--text)',textDecoration:r.done?'line-through':'none',marginBottom:r.sub?3:0}}>
              {r.title}
            </div>
            {r.sub && <div style={{fontSize:11.5,color:'var(--text3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.sub}</div>}
          </div>
          <div style={{display:'flex',gap:5,alignItems:'center',flexShrink:0}}>
            {r.type==='task' && r.priority && (
              <span className={`ttag ${priBadge[r.priority]}`}>
                {r.priority==='high'?'높음':r.priority==='med'?'보통':'낮음'}
              </span>
            )}
            <span style={{fontSize:10.5,color:'var(--text3)',padding:'2px 7px',background:'var(--surface2)',borderRadius:10}}>
              {typeLabel[r.type]}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
