import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [att,   setAtt]   = useState([]);
  const [asgn,  setAsgn]  = useState([]);
  const [ann,   setAnn]   = useState([]);
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/attendance/mine'),
      api.get('/assignments/mine'),
      api.get('/announcements/mine'),
      api.get('/marks/mine'),
    ]).then(([a, as, an, m]) => {
      setAtt(a.data || []);
      setAsgn(as.data || []);
      setAnn(an.data || []);
      setMarks(m.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader text="Loading your dashboard..." />;

  const avgAtt   = att.length   ? Math.round(att.reduce((s,a) => s+a.percentage,0) / att.length) : null;
  const atRisk   = att.filter(a => a.at_risk).length;
  const pending  = asgn.filter(a => !a.submitted).length;
  const avgMarks = marks.length ? Math.round(marks.reduce((s,m) => s+(m.percentage||0),0) / marks.length) : null;
  const urgent   = asgn.filter(a => !a.submitted && (a.days_left||99) <= 3).slice(0, 4);

  const PASTELS = ['#FFF3E8','#E8FBF0','#EEF0FF','#FFF0F0'];
  const COLORS  = ['#F2994A','#27AE60','#6347D1','#EB5757'];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:22 }}>

      {/* Welcome banner */}
      <div className="fade-up" style={{
        padding:'22px 28px', borderRadius:20,
        background:'linear-gradient(135deg,#7B61FF 0%,#5A3EC8 100%)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,0.07)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-40, left:60, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }}/>
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ fontSize:21, fontWeight:700, color:'#fff', marginBottom:4 }}>
            Hey, {user?.name?.split(' ')[0]}! 👋
          </div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.72)' }}>
            {user?.course ? `${user.course}${user.semester ? ' · Sem ' + user.semester : ''}` : 'Here\'s your academic overview for today'}
          </div>
        </div>
        <div style={{ fontSize:60, position:'relative', zIndex:1, flexShrink:0 }}>🎓</div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid fade-up-d1">
        <StatCard icon="📈"
          num={avgAtt != null ? `${avgAtt}%` : '—'}
          label="Avg Attendance"
          colorKey="green"
          trend={avgAtt != null ? (avgAtt >= 75 ? 'On Track' : 'At Risk') : '—'}
          trendDir={avgAtt != null && avgAtt >= 75 ? 'up' : 'down'} />
        <StatCard icon="⚠️"
          num={atRisk}
          label="At-Risk Subjects"
          colorKey="red"
          sub="Below 75%"
          trend={atRisk > 0 ? 'Needs attention' : 'All safe'}
          trendDir={atRisk > 0 ? 'down' : 'up'} />
        <StatCard icon="📋"
          num={pending}
          label="Pending Tasks"
          colorKey="orange"
          sub={`${asgn.length} total`}
          trend={pending > 0 ? `${pending} pending` : 'All done!'}
          trendDir="flat" />
        <StatCard icon="🏆"
          num={avgMarks != null ? `${avgMarks}%` : '—'}
          label="Avg Marks"
          colorKey="purple"
          trend={avgMarks != null ? (avgMarks >= 75 ? 'Excellent' : avgMarks >= 60 ? 'Good' : 'Keep going') : '—'}
          trendDir={avgMarks != null && avgMarks >= 60 ? 'up' : 'flat'} />
      </div>

      {/* Main content grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>

        {/* Attendance by subject */}
        <div className="card fade-up-d2">
          <div className="card-header">
            <div>
              <div className="card-title">📊 Subject Attendance</div>
              <div className="card-sub">Your progress this semester</div>
            </div>
            <Link to="/student/attendance" className="view-all">View Details</Link>
          </div>
          <div className="card-body">
            {att.length === 0 ? (
              <div className="empty" style={{ padding:'20px 0' }}>
                <div className="empty-icon">📊</div>
                <div className="empty-sub">No attendance data yet</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {att.slice(0, 5).map(a => {
                  const pct  = Math.min(a.percentage, 100);
                  const safe = !a.at_risk;
                  const clr  = safe ? '#27AE60' : '#EB5757';
                  return (
                    <div key={a.subject}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'var(--text1)' }}>{a.subject}</span>
                          {a.at_risk && <span style={{ fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:'50px', background:'#FFF0F0', color:'#EB5757' }}>At Risk</span>}
                        </div>
                        <span style={{ fontSize:13, fontWeight:700, color:clr }}>{a.percentage}%</span>
                      </div>
                      <div style={{ height:7, background:'var(--surface3)', borderRadius:50, overflow:'hidden', position:'relative' }}>
                        {/* 75% marker */}
                        <div style={{ position:'absolute', top:0, left:'75%', width:1.5, height:'100%', background:'rgba(0,0,0,0.15)', zIndex:2 }}/>
                        <div style={{ height:'100%', width:`${pct}%`, borderRadius:50, background:safe?'linear-gradient(90deg,#27AE60,#6FCF97)':'linear-gradient(90deg,#EB5757,#F2994A)', transition:'width 0.7s ease' }}/>
                      </div>
                    </div>
                  );
                })}
                {att.length > 5 && <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center' }}>+{att.length-5} more subjects</div>}
              </div>
            )}
          </div>
        </div>

        {/* Due soon */}
        <div className="card fade-up-d2">
          <div className="card-header">
            <div>
              <div className="card-title">🔥 Due Soon</div>
              <div className="card-sub">Assignments due within 3 days</div>
            </div>
            <Link to="/student/assignments" className="view-all">View All</Link>
          </div>
          <div className="card-body">
            {urgent.length === 0 ? (
              <div className="empty" style={{ padding:'20px 0' }}>
                <div className="empty-icon">✅</div>
                <div className="empty-title">No urgent deadlines!</div>
                <div className="empty-sub">You're all caught up</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {urgent.map((a, i) => (
                  <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', background:PASTELS[i%PASTELS.length], borderRadius:14 }}>
                    <div style={{ width:42, height:42, borderRadius:12, flexShrink:0, background:'rgba(255,255,255,0.7)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                      <div style={{ fontSize:15, fontWeight:800, color:COLORS[i%COLORS.length], lineHeight:1 }}>
                        {a.days_left <= 0 ? '!' : a.days_left}
                      </div>
                      <div style={{ fontSize:8, fontWeight:600, color:COLORS[i%COLORS.length], textTransform:'uppercase' }}>
                        {a.days_left <= 0 ? 'today' : 'days'}
                      </div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.title}</div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{a.subject}</div>
                    </div>
                    <span className={`badge badge-${a.days_left<=0?'red':'orange'}`} style={{ fontSize:9, flexShrink:0 }}>
                      {a.days_left<=0 ? 'Today!' : `${a.days_left}d left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Announcements */}
      {ann.length > 0 && (
        <div className="card fade-up-d3">
          <div className="card-header">
            <div>
              <div className="card-title">📢 Recent Announcements</div>
              <div className="card-sub">Latest updates from your teachers</div>
            </div>
            <span className="badge badge-purple">{ann.length}</span>
          </div>
          <div style={{ padding:'8px 0' }}>
            {ann.slice(0, 5).map((a, i) => {
              const isSystem = a.is_automated || a.teacher_id === 'SYSTEM';
              const isPrivate = a.target_roll && a.target_roll !== '';
              const autoIcon = a.auto_type === 'attendance_alert' ? '⚠️'
                : a.auto_type === 'assignment_reminder' ? '📋'
                : a.auto_type === 'marks_drop' ? '📉'
                : a.auto_type === 'detention_notice' ? '🚨'
                : '🤖';
              const pStyle = isSystem
                ? { bg:'#FFF3E8', color:'#F2994A', icon:autoIcon }
                : a.priority === 'high'
                ? { bg:'#FFF0F0', color:'#EB5757', icon:'🔴' }
                : a.priority === 'medium'
                ? { bg:'#FFF3E8', color:'#F2994A', icon:'🟡' }
                : { bg:'#EEF0FF', color:'#6347D1', icon:'🔵' };
              return (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'12px 24px', borderBottom: i < ann.slice(0,5).length-1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:pStyle.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                    {pStyle.icon}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)' }}>{a.title}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                      {isSystem ? '🤖 SmartAcademic System' : a.teacher_name}
                      {a.subject ? ` · ${a.subject}` : ''}
                      {' · '}{new Date(a.created_at || Date.now()).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:4, flexShrink:0, flexDirection:'column', alignItems:'flex-end' }}>
                    <span className={`badge badge-${a.priority==='high'?'red':a.priority==='medium'?'orange':'purple'}`} style={{ fontSize:9 }}>
                      {a.priority || 'info'}
                    </span>
                    {isPrivate && <span style={{ fontSize:8, fontWeight:700, color:'#F2994A', background:'#FFF3E8', padding:'1px 6px', borderRadius:'50px' }}>🔒 Private</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="card fade-up-d4">
        <div className="card-header">
          <div className="card-title">⚡ Quick Access</div>
        </div>
        <div className="card-body" style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {[
            { to:'/student/attendance',   icon:'✅', label:'My Attendance',    bg:'#E8FBF0', color:'#27AE60' },
            { to:'/student/assignments',  icon:'📋', label:'Assignments',       bg:'#FFF3E8', color:'#F2994A' },
            { to:'/student/report-card',  icon:'📊', label:'Report Card',       bg:'#EEF0FF', color:'#6347D1' },
            { to:'/student/timetable',    icon:'🗓️', label:'Timetable',         bg:'#EBF4FF', color:'#2F80ED' },
            { to:'/student/ai-assistant', icon:'🤖', label:'AI Assistant',      bg:'#EEF0FF', color:'#6347D1' },
            { to:'/student/cgpa-calculator', icon:'🎯', label:'CGPA Calculator', bg:'#FFF0F0', color:'#EB5757' },
          ].map(a => (
            <Link key={a.to} to={a.to}
              style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 20px', borderRadius:'50px', background:a.bg, color:a.color, fontSize:13, fontWeight:600, textDecoration:'none', transition:'all 0.2s', border:`2px solid ${a.bg}` }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 20px rgba(0,0,0,0.10)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; }}>
              <span style={{ fontSize:17 }}>{a.icon}</span>{a.label}
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}