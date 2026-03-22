import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Loader from '../../components/Loader';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function TeacherSchedule() {
  const [teachers, setTeachers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [avail,    setAvail]    = useState({});
  const [cancels,  setCancels]  = useState([]);
  const [teacher,  setTeacher]  = useState(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    // Use /classes/my-teachers — clean per-teacher-per-subject data
    api.get('/classes/my-teachers').then(r => {
      const seen = new Set(); const unique = [];
      (r.data || []).forEach(t => {
        if (!seen.has(t.teacher_id)) { seen.add(t.teacher_id); unique.push(t); }
      });
      setTeachers(unique);
    }).catch(() => {});
  }, []);

  const loadTeacher = async t => {
    setSelected(t); setLoading(true);
    try {
      const [a, c] = await Promise.all([
        api.get('/availability/teacher/' + t.teacher_id),
        api.get('/availability/cancellations/' + t.class_id),
      ]);
      // Backend returns { schedule: {...}, teacher: {...} }
      setAvail(a.data?.schedule || a.data || {});
      setTeacher(a.data?.teacher || { name: t.teacher_name, gender: t.teacher_gender });
      setCancels(c.data || []);
    } catch { setAvail({}); setCancels([]); }
    finally { setLoading(false); }
  };

  const AVATAR_COLORS = [
    'linear-gradient(135deg,#7B61FF,#6347D1)',
    'linear-gradient(135deg,#27AE60,#1a8a4a)',
    'linear-gradient(135deg,#F2994A,#e8890d)',
    'linear-gradient(135deg,#2F80ED,#1a6dd1)',
    'linear-gradient(135deg,#EB5757,#c0392b)',
  ];

  return (
    <div style={{ display:'flex', gap:20, minHeight:400 }}>
      {/* Teacher List */}
      <div style={{ width:260, flexShrink:0 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">👩‍🏫 My Teachers</div><span className="badge badge-purple">{teachers.length}</span></div>
          <div style={{ padding:'8px 12px', display:'flex', flexDirection:'column', gap:6 }}>
            {teachers.length === 0 ? (
              <div className="empty" style={{ padding:'20px 0' }}>
                <div className="empty-sub">No teachers found</div>
              </div>
            ) : teachers.map((t, i) => (
              <div key={t.teacher_id} onClick={() => loadTeacher(t)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:16, cursor:'pointer', border:`2px solid ${selected?.teacher_id===t.teacher_id?'#7B61FF':'var(--border)'}`, background:selected?.teacher_id===t.teacher_id?'#EEF0FF':'var(--surface2)', transition:'all 0.18s' }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:AVATAR_COLORS[i%AVATAR_COLORS.length], display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:15, fontWeight:700, flexShrink:0 }}>
                  {t.teacher_name?.split(' ').filter(w=>!['Dr.','Prof.','Mr.','Mrs.'].includes(w))[0]?.[0] || 'T'}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:selected?.teacher_id===t.teacher_id?'#6347D1':'var(--text1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.teacher_name}</div>
                  <div style={{ fontSize:10, color:'var(--text3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.subject}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:16, minWidth:0 }}>
        {!selected ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:64, marginBottom:16 }}>👩‍🏫</div>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--text1)', marginBottom:6 }}>Select a teacher</div>
              <div style={{ fontSize:13, color:'var(--text3)' }}>View their office hours and availability</div>
            </div>
          </div>
        ) : loading ? <Loader text="Loading schedule..."/> : (
          <>
            {/* Teacher Header */}
            <div className="card fade-up" style={{ padding:'18px 24px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#7B61FF,#6347D1)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:22, fontWeight:800 }}>
                  {(teacher?.name||selected.teacher_name)?.split(' ').filter(w=>!['Dr.','Prof.','Mr.','Mrs.'].includes(w))[0]?.[0]||'T'}
                </div>
                <div>
                  <div style={{ fontSize:18, fontWeight:700, color:'var(--text1)' }}>{teacher?.name||selected.teacher_name}</div>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{selected.subject} · {selected.class_name}</div>
                </div>
              </div>
            </div>

            {/* Office Hours */}
            <div className="card fade-up-d1">
              <div className="card-header">
                <div className="card-title">🕐 Office Hours & Schedule</div>
                <span className="badge badge-purple">{Object.values(avail).flat().length} slots</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, padding:'16px 20px' }}>
                {DAYS.map((day, di) => {
                  const slots = avail[day] || [];
                  const COLORS = ['#7B61FF','#27AE60','#2F80ED','#F2994A','#EB5757','#00B5A5'];
                  const BGS   = ['#EEF0FF','#E8FBF0','#EBF4FF','#FFF3E8','#FFF0F0','#E0FAF8'];
                  const clr = COLORS[di]; const bg = BGS[di];
                  return (
                    <div key={day} style={{ borderRadius:16, border:`1px solid ${slots.length>0?clr+'33':'var(--border)'}`, overflow:'hidden' }}>
                      <div style={{ padding:'10px 14px', background:slots.length>0?bg:'var(--surface2)', borderBottom:`1px solid ${slots.length>0?clr+'22':'var(--border)'}` }}>
                        <span style={{ fontSize:12, fontWeight:700, color:slots.length>0?clr:'var(--text3)' }}>{day.slice(0,3)}</span>
                      </div>
                      <div style={{ padding:'8px 10px', display:'flex', flexDirection:'column', gap:5 }}>
                        {slots.length===0 ? (
                          <div style={{ fontSize:10, color:'var(--text3)', textAlign:'center', padding:'8px 0' }}>Not available</div>
                        ) : slots.map((s, i) => (
                          <div key={i} style={{ fontSize:11, fontWeight:600, color:clr, padding:'5px 8px', background:bg, borderRadius:8 }}>
                            {s.start_time}–{s.end_time}
                            {s.avail_type&&s.avail_type!=='office' && <span style={{ fontSize:9, opacity:0.7, marginLeft:4 }}>({s.avail_type})</span>}
                            {s.location && <div style={{ fontSize:9, fontWeight:400, color:'var(--text3)', marginTop:1 }}>📍 {s.location}</div>}
                            {s.note && <div style={{ fontSize:9, fontWeight:400, color:'var(--text3)' }}>{s.note}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cancellations */}
            {cancels.length > 0 && (
              <div className="card fade-up-d2">
                <div className="card-header">
                  <div className="card-title">❌ Class Cancellations</div>
                  <span className="badge badge-red">{cancels.length}</span>
                </div>
                <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {cancels.map((c, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:'#FFF0F0', borderRadius:14, border:'1px solid #FFBDBD' }}>
                      <div style={{ width:40, height:40, borderRadius:12, background:'#FFF0F0', border:'2px solid #FFBDBD', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>❌</div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', gap:8, marginBottom:4 }}>
                          <span className="badge badge-red">Cancelled</span>
                          <span className="badge badge-purple">{c.subject}</span>
                        </div>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)' }}>📅 {c.cancelled_date}</div>
                        {c.reason && <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>{c.reason}</div>}
                        {c.rescheduled_to && <div style={{ fontSize:11, color:'#27AE60', marginTop:2, fontWeight:600 }}>↻ Rescheduled: {c.rescheduled_to}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}