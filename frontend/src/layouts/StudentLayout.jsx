import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_GROUPS = [
  { label: 'Overview', items: [
    { to: '/student/dashboard',       emoji: '🏠', label: 'Dashboard'       },
    { to: '/student/attendance',      emoji: '✅', label: 'Attendance'      },
    { to: '/student/report-card',     emoji: '📊', label: 'Report Card'     },
    { to: '/student/cgpa-calculator', emoji: '🎯', label: 'CGPA Calculator' },
  ]},
  { label: 'Academic', items: [
    { to: '/student/assignments', emoji: '📋', label: 'Assignments'   },
    { to: '/student/notes',       emoji: '📎', label: 'Notes & Files' },
    { to: '/student/forum',       emoji: '💬', label: 'Class Forum'   },
  ]},
  { label: 'Schedule & Tools', items: [
    { to: '/student/timetable',        emoji: '🗓️', label: 'Timetable'        },
    { to: '/student/teacher-schedule', emoji: '⏰', label: 'Teacher Schedule' },
    { to: '/student/ai-assistant',     emoji: '🤖', label: 'AI Assistant'     },
  ]},
];

const PAGE_TITLES = {
  '/student/dashboard':        'Dashboard',
  '/student/attendance':       'My Attendance',
  '/student/report-card':      'Report Card',
  '/student/cgpa-calculator':  'CGPA & Bunk Calculator',
  '/student/assignments':      'Assignments',
  '/student/notes':            'Notes & Files',
  '/student/forum':            'Class Forum',
  '/student/timetable':        'Timetable',
  '/student/teacher-schedule': 'Teacher Schedule',
  '/student/ai-assistant':     'AI Assistant',
  '/student/profile':          'My Profile',
};

export default function StudentLayout() {
  const { user, logout, theme, toggleTheme } = useAuth();
  const [showNotifs, setShowNotifs] = useState(false);
  const nav = useNavigate();
  const { pathname } = useLocation();

  const title    = PAGE_TITLES[pathname] || 'Student Portal';
  const today    = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const fullName = user?.name || 'Student';
  const initials = fullName.split(' ').filter(w => w.length > 0).map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const NOTIFS = [
    { icon:'📋', text:'New assignment posted: Data Structures',  time:'30 min ago',  color:'#6347D1' },
    { icon:'📢', text:'Exam schedule updated by your teacher',   time:'2 hours ago', color:'#F2994A' },
    { icon:'✅', text:'Attendance marked for today',             time:'3 hours ago', color:'#27AE60' },
  ];

  return (
    <div className="app-shell">

      {/* ════════════════ SIDEBAR ════════════════ */}
      <aside className="sidebar">
        <div className="sb-logo">
          <div className="sb-logo-icon">🎓</div>
          <div className="sb-logo-text">Smart<span>Academic</span></div>
        </div>

        <nav className="sb-nav" style={{ marginTop:8 }}>
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <div className="sb-section-label">{group.label}</div>
              {group.items.map(item => (
                <NavLink key={item.to} to={item.to}
                  className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
                  <span className="sb-icon">{item.emoji}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sb-illus-wrap">
          <div className="sb-illus-fig float-anim">
            <div className="sb-illus-head" />
            <div className="sb-illus-body">
              <div className="sb-illus-book" />
            </div>
          </div>
          <div className="sb-illus-caption">Keep learning! 📚</div>
        </div>

        <div className="sb-footer">
          <div className="sb-user" onClick={() => nav('/student/profile')} title="View Profile">
            <div className="sb-avatar">{initials}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="sb-user-name">{fullName}</div>
              <div className="sb-user-role">{user?.roll_no || 'Student'}</div>
            </div>
            <span style={{ color:'rgba(255,255,255,0.4)', fontSize:14, flexShrink:0 }}>›</span>
          </div>
        </div>
      </aside>

      {/* ════════════════ MAIN ════════════════ */}
      <div className="main-wrap">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-title">{title}</div>
            <div className="topbar-subtitle">{today}</div>
          </div>
          <div className="topbar-right">
            <button className="topbar-icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div style={{ position:'relative' }}>
              <button className="topbar-icon-btn" onClick={() => setShowNotifs(s => !s)}>
                🔔<span className="notif-dot" />
              </button>
              {showNotifs && (
                <div style={{
                  position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:300,
                  background:'var(--card-bg)', borderRadius:20,
                  boxShadow:'0 16px 48px rgba(0,0,0,0.14)', width:300,
                  border:'1px solid var(--border2)',
                }}>
                  <div style={{ padding:'16px 18px 12px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, color:'var(--text1)' }}>
                    🔔 Notifications
                  </div>
                  {NOTIFS.map((n, i) => (
                    <div key={i} style={{ padding:'12px 18px', borderBottom:i<NOTIFS.length-1?'1px solid var(--border)':'none', display:'flex', gap:12, alignItems:'flex-start' }}>
                      <div style={{ width:34, height:34, borderRadius:10, background:`${n.color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{n.icon}</div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--text1)' }}>{n.text}</div>
                        <div style={{ fontSize:10, color:'var(--text3)', marginTop:3 }}>{n.time}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding:'10px 18px' }}>
                    <button className="btn btn-ghost btn-sm btn-full" onClick={() => setShowNotifs(false)}>Close</button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ cursor:'pointer' }} onClick={() => nav('/student/profile')}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text1)' }}>{fullName.split(' ')[0]}</div>
              <div style={{ fontSize:10, color:'var(--text3)' }}>Student</div>
            </div>
            <button className="topbar-logout" onClick={() => { logout(); nav('/login'); }}>Logout</button>
          </div>
        </header>

        <main className="page-content" onClick={() => { if (showNotifs) setShowNotifs(false); }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}