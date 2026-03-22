import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';

export default function Forum() {
  const { user } = useAuth();
  const [classes,   setClasses]   = useState([]);
  const [cid,       setCid]       = useState('');
  const [subjects,  setSubjects]  = useState([]);
  const [subjFilter,setSubjFilter]= useState('');
  const [questions, setQuestions] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [openQid,   setOpenQid]   = useState(null);
  const [answers,   setAnswers]   = useState({});
  const [ansInput,  setAnsInput]  = useState({});
  const [posting,   setPosting]   = useState(false);
  const [aiWaiting, setAiWaiting] = useState(null); // qid waiting for AI
  const [form, setForm] = useState({ title:'', body:'', subject:'' });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.get('/classes/my').then(r => {
      const cls = r.data || [];
      setClasses(cls);
      if (cls.length) { setCid(String(cls[0].id)); }
    });
  }, []);

  useEffect(() => {
    if (!cid) return;
    loadQuestions();
    // Build subject list from class subjects
    const cls = classes.find(c => String(c.id)===cid);
    const subjs = cls?.subjects ? cls.subjects.split(',').map(s=>s.trim()).filter(Boolean) : [];
    setSubjects(subjs);
    setSubjFilter('');
  }, [cid]);

  const loadQuestions = () => {
    if (!cid) return;
    setLoading(true);
    const url = '/forum/questions/class/' + cid + (subjFilter ? '?subject=' + encodeURIComponent(subjFilter) : '');
    api.get(url).then(r => setQuestions(r.data || [])).finally(() => setLoading(false));
  };

  useEffect(() => { if (cid) loadQuestions(); }, [subjFilter]);

  const loadAnswers = async qid => {
    if (openQid === qid) { setOpenQid(null); return; }
    setOpenQid(qid);
    if (!answers[qid]) {
      const r = await api.get('/forum/questions/' + qid + '/answers');
      setAnswers(a => ({ ...a, [qid]: r.data || [] }));
    }
  };

  const postQuestion = async e => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Question title required'); return; }
    setPosting(true);
    try {
      const r = await api.post('/forum/questions', { class_id: parseInt(cid), ...form });
      toast.success('Question posted! AI is answering... 🤖');
      setAiWaiting(r.data.id);
      setShowForm(false);
      setForm({ title:'', body:'', subject:'' });
      loadQuestions();
      // Poll for AI answer after 4 seconds
      setTimeout(async () => {
        try {
          const ans = await api.get('/forum/questions/' + r.data.id + '/answers');
          setAnswers(a => ({ ...a, [r.data.id]: ans.data || [] }));
          setAiWaiting(null);
          loadQuestions();
        } catch { setAiWaiting(null); }
      }, 4000);
    } catch(err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setPosting(false); }
  };

  const postAnswer = async qid => {
    const ans = ansInput[qid]?.trim();
    if (!ans) { toast.error('Write an answer first'); return; }
    await api.post('/forum/questions/' + qid + '/answer', { answer: ans });
    toast.success('Answer posted!');
    setAnsInput(a => ({ ...a, [qid]: '' }));
    const r = await api.get('/forum/questions/' + qid + '/answers');
    setAnswers(a => ({ ...a, [qid]: r.data || [] }));
    loadQuestions();
  };

  const deleteQuestion = async qid => {
    if (!confirm('Delete this question?')) return;
    await api.delete('/forum/questions/' + qid);
    toast.success('Deleted');
    loadQuestions();
    if (openQid === qid) setOpenQid(null);
  };

  const triggerAI = async qid => {
    setAiWaiting(qid);
    try {
      await api.post('/forum/questions/' + qid + '/ai-answer');
      const r = await api.get('/forum/questions/' + qid + '/answers');
      setAnswers(a => ({ ...a, [qid]: r.data || [] }));
      toast.success('AI answered!');
      loadQuestions();
    } catch { toast.error('AI failed to answer'); }
    finally { setAiWaiting(null); }
  };

  // Answer role styles
  const answerStyle = role => {
    if (role === 'ai') return { bg:'linear-gradient(135deg,#F8F4FF,#EEF0FF)', border:'1px solid #C5CAFF', badge: { bg:'#7B61FF', color:'#fff', label:'🤖 AI Assistant' }};
    if (role === 'teacher') return { bg:'linear-gradient(135deg,#FFFBF0,#FFF3E8)', border:'1px solid #FFD4A8', badge: { bg:'#F2994A', color:'#fff', label:'👩‍🏫 Teacher' }};
    return { bg:'var(--surface2)', border:'1px solid var(--border)', badge: { bg:'#EEF0FF', color:'#6347D1', label:'👤 Student' }};
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
        <select className="inp" value={cid} onChange={e=>setCid(e.target.value)} style={{ minWidth:160, flex:1 }}>
          {classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.section?' · '+c.section:''}</option>)}
        </select>
        <select className="inp" value={subjFilter} onChange={e=>setSubjFilter(e.target.value)} style={{ minWidth:150, flex:1 }}>
          <option value="">All Subjects</option>
          {subjects.map(s=><option key={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowForm(s=>!s)} className="btn btn-primary">
          {showForm ? '✕ Cancel' : '💬 Ask Question'}
        </button>
      </div>

      {/* Post Question Form */}
      {showForm && (
        <div className="card fade-up">
          <div className="card-header"><div className="card-title">💬 Ask a Question</div><div className="card-sub">AI will auto-answer within seconds 🤖</div></div>
          <div className="card-body">
            <form onSubmit={postQuestion}>
              <div className="form-row form-row-2" style={{ marginBottom:12 }}>
                <div className="field">
                  <label className="lbl">Subject (optional)</label>
                  <select className="inp" value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}>
                    <option value="">General</option>
                    {subjects.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="lbl">Question Title *</label>
                  <input className="inp" placeholder="e.g. What is the difference between BFS and DFS?" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>
                </div>
              </div>
              <div className="field" style={{ marginBottom:14 }}>
                <label className="lbl">Details (optional)</label>
                <textarea className="inp" rows={3} placeholder="Explain your question in more detail..." value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}/>
              </div>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <button type="submit" disabled={posting} className="btn btn-primary">{posting?'Posting...':'💬 Post Question'}</button>
                <span style={{ fontSize:11, color:'var(--text3)' }}>🤖 AI will answer automatically</span>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Questions */}
      {loading ? <Loader text="Loading forum..."/> : questions.length===0 ? (
        <div className="card"><div className="empty"><div className="empty-icon">💬</div><div className="empty-title">No questions yet</div><div className="empty-sub">Be the first to ask!</div></div></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {questions.map(q => {
            const isOpen = openQid === q.id;
            const qAnswers = answers[q.id] || [];
            const isMyQ = q.student_roll === user?.roll_no;
            const isAiWait = aiWaiting === q.id;

            return (
              <div key={q.id} className="card" style={{ padding:0, overflow:'hidden' }}>
                {/* Question Header */}
                <div style={{ padding:'16px 20px', cursor:'pointer' }} onClick={() => loadAnswers(q.id)}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                    <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#7B61FF,#6347D1)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:14, flexShrink:0 }}>
                      {q.student_name?.split(' ').map(w=>w[0]).join('').slice(0,2)||'?'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', gap:8, marginBottom:6, flexWrap:'wrap', alignItems:'center' }}>
                        {q.subject && <span className="badge badge-purple">{q.subject}</span>}
                        {q.is_ai_answered===1 && <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:'50px', background:'linear-gradient(135deg,#7B61FF,#6347D1)', color:'#fff' }}>🤖 AI Answered</span>}
                        {isAiWait && <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:'50px', background:'#F8F4FF', color:'#7B61FF', border:'1px solid #C5CAFF' }}>✨ AI answering...</span>}
                      </div>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text1)', marginBottom:4 }}>{q.title}</div>
                      {q.body && <div style={{ fontSize:12, color:'var(--text2)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.body}</div>}
                      <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text3)' }}>
                        <span>👤 {q.student_name}</span>
                        <span>🕐 {new Date(q.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
                        <span>💬 {q.answer_count||0} answers</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                      {isMyQ && <button onClick={e=>{e.stopPropagation();deleteQuestion(q.id);}} className="btn btn-danger btn-xs">✕</button>}
                      <span style={{ fontSize:12, color:'var(--text3)', padding:'4px 8px' }}>{isOpen?'▲':'▼'}</span>
                    </div>
                  </div>
                </div>

                {/* Answers */}
                {isOpen && (
                  <div style={{ borderTop:'1px solid var(--border)' }}>
                    {/* Answers list */}
                    {qAnswers.length > 0 && (
                      <div style={{ padding:'12px 20px', display:'flex', flexDirection:'column', gap:12 }}>
                        {qAnswers.map((a, i) => {
                          const st = answerStyle(a.role);
                          return (
                            <div key={i} style={{ padding:'14px 16px', borderRadius:16, background:st.bg, border:st.border }}>
                              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                                <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:'50px', background:st.badge.bg, color:st.badge.color }}>{st.badge.label}</span>
                                <span style={{ fontSize:10, color:'var(--text3)' }}>{new Date(a.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                              </div>
                              <div style={{ fontSize:13, color:'var(--text1)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{a.answer}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Post answer + AI trigger */}
                    <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', background:'var(--surface2)' }}>
                      <div style={{ display:'flex', gap:10 }}>
                        <textarea className="inp" rows={2} placeholder="Write your answer..."
                          value={ansInput[q.id]||''} onChange={e=>setAnsInput(a=>({...a,[q.id]:e.target.value}))}
                          style={{ flex:1, resize:'none' }}/>
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          <button onClick={() => postAnswer(q.id)} className="btn btn-primary btn-sm">Post</button>
                          {!q.is_ai_answered && (
                            <button onClick={e=>{e.stopPropagation();triggerAI(q.id);}} disabled={isAiWait} className="btn btn-ghost btn-sm" style={{ fontSize:10 }}>
                              {isAiWait?'⏳':'🤖 Ask AI'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
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