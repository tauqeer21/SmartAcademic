import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import Loader from '../../components/Loader';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
         BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';

const grade  = p => p>=90?'O':p>=80?'A+':p>=70?'A':p>=60?'B+':p>=50?'B':p>=40?'C':'F';
const gradeColor = g => g==='O'||g==='A+'?'#27AE60':g==='F'?'#EB5757':g==='A'||g==='B+'?'#F2994A':'#6347D1';
const gradeBg    = g => g==='O'||g==='A+'?'#E8FBF0':g==='F'?'#FFF0F0':g==='A'||g==='B+'?'#FFF3E8':'#EEF0FF';
const SUBJ_CLR   = ['#7B61FF','#27AE60','#2F80ED','#F2994A','#EB5757','#00B5A5'];

export default function ReportCard() {
  const { user } = useAuth();
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [tab,     setTab]     = useState('overview'); // overview | marks | attendance

  useEffect(() => {
    const roll = user?.roll_no;
    if (!roll) { setLoading(false); setError('No roll number found'); return; }
    api.get('/analytics/report/' + roll)
      .then(r => setReport(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <Loader text="Generating your report card..."/>;
  if (error)   return <div className="empty"><div className="empty-icon">❌</div><div className="empty-title">{error}</div></div>;
  if (!report) return <div className="empty"><div className="empty-icon">📊</div><div className="empty-title">No report available yet</div><div className="empty-sub">Ask your teacher to enter marks and attendance</div></div>;

  // ── Data from backend ──
  const attPct       = report.attendance?.percentage ?? 0;
  const asgnRate     = report.assignments?.rate ?? 0;
  const marksPct     = report.marks_percentage ?? 0;
  const overall      = report.overall ?? 0;
  const overallGrade = report.grade || grade(overall);
  const summaries    = report.subject_summaries || [];
  const attBySub     = report.attendance_by_subject || [];
  const stu          = report.student || {};

  // Build chart data from subject_summaries
  const radarData = summaries.map(s => ({
    subject: s.subject.split(' ').slice(0,2).join(' '), // shorten name
    score: s.mst_pct || 0,
  }));

  const barData = summaries.map((s, i) => ({
    subject: s.subject.split(' ')[0], // first word only for bar
    mst1: s.mst1 ? Math.round((s.mst1.marks_obtained / (s.mst1.marks_total || 30)) * 100) : 0,
    mst2: s.mst2 ? Math.round((s.mst2.marks_obtained / (s.mst2.marks_total || 30)) * 100) : 0,
    color: SUBJ_CLR[i % SUBJ_CLR.length],
  }));

  const initials = stu.name?.split(' ').filter(w=>w.length>0).map(w=>w[0]).join('').toUpperCase().slice(0,2) || 'S';

  const TABS = [
    { id:'overview',   label:'📊 Overview'   },
    { id:'marks',      label:'📝 Marks'       },
    { id:'attendance', label:'✅ Attendance'  },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Student Header Card ── */}
      <div className="card fade-up" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ height:90, background:'linear-gradient(135deg,#7B61FF,#5A3EC8)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,0.07)' }}/>
          <div style={{ position:'absolute', bottom:-20, left:60, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }}/>
        </div>
        <div style={{ padding:'0 24px 24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, padding:'14px 0 20px' }}>
            {/* Avatar */}
            <div style={{ width:70, height:70, borderRadius:'50%', background:'linear-gradient(135deg,#7B61FF,#5A3EC8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:800, color:'#fff', border:'3px solid var(--card-bg)', boxShadow:'0 4px 16px rgba(99,71,209,0.25)', flexShrink:0, marginTop:-35 }}>
              {initials}
            </div>
            {/* Name & details */}
            <div style={{ flex:1 }}>
              <div style={{ fontSize:18, fontWeight:700, color:'var(--text1)' }}>{stu.name || user?.name}</div>
              <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
                {stu.roll_no} · {stu.course || 'B.Tech CSE'}{stu.semester ? ' · Sem ' + stu.semester : ''}
              </div>
              <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>
                Generated: {report.generated_at}
              </div>
            </div>
            {/* Overall Grade badge */}
            <div style={{ textAlign:'center', padding:'16px 24px', background:gradeBg(overallGrade), borderRadius:18, flexShrink:0 }}>
              <div style={{ fontSize:42, fontWeight:900, color:gradeColor(overallGrade), letterSpacing:'-1px', lineHeight:1 }}>{overallGrade}</div>
              <div style={{ fontSize:10, color:gradeColor(overallGrade), fontWeight:700, marginTop:4 }}>Overall Grade</div>
              <div style={{ fontSize:11, fontWeight:700, color:gradeColor(overallGrade), marginTop:2 }}>{overall}%</div>
            </div>
          </div>

          {/* Summary strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {[
              { icon:'📈', label:'Attendance',  val:`${attPct}%`,   color:'#6347D1', bg:'#EEF0FF', sub: report.attendance?.at_risk ? '⚠️ At Risk' : '✅ Safe' },
              { icon:'🏆', label:'Marks Avg',   val:`${marksPct}%`, color:'#27AE60', bg:'#E8FBF0', sub:`${report.total_obtained||0}/${report.total_max||0} pts` },
              { icon:'📋', label:'Assignments', val:`${asgnRate}%`, color:'#F2994A', bg:'#FFF3E8', sub:`${report.assignments?.submitted||0}/${report.assignments?.total||0} done` },
              { icon:'⭐', label:'Overall',     val:`${overall}%`,  color:'#EB5757', bg:'#FFF0F0', sub: overallGrade + ' grade' },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center', padding:'12px 6px', background:s.bg, borderRadius:14 }}>
                <div style={{ fontSize:18, marginBottom:3 }}>{s.icon}</div>
                <div style={{ fontSize:20, fontWeight:800, color:s.color, letterSpacing:'-0.5px' }}>{s.val}</div>
                <div style={{ fontSize:10, fontWeight:600, color:s.color, marginTop:2 }}>{s.label}</div>
                <div style={{ fontSize:9, color:s.color, opacity:0.7, marginTop:1 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex', gap:8 }} className="fade-up">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'10px 22px', borderRadius:'50px',
            border:`2px solid ${tab===t.id?'#7B61FF':'var(--border2)'}`,
            background:tab===t.id?'linear-gradient(135deg,#7B61FF,#6347D1)':'var(--card-bg)',
            color:tab===t.id?'#fff':'var(--text2)', fontSize:12, fontWeight:600,
            cursor:'pointer', fontFamily:'var(--font)', transition:'all 0.18s',
            boxShadow:tab===t.id?'0 6px 20px rgba(99,71,209,0.28)':'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

            {/* Radar chart */}
            {radarData.length > 0 && (
              <div className="card fade-up">
                <div className="card-header">
                  <div className="card-title">📡 Subject Performance Radar</div>
                  <div className="card-sub">MST average % per subject</div>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill:'var(--text3)', fontSize:10 }} />
                      <Radar dataKey="score" stroke="#7B61FF" fill="#7B61FF" fillOpacity={0.15} strokeWidth={2}/>
                      <Tooltip contentStyle={{ background:'var(--card-bg)', border:'none', borderRadius:14, boxShadow:'0 10px 30px rgba(0,0,0,0.08)', fontSize:12 }}/>
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* MST1 vs MST2 bar chart */}
            {barData.length > 0 && (
              <div className="card fade-up">
                <div className="card-header">
                  <div className="card-title">📊 MST1 vs MST2 Comparison</div>
                  <div className="card-sub">Score % per subject</div>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData} barSize={14} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                      <XAxis dataKey="subject" tick={{ fill:'var(--text3)', fontSize:10 }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fill:'var(--text3)', fontSize:10 }} axisLine={false} tickLine={false} domain={[0,100]}/>
                      <Tooltip contentStyle={{ background:'var(--card-bg)', border:'none', borderRadius:14, boxShadow:'0 10px 30px rgba(0,0,0,0.08)', fontSize:12 }}
                        formatter={(val, name) => [`${val}%`, name]}/>
                      <Bar dataKey="mst1" name="MST1" radius={[4,4,0,0]}>
                        {barData.map((d,i) => <Cell key={i} fill={d.color} fillOpacity={0.5}/>)}
                      </Bar>
                      <Bar dataKey="mst2" name="MST2" radius={[4,4,0,0]}>
                        {barData.map((d,i) => <Cell key={i} fill={d.color}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Subject grade summary */}
          <div className="card fade-up">
            <div className="card-header">
              <div className="card-title">📚 Subject-wise Grade Summary</div>
              <div className="card-sub">Based on MST average performance</div>
            </div>
            <div className="card-body" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {summaries.length === 0 ? (
                <div className="empty" style={{ gridColumn:'span 2' }}><div className="empty-sub">No marks data yet</div></div>
              ) : summaries.map((s, i) => {
                const g   = grade(s.mst_pct || 0);
                const clr = SUBJ_CLR[i % SUBJ_CLR.length];
                const pct = s.mst_pct || 0;
                return (
                  <div key={s.subject} style={{ padding:'16px', background:'var(--surface2)', borderRadius:16 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:38, height:38, borderRadius:10, background:`${clr}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                          📖
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:'var(--text1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:150 }}>{s.subject}</div>
                          <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>{pct}% average</div>
                        </div>
                      </div>
                      <span style={{ fontSize:20, fontWeight:900, color:gradeColor(g), padding:'4px 10px', borderRadius:10, background:gradeBg(g) }}>{g}</span>
                    </div>
                    <div style={{ height:7, background:'var(--surface3)', borderRadius:50, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background:clr, borderRadius:50, transition:'width 0.7s' }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MARKS TAB ── */}
      {tab === 'marks' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {summaries.length === 0 ? (
            <div className="card"><div className="empty"><div className="empty-icon">📝</div><div className="empty-sub">No marks recorded yet</div></div></div>
          ) : summaries.map((s, i) => {
            const clr     = SUBJ_CLR[i % SUBJ_CLR.length];
            const g       = grade(s.mst_pct || 0);
            const mst1Pct = s.mst1 ? Math.round((s.mst1.marks_obtained / (s.mst1.marks_total||30)) * 100) : null;
            const mst2Pct = s.mst2 ? Math.round((s.mst2.marks_obtained / (s.mst2.marks_total||30)) * 100) : null;
            const finPct  = s.final ? Math.round((s.final.marks_obtained / (s.final.marks_total||80)) * 100) : null;
            const trend   = mst1Pct != null && mst2Pct != null ? mst2Pct - mst1Pct : null;

            return (
              <div key={s.subject} className="card fade-up" style={{ padding:0, overflow:'hidden' }}>
                {/* Subject header */}
                <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', background:`${clr}08` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:44, height:44, borderRadius:14, background:`${clr}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>📖</div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:'var(--text1)' }}>{s.subject}</div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                        MST Avg: <strong style={{ color:clr }}>{s.mst_pct || 0}%</strong>
                        {trend != null && (
                          <span style={{ marginLeft:8, color:trend>=0?'#27AE60':'#EB5757', fontWeight:700 }}>
                            {trend>=0?'↑':'↓'} {Math.abs(trend)}% {trend>=0?'improved':'declined'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize:28, fontWeight:900, color:gradeColor(g), padding:'6px 14px', borderRadius:12, background:gradeBg(g) }}>{g}</span>
                </div>

                {/* Exam breakdown */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:0 }}>
                  {[
                    { label:'MST 1',  data:s.mst1,  pct:mst1Pct, total:s.mst1?.marks_total||30 },
                    { label:'MST 2',  data:s.mst2,  pct:mst2Pct, total:s.mst2?.marks_total||30 },
                    { label:'Final',  data:s.final, pct:finPct,  total:s.final?.marks_total||80 },
                  ].map((e, j) => (
                    <div key={e.label} style={{ padding:'16px', borderRight:j<2?'1px solid var(--border)':'none', textAlign:'center' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{e.label}</div>
                      {e.data ? (
                        <>
                          <div style={{ fontSize:26, fontWeight:900, color:e.pct>=75?'#27AE60':e.pct>=50?'#F2994A':'#EB5757', letterSpacing:'-0.5px', lineHeight:1 }}>
                            {e.data.marks_obtained}
                          </div>
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>out of {e.total}</div>
                          <div style={{ marginTop:8, height:5, background:'var(--surface3)', borderRadius:50, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${e.pct||0}%`, background:e.pct>=75?'#27AE60':e.pct>=50?'#F2994A':'#EB5757', borderRadius:50 }}/>
                          </div>
                          <div style={{ fontSize:10, fontWeight:700, color:e.pct>=75?'#27AE60':e.pct>=50?'#F2994A':'#EB5757', marginTop:4 }}>{e.pct}%</div>
                          <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:'50px', background:gradeBg(grade(e.pct||0)), color:gradeColor(grade(e.pct||0)), marginTop:4, display:'inline-block' }}>
                            {grade(e.pct||0)}
                          </span>
                        </>
                      ) : (
                        <div style={{ color:'var(--text3)', fontSize:12, paddingTop:8 }}>Not yet</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Internal + Assignment */}
                {(s.internal_total != null || s.assignment_avg != null) && (
                  <div style={{ padding:'10px 20px', background:'var(--surface2)', borderTop:'1px solid var(--border)', display:'flex', gap:16, fontSize:11, color:'var(--text2)', flexWrap:'wrap' }}>
                    {s.mst_avg != null && <span>📊 MST Avg Score: <strong style={{ color:clr }}>{s.mst_avg}/{s.mst_total||30}</strong></span>}
                    {s.assignment_avg != null && <span>📋 Assignment Avg: <strong style={{ color:'#F2994A' }}>{s.assignment_avg}/10</strong></span>}
                    {s.internal_total != null && <span>🔢 Internal Total: <strong style={{ color:'var(--text1)' }}>{s.internal_total}</strong></span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {tab === 'attendance' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Overall attendance */}
          <div className="card fade-up" style={{ padding:'20px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:20 }}>
              <div style={{ textAlign:'center', minWidth:80 }}>
                <div style={{ fontSize:48, fontWeight:900, color:attPct>=75?'#27AE60':'#EB5757', letterSpacing:'-2px', lineHeight:1 }}>{attPct}%</div>
                <div style={{ fontSize:11, color:attPct>=75?'#27AE60':'#EB5757', fontWeight:700, marginTop:4 }}>
                  {attPct>=75?'✅ Safe':'⚠️ At Risk'}
                </div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text2)' }}>Overall Attendance</span>
                  <span style={{ fontSize:12, color:'var(--text3)' }}>{report.attendance?.present||0}/{report.attendance?.total||0} classes</span>
                </div>
                <div style={{ height:12, background:'var(--surface3)', borderRadius:50, overflow:'hidden', position:'relative' }}>
                  <div style={{ position:'absolute', top:0, left:'75%', width:2, height:'100%', background:'rgba(0,0,0,0.2)' }}/>
                  <div style={{ height:'100%', width:`${Math.min(attPct,100)}%`, borderRadius:50, background:attPct>=75?'linear-gradient(90deg,#27AE60,#6FCF97)':'linear-gradient(90deg,#EB5757,#F2994A)', transition:'width 0.8s' }}/>
                </div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>▲ 75% minimum required · Applies to all subjects</div>
              </div>
            </div>
          </div>

          {/* Per-subject attendance */}
          {attBySub.length === 0 ? (
            <div className="card"><div className="empty"><div className="empty-sub">No attendance data yet</div></div></div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {attBySub.map((a, i) => {
                const safe = !a.at_risk;
                const pct  = a.percentage || 0;
                const clr  = SUBJ_CLR[i % SUBJ_CLR.length];
                return (
                  <div key={`${a.subject}-${a.class_id}`} className="card fade-up" style={{ padding:'16px 20px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text1)' }}>{a.subject}</div>
                        <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>{a.class_name}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:22, fontWeight:900, color:safe?'#27AE60':'#EB5757', letterSpacing:'-0.5px', lineHeight:1 }}>{pct}%</div>
                        <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:'50px', background:safe?'#E8FBF0':'#FFF0F0', color:safe?'#27AE60':'#EB5757' }}>
                          {safe?'SAFE':'AT RISK'}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ position:'relative', height:8, background:'var(--surface3)', borderRadius:50, overflow:'visible', marginBottom:6 }}>
                      <div style={{ position:'absolute', top:-1, left:'75%', width:2, height:10, background:'rgba(0,0,0,0.2)', zIndex:2, borderRadius:2 }}/>
                      <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background:safe?clr:'linear-gradient(90deg,#EB5757,#F2994A)', borderRadius:50, position:'relative', zIndex:1 }}/>
                    </div>

                    {/* Stats */}
                    <div style={{ display:'flex', gap:8 }}>
                      {[
                        { l:'Present', v:a.present, c:'#27AE60', bg:'#E8FBF0' },
                        { l:'Absent',  v:a.absent||((a.total||0)-(a.present||0)), c:'#EB5757', bg:'#FFF0F0' },
                        { l:'Total',   v:a.total,   c:'var(--text2)', bg:'var(--surface2)' },
                      ].map(s => (
                        <div key={s.l} style={{ flex:1, textAlign:'center', padding:'6px 4px', background:s.bg, borderRadius:10 }}>
                          <div style={{ fontSize:15, fontWeight:800, color:s.c }}>{s.v}</div>
                          <div style={{ fontSize:8, fontWeight:600, color:s.c, opacity:0.8, textTransform:'uppercase' }}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}