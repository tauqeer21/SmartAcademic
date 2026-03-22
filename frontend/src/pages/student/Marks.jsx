import { useState, useEffect } from 'react'
import api from '../../api/axios'
import Loader from '../../components/Loader'

const GRADE_CLR = { O:'var(--green)', 'A+':'var(--green)', A:'var(--teal)',
                    'B+':'var(--blue)', B:'var(--blue)', C:'var(--gold)', F:'var(--red)' }

function MiniTrendBar({ exams }) {
  if (exams.length < 2) return null
  const max = Math.max(...exams.map(e => e.pct))
  const min = Math.min(...exams.map(e => e.pct))
  const trend = exams[exams.length-1].pct - exams[0].pct
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:3,height:28}}>
      {exams.map((e,i) => (
        <div key={i} title={`${e.exam_type}: ${e.pct}%`} style={{
          flex:1, borderRadius:3,
          height: max===min ? '60%' : `${20 + ((e.pct-min)/(max-min))*60}%`,
          background: i===exams.length-1
            ? (trend>=0?'var(--green)':'var(--red)')
            : 'var(--border)',
          transition:'height 0.3s'
        }}/>
      ))}
      <span style={{fontSize:10,fontWeight:700,marginLeft:4,
        color:trend>=0?'var(--green)':'var(--red)',fontFamily:'var(--font-mono)',whiteSpace:'nowrap'}}>
        {trend>=0?'▲':'▼'}{Math.abs(trend.toFixed(1))}%
      </span>
    </div>
  )
}

