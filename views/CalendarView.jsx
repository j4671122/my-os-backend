'use client'
import { useState, useEffect } from 'react'
import useStore from '@/store/useStore'
import { api } from '@/lib/apiClient'

const DAY_KO   = ['일','월','화','수','목','금','토']
const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function daysInMonth(y, m) { return new Date(y, m+1, 0).getDate() }
function firstDayOf(y, m)  { return new Date(y, m, 1).getDay() }
function ds(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` }

export default function CalendarView() {
  const { events: storeEvents } = useStore()
  const [date, setDate]         = useState(new Date())
  const [gcalEvents, setGcal]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [gcalError, setGcalError] = useState('')

  const y = date.getFullYear()
  const m = date.getMonth()
  const todayStr = new Date().toISOString().slice(0,10)

  useEffect(() => {
    setLoading(true)
    api.get('/api/gcal')
      .then(data => setGcal(Array.isArray(data) ? data : []))
      .catch(e => setGcalError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const allEvents = [...gcalEvents, ...storeEvents]

  function eventsOn(dateStr) {
    return allEvents.filter(e => {
      const s = e.start?.date || e.start?.dateTime?.slice(0,10) || e.date
      return s === dateStr
    })
  }

  const fd  = firstDayOf(y, m)
  const dim = daysInMonth(y, m)
  const cells = Array.from({length: fd + dim}, (_,i) => i < fd ? null : i - fd + 1)

  const upcoming = allEvents
    .filter(e => {
      const s = e.start?.date || e.start?.dateTime?.slice(0,10) || e.date || ''
      return s >= todayStr
    })
    .sort((a,b) => {
      const sa = a.start?.dateTime || a.start?.date || a.date || ''
      const sb = b.start?.dateTime || b.start?.date || b.date || ''
      return sa.localeCompare(sb)
    })
    .slice(0,12)

  return (
    <div style={{maxWidth:680,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <span style={{fontWeight:800,fontSize:16}}>📅 캘린더</span>
        {loading && <span style={{fontSize:11,color:'var(--text3)'}}>Google Calendar 로딩 중…</span>}
        {!loading && gcalError && <span style={{fontSize:11,color:'var(--text3)'}}>Google Calendar 미연동</span>}
      </div>

      {/* Month grid */}
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:16,marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <button className="btn btn-ghost btn-sm" onClick={() => setDate(new Date(y, m-1, 1))}>‹</button>
          <span style={{fontWeight:800,fontSize:15}}>{y}년 {MONTH_KO[m]}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setDate(new Date(y, m+1, 1))}>›</button>
        </div>

        {/* Day headers */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',textAlign:'center',marginBottom:6}}>
          {DAY_KO.map((d,i) => (
            <div key={i} style={{fontSize:10.5,fontWeight:700,padding:'3px 0',color:i===0?'var(--red)':i===6?'var(--blue)':'var(--text3)'}}>
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`}/>
            const dateStr  = ds(y, m, day)
            const isToday  = dateStr===todayStr
            const dayEvents = eventsOn(dateStr)
            const col = i%7
            return (
              <div key={dateStr} style={{
                minHeight:46,padding:'4px 5px',borderRadius:8,
                background:isToday?'var(--accent-light)':'transparent',
                border:isToday?'1.5px solid var(--accent)':'1px solid transparent',
              }}>
                <div style={{
                  fontSize:12,fontWeight:isToday?800:400,marginBottom:2,
                  color:isToday?'var(--accent)':col===0?'var(--red)':col===6?'var(--blue)':'var(--text)',
                }}>
                  {day}
                </div>
                {dayEvents.slice(0,2).map((e,j) => (
                  <div key={j} style={{
                    fontSize:9,background:'var(--blue)',color:'#fff',borderRadius:3,
                    padding:'1px 4px',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                  }}>
                    {e.summary||e.title||'일정'}
                  </div>
                ))}
                {dayEvents.length>2 && (
                  <div style={{fontSize:8.5,color:'var(--text3)',marginTop:1}}>+{dayEvents.length-2}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming list */}
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:16}}>
        <div style={{fontWeight:700,fontSize:13.5,marginBottom:12}}>예정된 일정</div>
        {upcoming.length===0 ? (
          <div style={{color:'var(--text3)',fontSize:12.5,padding:'20px 0',textAlign:'center'}}>
            {gcalError ? 'Google Calendar를 연동하면 일정을 볼 수 있어요' : '예정된 일정이 없어요'}
          </div>
        ) : (
          upcoming.map((e,i) => {
            const start  = e.start?.date || e.start?.dateTime?.slice(0,10) || e.date || ''
            const hasTime = !!e.start?.dateTime
            const time   = hasTime ? new Date(e.start.dateTime).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : ''
            const isToday = start===todayStr
            return (
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom: i<upcoming.length-1?'1px solid var(--border)':'none'}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:isToday?'var(--accent)':'var(--blue)',flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {e.summary||e.title||'일정'}
                  </div>
                  <div style={{fontSize:11,color:isToday?'var(--accent)':'var(--text3)',marginTop:1}}>
                    {isToday?'오늘':start} {time}
                  </div>
                </div>
                {e.location && (
                  <div style={{fontSize:11,color:'var(--text3)',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',maxWidth:100}}>
                    📍 {e.location}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
