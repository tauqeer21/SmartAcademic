import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [role, setRole] = useState('teacher');
  const [id,   setId]   = useState('');
  const [pw,   setPw]   = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    if (!id || !pw) return toast.error('Please fill in all fields');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', { roll_no: id.trim().toUpperCase(), password: pw, role });
      login(data.user, data.token, role);
      nav(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally { setBusy(false); }
  }

  return (
    <div className="login-page">
      <div className="login-wrap">

        {/* ── LEFT PURPLE PANEL ── */}
        <div className="login-left">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="ll-logo">
              <div className="ll-logo-icon">🎓</div>
              <div className="ll-logo-name">SmartAcademic</div>
            </div>
            <div className="ll-title">Your Smart Education Management System</div>
            <div className="ll-desc">
              AI-powered tools to manage attendance, marks, assignments,
              and student performance — all in one beautiful platform.
            </div>
            <div className="ll-features">
              {[
                ['📊', 'Real-time Analytics & Reports'],
                ['🤖', 'AI Lesson Plans & Question Papers'],
                ['✅', 'Smart Attendance Tracking'],
                ['📈', 'Student Performance Insights'],
              ].map(([icon, text]) => (
                <div key={text} className="ll-feature">
                  <div className="ll-feature-dot">{icon}</div>
                  {text}
                </div>
              ))}
            </div>
          </div>

          <div className="ll-char">
            <div className="ll-char-fig float-anim">
              <div className="ll-head" />
              <div className="ll-body">
                <div className="ll-bag" />
              </div>
            </div>
            <div className="ll-footer-txt">Empowering educators &amp; students every day</div>
          </div>
        </div>

        {/* ── RIGHT WHITE FORM ── */}
        <div className="login-right">
          <div style={{ marginBottom: 20, fontSize: 13, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-bg)', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 50 }}>
            ✨ VIBECODE Hackathon 2025
          </div>
          <div className="lr-title">Welcome Back! 👋</div>
          <div className="lr-sub">Sign in to access your academic portal</div>

          <div className="login-role-tabs">
            <button
              type="button"
              className={`role-tab${role === 'teacher' ? ' active' : ''}`}
              onClick={() => setRole('teacher')}
            >
              🎓 Teacher
            </button>
            <button
              type="button"
              className={`role-tab${role === 'student' ? ' active' : ''}`}
              onClick={() => setRole('student')}
            >
              📚 Student
            </button>
          </div>

          <form onSubmit={submit}>
            <div className="field" style={{ marginBottom: 16 }}>
              <label className="lbl">{role === 'teacher' ? 'Teacher ID' : 'Roll Number'}</label>
              <input
                className="inp"
                autoFocus
                placeholder={role === 'teacher' ? 'e.g. T001' : 'e.g. CS001'}
                value={id}
                onChange={e => setId(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 26 }}>
              <label className="lbl">Password</label>
              <input
                className="inp"
                type="password"
                placeholder="Enter your password"
                value={pw}
                onChange={e => setPw(e.target.value)}
              />
            </div>
            <button className="btn-login" type="submit" disabled={busy}>
              {busy ? 'Signing in...' : `Sign in as ${role === 'teacher' ? 'Teacher' : 'Student'}`}
            </button>
          </form>

          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              🔑 Demo Accounts — click to auto-fill
            </div>

            {/* Teacher demos */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)', marginBottom: 6, letterSpacing: '0.04em' }}>TEACHERS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { id: 'T001', pw: 't001', name: 'Dr. Arvind Sharma' },
                  { id: 'T002', pw: 't002', name: 'Prof. Meena Joshi'  },
                  { id: 'T003', pw: 't003', name: 'Dr. Rajesh Kumar'   },
                ].map(t => (
                  <button key={t.id} type="button"
                    onClick={() => { setRole('teacher'); setId(t.id); setPw(t.pw); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 14px', borderRadius: 12,
                      border: `2px solid ${id === t.id && role === 'teacher' ? '#7B61FF' : 'var(--border2)'}`,
                      background: id === t.id && role === 'teacher' ? '#EEF0FF' : 'var(--surface2)',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font)',
                      width: '100%', textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!(id === t.id && role === 'teacher')) { e.currentTarget.style.borderColor = '#C5CAFF'; e.currentTarget.style.background = '#F5F6FF'; }}}
                    onMouseLeave={e => { if (!(id === t.id && role === 'teacher')) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--surface2)'; }}}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#7B61FF,#6347D1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                        {t.name.split(' ').filter(w => !['Dr.','Prof.','Mr.'].includes(w))[0][0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text1)' }}>{t.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>ID: {t.id} · pw: {t.pw}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: '50px', background: '#EEF0FF', color: '#6347D1' }}>Teacher</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Student demos */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', marginBottom: 6, letterSpacing: '0.04em' }}>STUDENTS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { id: 'CS001', pw: 'cs001', name: 'Aarav Patel',   tag: '⭐ Top'     },
                  { id: 'CS002', pw: 'cs002', name: 'Priya Sharma',  tag: '✅ Good'    },
                  { id: 'CS005', pw: 'cs005', name: 'Vikram Nair',   tag: '⚠️ At Risk' },
                ].map(s => (
                  <button key={s.id} type="button"
                    onClick={() => { setRole('student'); setId(s.id); setPw(s.pw); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 14px', borderRadius: 12,
                      border: `2px solid ${id === s.id && role === 'student' ? '#27AE60' : 'var(--border2)'}`,
                      background: id === s.id && role === 'student' ? '#E8FBF0' : 'var(--surface2)',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font)',
                      width: '100%', textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!(id === s.id && role === 'student')) { e.currentTarget.style.borderColor = '#A8E6C3'; e.currentTarget.style.background = '#F0FBF4'; }}}
                    onMouseLeave={e => { if (!(id === s.id && role === 'student')) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--surface2)'; }}}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#27AE60,#1a8a4a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                        {s.name[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text1)' }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>Roll: {s.id} · pw: {s.pw}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: '50px', background: '#E8FBF0', color: '#27AE60' }}>{s.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>
              Click any account above to auto-fill the form, then press Sign In
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--text3)' }}>
            SmartAcademic · AI-Powered · VIBECODE 2025
          </div>
        </div>
      </div>
    </div>
  );
}