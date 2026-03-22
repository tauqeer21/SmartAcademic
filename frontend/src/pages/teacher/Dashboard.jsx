import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useCurrentClass } from '../../context/AuthContext';
import api from '../../api/axios';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function greet() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [cls] = useCurrentClass();
  const [data,    setData]         = useState(null);
  const [alerts,  setAlerts]       = useState([]);
  const [announcements, setAnn]    = useState([]);
  const [loading, setLoading]      = useState(true);

  useEffect(() => {
    if (!cls?.id) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.get(`/analytics/teacher-dashboard?class_id=${cls.id}`),
      api.get(`/analytics/detention-alerts/${cls.id}`),
      api.get(`/announcements/class/${cls.id}`),
    ]).then(([d, a, an]) => {
      setData(d.data);
      setAlerts(a.data?.slice(0, 5) || []);
      setAnn((an.data||[]).filter(x=>x.teacher_id===user?.roll_no).slice(0,4));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [cls?.id]);

  if (loading) return <Loader text="Loading dashboard..." />;

  if (!cls) return (
    <div className="empty">
      <div className="empty-icon">🏫</div>
      <div className="empty-title">No class selected</div>
      <div className="empty-sub">Go to My Classes to create or select a class</div>
      <Link to="/teacher/my-classes" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
        Go to My Classes
      </Link>
    </div>
  );

  const subjects = cls?.subjects || '';

  const chartData = [
    { name: 'Oct', attendance: 78, marks: 72 },
    { name: 'Nov', attendance: 82, marks: 76 },
    { name: 'Dec', attendance: 74, marks: 68 },
    { name: 'Jan', attendance: 85, marks: 80 },
    { name: 'Feb', attendance: 80, marks: 78 },
    { name: 'Mar', attendance: data?.avg_attendance || 82, marks: 75 },
  ];

  const QUICK = [
    { to: '/teacher/attendance',    icon: '✅', label: 'Mark Attendance',  bg: '#EEF0FF', color: '#6347D1' },
    { to: '/teacher/marks',         icon: '📝', label: 'Enter Marks',      bg: '#E8FBF0', color: '#27AE60' },
    { to: '/teacher/assignments',   icon: '📋', label: 'New Assignment',   bg: '#FFF3E8', color: '#F2994A' },
    { to: '/teacher/announcements', icon: '📢', label: 'Announcement',     bg: '#FFF0F0', color: '#EB5757' },
    { to: '/teacher/ai-tools',      icon: '🤖', label: 'AI Tools',         bg: '#EBF4FF', color: '#2F80ED' },
    { to: '/teacher/question-paper',icon: '🗂️', label: 'Question Paper',   bg: '#EEF0FF', color: '#6347D1' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── WELCOME BANNER ── */}
      <div className="fade-up" style={{
        padding: '22px 28px', borderRadius: 20,
        background: 'linear-gradient(135deg,#7B61FF 0%,#5A3EC8 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,0.07)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-40, left:60, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            {greet()}, {user?.name}! 👋
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)' }}>
            {cls.name}{cls.section ? ' · ' + cls.section : ''}{subjects ? '  ·  ' + subjects : ''}
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="stat-grid fade-up-d1">
        <StatCard icon="👨‍🎓" num={data?.total_students ?? '—'} label="Total Students"
          colorKey="purple" trend="+2" trendDir="up" />
        <StatCard icon="📈" num={data?.avg_attendance != null ? `${data.avg_attendance}%` : '—'}
          label="Avg Attendance" colorKey="green"
          trend={data?.avg_attendance >= 75 ? 'Healthy' : 'Low'}
          trendDir={data?.avg_attendance >= 75 ? 'up' : 'down'} />
        <StatCard icon="⚠️" num={data?.at_risk ?? '—'} label="At Risk Students"
          colorKey="red"
          trend={data?.at_risk > 0 ? 'Needs attention' : 'All good'}
          trendDir={data?.at_risk > 0 ? 'down' : 'up'} />
        <StatCard icon="📋" num={data?.active_assignments ?? '—'}
          label="Active Assignments" colorKey="orange" trend="Active" trendDir="flat" />
      </div>

      {/* ── CHART + DETENTION ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>

        {/* Area chart */}
        <div className="card fade-up-d2">
          <div className="card-header">
            <div>
              <div className="card-title">📈 Class Performance Trend</div>
              <div className="card-sub">Attendance vs Marks — last 6 months</div>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {[['#7B61FF', 'Attendance'], ['#27AE60', 'Marks']].map(([c, n]) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
                  <span style={{ color: 'var(--text3)' }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7B61FF" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#7B61FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gM" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#27AE60" stopOpacity={0.14} />
                    <stop offset="95%" stopColor="#27AE60" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} domain={[50, 100]} />
                <Tooltip contentStyle={{ background: 'var(--card-bg)', border: 'none', borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,0.10)', fontSize: 12 }} />
                <Area type="monotoneX" dataKey="attendance" name="Attendance" stroke="#7B61FF" strokeWidth={2.5} fill="url(#gA)" dot={false} activeDot={{ r: 5, fill: '#7B61FF' }} />
                <Area type="monotoneX" dataKey="marks" name="Marks" stroke="#27AE60" strokeWidth={2.5} fill="url(#gM)" dot={false} activeDot={{ r: 5, fill: '#27AE60' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detention alerts */}
        <div className="card fade-up-d2">
          <div className="card-header">
            <div>
              <div className="card-title">⚠️ Detention Alerts</div>
              <div className="card-sub">Students below 75%</div>
            </div>
            <Link to="/teacher/analytics" className="view-all">View All</Link>
          </div>
          {alerts.length === 0 ? (
            <div className="empty" style={{ padding: '28px 20px' }}>
              <div className="empty-icon">✅</div>
              <div className="empty-title">All on track!</div>
              <div className="empty-sub">No detention alerts</div>
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {alerts.map((a, i) => (
                <div key={a.roll_no} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 20px',
                  borderBottom: i < alerts.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: a.severity === 'critical'
                      ? 'linear-gradient(135deg,#EB5757,#C0392B)'
                      : 'linear-gradient(135deg,#F2994A,#E8890D)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 11, fontWeight: 700,
                  }}>
                    {a.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <div style={{ flex: 1, height: 5, background: 'var(--surface3)', borderRadius: 50, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${a.percentage}%`, background: 'linear-gradient(90deg,#EB5757,#F2994A)', borderRadius: 50 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>{a.percentage}%</span>
                    </div>
                  </div>
                  <span className={`badge badge-${a.severity === 'critical' ? 'red' : 'orange'}`} style={{ fontSize: 9 }}>
                    {a.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ANNOUNCEMENTS + AI PROMO ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>

        {/* Recent Announcements */}
        <div className="card fade-up-d3">
          <div className="card-header">
            <div>
              <div className="card-title">📢 Recent Announcements</div>
              <div className="card-sub">Latest posts for {cls.name}</div>
            </div>
            <Link to="/teacher/announcements" className="view-all">Manage</Link>
          </div>
          {announcements.length === 0 ? (
            <div className="empty" style={{ padding: '24px 20px' }}>
              <div className="empty-icon">📢</div>
              <div className="empty-title">No announcements yet</div>
              <Link to="/teacher/announcements" className="btn btn-primary btn-xs" style={{ marginTop: 10 }}>
                Post Announcement
              </Link>
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {announcements.map((a, i) => {
                const pStyle = a.priority === 'high'
                  ? { bg: '#FFF0F0', color: '#EB5757', icon: '🔴' }
                  : a.priority === 'medium'
                  ? { bg: '#FFF3E8', color: '#F2994A', icon: '🟡' }
                  : { bg: '#EEF0FF', color: '#6347D1', icon: '🔵' };
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '12px 20px',
                    borderBottom: i < announcements.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: pStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      {pStyle.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{a.subject} · {new Date(a.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                    </div>
                    <span className={`badge badge-${a.priority === 'high' ? 'red' : a.priority === 'medium' ? 'orange' : 'purple'}`} style={{ fontSize: 9, flexShrink: 0 }}>
                      {a.priority || 'info'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Promo */}
        <div className="card fade-up-d3" style={{ background: 'linear-gradient(135deg,#F8F4FF,#EEF0FF)', border: 'none' }}>
          <div className="card-header" style={{ border: 'none', paddingBottom: 8 }}>
            <div className="card-title" style={{ color: '#6347D1' }}>🤖 AI-Powered Tools</div>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <p style={{ fontSize: 12, color: '#6347D1', lineHeight: 1.7, marginBottom: 14, opacity: 0.85 }}>
              Save hours of work. Generate lesson plans, question papers, rubrics and more in seconds.
            </p>
            {[
              ['📖', 'Lesson Plan Generator'],
              ['📝', 'Question Paper AI'],
              ['🎯', 'Assignment Rubrics'],
              ['📊', 'Content Summarizer'],
            ].map(([icon, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: '#6347D1', fontWeight: 500 }}>
                <span>{icon}</span> {label}
              </div>
            ))}
            <Link to="/teacher/ai-tools" className="btn btn-primary btn-sm btn-full" style={{ marginTop: 12 }}>
              Open AI Tools →
            </Link>
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="card fade-up-d4">
        <div className="card-header">
          <div className="card-title">⚡ Quick Actions</div>
          <div className="card-sub">Jump to frequently used features</div>
        </div>
        <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {QUICK.map(a => (
            <Link key={a.to} to={a.to}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '11px 20px', borderRadius: '50px',
                background: a.bg, color: a.color,
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
                transition: 'all 0.2s', border: `2px solid ${a.bg}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.10)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >
              <span style={{ fontSize: 17 }}>{a.icon}</span>{a.label}
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}