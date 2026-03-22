import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useCurrentClass } from '../context/AuthContext';
import ClassSwitcher from '../components/ClassSwitcher';

const NAV_GROUPS = [
  { label: 'Main Menu', items: [
    { to: '/teacher/dashboard',     emoji: '🏠', label: 'Dashboard'       },
    { to: '/teacher/analytics',     emoji: '📊', label: 'Analytics'       },
    { to: '/teacher/my-classes',    emoji: '🏫', label: 'My Classes'      },
  ]},
  { label: 'Academic', items: [
    { to: '/teacher/attendance',    emoji: '✅', label: 'Attendance'      },
    { to: '/teacher/marks',         emoji: '📝', label: 'Marks Entry'     },
    { to: '/teacher/assignments',   emoji: '📋', label: 'Assignments'     },
    { to: '/teacher/announcements', emoji: '📢', label: 'Announcements'   },
    { to: '/teacher/notes',         emoji: '📎', label: 'Notes & Files'   },
  ]},
  { label: 'AI Tools', items: [
    { to: '/teacher/ai-tools',       emoji: '🤖', label: 'AI Tools'        },
    { to: '/teacher/question-paper', emoji: '🗂️', label: 'Question Paper'  },
    { to: '/teacher/progress-report',emoji: '📈', label: 'Progress Report' },
  ]},
  { label: 'Schedule', items: [
    { to: '/teacher/timetable',     emoji: '🗓️', label: 'Timetable'       },
    { to: '/teacher/availability',  emoji: '⏰', label: 'Availability'    },
  ]},
];

const PAGE_TITLES = {
  '/teacher/dashboard':     'Dashboard',      '/teacher/analytics':    'Analytics',
  '/teacher/my-classes':    'My Classes',     '/teacher/attendance':   'Mark Attendance',
  '/teacher/marks':         'Marks Entry',    '/teacher/assignments':  'Assignments',
  '/teacher/announcements': 'Announcements',  '/teacher/notes':        'Notes & Files',
  '/teacher/ai-tools':      'AI Tools',       '/teacher/question-paper':'Question Paper',
  '/teacher/progress-report':'Progress Report','/teacher/timetable':   'Timetable',
  '/teacher/availability':  'Availability',   '/teacher/profile':      'My Profile',
};

const TITLES = ['Dr.','Prof.','Mr.','Mrs.','Ms.','Er.'];

export default function TeacherLayout() {
  const { user, logout, theme, toggleTheme } = useAuth();
  const [currentClass] = useCurrentClass();
  const [showNotifs, setShowNotifs] = useState(false);
  const nav = useNavigate();
  const { pathname } = useLocation();

  const title     = PAGE_TITLES[pathname] || 'Teacher Portal';
  const today     = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const fullName  = user?.name || 'Teacher';
  const firstName = fullName.split(' ').find(w => !TITLES.includes(w)) || fullName.split(' ').pop();
  const initials  = fullName.split(' ').filter(w=>w.length>0).map(w=>w[0]).join('').toUpperCase().slice(0,2);

  const NOTIFS = [
    { icon:'📋', text:'New assignment submission received', time:'2 min ago',  color:'#6347D1' },
    { icon:'⚠️', text:'3 students below 75% attendance',   time:'1 hour ago', color:'#EB5757' },
    { icon:'📢', text:'Announcement posted successfully',   time:'2 hrs ago',  color:'#27AE60' },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sb-logo">
          <div className="sb-logo-icon">🎓</div>
          <div className="sb-logo-text">Smart<span>Academic</span></div>
        </div>

        {currentClass && (
          <div className="sb-class-chip">
            <div className="sb-class-label">Active Class</div>
            <div className="sb-class-name">
              {currentClass.name}{currentClass.section ? ' · ' + currentClass.section : ''}
            </div>
          </div>
        )}

        <nav className="sb-nav">
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
            <div className="sb-illus-body"><div className="sb-illus-book" /></div>
          </div>
          <div className="sb-illus-caption">Empowering educators ✨</div>
        </div>

        <div className="sb-footer">
          <div className="sb-user" onClick={() => nav('/teacher/profile')}>
            <div className="sb-avatar">{initials}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="sb-user-name">{fullName}</div>
              <div className="sb-user-role">{currentClass?.subjects?.split(',')[0]?.trim() || 'Teacher'}</div>
            </div>
            <span style={{ color:'rgba(255,255,255,0.4)', fontSize:14 }}>›</span>
          </div>
        </div>
      </aside>

      <div className="main-wrap">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-title">{title}</div>
            <div className="topbar-subtitle">{today}</div>
          </div>
          <div className="topbar-right">
            <ClassSwitcher />
            <button className="topbar-icon-btn" onClick={toggleTheme}>{theme==='dark'?'☀️':'🌙'}</button>
            <div style={{ position:'relative' }}>
              <button className="topbar-icon-btn" onClick={() => setShowNotifs(s=>!s)}>
                🔔<span className="notif-dot"/>
              </button>
              {showNotifs && (
                <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:300, background:'var(--card-bg)', borderRadius:20, boxShadow:'0 16px 48px rgba(0,0,0,0.14)', width:300, border:'1px solid var(--border2)' }}>
                  <div style={{ padding:'16px 18px 12px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, color:'var(--text1)' }}>🔔 Notifications</div>
                  {NOTIFS.map((n,i) => (
                    <div key={i} style={{ padding:'12px 18px', borderBottom:i<NOTIFS.length-1?'1px solid var(--border)':'none', display:'flex', gap:12 }}>
                      <div style={{ width:34, height:34, borderRadius:10, background:`${n.color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{n.icon}</div>
                      <div><div style={{ fontSize:12, fontWeight:600, color:'var(--text1)' }}>{n.text}</div><div style={{ fontSize:10, color:'var(--text3)', marginTop:3 }}>{n.time}</div></div>
                    </div>
                  ))}
                  <div style={{ padding:'10px 18px' }}><button className="btn btn-ghost btn-sm btn-full" onClick={() => setShowNotifs(false)}>Close</button></div>
                </div>
              )}
            </div>
            <div style={{ cursor:'pointer' }} onClick={() => nav('/teacher/profile')}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text1)' }}>{firstName}</div>
              <div style={{ fontSize:10, color:'var(--text3)' }}>Teacher</div>
            </div>
            <button className="topbar-logout" onClick={() => { logout(); nav('/login'); }}>Logout</button>
          </div>
        </header>
        <main className="page-content" onClick={() => { if(showNotifs) setShowNotifs(false); }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}