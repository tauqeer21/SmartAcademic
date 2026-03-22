import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Loader from '../components/Loader'

function AvatarCircle({ name, size=80 }) {
  const initials = name ? name.trim().split(' ')
    .filter(w => !['prof.','dr.','mr.','mrs.','ms.'].includes(w.toLowerCase()))
    .slice(0,2).map(w => w[0].toUpperCase()).join('') : '?'
  const colors = ['#9333ea','#2dd4bf','#4ade80','#60a5fa','#f87171','#a78bfa','#fb923c']
  const color  = colors[(name?.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${color}, ${color}99)`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize: size * 0.35, fontWeight: 800, color: '#fff',
      fontFamily: 'var(--font-display)', flexShrink: 0,
      boxShadow: `0 8px 24px ${color}44`
    }}>
      {initials}
    </div>
  )
}

export default function Profile() {
  const { user } = useAuth()
  const [profile,   setProfile]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [pwForm,    setPwForm]    = useState({ old:'', new1:'', new2:'' })
  const [pwLoading, setPwLoading] = useState(false)
  const [showPw,    setShowPw]    = useState(false)

  useEffect(() => {
    api.get('/auth/profile')
      .then(r => setProfile(r.data))
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  const changePassword = async () => {
    if (!pwForm.old)  { toast.error('Enter your current password'); return }
    if (!pwForm.new1) { toast.error('Enter new password'); return }
    if (pwForm.new1.length < 6) { toast.error('New password must be at least 6 characters'); return }
    if (pwForm.new1 !== pwForm.new2) { toast.error('New passwords do not match'); return }
    if (pwForm.new1 === pwForm.old)  { toast.error('New password must be different from current'); return }

    setPwLoading(true)
    try {
      await api.post('/auth/change-password', { old_password: pwForm.old, new_password: pwForm.new1 })
      toast.success('Password changed successfully!')
      setPwForm({ old:'', new1:'', new2:'' })
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to change password')
    } finally {
      setPwLoading(false)
    }
  }

  if (loading) return <Loader text="Loading profile..." />
  if (!profile) return <div className="empty">Could not load profile</div>

  const isStudent = user?.role === 'student'
  const isTeacher = user?.role === 'teacher'

  const pwStrength = (pw) => {
    if (!pw) return null
    const has8  = pw.length >= 8
    const hasNum = /\d/.test(pw)
    const hasSym = /[^a-zA-Z0-9]/.test(pw)
    const score  = [has8, hasNum, hasSym].filter(Boolean).length
    return { score, label: ['Weak','Fair','Good','Strong'][score], color: ['var(--red)','var(--gold)','var(--blue)','var(--green)'][score] }
  }
  const strength = pwStrength(pwForm.new1)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16,maxWidth:760,margin:'0 auto'}}>

      {/* ── Identity Card ── */}
      <div className="card fade-up" style={{padding:'28px 28px',
        background:'linear-gradient(135deg,var(--card-bg),var(--surface))',
        borderTop:'4px solid var(--purple)'}}>
        <div style={{display:'flex',gap:24,alignItems:'center',flexWrap:'wrap'}}>
          <AvatarCircle name={profile.name} size={90}/>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:24,fontWeight:800,color:'var(--text1)',fontFamily:'var(--font-display)',lineHeight:1.2}}>
              {profile.name}
            </div>
            <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
              <span className={'badge badge-'+(isStudent?'teal':'purple')} style={{fontSize:12}}>
                {isStudent ? '🎓 Student' : '👨‍🏫 Teacher'}
              </span>
              {isStudent && profile.course && (
                <span className="badge badge-blue" style={{fontSize:11}}>{profile.course}</span>
              )}
              {isStudent && profile.semester && (
                <span className="badge badge-gold" style={{fontSize:11}}>Semester {profile.semester}</span>
              )}
            </div>
            {profile.created_at && (
              <div style={{fontSize:11,color:'var(--text3)',marginTop:8,fontFamily:'var(--font-mono)'}}>
                Member since {profile.created_at.slice(0,10)}
              </div>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',
          gap:12,marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
          {isStudent && [
            { icon:'🪪', label:'Roll Number', val: profile.roll_no, mono:true, locked:true },
            { icon:'⚧',  label:'Gender',      val: profile.gender?.charAt(0).toUpperCase()+profile.gender?.slice(1) },
            { icon:'📱', label:'Phone',        val: profile.phone || '—' },
            { icon:'📚', label:'Classes',      val: profile.classes + ' enrolled' },
            { icon:'📖', label:'Subjects',     val: profile.subjects + ' subjects' },
            { icon:'✓',  label:'Attendance',   val: profile.attendance_pct+'%',
              color: profile.attendance_pct>=75?'var(--green)':profile.attendance_pct>=60?'var(--gold)':'var(--red)' },
          ].map((item,i) => (
            <div key={i} style={{padding:'12px 14px',borderRadius:12,background:'var(--card-bg)',
              border:'1px solid var(--border)'}}>
              <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--font-mono)',
                textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5}}>
                {item.icon} {item.label}
                {item.locked && <span style={{marginLeft:6,opacity:0.5}}>🔒</span>}
              </div>
              <div style={{fontSize:14,fontWeight:700,
                color:item.color||'var(--text1)',
                fontFamily:item.mono?'var(--font-mono)':'inherit'}}>
                {item.val}
              </div>
            </div>
          ))}

          {isTeacher && [
            { icon:'🪪', label:'Teacher ID', val: profile.roll_no, mono:true },
            { icon:'⚧',  label:'Gender',     val: profile.gender?.charAt(0).toUpperCase()+profile.gender?.slice(1) },
            { icon:'🏫', label:'Classes',    val: profile.classes?.join(', ') || '—' },
            { icon:'📖', label:'Subjects',   val: profile.subjects?.join(', ') || '—' },
          ].map((item,i) => (
            <div key={i} style={{padding:'12px 14px',borderRadius:12,background:'var(--card-bg)',
              border:'1px solid var(--border)'}}>
              <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--font-mono)',
                textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5}}>
                {item.icon} {item.label}
              </div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--text1)',
                fontFamily:item.mono?'var(--font-mono)':'inherit'}}>
                {item.val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Password Change (Students only) ── */}
      {isStudent && (
        <div className="card fade-up">
          <div className="card-header">
            <div>
              <div className="card-title">🔐 Change Password</div>
              <div className="card-sub">Keep your account secure with a strong password</div>
            </div>
          </div>
          <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14,maxWidth:420}}>

            {/* Current password */}
            <div>
              <label className="lbl">Current Password</label>
              <div style={{position:'relative'}}>
                <input className="inp" type={showPw?'text':'password'}
                  placeholder="Your current password"
                  value={pwForm.old}
                  onChange={e=>setPwForm(f=>({...f,old:e.target.value}))}/>
                <button onClick={()=>setShowPw(p=>!p)}
                  style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                    background:'none',border:'none',cursor:'pointer',fontSize:14,color:'var(--text3)'}}>
                  {showPw?'🙈':'👁'}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="lbl">New Password</label>
              <input className="inp" type={showPw?'text':'password'}
                placeholder="Min 6 characters"
                value={pwForm.new1}
                onChange={e=>setPwForm(f=>({...f,new1:e.target.value}))}/>
              {/* Strength bar */}
              {pwForm.new1 && strength && (
                <div style={{marginTop:6}}>
                  <div style={{display:'flex',gap:4,marginBottom:4}}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{flex:1,height:4,borderRadius:2,
                        background: i < strength.score ? strength.color : 'var(--border)',
                        transition:'background 0.2s'}}/>
                    ))}
                  </div>
                  <div style={{fontSize:10,color:strength.color,fontFamily:'var(--font-mono)',fontWeight:700}}>
                    {strength.label}
                    {strength.score < 2 && ' — add numbers or symbols to strengthen'}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label className="lbl">Confirm New Password</label>
              <input className="inp" type={showPw?'text':'password'}
                placeholder="Repeat new password"
                value={pwForm.new2}
                onChange={e=>setPwForm(f=>({...f,new2:e.target.value}))}/>
              {pwForm.new2 && pwForm.new1 !== pwForm.new2 && (
                <div style={{fontSize:11,color:'var(--red)',marginTop:5,fontFamily:'var(--font-mono)'}}>
                  ✗ Passwords do not match
                </div>
              )}
              {pwForm.new2 && pwForm.new1 === pwForm.new2 && pwForm.new2.length >= 6 && (
                <div style={{fontSize:11,color:'var(--green)',marginTop:5,fontFamily:'var(--font-mono)'}}>
                  ✓ Passwords match
                </div>
              )}
            </div>

            <button onClick={changePassword} disabled={pwLoading}
              className="btn btn-primary" style={{width:'100%',justifyContent:'center',marginTop:4}}>
              {pwLoading ? '⏳ Changing...' : '🔐 Change Password'}
            </button>

            <div style={{padding:'10px 14px',borderRadius:10,background:'var(--surface)',
              border:'1px solid var(--border)',fontSize:11,color:'var(--text3)',lineHeight:1.7}}>
              🔒 <strong style={{color:'var(--text2)'}}>Your Roll Number cannot be changed</strong> — it is your permanent identity in the system used for attendance, marks, and all records.<br/>
              Only your password can be changed here.
            </div>
          </div>
        </div>
      )}

      {/* ── Teacher — no password change, explanation ── */}
      {isTeacher && (
        <div className="card fade-up" style={{padding:'20px 24px',
          background:'rgba(147,51,234,0.04)',border:'1px solid rgba(147,51,234,0.15)'}}>
          <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
            <div style={{fontSize:28,flexShrink:0}}>🔐</div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--text1)',marginBottom:6}}>
                Password managed by Administration
              </div>
              <div style={{fontSize:12,color:'var(--text3)',lineHeight:1.7}}>
                Teacher credentials are issued and managed by the institution's administration.
                If you need to change your password, please contact your department administrator or HOD.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}