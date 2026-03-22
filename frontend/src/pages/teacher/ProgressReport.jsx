import { useState, useEffect } from 'react';
import { useCurrentClass } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';

const EXAM_TYPES = ['MST1','MST2','Final','Practical','Viva'];
const grade = p => p>=90?'O':p>=80?'A+':p>=70?'A':p>=60?'B+':p>=50?'B':p>=40?'C':'F';
const gradeColor = g => g==='O'||g==='A+'?'#27AE60':g==='F'?'#EB5757':g==='A'||g==='B+'?'#F2994A':'#6347D1';

export default function ProgressReport() {
  const [cls] = useCurrentClass();
  const [examType, setExamType] = useState('MST1');
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [expandedRoll, setExpandedRoll] = useState(null);
  const [search, setSearch] = useState('');

  const generate = async () => {
    if (!cls?.id) { toast.error('Select a class first'); return; }
    setGenerating(true); setReports(null);
    try {
      const r = await api.post('/ai/progress-report', { class_id: cls.id, exam_type: examType });
      setReports(r.data);
      toast.success(`Reports generated for ${r.data.total} students!`);
    } catch(err) { toast.error(err.response?.data?.error || 'Failed — check Gemini API key'); }
    finally { setGenerating(false); }
  };

  const downloadPDF = async () => {
    if (!reports) return;
    setDownloading(true);
    try {
      const tok = localStorage.getItem('sas_token');
      const res = await fetch('/api/ai/progress-report-pdf', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tok}` },
        body: JSON.stringify({ reports: reports.reports, class_name: reports.class_name, exam_type: examType }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error||'Failed'); }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `Progress_${reports.class_name}_${examType}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('PDF downloaded!');
    } catch(err) { toast.error(err.message||'Failed'); }
    finally { setDownloading(false); }
  };

  if (!cls) return (
    <div className="empty">
      <div className="empty-icon">🏫</div>
      <div className="empty-title">No class selected</div>
      <div className="empty-sub">Select a class from the switcher</div>
    </div>
  );

  const filtered = reports?.reports?.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.roll_no.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      <div className="page-header fade-up">
        <div className="page-title">Progress Report</div>
        <div className="page-sub">AI-generated student progress reports with academic remarks</div>
      </div>

      {/* Config Card */}
      <div className="card fade-up">
        <div className="card-header">
          <div>
            <div className="card-title">📈 Generate Progress Reports</div>
            <div className="card-sub">{cls.name}{cls.section?' · '+cls.section:''} — AI analyzes each student's data</div>
          </div>
          {generating && <span className="badge badge-purple">✨ AI Writing Remarks...</span>}
        </div>
        <div className="card-body">
          <div style={{ display:'flex', gap:14, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div className="field">
              <label className="lbl">Exam Period</label>
              <select className="inp" value={examType} onChange={e=>setExamType(e.target.value)} style={{ minWidth:200 }}>
                {EXAM_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ padding:'10px 16px', borderRadius:14, background:'#EEF0FF', fontSize:12, color:'#6347D1', fontWeight:500, flex:1, minWidth:200 }}>
              💡 AI will analyze attendance, marks, assignment submission rate for each student and write a personalized academic remark.
            </div>
            <button onClick={generate} disabled={generating} className="btn btn-primary" style={{ padding:'12px 24px' }}>
              {generating ? (
                <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span className="dot" style={{ width:6, height:6, background:'#fff' }}/><span className="dot" style={{ width:6, height:6, background:'#fff', animationDelay:'0.2s' }}/><span className="dot" style={{ width:6, height:6, background:'#fff', animationDelay:'0.4s' }}/>
                  Generating...
                </span>
              ) : '📈 Generate Reports'}
            </button>
          </div>
          {generating && (
            <div style={{ marginTop:16, padding:'14px 16px', background:'#F8F4FF', borderRadius:14, fontSize:12, color:'#6347D1' }}>
              ⏳ AI is writing personalized remarks for each student. This may take 30-60 seconds...
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {reports && (
        <>
          {/* Summary */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }} className="fade-up">
            {[
              { l:'Total Students',  v:reports.total,     c:'#6347D1', bg:'#EEF0FF', icon:'👥' },
              { l:'Avg Attendance',  v:`${Math.round(reports.reports.reduce((s,r)=>s+(r.attendance||0),0)/reports.total)}%`, c:'#27AE60', bg:'#E8FBF0', icon:'📈' },
              { l:'At Risk',         v:reports.reports.filter(r=>(r.attendance||0)<75).length, c:'#EB5757', bg:'#FFF0F0', icon:'⚠️' },
              { l:'Passing',         v:reports.reports.filter(r=>r.grade&&r.grade!=='F'&&r.grade!=='—').length, c:'#F2994A', bg:'#FFF3E8', icon:'🏆' },
            ].map(s=>(
              <div key={s.l} style={{ padding:'18px', borderRadius:18, background:s.bg, display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ fontSize:28 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize:26, fontWeight:800, color:s.c, letterSpacing:'-0.5px' }}>{s.v}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:s.c, opacity:0.8 }}>{s.l}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{ display:'flex', gap:12, alignItems:'center' }} className="fade-up">
            <div style={{ position:'relative', flex:1, maxWidth:300 }}>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'var(--text3)' }}>🔍</span>
              <input className="inp" placeholder="Search student..." value={search} onChange={e=>setSearch(e.target.value)} style={{ paddingLeft:40 }}/>
            </div>
            <button onClick={downloadPDF} disabled={downloading} className="btn btn-primary" style={{ marginLeft:'auto' }}>
              {downloading ? '⏳ Building PDF...' : '📄 Download All as PDF'}
            </button>
          </div>

          {/* Student Cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }} className="fade-up">
            {filtered.map((r, i) => {
              const attSafe = (r.attendance||0) >= 75;
              const g = r.grade || '—';
              const gc = gradeColor(g);
              const isOpen = expandedRoll === r.roll_no;

              return (
                <div key={r.roll_no} className="card" style={{ padding:0, overflow:'hidden' }}>
                  {/* Header row */}
                  <div
                    style={{ padding:'16px 20px', cursor:'pointer', background:'var(--card-bg)', transition:'background 0.15s' }}
                    onClick={() => setExpandedRoll(isOpen ? null : r.roll_no)}
                    onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background='var(--card-bg)'}
                  >
                    {/* Top row: avatar + name + chevron */}
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                      <div style={{ width:40, height:40, borderRadius:'50%', background:`linear-gradient(135deg,${attSafe?'#7B61FF':'#EB5757'},${attSafe?'#6347D1':'#C0392B'})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:14, flexShrink:0 }}>
                        {r.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--text1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
                        <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{r.roll_no} · {r.gender}</div>
                      </div>
                      <span style={{ fontSize:12, color:'var(--text3)', flexShrink:0 }}>{isOpen?'▲':'▼'}</span>
                    </div>
                    {/* Bottom row: stats chips */}
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <div style={{ textAlign:'center', padding:'5px 12px', background:attSafe?'#E8FBF0':'#FFF0F0', borderRadius:10 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:attSafe?'#27AE60':'#EB5757' }}>{r.attendance||0}%</div>
                        <div style={{ fontSize:9, color:attSafe?'#27AE60':'#EB5757', fontWeight:600 }}>Attendance</div>
                      </div>
                      {r.avg_marks != null && (
                        <div style={{ textAlign:'center', padding:'5px 12px', background:'#EBF4FF', borderRadius:10 }}>
                          <div style={{ fontSize:14, fontWeight:800, color:'#2F80ED' }}>{r.avg_marks}%</div>
                          <div style={{ fontSize:9, color:'#2F80ED', fontWeight:600 }}>Avg Marks</div>
                        </div>
                      )}
                      <div style={{ textAlign:'center', padding:'5px 14px', background:`${gc}18`, borderRadius:10 }}>
                        <div style={{ fontSize:18, fontWeight:900, color:gc }}>{g}</div>
                        <div style={{ fontSize:9, color:gc, fontWeight:600 }}>Grade</div>
                      </div>
                      <div style={{ textAlign:'center', padding:'5px 12px', background:'#EEF0FF', borderRadius:10 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:'#6347D1' }}>{r.submitted}/{r.total_asgn}</div>
                        <div style={{ fontSize:9, color:'#6347D1', fontWeight:600 }}>Assignments</div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ borderTop:'1px solid var(--border)', padding:'16px 20px', background:'var(--surface2)' }}>
                      {/* Subject marks */}
                      {r.subj_summaries?.length > 0 && (
                        <div style={{ marginBottom:14 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>Marks by Subject</div>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                            {r.subj_summaries.map(s => (
                              <div key={s.subject} style={{ padding:'10px 14px', background:'var(--card-bg)', borderRadius:12 }}>
                                <div style={{ fontSize:12, fontWeight:700, color:'var(--text1)', marginBottom:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.subject}</div>
                                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                                  {s.mst1!=null && <span style={{ fontSize:10, color:'#6347D1', fontWeight:600 }}>MST1: {s.mst1}/{s.mst_total||30}</span>}
                                  {s.mst2!=null && <span style={{ fontSize:10, color:'#2F80ED', fontWeight:600 }}>MST2: {s.mst2}/{s.mst_total||30}</span>}
                                  {s.mst_avg!=null && <span style={{ fontSize:10, color:'#27AE60', fontWeight:700 }}>Avg: {s.mst_avg}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Remark */}
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>🤖 AI Remark</div>
                        <div style={{ padding:'14px 16px', background:'var(--card-bg)', borderRadius:14, borderLeft:'4px solid #7B61FF', fontSize:13, color:'var(--text1)', lineHeight:1.7, fontStyle:'italic' }}>
                          "{r.remark || 'No remark generated.'}"
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}