export default function MyMarks() {
  const [marks,   setMarks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('all') // all | improving | declining | failed

  useEffect(() => {
    api.get('/marks/mine')
      .then(r => setMarks(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loader text="Loading marks..." />

  // Group by subject
  const bySubject = {}
  marks.forEach(m => {
    if (!bySubject[m.subject]) bySubject[m.subject] = []
    bySubject[m.subject].push(m)
  })

  // Compute subject-level stats
  const subjects = Object.entries(bySubject).map(([subj, exams]) => {
    const sorted  = [...exams].sort((a,b) => a.exam_type.localeCompare(b.exam_type))
    const avg     = Math.round(sorted.reduce((s,e) => s+(e.percentage||0), 0) / sorted.length)
    const trend   = sorted.length>=2 ? sorted[sorted.length-1].percentage - sorted[0].percentage : 0
    const hasFail = sorted.some(e => e.percentage < 40)
    return { subj, exams: sorted, avg, trend, hasFail }
  })

  // Filter
  const filtered = subjects
    .filter(s => {
      const q = search.toLowerCase()
      if (q && !s.subj.toLowerCase().includes(q)) return false
      if (filter==='improving' && s.trend <= 0) return false
      if (filter==='declining' && s.trend >= 0) return false
      if (filter==='failed'    && !s.hasFail)   return false
      return true
    })

  // Overall stats
  const allExams   = marks.length
  const avgOverall = allExams ? Math.round(marks.reduce((s,m) => s+(m.percentage||0),0)/allExams) : 0
  const improving  = subjects.filter(s=>s.trend>0).length
  const declining  = subjects.filter(s=>s.trend<0).length
  const failed     = subjects.filter(s=>s.hasFail).length

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Overall banner */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:12}} className="fade-up">
        {[
          {label:'Overall Average', val:avgOverall+'%', clr:avgOverall>=60?'var(--green)':'var(--red)', icon:'📊'},
          {label:'Improving',       val:improving,      clr:'var(--green)',   icon:'📈'},
          {label:'Declining',       val:declining,      clr:'var(--red)',     icon:'📉'},
          {label:'Has Fails',       val:failed,         clr:failed?'var(--red)':'var(--text3)', icon:'⚠'},
        ].map((s,i) => (
          <div key={i} className="card" style={{padding:'16px 18px',borderTop:'3px solid '+s.clr}}>
            <div style={{fontSize:18,marginBottom:6}}>{s.icon}</div>
            <div style={{fontSize:28,fontWeight:800,color:s.clr,fontFamily:'var(--font-display)',lineHeight:1}}>{s.val}</div>
            <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--font-mono)',
              textTransform:'uppercase',letterSpacing:'0.06em',marginTop:5}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + filter bar */}
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}} className="fade-up">
        <input
          className="inp"
          placeholder="🔍 Search subject..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{flex:1,minWidth:180,maxWidth:300}}
        />
        <div style={{display:'flex',gap:6}}>
          {[
            ['all','All'],
            ['improving','📈 Improving'],
            ['declining','📉 Declining'],
            ['failed','⚠ Has Fail'],
          ].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={'btn btn-sm '+(filter===v?'btn-primary':'btn-ghost')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {marks.length===0 && (
        <div className="empty">No marks entered yet. Your teacher will add marks after each exam.</div>
      )}

      {filtered.length===0 && marks.length>0 && (
        <div className="empty">No subjects match your filter.</div>
      )}

      {/* Subject cards */}
      {filtered.map((s, i) => (
        <div key={i} className="card fade-up">
          {/* Subject header */}
          <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:800,color:'var(--text1)',marginBottom:4}}>{s.subj}</div>
                <MiniTrendBar exams={s.exams}/>
              </div>
              <div style={{textAlign:'right',flexShrink:0,marginLeft:16}}>
                <div style={{fontSize:36,fontWeight:800,fontFamily:'var(--font-display)',lineHeight:1,
                  color:s.avg>=60?'var(--green)':s.avg>=40?'var(--gold)':'var(--red)'}}>
                  {s.avg}%
                </div>
                <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--font-mono)',marginTop:3}}>
                  avg across {s.exams.length} exam{s.exams.length!==1?'s':''}
                </div>
              </div>
            </div>
          </div>

          {/* Exam rows */}
          <div style={{padding:'12px 20px',display:'flex',flexDirection:'column',gap:10}}>
            {s.exams.map((e, j) => {
              const pct   = e.percentage || 0
              const grade = e.grade || 'F'
              const clr   = GRADE_CLR[grade] || 'var(--text2)'
              return (
                <div key={j} style={{display:'flex',alignItems:'center',gap:14,
                  padding:'10px 14px',borderRadius:10,background:'var(--surface)',
                  border:'1px solid var(--border)'}}>
                  {/* Exam type badge */}
                  <div style={{minWidth:70}}>
                    <span className={'badge badge-'+(e.exam_type.includes('Final')?'red':e.exam_type.includes('MST')?'purple':'teal')}
                      style={{fontSize:11}}>
                      {e.exam_type}
                    </span>
                  </div>
                  {/* Progress */}
                  <div style={{flex:1}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}>
                      <span style={{color:'var(--text2)',fontFamily:'var(--font-mono)'}}>
                        {e.marks_obtained}/{e.marks_total} marks
                      </span>
                      <span style={{fontWeight:700,color:clr}}>{pct}%</span>
                    </div>
                    <div className="prog" style={{height:6}}>
                      <div className="prog-fill" style={{width:pct+'%',height:6,
                        background:pct>=75?'var(--green)':pct>=50?'var(--blue)':pct>=40?'var(--gold)':'var(--red)'}}/>
                    </div>
                  </div>
                  {/* Grade */}
                  <div style={{width:40,textAlign:'center',flexShrink:0}}>
                    <div style={{fontSize:20,fontWeight:800,color:clr,fontFamily:'var(--font-display)',lineHeight:1}}>{grade}</div>
                    <div style={{fontSize:9,color:'var(--text3)',fontFamily:'var(--font-mono)',marginTop:2}}>grade</div>
                  </div>
                  {/* vs previous exam arrow */}
                  {j > 0 && (() => {
                    const prev = s.exams[j-1].percentage || 0
                    const diff = (pct - prev).toFixed(1)
                    return (
                      <div style={{flexShrink:0,fontSize:11,fontWeight:700,
                        color:diff>=0?'var(--green)':'var(--red)',fontFamily:'var(--font-mono)'}}>
                        {diff>=0?'▲':'▼'}{Math.abs(diff)}%
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>

          {/* Grade scale hint */}
          <div style={{padding:'8px 20px',borderTop:'1px solid var(--border)',
            display:'flex',gap:8,flexWrap:'wrap',fontSize:10,color:'var(--text3)',
            fontFamily:'var(--font-mono)'}}>
            {[['O','≥90','green'],['A+','≥80','green'],['A','≥70','teal'],
              ['B+','≥60','blue'],['B','≥50','blue'],['C','≥40','gold'],['F','<40','red']
            ].map(([g,r,c]) => (
              <span key={g}>
                <span style={{fontWeight:700,color:`var(--${c})`}}>{g}</span> {r}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}