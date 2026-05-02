'use client'
import { useState } from 'react'
import useStore from '@/store/useStore'

// 4am → 3am (next day): 24 hours
const HOURS = Array.from({length:24}, (_,i) => (i+4)%24)
const MINS  = [0,10,20,30,40,50]

const DEFAULT_LABELS = [
  { id:'study',  name:'공부',  color:'#3b82f6' },
  { id:'work',   name:'업무',  color:'#8b5cf6' },
  { id:'rest',   name:'휴식',  color:'#10b981' },
  { id:'health', name:'운동',  color:'#f59e0b' },
  { id:'etc',    name:'기타',  color:'#6b7280' },
]

function todayKey() { return new Date().toISOString().slice(0,10) }
function cellKey(h,m) { return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` }

export default function TimeTrackerView() {
  const { settings, setSetting } = useStore()
  const labels    = settings.timeTrackerLabels?.length ? settings.timeTrackerLabels : DEFAULT_LABELS
  const data      = settings.timeTrackerData   || {}
  const selLabel  = settings.timeTrackerSelectedLabel || labels[0]?.id
  const todayData = data[todayKey()] || {}

  const [sideCollapsed, setSideCollapsed] = useState(false)
  const [labelModal, setLabelModal]       = useState(false)
  const [labelForm, setLabelForm]         = useState({ name:'', color:'#3b82f6' })

  function toggleCell(h, m) {
    const k  = cellKey(h,m)
    const dk = todayKey()
    const day = { ...(data[dk]||{}) }
    if (day[k]===selLabel) delete day[k]
    else day[k] = selLabel
    setSetting('timeTrackerData', { ...data, [dk]: day })
  }

  function addLabel() {
    if (!labelForm.name.trim()) return
    const l = { id:Date.now().toString(36), name:labelForm.name.trim(), color:labelForm.color }
    setSetting('timeTrackerLabels', [...labels, l])
    setLabelForm({ name:'', color:'#3b82f6' })
    setLabelModal(false)
  }

  function deleteLabel(id) {
    setSetting('timeTrackerLabels', labels.filter(l => l.id!==id))
    if (selLabel===id) setSetting('timeTrackerSelectedLabel', labels.find(l => l.id!==id)?.id || '')
  }

  // Summary
  const summary = {}
  Object.values(todayData).forEach(lid => { summary[lid]=(summary[lid]||0)+1 })
  const totalCells = Object.values(summary).reduce((a,b) => a+b, 0)

  return (
    <div className="tt-layout">
      {/* Board */}
      <div>
        <button className="tt-side-toggle" onClick={() => setSideCollapsed(v => !v)}>
          {sideCollapsed ? '▼ 라벨 패널 열기' : '▲ 라벨 패널 닫기'}
        </button>
        <div className="tt-board">
          <div className="tt-head">
            <div className="tt-nav">
              <span style={{fontWeight:800,fontSize:14}}>⏱ 타임 트래커</span>
            </div>
            <span style={{fontSize:12,color:'var(--text3)'}}>{todayKey()}</span>
          </div>
          <div className="tt-grid-wrap">
            <div className="tt-grid">
              {/* Column headers */}
              <div className="tt-min" style={{background:'var(--surface2)'}}></div>
              {MINS.map(m => (
                <div key={m} className="tt-min">{m===0?':00':`+${m}`}</div>
              ))}
              {/* Rows */}
              {HOURS.map(h => [
                <div key={`t-${h}`} className="tt-time">{String(h).padStart(2,'0')}:00</div>,
                ...MINS.map(m => {
                  const k   = cellKey(h,m)
                  const lid = todayData[k]
                  const lbl = labels.find(l => l.id===lid)
                  return (
                    <div key={`${h}-${m}`} className="tt-cell"
                      style={lbl ? { background:`${lbl.color}28` } : {}}
                      onClick={() => toggleCell(h,m)}
                      title={`${cellKey(h,m)} — ${lbl?lbl.name:'클릭해서 기록'}`}>
                      {lbl && <div className="tt-cell-label" style={{color:lbl.color,fontWeight:700}}>{lbl.name}</div>}
                    </div>
                  )
                }),
              ])}
            </div>
          </div>
        </div>
      </div>

      {/* Side panel */}
      <div className={`tt-side ${sideCollapsed?'collapsed':''}`}>
        <h4>🏷 라벨 선택</h4>
        <div className="tt-label-list">
          {labels.map(l => (
            <div key={l.id} className={`tt-label ${selLabel===l.id?'active':''}`}
              onClick={() => setSetting('timeTrackerSelectedLabel',l.id)}>
              <div className="tt-label-color" style={{background:l.color}}/>
              <span className="tt-label-name">{l.name}</span>
              <div className="tt-label-acts">
                <button onClick={e => { e.stopPropagation(); deleteLabel(l.id) }} title="삭제">🗑</button>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" style={{width:'100%',marginBottom:16}} onClick={() => setLabelModal(true)}>
          + 라벨 추가
        </button>

        <h4>📊 오늘 요약</h4>
        <div className="tt-summary">
          {labels.filter(l => summary[l.id]).map(l => (
            <div key={l.id} className="tt-summary-row">
              <div style={{width:10,height:10,borderRadius:'50%',background:l.color,flexShrink:0}}/>
              <span style={{fontSize:11.5,color:'var(--text2)',width:44,flexShrink:0}}>{l.name}</span>
              <div className="tt-summary-bar">
                <div className="tt-summary-fill" style={{width:`${summary[l.id]/(totalCells||1)*100}%`,background:l.color}}/>
              </div>
              <span style={{fontSize:10.5,color:'var(--text3)',flexShrink:0,minWidth:30,textAlign:'right'}}>
                {summary[l.id]*10}분
              </span>
            </div>
          ))}
          {totalCells===0 && (
            <div style={{fontSize:11.5,color:'var(--text3)'}}>셀을 클릭해 시간을 기록하세요</div>
          )}
          {totalCells>0 && (
            <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>총 {totalCells*10}분 기록됨</div>
          )}
        </div>
      </div>

      {labelModal && (
        <div className="overlay show" onClick={() => setLabelModal(false)}>
          <div className="modal" style={{width:280}} onClick={e => e.stopPropagation()}>
            <h3>라벨 추가</h3>
            <div className="modal-field">
              <label>이름</label>
              <input autoFocus value={labelForm.name} onChange={e => setLabelForm(f => ({...f,name:e.target.value}))}
                onKeyDown={e => e.key==='Enter' && addLabel()} placeholder="라벨 이름"/>
            </div>
            <div className="modal-field">
              <label>색상</label>
              <input type="color" value={labelForm.color} onChange={e => setLabelForm(f => ({...f,color:e.target.value}))}
                style={{width:'100%',height:38,border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',padding:2}}/>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setLabelModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={addLabel}>추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
