import { useState, useEffect } from 'react';
import { useCurrentClass, useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_CLR = ['#7B61FF','#27AE60','#2F80ED','#F2994A','#EB5757','#00B5A5'];
const DAY_BG  = ['#EEF0FF','#E8FBF0','#EBF4FF','#FFF3E8','#FFF0F0','#E0FAF8'];
const EXAM_TYPES = ['MST1','MST2','Final','Practical','Viva','Quiz'];

export default function TeacherTimetable() {
  const { user } = useAuth();
  const [cls] = useCurrentClass();
  const [tab, setTab]           = useState('class');
  const [timetable, setTimetable] = useState({});
  const [exams, setExams]       = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [cForm, setCForm]       = useState({day:'Monday',subject:'',start_time:'',end_time:'',room:''});
  const [eForm, setEForm]       = useState({subject:'',exam_type:'MST1',exam_date:'',start_time:'',end_time:'',room:'',syllabus:''});
  const [adding, setAdding]     = useState(false);

  const load = () => {
    if(!cls?.id)return;
    Promise.all([
      api.get('/timetable/class/'+cls.id),
      api.get('/exams/class/'+cls.id),
      api.get('/exams/conflicts/'+cls.id),
      api.get('/classes/'+cls.id+'/my-subjects')
    ]).then(([t,e,c,s])=>{
      const myRoll = user?.roll_no;
      // Filter timetable to only this teacher's slots
      const raw = t.data || {};
      const filtered = {};
      DAYS.forEach(d => { filtered[d] = (raw[d]||[]).filter(slot => slot.teacher_id === myRoll); });
      setTimetable(filtered);
      // Filter exams to only this teacher's
      setExams((e.data||[]).filter(ex => ex.teacher_id === myRoll));
      setConflicts(c.data||[]);
      const mySubjs = s.data || [];
      setSubjects(mySubjs);
      if(mySubjs.length) { setCForm(f=>({...f,subject:mySubjs[0]})); setEForm(f=>({...f,subject:mySubjs[0]})); }
    })
      .finally(()=>setLoading(false));
  };
  useEffect(()=>{setLoading(true);load();},[cls?.id]);

  const addSlot = async e => {
    e.preventDefault();
    if(!cForm.subject||!cForm.start_time||!cForm.end_time){toast.error('Fill required fields');return;}
    setAdding(true);
    try{await api.post('/timetable/',{...cForm,class_id:cls.id});toast.success('Slot added!');load();}
    catch{toast.error('Slot may already exist');}finally{setAdding(false);}
  };

  const addExam = async e => {
    e.preventDefault();
    if(!eForm.subject||!eForm.exam_date||!eForm.start_time){toast.error('Subject, date, time required');return;}
    setAdding(true);
    try{
      await api.post('/exams/',{...eForm,class_id:cls.id});
      toast.success('Exam scheduled!');
      setEForm(f=>({...f,exam_date:'',start_time:'',end_time:'',room:'',syllabus:''}));
      load();
    }catch{toast.error('Failed');}finally{setAdding(false);}
  };

  if(!cls)return <div className="empty"><div className="empty-icon">🏫</div><div>Select a class first</div></div>;
  if(loading)return <Loader/>;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div className="page-header fade-up">
        <div className="page-title">Timetable</div>
        <div className="page-sub">{cls.name} — Class schedule and exam dates</div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:8}} className="fade-up-d1">
        {[['class','🗓️ Class Schedule'],['exam','📝 Exam Schedule']].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:'10px 22px',borderRadius:'50px',border:`2px solid ${tab===t?'#7B61FF':'var(--border2)'}`,background:tab===t?'linear-gradient(135deg,#7B61FF,#6347D1)':'#fff',color:tab===t?'#fff':'var(--text2)',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'var(--font-main)',transition:'all 0.2s',boxShadow:tab===t?'0 8px 24px rgba(99,71,209,0.3)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {tab==='class' && <>
        {/* Add Slot Form */}
        <div className="card fade-up">
          <div className="card-header"><div className="card-title">➕ Add Class Slot</div></div>
          <div className="card-body">
            <form onSubmit={addSlot} style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div className="field" style={{minWidth:130}}>
                <label className="lbl">Day</label>
                <select className="inp" value={cForm.day} onChange={e=>setCForm(f=>({...f,day:e.target.value}))}>
                  {DAYS.map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="field" style={{flex:1,minWidth:160}}>
                <label className="lbl">Subject *</label>
                <select className="inp" value={cForm.subject} onChange={e=>setCForm(f=>({...f,subject:e.target.value}))}>
                  <option value="">Select subject</option>
                  {subjects.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="field"><label className="lbl">Start Time</label><input className="inp" type="time" value={cForm.start_time} onChange={e=>setCForm(f=>({...f,start_time:e.target.value}))}/></div>
              <div className="field"><label className="lbl">End Time</label><input className="inp" type="time" value={cForm.end_time} onChange={e=>setCForm(f=>({...f,end_time:e.target.value}))}/></div>
              <div className="field"><label className="lbl">Room</label><input className="inp" placeholder="Hall A" style={{width:100}} value={cForm.room} onChange={e=>setCForm(f=>({...f,room:e.target.value}))}/></div>
              <button type="submit" disabled={adding} className="btn btn-primary btn-sm">{adding?'Adding...':'+ Add Slot'}</button>
            </form>
          </div>
        </div>

        {/* Day Grid */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
          {DAYS.map((day,di)=>{
            const slots = timetable[day]||[];
            return (
              <div key={day} className="card fade-up">
                <div style={{padding:'14px 18px 10px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:10,height:10,borderRadius:'50%',background:DAY_CLR[di]}}/>
                    <span style={{fontSize:13,fontWeight:700,color:DAY_CLR[di]}}>{day}</span>
                  </div>
                  <span style={{fontSize:10,fontWeight:700,padding:'2px 9px',borderRadius:'50px',background:DAY_BG[di],color:DAY_CLR[di]}}>{slots.length} classes</span>
                </div>
                <div style={{padding:'10px 12px',display:'flex',flexDirection:'column',gap:7}}>
                  {slots.length===0 ? (
                    <div style={{textAlign:'center',padding:'14px 0',fontSize:11,color:'var(--text3)'}}>No classes scheduled</div>
                  ) : slots.map(s=>(
                    <div key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:14,background:DAY_BG[di],border:`1px solid ${DAY_CLR[di]}22`}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:DAY_CLR[di]}}>{s.subject}</div>
                        <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>{s.start_time}–{s.end_time}{s.room?' · '+s.room:''}</div>
                      </div>
                      <button onClick={()=>api.delete('/timetable/'+s.id).then(()=>load())} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:14,padding:2}}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </>}

      {tab==='exam' && <>
        {conflicts.length>0 && (
          <div style={{padding:'14px 18px',borderRadius:16,background:'#FFF0F0',border:'2px solid #FFBDBD'}} className="fade-up">
            <div style={{fontSize:12,fontWeight:700,color:'#EB5757',marginBottom:8}}>⚠️ {conflicts.length} Exam Conflict{conflicts.length>1?'s':''} Detected</div>
            {conflicts.map((c,i)=>(
              <div key={i} style={{fontSize:12,color:'var(--text2)',marginBottom:3}}>
                {c.date}: <strong>{c.s1}</strong> ({c.t1}) and <strong>{c.s2}</strong> ({c.t2})
              </div>
            ))}
          </div>
        )}

        <div className="card fade-up">
          <div className="card-header"><div className="card-title">📅 Schedule Exam</div></div>
          <div className="card-body">
            <form onSubmit={addExam}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
                <div className="field">
                  <label className="lbl">Subject *</label>
                  <select className="inp" value={eForm.subject} onChange={e=>setEForm(f=>({...f,subject:e.target.value}))}>
                    <option value="">Select</option>
                    {subjects.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="lbl">Exam Type</label>
                  <select className="inp" value={eForm.exam_type} onChange={e=>setEForm(f=>({...f,exam_type:e.target.value}))}>
                    {EXAM_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="field"><label className="lbl">Date *</label><input className="inp" type="date" value={eForm.exam_date} onChange={e=>setEForm(f=>({...f,exam_date:e.target.value}))}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
                <div className="field"><label className="lbl">Start Time *</label><input className="inp" type="time" value={eForm.start_time} onChange={e=>setEForm(f=>({...f,start_time:e.target.value}))}/></div>
                <div className="field"><label className="lbl">End Time</label><input className="inp" type="time" value={eForm.end_time} onChange={e=>setEForm(f=>({...f,end_time:e.target.value}))}/></div>
                <div className="field"><label className="lbl">Room</label><input className="inp" value={eForm.room} onChange={e=>setEForm(f=>({...f,room:e.target.value}))}/></div>
              </div>
              <div className="field" style={{marginBottom:14}}>
                <label className="lbl">Syllabus</label>
                <textarea className="inp" rows={2} placeholder="Unit 1-3, topics covered..." value={eForm.syllabus} onChange={e=>setEForm(f=>({...f,syllabus:e.target.value}))}/>
              </div>
              <button type="submit" disabled={adding} className="btn btn-primary">{adding?'Scheduling...':'📅 Schedule Exam'}</button>
            </form>
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {exams.length===0 ? (
            <div className="card"><div className="empty"><div className="empty-icon">📅</div><div>No exams scheduled yet</div></div></div>
          ) : exams.map(e=>{
            const clrKey = e.days_left<=3?'red':e.days_left<=10?'orange':'green';
            const clr = clrKey==='red'?'#EB5757':clrKey==='orange'?'#F2994A':'#27AE60';
            const bg  = clrKey==='red'?'#FFF0F0':clrKey==='orange'?'#FFF3E8':'#E8FBF0';
            return (
              <div key={e.id} className="card fade-up" style={{padding:'18px 22px',display:'flex',alignItems:'center',gap:16}}>
                <div style={{width:58,height:58,borderRadius:18,background:bg,border:`2px solid ${clr}44`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <div style={{fontSize:20,fontWeight:800,color:clr,lineHeight:1}}>{Math.max(0,e.days_left)}</div>
                  <div style={{fontSize:9,color:clr,fontWeight:600,textTransform:'uppercase'}}>days</div>
                </div>
                <div style={{flex:1}}>
                  <div style={{display:'flex',gap:7,marginBottom:6,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:'50px',background:bg,color:clr}}>{e.exam_type}</span>
                    <span className="badge badge-purple">{e.subject}</span>
                  </div>
                  <div style={{fontSize:14,fontWeight:700,color:'var(--text1)'}}>{e.exam_date} · {e.start_time}{e.end_time?' – '+e.end_time:''}</div>
                  {e.room && <div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>📍 {e.room}</div>}
                  {e.syllabus && <div style={{fontSize:11,color:'var(--text2)',marginTop:4}}>{e.syllabus}</div>}
                </div>
                <button onClick={()=>api.delete('/exams/'+e.id).then(()=>load())} className="btn btn-danger btn-sm">Delete</button>
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );
}