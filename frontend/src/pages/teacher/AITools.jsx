import { useState, useEffect } from 'react';
import { useCurrentClass } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const TOOLS = [
  { id:'lesson',  icon:'📖', title:'Lesson Plan',          desc:'Generate complete lesson plans with objectives, activities and assessment.',     color:'#6347D1', bg:'#EEF0FF', action:'Generate Plan'   },
  { id:'rubric',  icon:'📋', title:'Assignment Rubric',     desc:'Build detailed grading rubrics with Excellent/Good/Average/Poor criteria.',     color:'#27AE60', bg:'#E8FBF0', action:'Create Rubric'   },
  { id:'mcq',     icon:'🎯', title:'MCQ Generator',         desc:'Generate topic-wise MCQs with difficulty levels and answer explanations.',       color:'#F2994A', bg:'#FFF3E8', action:'Generate MCQs'   },
  { id:'summary', icon:'📝', title:'Content Summarizer',    desc:'Summarize lengthy academic content into concise, student-friendly notes.',       color:'#2F80ED', bg:'#EBF4FF', action:'Summarize'        },
  { id:'paper',   icon:'🗂️', title:'Question Paper',        desc:'Create balanced question papers with multiple sections and marking schemes.',    color:'#EB5757', bg:'#FFF0F0', action:'Generate Paper'   },
];

