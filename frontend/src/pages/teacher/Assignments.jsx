import { useState, useEffect } from 'react';
import { useCurrentClass, useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';

export default function TeacherAssignments() {
  const { user } = useAuth();
  const [cls] = useCurrentClass();
  const [subjects, setSubjects]   = useState([]);
  const [asgns,    setAsgns]      = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [file,     setFile]       = useState(null);
  const [form,     setForm]       = useState({ title:'', subject:'', description:'', deadline:'' });
  const [adding,   setAdding]     = useState(false);
  const [tab,      setTab]        = useState('list');       // list | submissions | grading
  const [selAsgn,  setSelAsgn]    = useState(null);
  const [subs,     setSubs]       = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [grades,   setGrades]     = useState({});
  const [savingGrades, setSavingGrades] = useState(false);
  const [marksTotalDefault, setMarksTotalDefault] = useState(10);

  const load = () => {
    if (!cls?.id) return;
    setLoading(true);
    api.get('/assignments/class/' + cls.id)
      .then(r => setAsgns(r.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!cls?.id) return;
    load();
    api.get('/classes/' + cls.id + '/my-subjects').then(r => {
      setSubjects(r.data || []);
      if (r.data.length) setForm(f => ({ ...f, subject: r.data[0] }));
    });
  }, [cls?.id]);

  const loadSubmissions = async (asgn) => {
    setSelAsgn(asgn); setTab('submissions'); setSubLoading(true);
    try {
      const r = await api.get('/assignments/' + asgn.id + '/submissions');
      setSubs(r.data || []);
      // Init grades state
      const g = {};
      (r.data || []).forEach(s => { g[s.roll_no] = { marks_obtained: s.marks_obtained ?? '', marks_total: s.marks_total ?? marksTotalDefault }; });
      setGrades(g);
    } catch { toast.error('Failed to load submissions'); }
    finally { setSubLoading(false); }
  };

  const handleCreate = async e => {
    e.preventDefault();
    if (!form.title || !form.subject || !form.deadline) { toast.error('Title, subject and deadline required'); return; }
    setAdding(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v]) => fd.append(k, v));
      fd.append('class_id', cls.id);
      if (file) fd.append('file', file);
      await api.post('/assignments/', fd, { headers: { 'Content-Type': 'multipart/form-data' }});
      toast.success('Assignment created!');
      setShowForm(false); setFile(null);
      setForm({ title:'', subject:subjects[0]||'', description:'', deadline:'' });
      load();
    } catch(err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setAdding(false); }
  };

  const handleDelete = async id => {
    if (!confirm('Delete this assignment?')) return;
    await api.delete('/assignments/' + id); toast.success('Deleted'); load();
  };

  const downloadFile = async (asgn) => {
    const tok = localStorage.getItem('sas_token');
    const r = await fetch(`/api/assignments/${asgn.id}/download`, { headers: { Authorization: `Bearer ${tok}` }});
    if (!r.ok) { toast.error('No file attached'); return; }
    const b = await r.blob();
    const url = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = url; a.download = asgn.file_name; a.click();
    URL.revokeObjectURL(url);
  };

  const saveGrades = async () => {
    if (!selAsgn) return;
    setSavingGrades(true);
    try {
      for (const [roll, g] of Object.entries(grades)) {
        if (g.marks_obtained === '' || g.marks_obtained === null) continue;
        await api.post(`/assignments/${selAsgn.id}/grade`, {
          student_roll: roll,
          marks_obtained: parseFloat(g.marks_obtained),
          marks_total: parseFloat(g.marks_total) || marksTotalDefault,
        });
      }
      toast.success('Grades saved!');
      loadSubmissions(selAsgn);
    } catch { toast.error('Failed to save grades'); }
    finally { setSavingGrades(false); }
  };

  if (!cls) return <div className="empty"><div className="empty-icon">🏫</div><div>Select a class first</div></div>;
  if (loading) return <Loader text="Loading assignments..."/>;

  // Show ONLY this teacher's assignments (filter by teacher_id)
  const myAsgns = asgns.filter(a => a.teacher_id === user?.roll_no);
  const pending = myAsgns.filter(a => (a.days_left || 0) >= 0);
  const past    = myAsgns.filter(a => (a.days_left || 0) < 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div className="page-title">Assignments</div>
          <div className="page-sub">{cls.name} — manage your assignments</div>
        </div>
        <button onClick={() => setShowForm(s=>!s)} className="btn btn-primary">
          {showForm ? '✕ Cancel' : '+ New Assignment'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card fade-up">
          <div className="card-header"><div className="card-title">📋 New Assignment</div></div>
          <div className="card-body">
            <form onSubmit={handleCreate}>
              <div className="form-row form-row-2" style={{ marginBottom:12 }}>
                <div className="field"><label className="lbl">Title *</label><input className="inp" placeholder="e.g. Implement Binary Tree" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>
                <div className="field">
                  <label className="lbl">Subject *</label>
                  <select className="inp" value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}>
                    {subjects.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row form-row-2" style={{ marginBottom:12 }}>
                <div className="field"><label className="lbl">Deadline *</label><input className="inp" type="date" value={form.deadline} min={new Date().toISOString().split('T')[0]} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))}/></div>
                <div className="field"><label className="lbl">Attach File (optional)</label><input className="inp" type="file" onChange={e=>setFile(e.target.files[0])} style={{ padding:'8px 12px' }}/></div>
              </div>
              <div className="field" style={{ marginBottom:14 }}>
                <label className="lbl">Description</label>
                <textarea className="inp" rows={2} placeholder="Describe the assignment..." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
              </div>
              <button type="submit" disabled={adding} className="btn btn-primary">{adding?'Creating...':'📋 Create Assignment'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Tabs: list / submissions / grading */}
      {tab !== 'list' && selAsgn && (
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={() => setTab('list')} className="btn btn-ghost btn-sm">← Back to List</button>
          <span style={{ fontSize:13, fontWeight:600, color:'var(--text1)' }}>{selAsgn.title}</span>
          <span className="badge badge-purple">{selAsgn.subject}</span>
        </div>
      )}

      {/* Assignment List */}
      {tab==='list' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {myAsgns.length===0 && <div className="card"><div className="empty"><div className="empty-icon">📋</div><div className="empty-title">No assignments yet</div><div className="empty-sub">Create your first assignment above</div></div></div>}

          {pending.length > 0 && (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>Active Assignments ({pending.length})</div>
              {pending.map(a => <AssignmentCard key={a.id} a={a} onView={() => loadSubmissions(a)} onDelete={handleDelete} onDownload={downloadFile} subjects={subjects}/>)}
            </div>
          )}
          {past.length > 0 && (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>Past Assignments ({past.length})</div>
              {past.map(a => <AssignmentCard key={a.id} a={a} onView={() => loadSubmissions(a)} onDelete={handleDelete} onDownload={downloadFile} subjects={subjects} past/>)}
            </div>
          )}
        </div>
      )}

      {/* Submissions View */}
      {tab==='submissions' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', gap:10 }}>
            <div style={{ padding:'12px 18px', borderRadius:14, background:'#EEF0FF', textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:800, color:'#6347D1' }}>{subs.length}</div>
              <div style={{ fontSize:10, color:'#6347D1', fontWeight:600 }}>Submitted</div>
            </div>
            <div style={{ padding:'12px 18px', borderRadius:14, background:'#FFF0F0', textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:800, color:'#EB5757' }}>{(selAsgn?.total_students||0)-subs.length}</div>
              <div style={{ fontSize:10, color:'#EB5757', fontWeight:600 }}>Not Submitted</div>
            </div>
            <div style={{ padding:'12px 18px', borderRadius:14, background:'#E8FBF0', textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:800, color:'#27AE60' }}>{selAsgn?.total_students||0}</div>
              <div style={{ fontSize:10, color:'#27AE60', fontWeight:600 }}>Total Students</div>
            </div>
            <button onClick={() => setTab('grading')} className="btn btn-primary btn-sm" style={{ marginLeft:'auto', alignSelf:'center' }}>
              📝 Enter Grades
            </button>
          </div>

          {subLoading ? <Loader/> : subs.length===0 ? (
            <div className="card"><div className="empty"><div className="empty-icon">📋</div><div className="empty-sub">No submissions yet</div></div></div>
          ) : (
            <div className="card">
              <table className="tbl">
                <thead><tr><th>Student</th><th>Roll No</th><th>Submitted At</th><th>File</th><th>Marks</th></tr></thead>
                <tbody>
                  {subs.map(s => (
                    <tr key={s.roll_no}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div className="stu-av" style={{ background:'linear-gradient(135deg,#27AE60,#1a8a4a)', width:30, height:30, fontSize:10 }}>
                            {s.name?.split(' ').map(w=>w[0]).join('').slice(0,2)}
                          </div>
                          <span style={{ fontWeight:600, fontSize:13 }}>{s.name}</span>
                        </div>
                      </td>
                      <td><span className="badge badge-purple">{s.roll_no}</span></td>
                      <td style={{ fontSize:11, color:'var(--text3)' }}>{new Date(s.submitted_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                      <td>
                        {s.file_name ? (
                          <button className="btn btn-ghost btn-xs" onClick={async () => {
                            const tok = localStorage.getItem('sas_token');
                            const res = await fetch(`/api/assignments/${selAsgn.id}/submissions/${s.roll_no}/download`, { headers:{ Authorization:`Bearer ${tok}` }});
                            if (res.ok) { const b=await res.blob(); const u=URL.createObjectURL(b); const a=document.createElement('a');a.href=u;a.download=s.file_name;a.click(); }
                          }}>⬇ {s.file_name}</button>
                        ) : <span style={{ color:'var(--text3)', fontSize:11 }}>No file</span>}
                      </td>
                      <td>
                        {s.marks_obtained!=null ? (
                          <span style={{ fontWeight:700, color:'#6347D1' }}>{s.marks_obtained}/{s.marks_total||10}</span>
                        ) : <span style={{ color:'var(--text3)', fontSize:11 }}>Not graded</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Grading View */}
      {tab==='grading' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', gap:14, alignItems:'flex-end' }}>
            <div className="field">
              <label className="lbl">Default Marks Total</label>
              <input className="inp" type="number" value={marksTotalDefault} onChange={e => {
                setMarksTotalDefault(Number(e.target.value));
                setGrades(g => { const ng={...g}; Object.keys(ng).forEach(r => { if(!ng[r].marks_total||ng[r].marks_total===10) ng[r]={...ng[r],marks_total:Number(e.target.value)}; }); return ng; });
              }} style={{ width:100 }}/>
            </div>
            <button onClick={() => setTab('submissions')} className="btn btn-ghost btn-sm">← Back to Submissions</button>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">📝 Grade Submissions — {selAsgn?.title}</div>
              <button onClick={saveGrades} disabled={savingGrades} className="btn btn-primary btn-sm">
                {savingGrades?'Saving...':'💾 Save All Grades'}
              </button>
            </div>
            <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {subs.map(s => (
                <div key={s.roll_no} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:'var(--surface2)', borderRadius:14 }}>
                  <div className="stu-av" style={{ background:'linear-gradient(135deg,#7B61FF,#6347D1)', width:36, height:36, fontSize:12 }}>
                    {s.name?.split(' ').map(w=>w[0]).join('').slice(0,2)}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)' }}>{s.name}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{s.roll_no}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <input type="number" min="0" max={grades[s.roll_no]?.marks_total||10}
                      value={grades[s.roll_no]?.marks_obtained ?? ''}
                      onChange={e => setGrades(g => ({ ...g, [s.roll_no]: { ...g[s.roll_no], marks_obtained: e.target.value }}))}
                      placeholder="—"
                      style={{ width:70, padding:'7px 10px', borderRadius:10, border:'2px solid var(--border2)', fontFamily:'var(--font)', fontSize:13, fontWeight:700, textAlign:'center', outline:'none', color:'var(--text1)', background:'var(--card-bg)' }}
                    />
                    <span style={{ fontSize:12, color:'var(--text3)' }}>/</span>
                    <input type="number" min="1"
                      value={grades[s.roll_no]?.marks_total ?? marksTotalDefault}
                      onChange={e => setGrades(g => ({ ...g, [s.roll_no]: { ...g[s.roll_no], marks_total: e.target.value }}))}
                      style={{ width:60, padding:'7px 10px', borderRadius:10, border:'2px solid var(--border2)', fontFamily:'var(--font)', fontSize:13, textAlign:'center', outline:'none', color:'var(--text3)', background:'var(--card-bg)' }}
                    />
                    {grades[s.roll_no]?.marks_obtained !== '' && grades[s.roll_no]?.marks_obtained != null && (
                      <span style={{ fontSize:12, fontWeight:700, color:'#6347D1', minWidth:40 }}>
                        {Math.round(grades[s.roll_no].marks_obtained / (grades[s.roll_no].marks_total||10) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {subs.length === 0 && <div className="empty" style={{ padding:'20px 0' }}><div className="empty-sub">No submissions to grade yet</div></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssignmentCard({ a, onView, onDelete, onDownload, past }) {
  const urgency = a.urgency;
  const clr = urgency==='critical'?'#EB5757':urgency==='high'?'#F2994A':'#6347D1';
  const bg  = urgency==='critical'?'#FFF0F0':urgency==='high'?'#FFF3E8':'#EEF0FF';
  const dl  = a.days_left;

  return (
    <div className="card fade-up" style={{ padding:'18px 20px', opacity:past?0.8:1 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
        <div style={{ width:48, height:48, borderRadius:14, background:bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:clr, lineHeight:1 }}>{dl<0?'✓':Math.abs(dl)}</div>
          <div style={{ fontSize:8, color:clr, fontWeight:600, textTransform:'uppercase' }}>{dl<0?'done':'days'}</div>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', gap:8, marginBottom:5, flexWrap:'wrap' }}>
            <span className="badge badge-purple">{a.subject}</span>
            {dl>=0&&dl<=2&&<span className="badge badge-red">Urgent</span>}
            {past&&<span className="badge badge-gray">Past</span>}
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text1)', marginBottom:3 }}>{a.title}</div>
          {a.description && <div style={{ fontSize:11, color:'var(--text3)', marginBottom:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.description}</div>}
          <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text3)', flexWrap:'wrap' }}>
            <span>📅 Due: <strong style={{ color:'var(--text2)' }}>{new Date(a.deadline+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</strong></span>
            <span>📤 <strong style={{ color:'#27AE60' }}>{a.submission_count||0}</strong>/{a.total_students||0} submitted</span>
          </div>
          {/* Submission progress bar */}
          {a.total_students > 0 && (
            <div style={{ marginTop:8, height:5, background:'var(--surface3)', borderRadius:50, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${(a.submission_count||0)/a.total_students*100}%`, background:'linear-gradient(90deg,#27AE60,#6FCF97)', borderRadius:50 }}/>
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap' }}>
          <button onClick={onView} className="btn btn-ghost btn-xs">👁 Submissions</button>
          {a.file_name && <button onClick={() => onDownload(a)} className="btn btn-ghost btn-xs">⬇ File</button>}
          <button onClick={() => onDelete(a.id)} className="btn btn-danger btn-xs">Delete</button>
        </div>
      </div>
    </div>
  );
}