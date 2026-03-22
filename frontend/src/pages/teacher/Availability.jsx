import { useState, useEffect } from 'react';
import { useCurrentClass } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function TeacherAvailability() {
  const [cls] = useCurrentClass();
  const [avail, setAvail]     = useState({});
  const [cancels, setCancels] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [tab, setTab]         = useState('hours');
  const [form, setForm]       = useState({day:'Monday',start_time:'',end_time:'',location:'',note:''});
  const [cForm, setCForm]     = useState({subject:'',cancelled_date:'',reason:'',rescheduled_to:''});
  const [adding, setAdding]   = useState(false);

  const load = () => {
    api.get('/availability/mine').then(r=>setAvail(r.data));
    if(cls?.id){
      api.get('/availability/cancellations/'+cls.id).then(r=>setCancels(r.data));
      api.get('/classes/'+cls.id+'/my-subjects').then(r=>setSubjects(r.data));
    }
  };
  useEffect(()=>load(),[cls?.id]);

  const addHours = async e => {
    e.preventDefault();
    if(!form.start_time||!form.end_time){toast.error('Times required');return;}
    setAdding(true);
    try{await api.post('/availability/',form);toast.success('Office hours added!');load();}
    catch{toast.error('Failed');}finally{setAdding(false);}
  };

  const addCancel = async e => {
    e.preventDefault();
    if(!cForm.subject||!cForm.cancelled_date){toast.error('Subject and date required');return;}
    if(!cls?.id){toast.error('Select a class first');return;}
    setAdding(true);
    try{
      await api.post('/availability/cancel',{...cForm,class_id:cls.id});
      toast.success('Cancellation posted!');
      setCForm({subject:'',cancelled_date:'',reason:'',rescheduled_to:''});
      load();
    }catch{toast.error('Failed');}finally{setAdding(false);}
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div className="page-header fade-up">
        <div className="page-title">Availability</div>
        <div className="page-sub">Set office hours and manage class cancellations</div>
      </div>

      <div style={{display:'flex',gap:8}} className="fade-up-d1">
        {[['hours','🕐 Office Hours'],['cancel','❌ Cancellations']].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:'10px 22px',borderRadius:'50px',border:`2px solid ${tab===t?'#7B61FF':'var(--border2)'}`,background:tab===t?'linear-gradient(135deg,#7B61FF,#6347D1)':'#fff',color:tab===t?'#fff':'var(--text2)',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'var(--font-main)',transition:'all 0.2s',boxShadow:tab===t?'0 8px 24px rgba(99,71,209,0.3)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {tab==='hours' && <>
        <div className="card fade-up">
          <div className="card-header"><div className="card-title">🕐 Add Office Hours</div></div>
          <div className="card-body">
            <form onSubmit={addHours} style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div className="field" style={{minWidth:130}}>
                <label className="lbl">Day</label>
                <select className="inp" value={form.day} onChange={e=>setForm(f=>({...f,day:e.target.value}))}>
                  {DAYS.map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="field"><label className="lbl">From</label><input className="inp" type="time" value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))}/></div>
              <div className="field"><label className="lbl">To</label><input className="inp" type="time" value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))}/></div>
              <div className="field" style={{flex:1,minWidth:140}}><label className="lbl">Location</label><input className="inp" placeholder="Room 204 / Online" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))}/></div>
              <div className="field" style={{flex:1,minWidth:140}}><label className="lbl">Note</label><input className="inp" placeholder="Optional note" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/></div>
              <button type="submit" disabled={adding} className="btn btn-primary btn-sm">{adding?'Adding...':'+ Add'}</button>
            </form>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
          {DAYS.map((day,di)=>{
            const slots=avail[day]||[];
            const clr=['#7B61FF','#27AE60','#2F80ED','#F2994A','#EB5757','#00B5A5'][di];
            const bg =['#EEF0FF','#E8FBF0','#EBF4FF','#FFF3E8','#FFF0F0','#E0FAF8'][di];
            return (
              <div key={day} className="card fade-up">
                <div style={{padding:'14px 18px 10px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:10,height:10,borderRadius:'50%',background:clr}}/>
                    <span style={{fontSize:13,fontWeight:700,color:clr}}>{day}</span>
                  </div>
                  <span style={{fontSize:10,fontWeight:600,color:slots.length>0?clr:'var(--text3)'}}>{slots.length>0?slots.length+' slots':'Unavailable'}</span>
                </div>
                <div style={{padding:'10px 12px',display:'flex',flexDirection:'column',gap:7}}>
                  {slots.length===0 ? (
                    <div style={{textAlign:'center',padding:'12px 0',fontSize:11,color:'var(--text3)'}}>Not available this day</div>
                  ) : slots.map(s=>(
                    <div key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:14,background:bg,border:`1px solid ${clr}22`}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:clr}}>{s.start_time} – {s.end_time}</div>
                        {s.location && <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>📍 {s.location}</div>}
                        {s.note && <div style={{fontSize:10,color:'var(--text3)'}}>{s.note}</div>}
                      </div>
                      <button onClick={()=>api.delete('/availability/'+s.id).then(()=>load())} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:14,padding:2}}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </>}

      {tab==='cancel' && <>
        <div className="card fade-up">
          <div className="card-header"><div className="card-title">❌ Post Class Cancellation</div></div>
          <div className="card-body">
            <form onSubmit={addCancel}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <div className="field">
                  <label className="lbl">Subject *</label>
                  <select className="inp" value={cForm.subject} onChange={e=>setCForm(f=>({...f,subject:e.target.value}))}>
                    <option value="">Select subject</option>
                    {subjects.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field"><label className="lbl">Cancelled Date *</label><input className="inp" type="date" value={cForm.cancelled_date} onChange={e=>setCForm(f=>({...f,cancelled_date:e.target.value}))}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                <div className="field"><label className="lbl">Reason</label><input className="inp" placeholder="e.g. Faculty unavailable" value={cForm.reason} onChange={e=>setCForm(f=>({...f,reason:e.target.value}))}/></div>
                <div className="field"><label className="lbl">Rescheduled To</label><input className="inp" type="date" value={cForm.rescheduled_to} onChange={e=>setCForm(f=>({...f,rescheduled_to:e.target.value}))}/></div>
              </div>
              <button type="submit" disabled={adding||!cls?.id} className="btn btn-primary">{adding?'Posting...':'Post Cancellation'}</button>
            </form>
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {cancels.length===0 ? (
            <div className="card"><div className="empty"><div className="empty-icon">✅</div><div>No cancellations posted</div></div></div>
          ) : cancels.map((c,i)=>(
            <div key={i} className="card fade-up" style={{padding:'18px 22px'}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                <div style={{width:44,height:44,borderRadius:14,background:'#FFF0F0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>❌</div>
                <div style={{flex:1}}>
                  <div style={{display:'flex',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                    <span className="badge badge-red">Cancelled</span>
                    <span className="badge badge-purple">{c.subject}</span>
                  </div>
                  <div style={{fontSize:14,fontWeight:700,color:'var(--text1)',marginBottom:4}}>📅 {c.cancelled_date}</div>
                  {c.reason && <div style={{fontSize:12,color:'var(--text2)'}}>{c.reason}</div>}
                  {c.rescheduled_to && <div style={{fontSize:12,color:'#27AE60',marginTop:4,fontWeight:600}}>↻ Rescheduled: {c.rescheduled_to}</div>}
                  <div style={{fontSize:10,color:'var(--text3)',marginTop:6}}>{c.teacher_name}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}