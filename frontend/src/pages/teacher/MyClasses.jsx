import { useState, useEffect } from 'react';
import { useCurrentClass, useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';

const GENDERS = ['male','female','other'];

export default function MyClasses() {
  const { user } = useAuth();
  const [, setCurrentClass] = useCurrentClass();
  const [classes, setClasses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [cform, setCform]       = useState({name:'',section:'',semester:'',course:''});
  const [sform, setSform]       = useState({roll_no:'',name:'',gender:'male',phone:'',password:''});
  const [subj, setSubj]         = useState('');
  const [adding, setAdding]     = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});

  const load = () => api.get('/classes/my').then(r=>{setClasses(r.data);setLoading(false);}).catch(()=>setLoading(false));

  const loadClass = c => {
    setSelected(c); setEditMode(false);
    setSform(f=>({...f,course:c.course||'',semester:c.semester||''}));
    Promise.all([api.get('/classes/'+c.id+'/students'),api.get('/classes/'+c.id+'/my-subjects')])
      .then(([s,sub])=>{setStudents(s.data);setSubjects(sub.data);});
  };

  const saveEdit = async () => {
    try {
      const r = await api.put('/classes/'+selected.id, editForm);
      toast.success('Class updated!');
      setSelected(r.data); setCurrentClass(r.data); setEditMode(false); load();
    } catch(err){toast.error(err.response?.data?.error||'Failed');}
  };

  useEffect(()=>{load();},[]);

  const createClass = async e => {
    e.preventDefault();
    if(!cform.name.trim()){toast.error('Class name required');return;}
    setAdding(true);
    try{await api.post('/classes/',cform);toast.success('Class created!');setCform({name:'',section:'',semester:'',course:''});load();}
    catch(err){toast.error(err.response?.data?.error||'Failed');}finally{setAdding(false);}
  };

  const addSubject = async e => {
    e.preventDefault();
    if(!subj.trim()||!selected)return;
    try{
      await api.post('/classes/'+selected.id+'/subjects',{subject:subj.trim()});
      toast.success('Subject added!');setSubj('');
      const r=await api.get('/classes/'+selected.id+'/my-subjects');setSubjects(r.data);
    }catch(err){toast.error(err.response?.data?.error||'Failed');}
  };

  const removeSubject = async s => {
    await api.delete('/classes/'+selected.id+'/subjects/'+encodeURIComponent(s));
    toast.success('Removed');setSubjects(p=>p.filter(x=>x!==s));
  };

  const enrollStudent = async e => {
    e.preventDefault();
    if(!sform.roll_no.trim()||!sform.name.trim()||!selected){toast.error('Roll number and name required');return;}
    setAdding(true);
    try{
      const payload={...sform,course:selected.course||sform.course,semester:selected.semester||sform.semester,password:sform.password.trim()||sform.roll_no.trim().toLowerCase()};
      await api.post('/classes/'+selected.id+'/students',payload);
      toast.success(sform.name+' enrolled!');
      setSform({roll_no:'',name:'',gender:'male',phone:'',password:'',course:selected.course||'',semester:selected.semester||''});
      const r=await api.get('/classes/'+selected.id+'/students');setStudents(r.data);
    }catch(err){toast.error(err.response?.data?.error||'Failed');}finally{setAdding(false);}
  };

  const removeStudent = async roll => {
    if(!confirm('Remove student from this class?'))return;
    await api.delete('/classes/'+selected.id+'/students/'+roll);
    toast.success('Removed');setStudents(p=>p.filter(s=>s.roll_no!==roll));
  };

  const deleteClass = async id => {
    if(!confirm('Delete this class? All data will be removed.'))return;
    await api.delete('/classes/'+id);toast.success('Class deleted');load();
    if(selected?.id===id){setSelected(null);setStudents([]);setSubjects([]);}
  };

  if(loading)return <Loader text="Loading classes..."/>;

  return (
    <div style={{display:'flex',gap:20}}>
      {/* LEFT PANEL */}
      <div style={{width:280,flexShrink:0,display:'flex',flexDirection:'column',gap:16}}>
        {/* Create Class */}
        <div className="card">
          <div className="card-header"><div className="card-title">🏫 Create New Class</div></div>
          <div className="card-body">
            <form onSubmit={createClass} style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="field">
                <label className="lbl">Class Name *</label>
                <input className="inp" placeholder="e.g. CSE-A" value={cform.name} onChange={e=>setCform(f=>({...f,name:e.target.value}))}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div className="field"><label className="lbl">Section</label><input className="inp" placeholder="A/B" value={cform.section} onChange={e=>setCform(f=>({...f,section:e.target.value}))}/></div>
                <div className="field"><label className="lbl">Semester</label><input className="inp" placeholder="4" value={cform.semester} onChange={e=>setCform(f=>({...f,semester:e.target.value}))}/></div>
              </div>
              <div className="field"><label className="lbl">Course</label><input className="inp" placeholder="B.Tech CSE" value={cform.course} onChange={e=>setCform(f=>({...f,course:e.target.value}))}/></div>
              <button type="submit" disabled={adding} className="btn btn-primary btn-full">{adding?'Creating...':'+ Create Class'}</button>
            </form>
          </div>
        </div>

        {/* Class List */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">My Classes</div>
            <span className="badge badge-purple">{classes.length}</span>
          </div>
          <div style={{padding:'8px 12px',display:'flex',flexDirection:'column',gap:6}}>
            {classes.length===0 ? (
              <div className="empty" style={{padding:'20px 0'}}>No classes yet</div>
            ) : classes.map(c=>(
              <div key={c.id} onClick={()=>loadClass(c)}
                style={{padding:'12px 14px',borderRadius:16,cursor:'pointer',border:`2px solid ${selected?.id===c.id?'#7B61FF':'var(--border)'}`,background:selected?.id===c.id?'#EEF0FF':'var(--surface2)',transition:'all 0.18s'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:selected?.id===c.id?'#6347D1':'var(--text1)'}}>{c.name}{c.section?' · '+c.section:''}</div>
                    <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>{c.course}{c.semester?' · Sem '+c.semester:''}</div>
                    <div style={{fontSize:10,color:'#27AE60',marginTop:2,fontWeight:500}}>👥 {c.student_count||0} students</div>
                    {c.created_by !== user?.roll_no && <div style={{fontSize:9,color:'#F2994A',marginTop:2,fontWeight:600}}>👁 View only</div>}
                  </div>
                  {c.created_by === user?.roll_no && (
                    <button onClick={e=>{e.stopPropagation();deleteClass(c.id);}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:14,padding:2}}>✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      {selected ? (
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:16,minWidth:0}}>
          {/* Class Header */}
          <div className="card fade-up">
            <div className="card-header">
              <div>
                <div className="card-title">{selected.name}{selected.section?' · '+selected.section:''}</div>
                <div className="card-sub">{selected.course}{selected.semester?' · Sem '+selected.semester:''}</div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <span className="badge badge-green">{students.length} students</span>
                {selected.created_by === user?.roll_no && (
                  <button className="btn btn-ghost btn-sm" onClick={()=>{setEditMode(!editMode);setEditForm({name:selected.name,section:selected.section||'',semester:selected.semester||'',course:selected.course||''});}}>
                    {editMode?'✕ Cancel':'✏️ Edit'}
                  </button>
                )}
                {selected.created_by !== user?.roll_no && (
                  <span style={{fontSize:11,color:'#F2994A',fontWeight:600}}>👁 View only — created by another teacher</span>
                )}
              </div>
            </div>

            {editMode && (
              <div className="card-body" style={{borderTop:'1px solid var(--border)'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                  <div className="field"><label className="lbl">Class Name</label><input className="inp" value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}/></div>
                  <div className="field"><label className="lbl">Section</label><input className="inp" value={editForm.section} onChange={e=>setEditForm(f=>({...f,section:e.target.value}))}/></div>
                  <div className="field"><label className="lbl">Course</label><input className="inp" value={editForm.course} onChange={e=>setEditForm(f=>({...f,course:e.target.value}))}/></div>
                  <div className="field"><label className="lbl">Semester</label><input className="inp" value={editForm.semester} onChange={e=>setEditForm(f=>({...f,semester:e.target.value}))}/></div>
                </div>
                <button onClick={saveEdit} className="btn btn-primary btn-sm">Save Changes</button>
              </div>
            )}

            {/* Subjects */}
            <div className="card-body" style={{borderTop:'1px solid var(--border)'}}>
              <label className="lbl">Subjects You Teach</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12,marginTop:6}}>
                {subjects.length===0 ? <span style={{fontSize:12,color:'var(--text3)'}}>No subjects added yet</span> :
                  subjects.map(s=>(
                    <div key={s} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:'50px',background:'#EEF0FF',border:'2px solid #C5CAFF',fontSize:12,fontWeight:600,color:'#6347D1'}}>
                      {s}
                      <button onClick={()=>removeSubject(s)} style={{background:'none',border:'none',cursor:'pointer',color:'#6347D1',fontSize:13,lineHeight:1,padding:0}}>×</button>
                    </div>
                  ))
                }
              </div>
              <form onSubmit={addSubject} style={{display:'flex',gap:10}}>
                <input className="inp" placeholder="Add subject e.g. Data Structures" value={subj} onChange={e=>setSubj(e.target.value)} style={{flex:1}}/>
                <button type="submit" className="btn btn-primary btn-sm">+ Add</button>
              </form>
            </div>
          </div>

          {/* Enroll Student */}
          <div className="card fade-up">
            <div className="card-header"><div className="card-title">➕ Enroll Student</div></div>
            <div className="card-body">
              <form onSubmit={enrollStudent}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                  <div className="field"><label className="lbl">Roll Number *</label><input className="inp" placeholder="CS2021045" value={sform.roll_no} onChange={e=>setSform(f=>({...f,roll_no:e.target.value}))}/></div>
                  <div className="field"><label className="lbl">Full Name *</label><input className="inp" placeholder="Student Name" value={sform.name} onChange={e=>setSform(f=>({...f,name:e.target.value}))}/></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                  <div className="field">
                    <label className="lbl">Gender</label>
                    <select className="inp" value={sform.gender} onChange={e=>setSform(f=>({...f,gender:e.target.value}))}>
                      {GENDERS.map(g=><option key={g} value={g}>{g.charAt(0).toUpperCase()+g.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="field"><label className="lbl">Phone (optional)</label><input className="inp" placeholder="9876543210" value={sform.phone} onChange={e=>setSform(f=>({...f,phone:e.target.value}))}/></div>
                </div>
                <div style={{padding:'10px 16px',borderRadius:14,background:'#E8FBF0',border:'1px solid #A8E6C3',fontSize:12,color:'#27AE60',marginBottom:12,display:'flex',gap:16,flexWrap:'wrap'}}>
                  <span>📚 Course: <strong>{selected.course||'—'}</strong></span>
                  <span>📅 Semester: <strong>{selected.semester||'—'}</strong></span>
                </div>
                <div className="field" style={{marginBottom:14}}>
                  <label className="lbl" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span>Login Password</span>
                    <button type="button" onClick={()=>setShowPass(p=>!p)} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#6347D1',fontFamily:'var(--font-main)',fontWeight:600}}>
                      {showPass?'Use default':'Set custom'}
                    </button>
                  </label>
                  {showPass
                    ? <input className="inp" type="text" placeholder="Custom password" value={sform.password} onChange={e=>setSform(f=>({...f,password:e.target.value}))}/>
                    : <div style={{padding:'11px 16px',borderRadius:14,background:'var(--surface2)',border:'2px solid var(--border2)',fontSize:12,color:'var(--text3)'}}>
                        Default: <span style={{color:'#6347D1',fontWeight:600}}>{sform.roll_no?sform.roll_no.toLowerCase():'(roll number)'}</span>
                      </div>
                  }
                </div>
                <button type="submit" disabled={adding} className="btn btn-primary">{adding?'Enrolling...':'+ Enroll Student'}</button>
              </form>
            </div>
          </div>

          {/* Students Table */}
          <div className="card fade-up">
            <div className="card-header">
              <div className="card-title">👥 Enrolled Students</div>
              <span className="badge badge-purple">{students.length}</span>
            </div>
            {students.length===0 ? (
              <div className="empty" style={{padding:'28px'}}>
                <div className="empty-icon">👥</div>
                <div style={{fontWeight:600,color:'var(--text2)'}}>No students enrolled yet</div>
              </div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Name</th><th>Roll No</th><th>Gender</th><th>Course</th><th>Sem</th><th>Phone</th><th></th></tr></thead>
                <tbody>
                  {students.map(s=>(
                    <tr key={s.roll_no}>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div className="stu-av" style={{background:s.gender==='female'?'linear-gradient(135deg,#7B61FF,#6347D1)':'linear-gradient(135deg,#2F80ED,#1a6dd1)',width:32,height:32,fontSize:11}}>
                            {s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                          </div>
                          <span style={{fontWeight:600,color:'var(--text1)',fontSize:13}}>{s.name}</span>
                        </div>
                      </td>
                      <td><span className="badge badge-purple">{s.roll_no}</span></td>
                      <td><span className={`badge badge-${s.gender==='female'?'purple':'blue'}`}>{s.gender}</span></td>
                      <td style={{fontSize:12,color:'var(--text2)'}}>{s.course||'—'}</td>
                      <td style={{fontSize:12,color:'var(--text2)'}}>{s.semester||'—'}</td>
                      <td style={{fontSize:11,color:'var(--text3)'}}>{s.phone||'—'}</td>
                      <td><button onClick={()=>removeStudent(s.roll_no)} className="btn btn-danger btn-xs">Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:64,marginBottom:16}}>🏫</div>
            <div style={{fontSize:16,fontWeight:700,color:'var(--text1)',marginBottom:6}}>Select a class to manage</div>
            <div style={{fontSize:13,color:'var(--text3)'}}>Or create a new class on the left</div>
          </div>
        </div>
      )}
    </div>
  );
}