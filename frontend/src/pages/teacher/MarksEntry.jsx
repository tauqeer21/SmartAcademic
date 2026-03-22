import { useState, useEffect } from 'react';
import { useCurrentClass, useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';

const EXAM_TYPES = ['MST1','MST2','Final','Practical','Assignment','Viva','Quiz'];
const grade = p => p>=90?'O':p>=80?'A+':p>=70?'A':p>=60?'B+':p>=50?'B':p>=40?'C':'F';
const gradeStyle = g => {
  if(g==='O'||g==='A+') return {bg:'#E8FBF0',color:'#27AE60'};
  if(g==='F') return {bg:'#FFF0F0',color:'#EB5757'};
  if(g==='B+'||g==='A') return {bg:'#FFF3E8',color:'#F2994A'};
  return {bg:'#EEF0FF',color:'#6347D1'};
};

export default function MarksEntry() {
  const { user } = useAuth();
  const [cls] = useCurrentClass();
  const [subjects, setSubjects]   = useState([]);
  const [students, setStudents]   = useState([]);
  const [subject, setSubject]     = useState('');
  const [examType, setExamType]   = useState('MST1');
  const [maxMarks, setMaxMarks]   = useState(30);
  const [entries, setEntries]     = useState({});
  const [savedMarks, setSavedMarks] = useState([]);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!cls?.id) return;
    Promise.all([
      api.get('/classes/'+cls.id+'/my-subjects'),
      api.get('/classes/'+cls.id+'/students'),
      api.get('/marks/class/'+cls.id)
    ]).then(([s,st,m]) => {
      const mySubjects = s.data || [];
      setSubjects(mySubjects);
      setStudents(st.data);
      // Only show marks for THIS teacher's subjects
      setSavedMarks((m.data||[]).filter(mk => mySubjects.includes(mk.subject)));
      if(mySubjects.length) setSubject(mySubjects[0]);
    }).finally(() => setLoading(false));
  }, [cls?.id]);

  const handleSave = async () => {
    if (!subject.trim()) { toast.error('Select subject'); return; }
    setSaving(true);
    try {
      await api.post('/marks/save', {
        class_id: cls.id, subject, exam_type: examType,
        entries: students.map(s => ({ roll_no: s.roll_no, marks_obtained: parseFloat(entries[s.roll_no])||0, marks_total: parseFloat(maxMarks) }))
      });
      toast.success('Marks saved successfully!');
      setEntries({});
      const r = await api.get('/marks/class/'+cls.id);
      const mySubjs = subjects;
      setSavedMarks((r.data||[]).filter(mk => mySubjs.includes(mk.subject)));
    } catch(err) { toast.error(err.response?.data?.error||'Failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <Loader text="Loading marks data..."/>;
  if (!cls) return <div className="empty"><div className="empty-icon">🏫</div><div>Select a class first</div></div>;

  const avgScore = savedMarks.length ? Math.round(savedMarks.reduce((s,m)=>s+(m.percentage||0),0)/savedMarks.length) : 0;
  const passing  = savedMarks.filter(m=>m.percentage>=40).length;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div className="page-header fade-up">
        <div className="page-title">Marks Entry</div>
        <div className="page-sub">{cls.name} — Enter and review student marks</div>
      </div>

      {/* Summary Cards */}
      {savedMarks.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}} className="fade-up-d1">
          {[
            {icon:'📝',num:savedMarks.length,label:'Total Entries',bg:'#EEF0FF',color:'#6347D1'},
            {icon:'📊',num:`${avgScore}%`,label:'Class Average',bg:'#E8FBF0',color:'#27AE60'},
            {icon:'✅',num:passing,label:'Passing Students',bg:'#FFF3E8',color:'#F2994A'},
          ].map(c=>(
            <div key={c.label} className="card" style={{padding:'20px',display:'flex',alignItems:'center',gap:16}}>
              <div style={{width:48,height:48,borderRadius:16,background:c.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{c.icon}</div>
              <div>
                <div style={{fontSize:24,fontWeight:800,color:c.color,letterSpacing:'-0.5px'}}>{c.num}</div>
                <div style={{fontSize:12,color:'var(--text3)',fontWeight:500}}>{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entry Form */}
      <div className="card fade-up-d1">
        <div className="card-header">
          <div><div className="card-title">✏️ Enter Marks</div><div className="card-sub">{cls.name}</div></div>
        </div>
        <div className="card-body">
          <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:20}}>
            <div style={{flex:1,minWidth:140}}>
              <label className="lbl">Subject</label>
              <select className="inp" value={subject} onChange={e=>setSubject(e.target.value)}>
                {subjects.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{minWidth:130}}>
              <label className="lbl">Exam Type</label>
              <select className="inp" value={examType} onChange={e=>setExamType(e.target.value)}>
                {EXAM_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{width:120}}>
              <label className="lbl">Max Marks</label>
              <input className="inp" type="number" value={maxMarks} onChange={e=>setMaxMarks(e.target.value)} min="1"/>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="empty">No students enrolled</div>
          ) : (
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
                {students.map(s => {
                  const val = entries[s.roll_no] ?? '';
                  const pct = val !== '' ? Math.round((parseFloat(val)/maxMarks)*100) : null;
                  const g   = pct !== null ? grade(pct) : null;
                  const gs  = g ? gradeStyle(g) : null;
                  return (
                    <div key={s.roll_no} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:16,background:'var(--surface2)',border:'1px solid var(--border)'}}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#7B61FF,#6347D1)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700,flexShrink:0}}>
                        {s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:'var(--text1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</div>
                        <div style={{fontSize:10,color:'var(--text3)'}}>{s.roll_no}</div>
                      </div>
                      <input
                        type="number" min="0" max={maxMarks}
                        placeholder="—"
                        value={val}
                        onChange={e=>setEntries(prev=>({...prev,[s.roll_no]:e.target.value}))}
                        style={{width:64,textAlign:'center',padding:'7px 8px',borderRadius:12,border:'2px solid var(--border2)',background:'#fff',color:'var(--text1)',fontSize:14,fontWeight:700,fontFamily:'var(--font-main)',outline:'none'}}
                        onFocus={e=>e.target.style.borderColor='#7B61FF'}
                        onBlur={e=>e.target.style.borderColor='var(--border2)'}
                      />
                      <span style={{fontSize:10,color:'var(--text3)',width:28}}>/{maxMarks}</span>
                      {gs && <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:'50px',background:gs.bg,color:gs.color,flexShrink:0}}>{g}</span>}
                    </div>
                  );
                })}
              </div>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-full" style={{padding:'13px'}}>
                {saving ? 'Saving...' : '💾 Save All Marks'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Saved Marks Table */}
      {savedMarks.length > 0 && (
        <div className="card fade-up-d2">
          <div className="card-header">
            <div><div className="card-title">📊 Marks Record</div><div className="card-sub">All saved marks for this class</div></div>
            <span className="badge badge-purple">{savedMarks.length} entries</span>
          </div>
          <table className="tbl">
            <thead><tr><th>Student</th><th>Subject</th><th>Exam</th><th>Marks</th><th>Score</th><th>Grade</th></tr></thead>
            <tbody>
              {savedMarks.map((r,i) => {
                const gs = gradeStyle(r.grade||grade(r.percentage||0));
                return (
                  <tr key={i}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div className="stu-av" style={{background:'linear-gradient(135deg,#7B61FF,#6347D1)'}}>
                          {r.student_name?.split(' ').map(w=>w[0]).join('').slice(0,2)||'--'}
                        </div>
                        <span style={{fontWeight:600,color:'var(--text1)',fontSize:13}}>{r.student_name}</span>
                      </div>
                    </td>
                    <td><span style={{fontSize:12,color:'var(--text2)'}}>{r.subject}</span></td>
                    <td><span className="badge badge-purple">{r.exam_type}</span></td>
                    <td><span style={{fontWeight:700,color:'var(--text1)'}}>{r.marks_obtained}/{r.marks_total}</span></td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div className="prog" style={{width:80}}>
                          <div className="prog-fill" style={{width:`${r.percentage}%`,background:r.percentage>=60?'linear-gradient(90deg,#27AE60,#6FCF97)':r.percentage>=40?'linear-gradient(90deg,#F2994A,#FFD93D)':'linear-gradient(90deg,#EB5757,#F2994A)'}}/>
                        </div>
                        <span style={{fontSize:12,fontWeight:700,color:'var(--text2)'}}>{r.percentage}%</span>
                      </div>
                    </td>
                    <td><span style={{fontSize:11,fontWeight:700,padding:'4px 12px',borderRadius:'50px',background:gs.bg,color:gs.color}}>{r.grade||grade(r.percentage||0)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}