export default function AITools() {
  const [cls] = useCurrentClass();
  const [subjects, setSubjects] = useState([]);
  const [activeTool, setActiveTool] = useState(null);
  const [form, setForm] = useState({ topic:'', subject:'', count:10, points:100 });
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cls?.id) return;
    api.get('/classes/' + cls.id + '/my-subjects').then(r => {
      setSubjects(r.data || []);
      if (r.data.length) setForm(f => ({ ...f, subject: r.data[0] }));
    });
  }, [cls?.id]);

  const handleGenerate = async () => {
    if (!form.topic.trim()) { toast.error('Enter a topic first'); return; }
    setLoading(true); setResult('');
    try {
      let r;
      if (activeTool === 'lesson') {
        r = await api.post('/ai/lesson-plan', {
          topic: form.topic, subject: form.subject, class_id: cls?.id
        });
        setResult(r.data.plan || JSON.stringify(r.data, null, 2));

      } else if (activeTool === 'rubric') {
        r = await api.post('/ai/rubric', {
          assignment_title: form.topic,   // ← correct field name
          subject: form.subject,
          total_marks: form.points        // ← correct field name
        });
        setResult(r.data.rubric || JSON.stringify(r.data, null, 2));

      } else if (activeTool === 'mcq') {
        r = await api.post('/ai/generate-mcq', {
          topic: form.topic, subject: form.subject,
          num_questions: form.count,      // ← correct field name
          class_id: cls?.id
        });
        setResult(r.data.mcqs || JSON.stringify(r.data, null, 2));

      } else if (activeTool === 'summary') {
        r = await api.post('/ai/summarize', {
          text: form.topic               // ← correct field name
        });
        setResult(r.data.summary || JSON.stringify(r.data, null, 2));

      } else if (activeTool === 'paper') {
        r = await api.post('/ai/generate-paper', {
          subject: form.subject, topic: form.topic,
          total_marks: form.points, class_id: cls?.id
        });
        setResult(r.data.content || JSON.stringify(r.data, null, 2));
      }
      toast.success('Generated successfully!');
    } catch(err) {
      toast.error(err.response?.data?.error || 'Generation failed — check API keys');
    } finally { setLoading(false); }
  };

  const activeDef = TOOLS.find(t => t.id === activeTool);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div className="page-header fade-up">
        <div className="page-title">AI Tools</div>
        <div className="page-sub">Powered by Groq &amp; Gemini — Generate academic content instantly</div>
      </div>

      {/* Tool Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }} className="fade-up-d1">
        {TOOLS.map(t => (
          <div key={t.id} className="card" onClick={() => { setActiveTool(t.id); setResult(''); }}
            style={{
              padding:'22px', cursor:'pointer', transition:'all 0.22s',
              border: activeTool === t.id ? `2px solid ${t.color}` : '2px solid transparent',
              boxShadow: activeTool === t.id ? `0 8px 32px ${t.color}22` : 'var(--card-shadow)',
            }}
            onMouseEnter={e => { if (activeTool !== t.id) { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; }}}
            onMouseLeave={e => { if (activeTool !== t.id) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--card-shadow)'; }}}
          >
            <div style={{ width:50, height:50, borderRadius:16, background:t.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, marginBottom:14 }}>{t.icon}</div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--text1)', marginBottom:5 }}>{t.title}</div>
            <div style={{ fontSize:11, color:'var(--text3)', lineHeight:1.6, marginBottom:14 }}>{t.desc}</div>
            <span style={{
              fontSize:11, fontWeight:700, padding:'5px 14px', borderRadius:'50px',
              background: activeTool === t.id ? t.color : t.bg,
              color: activeTool === t.id ? '#fff' : t.color,
              transition:'all 0.2s',
            }}>
              {t.action} →
            </span>
          </div>
        ))}

        {/* Coming soon card */}
        <div className="card" style={{ padding:'22px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', gap:8, border:'2px dashed var(--border2)', boxShadow:'none', background:'var(--surface2)' }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:'#EEF0FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>✨</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#6347D1' }}>More Coming Soon</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>AI-powered tools being added</div>
        </div>
      </div>

      {/* Generator Panel */}
      {activeTool && activeDef && (
        <div className="card fade-up-d2">
          <div className="card-header">
            <div>
              <div className="card-title">{activeDef.icon} {activeDef.title}</div>
              <div className="card-sub">Fill in the details and generate</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setActiveTool(null); setResult(''); }}>✕ Close</button>
          </div>
          <div className="card-body">
            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:16 }}>

              {/* Topic / Content input */}
              <div style={{ flex:2, minWidth:200 }} className="field">
                <label className="lbl">
                  {activeTool === 'summary' ? 'Content to Summarize *' : 'Topic *'}
                </label>
                <input className="inp"
                  placeholder={
                    activeTool === 'summary'
                      ? 'Paste academic content here to summarize...'
                      : 'e.g. Binary Trees, Sorting Algorithms, Linked Lists...'
                  }
                  value={form.topic}
                  onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                />
              </div>

              {/* Subject selector */}
              {subjects.length > 0 && activeTool !== 'summary' && (
                <div style={{ flex:1, minWidth:140 }} className="field">
                  <label className="lbl">Subject</label>
                  <select className="inp" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                    {subjects.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* MCQ count */}
              {activeTool === 'mcq' && (
                <div style={{ width:100 }} className="field">
                  <label className="lbl">No. of MCQs</label>
                  <input className="inp" type="number" min="5" max="30" value={form.count}
                    onChange={e => setForm(f => ({ ...f, count: e.target.value }))} />
                </div>
              )}

              {/* Marks for rubric/paper */}
              {(activeTool === 'rubric' || activeTool === 'paper') && (
                <div style={{ width:120 }} className="field">
                  <label className="lbl">{activeTool === 'rubric' ? 'Total Marks' : 'Total Marks'}</label>
                  <input className="inp" type="number" value={form.points}
                    onChange={e => setForm(f => ({ ...f, points: e.target.value }))} />
                </div>
              )}
            </div>

            {/* Generate button */}
            <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}
              style={{ padding:'12px 28px' }}>
              {loading ? (
                <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span className="dot" style={{ width:6, height:6, background:'#fff' }} />
                  <span className="dot" style={{ width:6, height:6, background:'#fff', animationDelay:'0.2s' }} />
                  <span className="dot" style={{ width:6, height:6, background:'#fff', animationDelay:'0.4s' }} />
                  Generating...
                </span>
              ) : `✨ ${activeDef.action}`}
            </button>

            {/* Result */}
            {result && (
              <div style={{ marginTop:20, padding:'20px', background:'var(--surface2)', borderRadius:16, border:'1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--text1)' }}>✅ Generated Result</span>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => { navigator.clipboard.writeText(result); toast.success('Copied!'); }}>
                      📋 Copy
                    </button>
                    <button className="btn btn-ghost btn-xs" onClick={() => setResult('')}>
                      ✕ Clear
                    </button>
                  </div>
                </div>
                <pre style={{ fontSize:12, color:'var(--text2)', whiteSpace:'pre-wrap', lineHeight:1.8, fontFamily:'var(--font)', margin:0 }}>
                  {result}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}