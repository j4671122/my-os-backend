'use client'
import { useState } from 'react'
import useStore from '@/store/useStore'

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6) }

export default function MemosView() {
  const { settings, setSetting } = useStore()
  const memos = settings.memos || []
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ title:'', body:'', tags:'' })
  const [search, setSearch] = useState('')

  function openAdd() {
    setForm({ title:'', body:'', tags:'' })
    setModal({ mode:'add' })
  }

  function openEdit(memo) {
    setForm({ title:memo.title||'', body:memo.body||'', tags:(memo.tags||[]).join(', ') })
    setModal({ mode:'edit', memo })
  }

  function handleSave() {
    if (!form.body.trim() && !form.title.trim()) return
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    if (modal.mode==='add') {
      const m = { id:uid(), title:form.title, body:form.body, tags, createdAt:new Date().toISOString() }
      setSetting('memos', [m, ...memos])
    } else {
      setSetting('memos', memos.map(m => m.id===modal.memo.id ? {...m, title:form.title, body:form.body, tags} : m))
    }
    setModal(null)
  }

  function handleDelete(id, e) {
    e.stopPropagation()
    setSetting('memos', memos.filter(m => m.id!==id))
  }

  const filtered = search.trim()
    ? memos.filter(m => {
        const q = search.toLowerCase()
        return (m.title||'').toLowerCase().includes(q) || (m.body||'').toLowerCase().includes(q)
      })
    : memos

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <span style={{fontWeight:800,fontSize:16}}>📝 메모</span>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ 메모 추가</button>
      </div>

      <div className="search-bar" style={{marginBottom:16}}>
        <span style={{color:'var(--text3)'}}>🔍</span>
        <input placeholder="메모 검색…" value={search} onChange={e => setSearch(e.target.value)}/>
        {search && <button onClick={() => setSearch('')} style={{border:'none',background:'none',cursor:'pointer',color:'var(--text3)',fontSize:14}}>✕</button>}
      </div>

      {filtered.length===0 && (
        <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text3)'}}>
          {search ? `"${search}"에 대한 메모가 없어요` : '메모를 추가해보세요 ✍️'}
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
        {filtered.map(m => (
          <div key={m.id}
            onClick={() => openEdit(m)}
            style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:14,cursor:'pointer',position:'relative',transition:'border-color .15s,box-shadow .15s'}}
            onMouseEnter={e => e.currentTarget.style.borderColor='var(--border2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
          >
            {m.title && (
              <div style={{fontWeight:700,fontSize:13.5,marginBottom:6,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {m.title}
              </div>
            )}
            <div style={{fontSize:12.5,color:'var(--text2)',lineHeight:1.6,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:4,WebkitBoxOrient:'vertical',whiteSpace:'pre-wrap'}}>
              {m.body}
            </div>
            {m.tags?.length>0 && (
              <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:8}}>
                {m.tags.map(t => (
                  <span key={t} style={{fontSize:10.5,background:'var(--accent-light)',color:'var(--accent)',padding:'1px 7px',borderRadius:10,fontWeight:600}}>
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <div style={{fontSize:10,color:'var(--text3)',marginTop:8}}>{m.createdAt?.slice(0,10)}</div>
            <button
              onClick={e => handleDelete(m.id, e)}
              style={{position:'absolute',top:8,right:8,background:'none',border:'none',cursor:'pointer',fontSize:13,color:'var(--text3)',opacity:.7,lineHeight:1}}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {modal && (
        <div className="overlay show" onClick={() => setModal(null)}>
          <div className="modal" style={{width:480}} onClick={e => e.stopPropagation()}>
            <h3>{modal.mode==='add'?'메모 추가':'메모 수정'}</h3>
            <div className="modal-field">
              <label>제목 (선택)</label>
              <input value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))} placeholder="제목"/>
            </div>
            <div className="modal-field">
              <label>내용</label>
              <textarea
                value={form.body}
                onChange={e => setForm(f => ({...f,body:e.target.value}))}
                placeholder="내용을 입력하세요…"
                style={{minHeight:160}}
                autoFocus={modal.mode==='add'}
                onKeyDown={e => e.key==='Enter' && e.metaKey && handleSave()}
              />
            </div>
            <div className="modal-field">
              <label>태그 (쉼표로 구분)</label>
              <input value={form.tags} onChange={e => setForm(f => ({...f,tags:e.target.value}))} placeholder="공부, 아이디어, 일상"/>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>취소</button>
              <button className="btn btn-primary" onClick={handleSave}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
