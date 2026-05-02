'use client'
import { useState, useEffect, useRef } from 'react'

const PRESETS = [
  { label:'🎯 집중',      minutes:25, color:'#ef4444' },
  { label:'☕ 짧은 휴식', minutes:5,  color:'#3b82f6' },
  { label:'🌴 긴 휴식',   minutes:15, color:'#10b981' },
]

const SIZE = 220
const R    = 90
const CIRC = 2 * Math.PI * R

function pad(n) { return String(n).padStart(2,'0') }

export default function PomodoroView() {
  const [presetIdx, setPresetIdx] = useState(0)
  const [totalSecs, setTotalSecs] = useState(25*60)
  const [remaining, setRemaining] = useState(25*60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const [customModal, setCustomModal] = useState(false)
  const [customMin, setCustomMin] = useState('')
  const intervalRef = useRef(null)

  const preset = PRESETS[presetIdx]

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            setSessions(s => s+1)
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission==='granted') {
              new Notification('포모도로 완료! 🎉', { body:`${preset.label} 세션이 끝났어요` })
            }
            return 0
          }
          return r-1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, preset.label])

  function selectPreset(idx) {
    setPresetIdx(idx)
    setRunning(false)
    const secs = PRESETS[idx].minutes * 60
    setTotalSecs(secs)
    setRemaining(secs)
  }

  function applyCustom() {
    const m = parseInt(customMin)
    if (!m || m<1 || m>180) return
    setRunning(false)
    setTotalSecs(m*60)
    setRemaining(m*60)
    setCustomModal(false)
    setCustomMin('')
  }

  function reset() { setRunning(false); setRemaining(totalSecs) }

  const progress    = remaining / totalSecs
  const dashOffset  = CIRC * (1 - progress)
  const mins        = Math.floor(remaining/60)
  const secs        = remaining%60
  const halfSessions = Math.floor(sessions/4)

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'20px 0',maxWidth:420,margin:'0 auto'}}>
      <div style={{fontWeight:800,fontSize:16,marginBottom:20,alignSelf:'flex-start'}}>🍅 포모도로</div>

      {/* Preset buttons */}
      <div style={{display:'flex',gap:8,marginBottom:28,flexWrap:'wrap',justifyContent:'center'}}>
        {PRESETS.map((p,i) => (
          <button key={i} onClick={() => selectPreset(i)}
            className={`btn ${presetIdx===i?'btn-primary':'btn-ghost'} btn-sm`}
            style={presetIdx===i?{background:p.color,borderColor:p.color}:{}}>
            {p.label} {p.minutes}분
          </button>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={() => setCustomModal(true)}>⚙️ 커스텀</button>
      </div>

      {/* SVG circular timer */}
      <div style={{position:'relative',marginBottom:32}}>
        <svg width={SIZE} height={SIZE}>
          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="var(--surface2)" strokeWidth={14}/>
          <circle
            cx={SIZE/2} cy={SIZE/2} r={R}
            fill="none"
            stroke={preset.color}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
            style={{transition: running ? 'stroke-dashoffset .95s linear' : 'none'}}
          />
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4}}>
          <div style={{fontSize:46,fontWeight:800,letterSpacing:-2,fontVariantNumeric:'tabular-nums',lineHeight:1}}>
            {pad(mins)}:{pad(secs)}
          </div>
          <div style={{fontSize:12,color:'var(--text3)'}}>{preset.label}</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{display:'flex',gap:16,alignItems:'center',marginBottom:28}}>
        <button onClick={reset}
          style={{width:44,height:44,borderRadius:'50%',border:'1.5px solid var(--border)',background:'var(--surface)',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text2)'}}>
          ↺
        </button>
        <button onClick={() => setRunning(r => !r)}
          style={{width:68,height:68,borderRadius:'50%',border:'none',background:preset.color,color:'#fff',fontSize:26,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 8px 24px ${preset.color}55`,transition:'transform .1s'}}
          onMouseDown={e => e.currentTarget.style.transform='scale(.94)'}
          onMouseUp={e => e.currentTarget.style.transform='scale(1)'}>
          {running?'⏸':'▶'}
        </button>
        <div style={{width:44}}/>
      </div>

      {/* Session dots */}
      {sessions>0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center',marginBottom:8}}>
          {Array.from({length:Math.min(sessions,8)}, (_,i) => (
            <span key={i} style={{fontSize:18}}>{i%4===3?'🍅':'🔴'}</span>
          ))}
          <span style={{fontSize:12,color:'var(--text3)',alignSelf:'center',marginLeft:4}}>
            완료 {sessions}세션 {halfSessions>0&&`· 쉬는 시간 ${halfSessions}회`}
          </span>
        </div>
      )}

      {/* Notification permission */}
      {typeof window!=='undefined' && 'Notification' in window && Notification.permission==='default' && (
        <button className="btn btn-ghost btn-sm" style={{marginTop:8}} onClick={() => Notification.requestPermission()}>
          🔔 완료 알림 허용
        </button>
      )}

      {/* Custom modal */}
      {customModal && (
        <div className="overlay show" onClick={() => setCustomModal(false)}>
          <div className="modal" style={{width:280}} onClick={e => e.stopPropagation()}>
            <h3>커스텀 시간</h3>
            <div className="modal-field">
              <label>분 (1~180)</label>
              <input type="number" autoFocus min={1} max={180} value={customMin}
                onChange={e => setCustomMin(e.target.value)}
                onKeyDown={e => e.key==='Enter' && applyCustom()}
                placeholder="25"/>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setCustomModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={applyCustom}>적용</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
