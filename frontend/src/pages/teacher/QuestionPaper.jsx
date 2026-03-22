import { useState, useEffect } from 'react';
import { useCurrentClass } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const DIFFICULTIES = ['Easy','Medium','Hard','Mixed'];
const EXAM_TYPES   = ['First Mid-Semester Examination','Second Mid-Semester Examination','End Semester Examination','Quiz','Practical'];

export default function QuestionPaper() {
  const [cls] = useCurrentClass();
  const [subjects, setSubjects] = useState([]);
  const [papers,   setPapers]   = useState([]);
  const [mode,     setMode]     = useState('generate'); // generate | editor
  const [generating, setGenerating] = useState(false);
  const [editorData, setEditorData] = useState(null);
  const [buildingPdf, setBuildingPdf] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreReq, setMoreReq]   = useState('');

  const [meta, setMeta] = useState({
    subject:'', college:'University Institute of Engineering', branch:'B.Tech (CSE)',
    semester:'4th Semester', exam_type:'First Mid-Semester Examination',
    subj_code:'', duration:'1:30 Hrs', total_marks:24, difficulty:'Medium', topic:'',
  });

  useEffect(() => {
    loadPapers();
    if (cls?.id) api.get('/classes/' + cls.id + '/my-subjects').then(r => {
      setSubjects(r.data || []);
      if (r.data.length) setMeta(m => ({ ...m, subject: r.data[0] }));
    });
  }, [cls?.id]);

  const loadPapers = () => api.get('/ai/papers').then(r => setPapers(r.data || []));

  // Generate PDF directly (download)
  const generatePDF = async () => {
    if (!meta.subject) { toast.error('Subject required'); return; }
    setGenerating(true);
    try {
      const tok = localStorage.getItem('sas_token');
      const res = await fetch('/api/ai/generate-paper', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tok}` },
        body: JSON.stringify({ ...meta, class_id: cls?.id||null }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error||'Failed'); }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `QP_${meta.subject}_${meta.exam_type}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Question paper downloaded!');
      loadPapers();
    } catch(err) { toast.error(err.message || 'Failed — check Gemini API key'); }
    finally { setGenerating(false); }
  };

  // Generate JSON for interactive editor
  const generateEditor = async () => {
    if (!meta.subject) { toast.error('Subject required'); return; }
    setGenerating(true);
    try {
      const r = await api.post('/ai/generate-paper-data', {
        class_id: cls?.id||null, subject: meta.subject,
        total_marks: meta.total_marks, difficulty: meta.difficulty, topic: meta.topic,
      });
      setEditorData({ ...r.data, meta });
      setMode('editor');
      toast.success('Paper generated! Edit questions below.');
    } catch(err) { toast.error(err.response?.data?.error || 'Failed — check API keys'); }
    finally { setGenerating(false); }
  };

  // Ask AI for more questions
  const askMoreQuestions = async () => {
    if (!moreReq.trim()) { toast.error('Describe what questions you need'); return; }
    setLoadingMore(true);
    try {
      const r = await api.post('/ai/more-questions', {
        subject: meta.subject, request: moreReq, class_id: cls?.id||null,
      });
      const newQs = r.data.questions || [];
      // Add to question bank
      setEditorData(d => ({ ...d, question_bank: [...(d.question_bank||[]), ...newQs] }));
      setMoreReq('');
      toast.success(`${newQs.length} new questions added to bank!`);
    } catch(err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoadingMore(false); }
  };

  // Build PDF from editor state
  const buildPDF = async () => {
    if (!editorData) return;
    setBuildingPdf(true);
    try {
      const tok = localStorage.getItem('sas_token');
      const res = await fetch('/api/ai/build-paper-pdf', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${tok}` },
        body: JSON.stringify({ paper_data: editorData, meta: editorData.meta, class_id: cls?.id||null }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error||'Failed'); }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `QP_${meta.subject}_${meta.exam_type}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('PDF downloaded!');
      loadPapers();
    } catch(err) { toast.error(err.message||'Failed'); }
    finally { setBuildingPdf(false); }
  };

  const deleteQ = (section, idx) => {
    setEditorData(d => ({
      ...d, [section]: d[section].filter((_,i)=>i!==idx)
    }));
  };

  const addFromBank = (q, section) => {
    const sno = (editorData[section]?.length||0) + 1;
    setEditorData(d => ({ ...d, [section]: [...(d[section]||[]), { ...q, sno }] }));
    toast.success('Question added to ' + section.replace('section_','Section ').toUpperCase());
  };

  const deletePaper = async id => {
    await api.delete('/ai/papers/' + id); toast.success('Deleted'); loadPapers();
  };

  const SECTIONS = [['section_a','Section A'],['section_b','Section B'],['section_c','Section C']];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Mode toggle */}
      <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' }}>
        <div>
          <div className="page-title">Question Paper Generator</div>
          <div className="page-sub">AI-powered • University exam format • Direct PDF download</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {['generate','editor'].map(m => (
            <button key={m} onClick={()=>setMode(m)} style={{
              padding:'9px 18px', borderRadius:'50px',
              border:`2px solid ${mode===m?'#7B61FF':'var(--border2)'}`,
              background:mode===m?'linear-gradient(135deg,#7B61FF,#6347D1)':'var(--card-bg)',
              color:mode===m?'#fff':'var(--text2)', fontSize:12, fontWeight:600,
              cursor:'pointer', fontFamily:'var(--font)', transition:'all 0.18s',
            }}>{m==='generate'?'⚡ Quick Generate':'✏️ Interactive Editor'}</button>
          ))}
        </div>
      </div>

      {/* ── GENERATE MODE ── */}
      {mode==='generate' && (
        <div className="card fade-up">
          <div className="card-header">
            <div><div className="card-title">⚡ Generate Question Paper</div><div className="card-sub">Fill details → AI generates → Downloads as PDF</div></div>
            {generating && <span className="badge badge-purple">✨ Generating...</span>}
          </div>
          <div className="card-body">
            {/* Row 1: Subject, Exam Type, Total Marks */}
            <div className="form-row form-row-3" style={{ marginBottom:12 }}>
              <div className="field">
                <label className="lbl">Subject *</label>
                {subjects.length ? (
                  <select className="inp" value={meta.subject} onChange={e=>setMeta(m=>({...m,subject:e.target.value}))}>
                    {subjects.map(s=><option key={s}>{s}</option>)}
                  </select>
                ) : (
                  <input className="inp" placeholder="e.g. Data Structures" value={meta.subject} onChange={e=>setMeta(m=>({...m,subject:e.target.value}))}/>
                )}
              </div>
              <div className="field">
                <label className="lbl">Exam Type</label>
                <select className="inp" value={meta.exam_type} onChange={e=>setMeta(m=>({...m,exam_type:e.target.value}))}>
                  {EXAM_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field"><label className="lbl">Total Marks</label><input className="inp" type="number" value={meta.total_marks} onChange={e=>setMeta(m=>({...m,total_marks:e.target.value}))}/></div>
            </div>
            {/* Row 2: College, Branch, Semester */}
            <div className="form-row form-row-3" style={{ marginBottom:12 }}>
              <div className="field"><label className="lbl">College Name</label><input className="inp" value={meta.college} onChange={e=>setMeta(m=>({...m,college:e.target.value}))}/></div>
              <div className="field"><label className="lbl">Branch</label><input className="inp" value={meta.branch} onChange={e=>setMeta(m=>({...m,branch:e.target.value}))}/></div>
              <div className="field"><label className="lbl">Semester</label><input className="inp" value={meta.semester} onChange={e=>setMeta(m=>({...m,semester:e.target.value}))}/></div>
            </div>
            {/* Row 3: Subject Code, Duration, Difficulty, Topic */}
            <div className="form-row form-row-3" style={{ marginBottom:16 }}>
              <div className="field"><label className="lbl">Subject Code (optional)</label><input className="inp" placeholder="e.g. CS-301" value={meta.subj_code} onChange={e=>setMeta(m=>({...m,subj_code:e.target.value}))}/></div>
              <div className="field"><label className="lbl">Duration</label><input className="inp" placeholder="1:30 Hrs" value={meta.duration} onChange={e=>setMeta(m=>({...m,duration:e.target.value}))}/></div>
              <div className="field">
                <label className="lbl">Difficulty</label>
                <select className="inp" value={meta.difficulty} onChange={e=>setMeta(m=>({...m,difficulty:e.target.value}))}>
                  {DIFFICULTIES.map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="field" style={{ marginBottom:16 }}>
              <label className="lbl">Focus Topic (optional)</label>
              <input className="inp" placeholder="e.g. Trees and Graphs, Sorting Algorithms..." value={meta.topic} onChange={e=>setMeta(m=>({...m,topic:e.target.value}))}/>
            </div>

            <div style={{ display:'flex', gap:12 }}>
              <button onClick={generatePDF} disabled={generating} className="btn btn-primary" style={{ padding:'12px 28px' }}>
                {generating ? '⏳ Generating PDF...' : '📄 Generate & Download PDF'}
              </button>
              <button onClick={generateEditor} disabled={generating} className="btn btn-ghost" style={{ padding:'12px 22px' }}>
                {generating ? '⏳ Loading...' : '✏️ Open in Editor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDITOR MODE ── */}
      {mode==='editor' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {!editorData ? (
            <div className="card">
              <div className="empty">
                <div className="empty-icon">✏️</div>
                <div className="empty-title">No paper loaded</div>
                <div className="empty-sub">Go to Quick Generate and click "Open in Editor"</div>
                <button className="btn btn-primary btn-sm" style={{ marginTop:12 }} onClick={() => setMode('generate')}>← Go to Generate</button>
              </div>
            </div>
          ) : (
            <>
              {/* Editor Header */}
              <div className="card fade-up" style={{ padding:'18px 24px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, color:'var(--text1)' }}>✏️ Editing: {editorData.meta?.subject} — {editorData.meta?.exam_type}</div>
                    <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{editorData.meta?.total_marks} marks · {editorData.meta?.duration}</div>
                  </div>
                  <div style={{ display:'flex', gap:10 }}>
                    <button onClick={buildPDF} disabled={buildingPdf} className="btn btn-primary">
                      {buildingPdf ? '⏳ Building...' : '📄 Download PDF'}
                    </button>
                    <button onClick={() => setEditorData(null)} className="btn btn-ghost btn-sm">Clear</button>
                  </div>
                </div>
              </div>

              {/* Section editors */}
              {SECTIONS.map(([key, label]) => (
                <div key={key} className="card fade-up">
                  <div className="card-header">
                    <div className="card-title">{label} ({editorData[key]?.length||0} questions)</div>
                  </div>
                  <div style={{ padding:'8px 0' }}>
                    {(editorData[key]||[]).map((q, i) => (
                      <div key={i} style={{ display:'flex', gap:12, padding:'12px 20px', borderBottom:'1px solid var(--border)', alignItems:'flex-start' }}>
                        <span style={{ fontSize:12, fontWeight:700, color:'var(--text3)', minWidth:28, paddingTop:2 }}>{q.sno||i+1}.</span>
                        <div style={{ flex:1 }}>
                          <textarea value={q.question} onChange={e => setEditorData(d => ({ ...d, [key]: d[key].map((qq,ii)=>ii===i?{...qq,question:e.target.value}:qq) }))}
                            style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:'2px solid var(--border2)', fontFamily:'var(--font)', fontSize:13, resize:'vertical', minHeight:60, outline:'none', color:'var(--text1)', background:'var(--card-bg)' }}/>
                          <div style={{ display:'flex', gap:8, marginTop:6 }}>
                            {['marks','co','bloom'].map(f => (
                              <div key={f} style={{ display:'flex', alignItems:'center', gap:4 }}>
                                <span style={{ fontSize:10, color:'var(--text3)' }}>{f.toUpperCase()}:</span>
                                <input value={q[f]||''} onChange={e => setEditorData(d => ({ ...d, [key]: d[key].map((qq,ii)=>ii===i?{...qq,[f]:e.target.value}:qq) }))}
                                  style={{ width:70, padding:'4px 8px', borderRadius:8, border:'1px solid var(--border2)', fontFamily:'var(--font)', fontSize:11, outline:'none', color:'var(--text1)', background:'var(--card-bg)' }}/>
                              </div>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => deleteQ(key, i)} style={{ color:'var(--red)', background:'none', border:'none', cursor:'pointer', fontSize:16, padding:4, flexShrink:0 }}>✕</button>
                      </div>
                    ))}
                    {(editorData[key]||[]).length===0 && <div style={{ padding:'16px 20px', fontSize:12, color:'var(--text3)', textAlign:'center' }}>No questions in this section. Add from question bank below.</div>}
                  </div>
                </div>
              ))}

              {/* Question Bank */}
              {(editorData.question_bank||[]).length > 0 && (
                <div className="card fade-up">
                  <div className="card-header">
                    <div><div className="card-title">🏦 Question Bank</div><div className="card-sub">Click + to add to a section</div></div>
                    <span className="badge badge-purple">{editorData.question_bank.length} questions</span>
                  </div>
                  <div style={{ padding:'8px 0' }}>
                    {editorData.question_bank.map((q, i) => (
                      <div key={i} style={{ display:'flex', gap:12, padding:'10px 20px', borderBottom:'1px solid var(--border)', alignItems:'center' }}>
                        <div style={{ flex:1, fontSize:12, color:'var(--text1)' }}>{q.question}</div>
                        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                          <span style={{ fontSize:9, color:'var(--text3)', padding:'2px 6px', background:'var(--surface2)', borderRadius:6 }}>Sec {q.section} · {q.marks}m · {q.co} · {q.bloom}</span>
                          {['section_a','section_b','section_c'].map(s => (
                            <button key={s} onClick={() => addFromBank(q, s)} style={{ fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:6, background:'#EEF0FF', color:'#6347D1', border:'none', cursor:'pointer' }}>
                              +{s.replace('section_','')}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ask for more questions */}
              <div className="card fade-up" style={{ background:'linear-gradient(135deg,#F8F4FF,#EEF0FF)', border:'none' }}>
                <div className="card-header" style={{ border:'none', paddingBottom:8 }}>
                  <div className="card-title" style={{ color:'#6347D1' }}>✨ Ask AI for More Questions</div>
                </div>
                <div className="card-body" style={{ paddingTop:0 }}>
                  <div style={{ display:'flex', gap:12 }}>
                    <input className="inp" placeholder="e.g. 3 hard questions on recursion for Section B" value={moreReq} onChange={e=>setMoreReq(e.target.value)} style={{ flex:1 }}/>
                    <button onClick={askMoreQuestions} disabled={loadingMore||!moreReq} className="btn btn-primary btn-sm">
                      {loadingMore?'Loading...':'✨ Generate'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Papers History */}
      {papers.length > 0 && (
        <div className="card fade-up">
          <div className="card-header">
            <div className="card-title">📚 Generated Papers History</div>
            <span className="badge badge-purple">{papers.length}</span>
          </div>
          <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {papers.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:'var(--surface2)', borderRadius:14 }}>
                <div style={{ width:40, height:40, borderRadius:12, background:'#FFF0F0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>📄</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text1)' }}>{p.subject}</div>
                  <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{new Date(p.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                </div>
                <span className="badge badge-purple" style={{ fontSize:9 }}>Paper #{p.id}</span>
                <button onClick={() => deletePaper(p.id)} className="btn btn-danger btn-xs">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}