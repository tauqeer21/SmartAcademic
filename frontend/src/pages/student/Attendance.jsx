import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Loader from '../../components/Loader';

const SUBJ_COLORS = ['#7B61FF','#27AE60','#2F80ED','#F2994A','#EB5757','#00B5A5','#9B59B6'];

export default function StudentAttendance() {
  const [att,      setAtt]      = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null); // expanded card index
  const [histSubj, setHistSubj] = useState(null);
  const [history,  setHistory]  = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    api.get('/attendance/mine').then(r => setAtt(r.data || [])).finally(() => setLoading(false));
  }, []);

  const loadHistory = async (a) => {
    setHistLoading(true);
    try {
      const r = await api.get(
        `/attendance/subject-detail?class_id=${a.class_id}&subject=${encodeURIComponent(a.subject)}`
      );
      setHistory(r.data || []);
    } catch { setHistory([]); }
    finally { setHistLoading(false); }
  };

  const toggleCard = (i, a) => {
    if (selected === i) { setSelected(null); setHistory([]); setHistSubj(null); }
    else { setSelected(i); setHistSubj(a.subject); loadHistory(a); }
  };

  if (loading) return <Loader text="Loading attendance..."/>;

  const avg    = att.length ? Math.round(att.reduce((s,a) => s+(a.percentage||0), 0) / att.length) : 0;
  const atRisk = att.filter(a => a.at_risk === true);
  const safe   = att.filter(a => !a.at_risk);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      <div className="page-header fade-up">
        <div className="page-title">My Attendance</div>
        <div className="page-sub">Subject-wise attendance · tap a card to open bunk calculator &amp; history</div>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }} className="fade-up-d1">
        {[
          { icon:'📊', num:`${avg}%`,     label:'Overall Average',  bg:'#EEF0FF', color:'#6347D1' },
          { icon:'✅', num:safe.length,   label:'Safe Subjects',    bg:'#E8FBF0', color:'#27AE60' },
          { icon:'⚠️', num:atRisk.length, label:'At-Risk Subjects', bg:'#FFF0F0', color:'#EB5757' },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding:'20px', display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:50, height:50, borderRadius:16, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{c.icon}</div>
            <div>
              <div style={{ fontSize:30, fontWeight:800, color:c.color, letterSpacing:'-1px' }}>{c.num}</div>
              <div style={{ fontSize:12, color:'var(--text3)', fontWeight:500 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* At-risk alert */}
      {atRisk.length > 0 && (
        <div style={{ padding:'14px 18px', borderRadius:16, background:'#FFF0F0', border:'2px solid #FFBDBD', display:'flex', alignItems:'flex-start', gap:12 }} className="fade-up-d1">
          <span style={{ fontSize:24, flexShrink:0 }}>⚠️</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#EB5757' }}>
              {atRisk.length} subject{atRisk.length>1?'s':''} below 75% attendance!
            </div>
            <div style={{ fontSize:11, color:'#EB5757', opacity:0.85, marginTop:3 }}>
              You may be detained in: <strong>{atRisk.map(a => a.subject).join(', ')}</strong>
            </div>
            <div style={{ fontSize:10, color:'#EB5757', opacity:0.6, marginTop:4 }}>
              Tap on each subject card below to see exactly how many classes you must attend.
            </div>
          </div>
        </div>
      )}

      {/* Subject cards */}
      {att.length === 0 ? (
        <div className="card"><div className="empty"><div className="empty-icon">📊</div><div className="empty-title">No attendance data yet</div></div></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }} className="fade-up-d2">
          {att.map((a, i) => {
            const clr    = SUBJ_COLORS[i % SUBJ_COLORS.length];
            const isSafe = !a.at_risk;
            const pct    = Math.min(a.percentage || 0, 100);
            const isOpen = selected === i;

            // Computed values
            const totalSem  = a.total_lectures_semester || a.total;
            const remaining = Math.max(0, totalSem - a.total);
            const need      = a.required_total || Math.ceil(0.75 * totalSem);
            const weeksLeft = Math.round(remaining / 5); // 5 per week
            const heldPct   = Math.round(a.total / totalSem * 100);
            const presentPct= Math.round((a.present||0) / totalSem * 100);
            const absentPct = Math.round((a.absent||0) / totalSem * 100);
            const remPct    = Math.round(remaining / totalSem * 100);

            return (
              <div key={`${a.subject}-${a.class_id}`} className="card"
                style={{ padding:'20px', cursor:'pointer', border:isOpen?`2px solid ${clr}`:'2px solid transparent', transition:'all 0.2s' }}
                onClick={() => toggleCard(i, a)}>

                {/* Header */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:44, height:44, borderRadius:14, background:isSafe?'#E8FBF0':'#FFF0F0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                      {isSafe ? '📗' : '📕'}
                    </div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text1)' }}>{a.subject}</div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{a.teacher_name || a.class_name || 'Teacher'}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:28, fontWeight:800, color:isSafe?'#27AE60':'#EB5757', letterSpacing:'-1px', lineHeight:1 }}>{a.percentage}%</div>
                    <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:'50px', background:isSafe?'#E8FBF0':'#FFF0F0', color:isSafe?'#27AE60':'#EB5757' }}>
                      {isSafe ? 'SAFE' : 'AT RISK'}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom:12 }}>
                  <div style={{ position:'relative', height:10, background:'var(--surface3)', borderRadius:50, overflow:'visible', marginBottom:4 }}>
                    <div style={{ position:'absolute', top:-2, left:'75%', width:2, height:14, background:'rgba(0,0,0,0.2)', zIndex:2, borderRadius:2 }}/>
                    <div style={{ height:'100%', borderRadius:50, width:`${pct}%`, background:isSafe?`linear-gradient(90deg,${clr},${clr}99)`:'linear-gradient(90deg,#EB5757,#F2994A)', transition:'width 0.7s', position:'relative', zIndex:1 }}/>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--text3)' }}>
                    <span>0%</span>
                    <span style={{ fontWeight:600 }}>▲ 75% required</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {[
                    { label:'Present', val:a.present, color:'#27AE60', bg:'#E8FBF0' },
                    { label:'Absent',  val:a.absent,  color:'#EB5757', bg:'#FFF0F0' },
                    { label:'Total',   val:a.total,   color:'var(--text2)', bg:'var(--surface2)' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign:'center', padding:'8px 4px', background:s.bg, borderRadius:12 }}>
                      <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.val}</div>
                      <div style={{ fontSize:9, fontWeight:600, color:s.color, opacity:0.8, textTransform:'uppercase', letterSpacing:'0.04em' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* ── EXPANDED BUNK CALCULATOR ── */}
                {isOpen && (
                  <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)' }} onClick={e => e.stopPropagation()}>

                    <div style={{ fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:10 }}>🧮 Bunk Calculator</div>

                    {/* Can skip + Must attend — always show BOTH */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                      <div style={{ padding:'14px', borderRadius:14, background:a.can_miss>0?'#E8FBF0':'#FFF0F0', textAlign:'center' }}>
                        <div style={{ fontSize:36, fontWeight:900, color:a.can_miss>0?'#27AE60':'#EB5757', letterSpacing:'-1px', lineHeight:1 }}>
                          {a.can_miss || 0}
                        </div>
                        <div style={{ fontSize:11, fontWeight:700, color:a.can_miss>0?'#27AE60':'#EB5757', marginTop:5 }}>
                          {a.can_miss>0 ? 'Can Skip' : 'Cannot Skip'}
                        </div>
                        <div style={{ fontSize:9, color:a.can_miss>0?'#27AE60':'#EB5757', opacity:0.7, marginTop:2 }}>
                          of remaining {remaining} classes
                        </div>
                      </div>
                      <div style={{ padding:'14px', borderRadius:14, background:a.need_to_attend>0?'#FFF0F0':'#E8FBF0', textAlign:'center' }}>
                        <div style={{ fontSize:36, fontWeight:900, color:a.need_to_attend>0?'#EB5757':'#27AE60', letterSpacing:'-1px', lineHeight:1 }}>
                          {a.need_to_attend || 0}
                        </div>
                        <div style={{ fontSize:11, fontWeight:700, color:a.need_to_attend>0?'#EB5757':'#27AE60', marginTop:5 }}>
                          {a.need_to_attend>0 ? 'Must Attend' : 'No Obligation'}
                        </div>
                        <div style={{ fontSize:9, color:a.need_to_attend>0?'#EB5757':'#27AE60', opacity:0.7, marginTop:2 }}>
                          {a.need_to_attend>0
                            ? `to reach 75% of ${totalSem} total`
                            : 'already ≥75% target'}
                        </div>
                      </div>
                    </div>

                    {/* Visual semester bar */}
                    <div style={{ padding:'12px 14px', borderRadius:14, background:'var(--surface2)', marginBottom:12 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8 }}>
                        📅 Semester Progress · 5 lectures/week
                      </div>
                      <div style={{ position:'relative', height:14, background:'var(--surface3)', borderRadius:50, overflow:'hidden', marginBottom:6 }}>
                        {/* 75% target marker */}
                        <div style={{ position:'absolute', top:0, left:'75%', width:2, height:'100%', background:'rgba(0,0,0,0.3)', zIndex:4 }}/>
                        {/* Attended (green) */}
                        <div style={{ position:'absolute', top:0, left:0, height:'100%', width:`${presentPct}%`, background:'#27AE60', zIndex:2, borderRadius:'50px 0 0 50px' }}/>
                        {/* Held but absent (red) */}
                        <div style={{ position:'absolute', top:0, left:`${presentPct}%`, height:'100%', width:`${absentPct}%`, background:'#EB5757', zIndex:2 }}/>
                        {/* Remaining (striped) */}
                        <div style={{ position:'absolute', top:0, left:`${heldPct}%`, height:'100%', width:`${remPct}%`, background:'repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb 3px,#f3f4f6 3px,#f3f4f6 6px)', zIndex:1 }}/>
                      </div>
                      {/* Legend */}
                      <div style={{ display:'flex', gap:10, fontSize:9, color:'var(--text3)', marginBottom:10, flexWrap:'wrap' }}>
                        <span><span style={{color:'#27AE60',fontWeight:700}}>■</span> Present ({a.present})</span>
                        <span><span style={{color:'#EB5757',fontWeight:700}}>■</span> Absent ({a.absent})</span>
                        <span><span style={{color:'#9ca3af',fontWeight:700}}>▨</span> Remaining ({remaining})</span>
                        <span style={{marginLeft:'auto',fontWeight:600,color:'var(--text2)'}}>75% = {need} needed</span>
                      </div>
                      {/* 4 stats */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                        {[
                          { l:'Held',       v:a.total,    c:'var(--text1)' },
                          { l:'Remaining',  v:remaining,  c:'#6347D1'      },
                          { l:'Weeks Left', v:`~${weeksLeft}`, c:'#2F80ED' },
                          { l:'Need Total', v:need,       c:'#F2994A'      },
                        ].map(s => (
                          <div key={s.l} style={{ textAlign:'center', padding:'7px 4px', background:'var(--card-bg)', borderRadius:10 }}>
                            <div style={{ fontSize:16, fontWeight:800, color:s.c }}>{s.v}</div>
                            <div style={{ fontSize:8, color:'var(--text3)', fontWeight:600, marginTop:2, textTransform:'uppercase' }}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Plain English summary */}
                    <div style={{ padding:'10px 14px', borderRadius:12, background:isSafe?'#E8FBF0':'#FFF0F0', fontSize:11, color:isSafe?'#27AE60':'#EB5757', lineHeight:1.7, fontWeight:500, marginBottom:14 }}>
                      {isSafe
                        ? a.can_miss > 0
                          ? `✅ Safe! You can skip up to ${a.can_miss} more class${a.can_miss!==1?'es':''} from the remaining ${remaining} and still finish at ≥75%.`
                          : `✅ You're at exactly the minimum. Attend all remaining ${remaining} classes to stay safe.`
                        : `⚠️ You need to attend ${a.need_to_attend} of the remaining ${remaining} classes (≈${Math.ceil(a.need_to_attend/5)} weeks). You can still skip ${a.can_miss} of them.`
                      }
                    </div>

                    {/* Attendance History */}
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:8 }}>📅 Attendance History</div>
                      {histLoading ? (
                        <div style={{ textAlign:'center', padding:'12px', color:'var(--text3)', fontSize:12 }}>Loading...</div>
                      ) : history.length > 0 ? (
                        <div style={{ maxHeight:200, overflowY:'auto', borderRadius:12, border:'1px solid var(--border)' }}>
                          {history.map((h, j) => (
                            <div key={j} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', borderBottom:j<history.length-1?'1px solid var(--border)':'none', background:j%2===0?'var(--surface2)':'transparent' }}>
                              <span style={{ fontSize:12, color:'var(--text2)', fontWeight:500 }}>
                                {new Date(h.date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}
                              </span>
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:'50px', background:h.status==='Present'?'#E8FBF0':'#FFF0F0', color:h.status==='Present'?'#27AE60':'#EB5757' }}>
                                {h.status==='Present'?'✅ Present':'❌ Absent'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding:'10px', background:'var(--surface2)', borderRadius:12, fontSize:11, color:'var(--text3)', textAlign:'center' }}>
                          No history available
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop:10, fontSize:10, color:'var(--text3)', textAlign:'center' }}>Tap card to collapse</div>
                  </div>
                )}

                {!isOpen && (
                  <div style={{ marginTop:10, fontSize:10, color:clr, textAlign:'center', fontWeight:500 }}>
                    Tap to open bunk calculator &amp; history ›
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}