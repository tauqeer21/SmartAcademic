import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Loader from '../../components/Loader';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_CLR = ['#7B61FF','#27AE60','#2F80ED','#F2994A','#EB5757','#00B5A5'];
const DAY_BG  = ['#EEF0FF','#E8FBF0','#EBF4FF','#FFF3E8','#FFF0F0','#E0FAF8'];

export default function StudentTimetable() {
  const [timetable, setTimetable] = useState({});
  const [exams, setExams]         = useState([]);
  const [tab, setTab]             = useState('class');
  const [loading, setLoading]     = useState(true);

  useEffect(()=>{
    Promise.all([api.get('/timetable/mine'),api.get('/exams/mine')])
      .then(([t,e])=>{setTimetable(t.data);setExams(e.data||[]);})
      .finally(()=>setLoading(false));
  },[]);

  const today = new Date().toLocaleDateString('en-US',{weekday:'long'});
  if(loading)return <Loader text="Loading timetable..."/>;

  const upcomingExams = exams.filter(e=>e.days_left>=0).sort((a,b)=>a.days_left-b.days_left);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div className="page-header fade-up">
        <div className="page-title">Timetable</div>
        <div className="page-sub">Your weekly class schedule and upcoming exams</div>
      </div>

      {/* Today highlight */}
      {timetable[today]?.length>0 && (
        <div style={{padding:'16px 20px',borderRadius:20,background:'linear-gradient(135deg,#7B61FF,#6347D1)',color:'#fff'}} className="fade-up-d1">
          <div style={{fontSize:13,fontWeight:600,opacity:0.8,marginBottom:8}}>📅 Today — {today}</div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {timetable[today].map((s,i)=>(
              <div key={i} style={{padding:'8px 16px',borderRadius:'50px',background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.3)'}}>
                <span style={{fontWeight:700,fontSize:13}}>{s.subject}</span>
                <span style={{fontSize:11,opacity:0.8,marginLeft:8}}>{s.start_time}–{s.end_time}</span>
                {s.room && <span style={{fontSize:10,opacity:0.7,marginLeft:6}}>· {s.room}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:8}} className="fade-up-d1">
        {[['class','🗓️ Weekly Schedule'],['exam','📝 Exams']].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:'10px 22px',borderRadius:'50px',border:`2px solid ${tab===t?'#7B61FF':'var(--border2)'}`,background:tab===t?'linear-gradient(135deg,#7B61FF,#6347D1)':'#fff',color:tab===t?'#fff':'var(--text2)',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'var(--font-main)',transition:'all 0.2s',boxShadow:tab===t?'0 8px 24px rgba(99,71,209,0.3)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {tab==='class' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}} className="fade-up-d2">
          {DAYS.map((day,di)=>{
            const slots=timetable[day]||[];
            const isToday=day===today;
            return (
              <div key={day} className="card" style={{border:isToday?`2px solid ${DAY_CLR[di]}`:'2px solid transparent',transition:'all 0.2s'}}>
                <div style={{padding:'14px 18px 10px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:10,height:10,borderRadius:'50%',background:isToday?DAY_CLR[di]:'var(--border3)'}}/>
                    <span style={{fontSize:13,fontWeight:700,color:isToday?DAY_CLR[di]:'var(--text2)'}}>{day}</span>
                    {isToday && <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:'50px',background:DAY_BG[di],color:DAY_CLR[di]}}>TODAY</span>}
                  </div>
                  <span style={{fontSize:10,color:'var(--text3)'}}>{slots.length} classes</span>
                </div>
                <div style={{padding:'10px 12px',display:'flex',flexDirection:'column',gap:7}}>
                  {slots.length===0 ? (
                    <div style={{textAlign:'center',padding:'14px 0',fontSize:11,color:'var(--text3)'}}>No classes</div>
                  ) : slots.map((s,i)=>(
                    <div key={i} style={{padding:'10px 12px',borderRadius:14,background:DAY_BG[di],border:`1px solid ${DAY_CLR[di]}22`}}>
                      <div style={{fontSize:12,fontWeight:700,color:DAY_CLR[di]}}>{s.subject}</div>
                      <div style={{fontSize:10,color:'var(--text3)',marginTop:3}}>{s.start_time}–{s.end_time}{s.room?' · '+s.room:''}</div>
                      <div style={{fontSize:10,color:'var(--text3)'}}>{s.teacher_name}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab==='exam' && (
        <div style={{display:'flex',flexDirection:'column',gap:12}} className="fade-up-d2">
          {upcomingExams.length===0 ? (
            <div className="card"><div className="empty"><div className="empty-icon">📅</div><div>No upcoming exams</div></div></div>
          ) : upcomingExams.map((e,i)=>{
            const urgent=e.days_left<=3;
            const soon=e.days_left<=10;
            const clr=urgent?'#EB5757':soon?'#F2994A':'#27AE60';
            const bg =urgent?'#FFF0F0':soon?'#FFF3E8':'#E8FBF0';
            return (
              <div key={i} className="card fade-up" style={{padding:'18px 22px',display:'flex',alignItems:'center',gap:16}}>
                <div style={{width:60,height:60,borderRadius:20,background:bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0,border:`2px solid ${clr}33`}}>
                  <div style={{fontSize:22,fontWeight:800,color:clr,lineHeight:1}}>{e.days_left}</div>
                  <div style={{fontSize:9,color:clr,fontWeight:600,textTransform:'uppercase'}}>days</div>
                </div>
                <div style={{flex:1}}>
                  <div style={{display:'flex',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:'50px',background:bg,color:clr}}>{e.exam_type}</span>
                    <span className="badge badge-purple">{e.subject}</span>
                    {urgent && <span className="badge badge-red">Urgent!</span>}
                  </div>
                  <div style={{fontSize:14,fontWeight:700,color:'var(--text1)'}}>📅 {e.exam_date}</div>
                  {e.start_time && <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>⏰ {e.start_time}{e.end_time?' – '+e.end_time:''}{e.room?' · '+e.room:''}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}