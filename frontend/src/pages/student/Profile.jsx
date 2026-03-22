import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function StudentProfile() {
  const { user, theme, toggleTheme } = useAuth();
  const [profile, setProfile] = useState(null);
  const [oldPw, setOldPw]   = useState('');
  const [newPw, setNewPw]   = useState('');
  const [confPw,setConfPw]  = useState('');
  const [saving,setSaving]  = useState(false);
  const [showOld,setShowOld]= useState(false);
  const [showNew,setShowNew]= useState(false);

  useEffect(() => {
    api.get('/auth/profile').then(r => setProfile(r.data)).catch(()=>{});
  }, []);

  const fullName = user?.name||'Student';
  const initials = fullName.split(' ').filter(w=>w.length>0).map(w=>w[0]).join('').toUpperCase().slice(0,2);

  const handleChangePw = async e => {
    e.preventDefault();
    if (!oldPw||!newPw||!confPw) { toast.error('Fill all fields'); return; }
    if (newPw!==confPw) { toast.error('Passwords do not match'); return; }
    if (newPw.length<6) { toast.error('Min 6 characters'); return; }
    if (newPw===oldPw)  { toast.error('Must be different'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password',{ old_password:oldPw, new_password:newPw });
      toast.success('Password changed! 🎉');
      setOldPw(''); setNewPw(''); setConfPw('');
    } catch(err) { toast.error(err.response?.data?.error||'Failed'); }
    finally { setSaving(false); }
  };

  const strength = pw => {
    if (!pw) return 0;
    let s=0;
    if(pw.length>=6) s++; if(pw.length>=10) s++;
    if(/[A-Z]/.test(pw)) s++; if(/[0-9]/.test(pw)) s++; if(/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };
  const sw = strength(newPw);
  const sl = ['','Very Weak','Weak','Fair','Strong','Very Strong'][sw];
  const sc = ['','#EB5757','#F2994A','#F2C94C','#27AE60','#1a8a4a'][sw];

  const attPct = profile?.attendance_pct;
  const attSafe = attPct >= 75;

  const INFO = [
    { label:'Full Name',   val:fullName,                                     icon:'👤', color:'#6347D1', bg:'#EEF0FF' },
    { label:'Roll Number', val:user?.roll_no||'—',                            icon:'🪪', color:'#2F80ED', bg:'#EBF4FF' },
    { label:'Course',      val:user?.course||'—',                             icon:'📚', color:'#27AE60', bg:'#E8FBF0' },
    { label:'Semester',    val:user?.semester?`Semester ${user.semester}`:'—',icon:'📅', color:'#F2994A', bg:'#FFF3E8' },
    { label:'Phone',       val:profile?.phone||'—',                           icon:'📱', color:'#EB5757', bg:'#FFF0F0' },
    { label:'Joined',      val:profile?.created_at?new Date(profile.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—', icon:'🗓️', color:'#6347D1', bg:'#EEF0FF' },
  ];

  const STATS = profile ? [
    { label:'Attendance',   val:`${profile.attendance_pct||0}%`, icon:'✅', color:attSafe?'#27AE60':'#EB5757', bg:attSafe?'#E8FBF0':'#FFF0F0' },
    { label:'Classes',      val:profile.classes||0,              icon:'🏫', color:'#2F80ED', bg:'#EBF4FF' },
    { label:'Subjects',     val:profile.subjects||0,             icon:'📚', color:'#6347D1', bg:'#EEF0FF' },
    { label:'Assignments',  val:profile.assignments_submitted||0,icon:'📋', color:'#F2994A', bg:'#FFF3E8' },
  ] : [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:860 }}>

      {/* Profile Card */}
      <div className="card fade-up" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ height:90, background:'linear-gradient(135deg,#7B61FF,#5A3EC8)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-50, right:-50, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }}/>
        </div>
        <div style={{ padding:'0 28px 28px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:20, padding:'16px 0 24px' }}>
            <div style={{ width:80, height:80, borderRadius:'50%', background:'linear-gradient(135deg,#7B61FF,#5A3EC8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:800, color:'#fff', border:'3px solid var(--card-bg)', boxShadow:'0 6px 24px rgba(99,71,209,0.30)', flexShrink:0, marginTop:-40 }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:'var(--text1)' }}>{fullName}</div>
              <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 12px', borderRadius:'50px', background:'#EEF0FF', color:'#6347D1' }}>📚 Student</span>
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 12px', borderRadius:'50px', background:'#EBF4FF', color:'#2F80ED' }}>Roll: {user?.roll_no}</span>
                {user?.course && <span style={{ fontSize:11, fontWeight:700, padding:'3px 12px', borderRadius:'50px', background:'#E8FBF0', color:'#27AE60' }}>{user.course}</span>}
                {user?.semester && <span style={{ fontSize:11, fontWeight:700, padding:'3px 12px', borderRadius:'50px', background:'#FFF3E8', color:'#F2994A' }}>Sem {user.semester}</span>}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          {STATS.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
              {STATS.map(s=>(
                <div key={s.label} style={{ padding:'14px', borderRadius:16, background:s.bg, textAlign:'center' }}>
                  <div style={{ fontSize:24, marginBottom:4 }}>{s.icon}</div>
                  <div style={{ fontSize:20, fontWeight:800, color:s.color, letterSpacing:'-0.5px' }}>{s.val}</div>
                  <div style={{ fontSize:10, color:s.color, fontWeight:600, opacity:0.8, marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Info grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            {INFO.map(i=>(
              <div key={i.label} style={{ padding:'14px 16px', background:i.bg, borderRadius:16, display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:12, background:'rgba(255,255,255,0.7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{i.icon}</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:9, color:i.color, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3, opacity:0.8 }}>{i.label}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:i.color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{i.val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="card fade-up-d1">
        <div className="card-header"><div className="card-title">⚙️ Preferences</div></div>
        <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', background:'var(--surface2)', borderRadius:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'#EEF0FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{theme==='dark'?'🌙':'☀️'}</div>
              <div><div style={{ fontSize:13, fontWeight:700, color:'var(--text1)' }}>Theme</div><div style={{ fontSize:11, color:'var(--text3)' }}>{theme==='dark'?'Dark':'Light'} Mode</div></div>
            </div>
            <button onClick={toggleTheme} className="btn btn-ghost btn-sm">Switch to {theme==='dark'?'Light ☀️':'Dark 🌙'}</button>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', background:'linear-gradient(135deg,#F8F4FF,#EEF0FF)', borderRadius:14 }}>
            <div style={{ fontSize:28 }}>🎓</div>
            <div><div style={{ fontSize:13, fontWeight:700, color:'#6347D1' }}>SmartAcademic</div><div style={{ fontSize:11, color:'#6347D1', opacity:0.75 }}>AI-Powered Education · VIBECODE 2025</div></div>
            <div style={{ marginLeft:'auto', fontSize:11, color:'#6347D1', fontWeight:600, opacity:0.6 }}>v3.0</div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card fade-up-d2">
        <div className="card-header"><div><div className="card-title">🔐 Change Password</div></div></div>
        <div className="card-body">
          <form onSubmit={handleChangePw}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:16 }}>
              <div className="field">
                <label className="lbl">Current Password</label>
                <div style={{ position:'relative' }}>
                  <input className="inp" type={showOld?'text':'password'} placeholder="Current password" value={oldPw} onChange={e=>setOldPw(e.target.value)} style={{ paddingRight:40 }}/>
                  <button type="button" onClick={()=>setShowOld(s=>!s)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'var(--text3)' }}>{showOld?'🙈':'👁'}</button>
                </div>
              </div>
              <div className="field">
                <label className="lbl">New Password</label>
                <div style={{ position:'relative' }}>
                  <input className="inp" type={showNew?'text':'password'} placeholder="Min 6 chars" value={newPw} onChange={e=>setNewPw(e.target.value)} style={{ paddingRight:40 }}/>
                  <button type="button" onClick={()=>setShowNew(s=>!s)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'var(--text3)' }}>{showNew?'🙈':'👁'}</button>
                </div>
                {newPw&&<><div style={{ marginTop:6, height:4, background:'var(--surface3)', borderRadius:50, overflow:'hidden' }}><div style={{ height:'100%', width:`${sw*20}%`, background:sc, borderRadius:50, transition:'all 0.3s' }}/></div><div style={{ fontSize:9, color:sc, fontWeight:700, marginTop:2 }}>{sl}</div></>}
              </div>
              <div className="field">
                <label className="lbl">Confirm Password</label>
                <input className="inp" type="password" placeholder="Repeat" value={confPw} onChange={e=>setConfPw(e.target.value)} style={{ borderColor:confPw&&confPw!==newPw?'var(--red)':'' }}/>
                {confPw&&confPw!==newPw&&<div style={{ fontSize:10, color:'var(--red)', marginTop:3 }}>Doesn't match</div>}
                {confPw&&confPw===newPw &&<div style={{ fontSize:10, color:'var(--green)', marginTop:3 }}>✓ Match</div>}
              </div>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <button type="submit" className="btn btn-primary" disabled={saving||(confPw&&confPw!==newPw)}>{saving?'Updating...':'🔐 Update Password'}</button>
              {(oldPw||newPw||confPw)&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>{setOldPw('');setNewPw('');setConfPw('');}}>Clear</button>}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}