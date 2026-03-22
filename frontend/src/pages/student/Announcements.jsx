import { useState, useEffect } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import Loader from '../../components/Loader'

const TYPE_STYLE = {
  attendance_alert:    { icon:'⚠',  color:'var(--red)',    bg:'rgba(248,113,113,0.08)',  label:'Attendance Alert' },
  assignment_reminder: { icon:'📋', color:'var(--gold)',   bg:'rgba(251,191,36,0.08)',   label:'Assignment Reminder' },
  marks_drop:          { icon:'📉', color:'var(--purple)', bg:'rgba(147,51,234,0.08)',   label:'Marks Drop Alert' },
  '':                  { icon:'📢', color:'var(--teal)',   bg:'rgba(45,212,191,0.06)',   label:'Announcement' },
}

export default function StudentAnnouncements() {
  const [anns,    setAnns]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  const load = () =>
    api.get('/announcements/mine?_t=' + Date.now()).then(r => setAnns(r.data || [])).catch(()=>{})

  const clearMyAlerts = async () => {
    if (!window.confirm('Clear all automated alerts and reminders?')) return
    try {
      await api.delete('/announcements/clear-auto-for-me')
      setAnns(prev => prev.filter(a => !a.is_automated))
    } catch(e) { alert('Failed to clear') }
  }

  useEffect(() => {
    api.get('/announcements/mine?_t=' + Date.now())
      .then(r => setAnns(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))

    // Refresh when tab becomes visible
    const onVisible = () => {
      if (document.visibilityState === 'visible')
        api.get('/announcements/mine?_t=' + Date.now()).then(r => setAnns(r.data || [])).catch(()=>{})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (loading) return <Loader text="Loading announcements..." />

  const alerts    = anns.filter(a => a.auto_type === 'attendance_alert')
  const reminders = anns.filter(a => a.auto_type === 'assignment_reminder')
  const marksDrop = anns.filter(a => a.auto_type === 'marks_drop')
  const regular   = anns.filter(a => !a.auto_type)
  const allAuto   = anns.filter(a => a.is_automated)

  const displayed = filter === 'all'      ? anns
                  : filter === 'alerts'   ? alerts
                  : filter === 'reminder' ? reminders
                  : filter === 'marks'    ? marksDrop
                  : regular

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Header stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}} className="fade-up">
        {[
          {label:'All',          val:anns.length,      clr:'var(--purple)', key:'all'},
          {label:'⚠ Alerts',    val:alerts.length,    clr:'var(--red)',    key:'alerts'},
          {label:'📋 Reminders', val:reminders.length, clr:'var(--gold)',   key:'reminder'},
          {label:'📉 Marks Drop',val:marksDrop.length, clr:'var(--purple)', key:'marks'},
          {label:'📢 General',   val:regular.length,   clr:'var(--teal)',   key:'general'},
        ].map(s => (
          <div key={s.key} onClick={()=>setFilter(s.key)}
            className="card" style={{padding:'14px 16px',cursor:'pointer',
              borderTop:'3px solid '+(filter===s.key?s.clr:'transparent'),
              opacity:filter===s.key||filter==='all'?1:0.7,transition:'all 0.2s'}}>
            <div style={{fontSize:24,fontWeight:800,color:s.clr,fontFamily:'var(--font-display)'}}>{s.val}</div>
            <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--font-mono)',
              textTransform:'uppercase',marginTop:4}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Unread alerts banner + clear button */}
      {(alerts.length > 0 || reminders.length > 0) && filter === 'all' && (
        <div style={{padding:'12px 16px',borderRadius:12,display:'flex',
          justifyContent:'space-between',alignItems:'center',gap:12,
          background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.25)'}}
          className="fade-up">
          <div style={{fontSize:13,color:'var(--red)',fontWeight:600}}>
            {alerts.length > 0 && <span>⚠ {alerts.length} attendance alert{alerts.length>1?'s':''}</span>}
            {alerts.length > 0 && reminders.length > 0 && <span> · </span>}
            {reminders.length > 0 && <span>📋 {reminders.length} assignment reminder{reminders.length>1?'s':''}</span>}
          </div>
          <button onClick={clearMyAlerts}
            style={{fontSize:11,padding:'4px 12px',borderRadius:8,cursor:'pointer',flexShrink:0,
              background:'var(--red)',color:'white',border:'none',fontWeight:600}}>
            ✕ Clear Alerts
          </button>
        </div>
      )}

      {/* List */}
      {displayed.length === 0 && (
        <div className="empty">No announcements yet</div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {displayed.map((a, i) => {
          const style = TYPE_STYLE[a.auto_type || ''] || TYPE_STYLE['']
          return (
            <div key={i} className="card fade-up" style={{
              borderLeft:`4px solid ${style.color}`,
              background: a.is_automated ? style.bg : 'var(--card-bg)'}}>
              <div style={{padding:'14px 18px'}}>
                <div style={{display:'flex',justifyContent:'space-between',
                  alignItems:'flex-start',gap:12,marginBottom:8}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:6,flexWrap:'wrap'}}>
                      {a.is_automated && (
                        <span style={{fontSize:10,fontWeight:700,color:style.color,
                          fontFamily:'var(--font-mono)',padding:'2px 8px',borderRadius:20,
                          background:style.bg,border:`1px solid ${style.color}44`}}>
                          {style.icon} {style.label}
                        </span>
                      )}
                      {a.priority === 'high' && !a.is_automated && (
                        <span className="badge badge-red" style={{fontSize:10}}>High Priority</span>
                      )}
                      {a.class_name && (
                        <span className="badge badge-purple" style={{fontSize:10}}>{a.class_name}</span>
                      )}
                    </div>
                    <div style={{fontSize:15,fontWeight:700,color:'var(--text1)',lineHeight:1.3}}>
                      {a.title}
                    </div>
                  </div>
                  <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-mono)',
                    flexShrink:0,textAlign:'right'}}>
                    {a.created_at?.slice(0,10)}<br/>
                    <span style={{fontSize:10}}>{a.created_at?.slice(11,16)}</span>
                  </div>
                </div>

                {a.body && (
                  <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.7,
                    whiteSpace:'pre-line',paddingTop:8,
                    borderTop:'1px solid var(--border)'}}>
                    {a.body}
                  </div>
                )}

                <div style={{marginTop:8,fontSize:11,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>
                  From: {a.is_automated ? '🤖 SmartAcademic System' : `👨‍🏫 ${a.teacher_name || 'Teacher'}`}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}