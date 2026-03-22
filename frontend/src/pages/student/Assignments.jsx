import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';

export default function StudentAssignments() {
  const [asgns,   setAsgns]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all'); // all | pending | submitted | overdue
  const [explain, setExplain] = useState({});   // { [id]: text }
  const [explaining, setExplaining] = useState(null);
  const [submitting, setSubmitting] = useState(null);

  useEffect(() => {
    api.get('/assignments/mine').then(r => setAsgns(r.data||[])).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (aid, file) => {
    setSubmitting(aid);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      await api.post('/assignments/' + aid + '/submit', fd, { headers:{ 'Content-Type':'multipart/form-data' }});
      toast.success('Submitted! ✅');
      const r = await api.get('/assignments/mine');
      setAsgns(r.data||[]);
    } catch(err) { toast.error(err.response?.data?.error||'Failed'); }
    finally { setSubmitting(null); }
  };

  const handleExplain = async aid => {
    if (explain[aid]) { setExplain(e=>({ ...e, [aid]: null })); return; }
    setExplaining(aid);
    try {
      const r = await api.post('/ai/explain-assignment', { assignment_id: aid });
      setExplain(e => ({ ...e, [aid]: r.data.explanation }));
    } catch { toast.error('AI explanation failed'); }
    finally { setExplaining(null); }
  };

  const downloadFile = async a => {
    const tok = localStorage.getItem('sas_token');
    const res = await fetch(`/api/assignments/${a.id}/download`, { headers:{ Authorization:`Bearer ${tok}` }});
    if (!res.ok) { toast.error('No file attached'); return; }
    const b = await res.blob();
    const url = URL.createObjectURL(b);
    const el = document.createElement('a'); el.href=url; el.download=a.file_name; el.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Loader text="Loading assignments..."/>;

  const now = new Date();
  const filtered = asgns.filter(a => {
    if (filter==='pending')   return !a.submitted && new Date(a.deadline+'T23:59:59') >= now;
    if (filter==='submitted') return a.submitted;
    if (filter==='overdue')   return !a.submitted && new Date(a.deadline+'T23:59:59') < now;
    return true;
  });

  const counts = {
    all: asgns.length,
    pending: asgns.filter(a=>!a.submitted&&new Date(a.deadline+'T23:59:59')>=now).length,
    submitted: asgns.filter(a=>a.submitted).length,
    overdue: asgns.filter(a=>!a.submitted&&new Date(a.deadline+'T23:59:59')<now).length,
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {[
          {id:'all',label:'All',icon:'📋'},
          {id:'pending',label:'Pending',icon:'⏳'},
          {id:'submitted',label:'Submitted',icon:'✅'},
          {id:'overdue',label:'Overdue',icon:'❌'},
        ].map(f => (
          <button key={f.id} onClick={()=>setFilter(f.id)} style={{
            padding:'9px 18px', borderRadius:'50px',
            border:`2px solid ${filter===f.id?'#7B61FF':'var(--border2)'}`,
            background:filter===f.id?'linear-gradient(135deg,#7B61FF,#6347D1)':'var(--card-bg)',
            color:filter===f.id?'#fff':'var(--text2)', fontSize:12, fontWeight:600,
            cursor:'pointer', fontFamily:'var(--font)', transition:'all 0.18s',
          }}>{f.icon} {f.label} <span style={{ opacity:0.7 }}>({counts[f.id]})</span></button>
        ))}
      </div>

      {filtered.length===0 ? (
        <div className="card"><div className="empty"><div className="empty-icon">📋</div><div className="empty-title">No assignments here</div></div></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {filtered.map(a => {
            const dl    = a.days_left;
            const over  = dl < 0;
            const clr   = a.submitted?'#27AE60':over?'#EB5757':a.urgency==='critical'?'#EB5757':a.urgency==='high'?'#F2994A':'#6347D1';
            const bg    = a.submitted?'#E8FBF0':over?'#FFF0F0':a.urgency==='critical'?'#FFF0F0':a.urgency==='high'?'#FFF3E8':'#EEF0FF';
            const hasMark = a.sub_marks != null;

            return (
              <div key={a.id} className="card fade-up" style={{ padding:0, overflow:'hidden' }}>
                <div style={{ display:'flex', gap:0 }}>
                  {/* Left color bar */}
                  <div style={{ width:6, background:clr, flexShrink:0 }}/>

                  <div style={{ flex:1, padding:'18px 20px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                      {/* Status indicator */}
                      <div style={{ width:52, height:52, borderRadius:16, background:bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {a.submitted ? (
                          <><div style={{ fontSize:20 }}>✅</div><div style={{ fontSize:8, color:'#27AE60', fontWeight:700 }}>Done</div></>
                        ) : over ? (
                          <><div style={{ fontSize:20 }}>❌</div><div style={{ fontSize:8, color:'#EB5757', fontWeight:700 }}>Overdue</div></>
                        ) : (
                          <><div style={{ fontSize:18, fontWeight:800, color:clr, lineHeight:1 }}>{Math.abs(dl)}</div><div style={{ fontSize:8, color:clr, fontWeight:600 }}>days left</div></>
                        )}
                      </div>

                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                          <span className="badge badge-purple">{a.subject}</span>
                          {a.class_name && <span style={{ fontSize:10, color:'var(--text3)' }}>{a.class_name}</span>}
                          {!a.submitted && !over && dl<=2 && <span className="badge badge-red">Urgent</span>}
                          {hasMark && <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:'50px', background:'#E8FBF0', color:'#27AE60' }}>Marked: {a.sub_marks}/{a.sub_marks_total}</span>}
                        </div>
                        <div style={{ fontSize:15, fontWeight:700, color:'var(--text1)', marginBottom:4 }}>{a.title}</div>
                        {a.description && <div style={{ fontSize:12, color:'var(--text2)', marginBottom:6 }}>{a.description}</div>}
                        <div style={{ fontSize:11, color:'var(--text3)' }}>
                          📅 Deadline: <strong style={{ color:'var(--text2)' }}>{new Date(a.deadline+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</strong>
                          {a.teacher_name && <span style={{ marginLeft:12 }}>👩‍🏫 {a.teacher_name}</span>}
                        </div>

                        {/* Marks display */}
                        {hasMark && (
                          <div style={{ marginTop:10, padding:'10px 14px', background:'#E8FBF0', borderRadius:12, display:'flex', gap:14, alignItems:'center' }}>
                            <div style={{ fontSize:22, fontWeight:900, color:'#27AE60' }}>{a.sub_marks}/{a.sub_marks_total||10}</div>
                            <div>
                              <div style={{ fontSize:11, fontWeight:700, color:'#27AE60' }}>Assignment Marks</div>
                              <div style={{ height:5, width:100, background:'#C8F0D8', borderRadius:50, overflow:'hidden', marginTop:4 }}>
                                <div style={{ height:'100%', width:`${Math.min(100,a.sub_marks/(a.sub_marks_total||10)*100)}%`, background:'#27AE60', borderRadius:50 }}/>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* AI Explanation */}
                        {explain[a.id] && (
                          <div style={{ marginTop:12, padding:'14px 16px', background:'linear-gradient(135deg,#F8F4FF,#EEF0FF)', borderRadius:16, border:'1px solid #C5CAFF' }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#6347D1', marginBottom:8 }}>🤖 AI Explanation</div>
                            <div style={{ fontSize:12, color:'var(--text1)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{explain[a.id]}</div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
                        {!a.submitted && !over && (
                          <label className="btn btn-primary btn-sm" style={{ cursor:'pointer', textAlign:'center' }}>
                            {submitting===a.id ? '⏳...' : '📤 Submit'}
                            <input type="file" style={{ display:'none' }} onChange={e => { if(e.target.files[0]) handleSubmit(a.id, e.target.files[0]); }}/>
                          </label>
                        )}
                        {!a.submitted && !over && (
                          <button onClick={() => handleSubmit(a.id, null)} disabled={submitting===a.id} className="btn btn-ghost btn-xs">
                            Submit (no file)
                          </button>
                        )}
                        {a.file_name && (
                          <button onClick={() => downloadFile(a)} className="btn btn-ghost btn-xs">⬇ File</button>
                        )}
                        <button onClick={() => handleExplain(a.id)} disabled={explaining===a.id} className="btn btn-ghost btn-xs" style={{ color:'#6347D1' }}>
                          {explaining===a.id ? '⏳...' : explain[a.id] ? '▲ Hide AI' : '🤖 Explain'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}