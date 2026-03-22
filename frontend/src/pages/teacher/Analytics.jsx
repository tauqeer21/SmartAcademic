import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentClass, useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';

const grade = p => p>=90?'O':p>=80?'A+':p>=70?'A':p>=60?'B+':p>=50?'B':p>=40?'C':'F';
const gradeColor = g => (g==='O'||g==='A+') ? '#27AE60' : g==='F' ? '#EB5757' : (g==='A'||g==='B+') ? '#F2994A' : '#6347D1';
const COLORS = ['#7B61FF','#27AE60','#F2994A','#EB5757','#2F80ED','#00B5A5'];

export default function Analytics() {
  const { user } = useAuth();
  const [cls] = useCurrentClass();
  const [subjects, setSubjects] = useState([]);
  const [stats,  setStats]   = useState(null);
  const [alerts, setAlerts]  = useState([]);
  const [marks,  setMarks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]        = useState('overview');

  useEffect(() => {
    const cid = cls?.id;
    setLoading(true);
    Promise.all([
      api.get('/analytics/teacher-dashboard' + (cid ? '?class_id=' + cid : '')),
      cid ? api.get('/analytics/detention-alerts/' + cid) : Promise.resolve({ data: [] }),
      cid ? api.get('/marks/class/' + cid)               : Promise.resolve({ data: [] }),
      cid ? api.get('/classes/' + cid + '/my-subjects')  : Promise.resolve({ data: [] }),
    ]).then(([s, a, m, subj]) => {
      const mySubjects = subj.data || [];
      setSubjects(mySubjects);
      setStats(s.data);
      setAlerts(a.data || []);
      // Only show marks for THIS teacher's subjects
      setMarks((m.data || []).filter(mk => mySubjects.includes(mk.subject)));
    }).finally(() => setLoading(false));
  }, [cls?.id]);

  if (loading) return <Loader text="Loading analytics..." />;

  /* ── Computed ── */
  const bySubject = marks.reduce((acc, m) => {
    if (!acc[m.subject]) acc[m.subject] = { subject: m.subject, total: 0, count: 0, pass: 0, fail: 0 };
    acc[m.subject].total += (m.percentage || 0);
    acc[m.subject].count++;
    if ((m.percentage || 0) >= 40) acc[m.subject].pass++;
    else acc[m.subject].fail++;
    return acc;
  }, {});
  const subjectData = Object.values(bySubject).map(s => ({ ...s, avg: Math.round(s.total / s.count) }));

  const gradeDist = marks.reduce((acc, m) => {
    const g = grade(m.percentage || 0);
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});
  const gradeData = Object.entries(gradeDist).map(([g, count]) => ({ name: g, value: count, color: gradeColor(g) }));

  const TABS = [
    { id: 'overview',   label: '📊 Overview'   },
    { id: 'attendance', label: '✅ Attendance' },
    { id: 'marks',      label: '📝 Marks'      },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      <div className="page-header fade-up" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
        <div>
          <div className="page-title">Analytics</div>
          <div className="page-sub">
            Comprehensive class performance analysis{cls ? ' — ' + cls.name + (cls.section ? ' · ' + cls.section : '') : ''}
          </div>
        </div>
        {cls?.id && (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => {
              const tok = localStorage.getItem('sas_token');
              fetch(`/api/analytics/export/attendance/${cls.id}`, { headers:{ Authorization:`Bearer ${tok}` }})
                .then(r=>r.blob()).then(b=>{ const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download=`attendance_${cls.name}.csv`; a.click(); URL.revokeObjectURL(u); });
            }} className="btn btn-ghost btn-sm">📥 Attendance CSV</button>
            <button onClick={() => {
              const tok = localStorage.getItem('sas_token');
              fetch(`/api/analytics/export/marks/${cls.id}`, { headers:{ Authorization:`Bearer ${tok}` }})
                .then(r=>r.blob()).then(b=>{ const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download=`marks_${cls.name}.csv`; a.click(); URL.revokeObjectURL(u); });
            }} className="btn btn-ghost btn-sm">📥 Marks CSV</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8 }} className="fade-up-d1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'10px 22px', borderRadius:'50px',
            border:`2px solid ${tab===t.id ? '#7B61FF' : 'var(--border2)'}`,
            background: tab===t.id ? 'linear-gradient(135deg,#7B61FF,#6347D1)' : 'var(--card-bg)',
            color: tab===t.id ? '#fff' : 'var(--text2)',
            fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)',
            transition:'all 0.2s',
            boxShadow: tab===t.id ? '0 6px 20px rgba(99,71,209,0.30)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Stat Cards — always visible */}
      <div className="stat-grid fade-up-d1">
        <StatCard icon="👥" num={stats?.total_students ?? 0}   label="Total Students"    colorKey="purple" />
        <StatCard icon="⚠️" num={alerts.length}                label="At Risk (<75%)"    colorKey="red"
          trend={alerts.length > 0 ? 'Needs action' : 'All good'} trendDir={alerts.length > 0 ? 'down' : 'up'} />
        <StatCard icon="📈" num={(stats?.avg_attendance ?? 0) + '%'} label="Avg Attendance"
          colorKey={stats?.avg_attendance >= 75 ? 'green' : 'red'}
          trend={stats?.avg_attendance >= 75 ? 'Healthy' : 'Low'}
          trendDir={stats?.avg_attendance >= 75 ? 'up' : 'down'} />
        <StatCard icon="📝" num={marks.length}                 label="Total Mark Entries" colorKey="orange" />
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>

            {/* Subject avg bar chart */}
            <div className="card fade-up">
              <div className="card-header">
                <div className="card-title">📊 Subject-wise Avg Marks</div>
                <div className="card-sub">Average percentage per subject</div>
              </div>
              <div className="card-body">
                {subjectData.length === 0 ? (
                  <div className="empty" style={{ padding:'20px 0' }}>
                    <div className="empty-icon">📊</div>
                    <div className="empty-sub">No marks data yet</div>
                    <Link to="/teacher/marks" className="btn btn-primary btn-xs" style={{ marginTop:8 }}>Enter Marks</Link>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={subjectData} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="subject" tick={{ fill:'var(--text3)', fontSize:10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill:'var(--text3)', fontSize:11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background:'var(--card-bg)', border:'none', borderRadius:14, boxShadow:'0 10px 30px rgba(0,0,0,0.10)', fontSize:12 }} />
                      <Bar dataKey="avg" name="Avg %" radius={[8, 8, 0, 0]}>
                        {subjectData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Grade distribution pie */}
            <div className="card fade-up">
              <div className="card-header">
                <div className="card-title">🎯 Grade Distribution</div>
                <div className="card-sub">All marks across all subjects</div>
              </div>
              <div className="card-body">
                {gradeData.length === 0 ? (
                  <div className="empty" style={{ padding:'20px 0' }}>
                    <div className="empty-icon">🎯</div>
                    <div className="empty-sub">No data yet</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={gradeData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        outerRadius={75} label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false} fontSize={11}>
                        {gradeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background:'var(--card-bg)', border:'none', borderRadius:14, boxShadow:'0 10px 30px rgba(0,0,0,0.10)', fontSize:12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Summary row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
            {[
              { label:'Pass Rate',    val: marks.length ? Math.round(marks.filter(m => m.percentage >= 40).length / marks.length * 100) + '%' : '—', icon:'✅', color:'#27AE60', bg:'#E8FBF0' },
              { label:'Highest Score', val: marks.length ? Math.max(...marks.map(m => m.percentage || 0)) + '%' : '—', icon:'🏆', color:'#6347D1', bg:'#EEF0FF' },
              { label:'Class Average', val: marks.length ? Math.round(marks.reduce((s, m) => s + (m.percentage || 0), 0) / marks.length) + '%' : '—', icon:'📊', color:'#2F80ED', bg:'#EBF4FF' },
              { label:'Fail Count',    val: marks.filter(m => (m.percentage || 0) < 40).length, icon:'⚠️', color:'#EB5757', bg:'#FFF0F0' },
            ].map(s => (
              <div key={s.label} style={{ padding:'18px', borderRadius:18, background:s.bg }}>
                <div style={{ fontSize:24, marginBottom:8 }}>{s.icon}</div>
                <div style={{ fontSize:26, fontWeight:800, color:s.color, letterSpacing:'-0.5px', lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:11, fontWeight:600, color:s.color, opacity:0.8, marginTop:6 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {tab === 'attendance' && (
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:18 }}>

            {/* Detention table */}
            <div className="card fade-up">
              <div className="card-header">
                <div>
                  <div className="card-title">⚠️ Detention Risk Students</div>
                  <div className="card-sub">Students below 75% attendance threshold</div>
                </div>
                <span className={`badge badge-${alerts.length > 0 ? 'red' : 'green'}`}>{alerts.length} students</span>
              </div>
              {alerts.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">✅</div>
                  <div className="empty-title">All students on track!</div>
                  <div className="empty-sub">No one below the attendance threshold</div>
                </div>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr><th>Student</th><th>Roll No</th><th>Attendance</th><th>Classes Needed</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {alerts.map(a => (
                      <tr key={a.roll_no}>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div className="stu-av" style={{
                              background: a.severity==='critical'
                                ? 'linear-gradient(135deg,#EB5757,#C0392B)'
                                : 'linear-gradient(135deg,#F2994A,#E8890D)',
                              width:32, height:32, fontSize:11,
                            }}>
                              {a.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <div style={{ fontWeight:600, color:'var(--text1)', fontSize:13 }}>{a.name}</div>
                              <div style={{ fontSize:10, color:'var(--text3)' }}>{a.gender}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className="badge badge-purple">{a.roll_no}</span></td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:80, height:6, background:'var(--surface3)', borderRadius:50, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${a.percentage}%`, background:'linear-gradient(90deg,#EB5757,#F2994A)', borderRadius:50 }} />
                            </div>
                            <span style={{ fontSize:12, fontWeight:700, color:'var(--red)' }}>{a.percentage}%</span>
                          </div>
                        </td>
                        <td><span style={{ fontSize:12, color:'var(--text2)', fontWeight:600 }}>{a.classes_needed} more</span></td>
                        <td><span className={`badge badge-${a.severity==='critical' ? 'red' : 'orange'}`}>{a.severity}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Right summary */}
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="card fade-up" style={{ padding:'20px' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text1)', marginBottom:16 }}>📊 Attendance Breakdown</div>
                {[
                  { label:'Above 90%', val: Math.max(0, (stats?.total_students||0) - alerts.length - 2), color:'#27AE60', bg:'#E8FBF0' },
                  { label:'75–90%',    val: Math.min(2, Math.max(0, (stats?.total_students||0) - alerts.length)), color:'#6347D1', bg:'#EEF0FF' },
                  { label:'60–75%',    val: alerts.filter(a => a.severity !== 'critical').length, color:'#F2994A', bg:'#FFF3E8' },
                  { label:'Below 60%', val: alerts.filter(a => a.severity === 'critical').length, color:'#EB5757', bg:'#FFF0F0' },
                ].map(s => (
                  <div key={s.label} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color:s.color, flexShrink:0 }}>{s.val}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text1)', marginBottom:3 }}>{s.label}</div>
                      <div style={{ height:5, background:'var(--surface3)', borderRadius:50, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${stats?.total_students ? Math.min(100, s.val/stats.total_students*100) : 0}%`, background:s.color, borderRadius:50 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card fade-up" style={{ padding:'20px', background:'linear-gradient(135deg,#F8F4FF,#EEF0FF)', border:'none' }}>
                <div style={{ fontSize:46, fontWeight:900, color:'#6347D1', letterSpacing:'-2px', lineHeight:1 }}>
                  {stats?.avg_attendance || 0}%
                </div>
                <div style={{ fontSize:13, color:'#6347D1', fontWeight:600, marginTop:6 }}>Class Average Attendance</div>
                <div style={{ fontSize:11, color:'#6347D1', opacity:0.7, marginTop:6 }}>
                  {(stats?.avg_attendance || 0) >= 75 ? '✅ Above required threshold' : '⚠️ Below required 75%'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MARKS TAB ── */}
      {tab === 'marks' && (
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          {subjectData.length === 0 ? (
            <div className="card">
              <div className="empty">
                <div className="empty-icon">📝</div>
                <div className="empty-title">No marks data yet</div>
                <div className="empty-sub">Enter marks to see analysis here</div>
                <Link to="/teacher/marks" className="btn btn-primary btn-sm" style={{ marginTop:12 }}>Enter Marks</Link>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>

                {/* Subject performance bars */}
                <div className="card fade-up">
                  <div className="card-header">
                    <div className="card-title">📊 Subject Performance</div>
                    <div className="card-sub">Average marks and pass rate</div>
                  </div>
                  <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    {subjectData.map((s, i) => (
                      <div key={s.subject}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'var(--text1)' }}>{s.subject}</span>
                          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <span style={{ fontSize:11, color:'var(--text3)' }}>{s.count} entries</span>
                            <span style={{ fontSize:13, fontWeight:700, color:COLORS[i % COLORS.length] }}>{s.avg}%</span>
                          </div>
                        </div>
                        <div style={{ height:8, background:'var(--surface3)', borderRadius:50, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${s.avg}%`, borderRadius:50, background:COLORS[i % COLORS.length] }} />
                        </div>
                        <div style={{ display:'flex', gap:12, marginTop:4, fontSize:10, color:'var(--text3)' }}>
                          <span style={{ color:'#27AE60' }}>✅ {s.pass} pass</span>
                          <span style={{ color:'#EB5757' }}>❌ {s.fail} fail</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grade breakdown */}
                <div className="card fade-up">
                  <div className="card-header">
                    <div className="card-title">🎯 Grade Breakdown</div>
                    <div className="card-sub">Distribution across all entries</div>
                  </div>
                  <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {['O','A+','A','B+','B','C','F'].map(g => {
                      const count = gradeDist[g] || 0;
                      const pct   = marks.length ? Math.round(count / marks.length * 100) : 0;
                      return (
                        <div key={g} style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <span style={{ width:38, height:28, borderRadius:8, background:gradeColor(g)+'18', color:gradeColor(g), fontSize:12, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{g}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ height:7, background:'var(--surface3)', borderRadius:50, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${pct}%`, background:gradeColor(g), borderRadius:50 }} />
                            </div>
                          </div>
                          <span style={{ fontSize:12, fontWeight:700, color:'var(--text2)', minWidth:28 }}>{count}</span>
                          <span style={{ fontSize:10, color:'var(--text3)', minWidth:32 }}>{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Full marks table */}
              <div className="card fade-up">
                <div className="card-header">
                  <div className="card-title">📋 All Marks Records</div>
                  <span className="badge badge-purple">{marks.length} entries</span>
                </div>
                <table className="tbl">
                  <thead>
                    <tr><th>Student</th><th>Subject</th><th>Exam Type</th><th>Marks</th><th>Score</th><th>Grade</th></tr>
                  </thead>
                  <tbody>
                    {marks.slice(0, 30).map((m, i) => {
                      const g  = m.grade || grade(m.percentage || 0);
                      const gc = gradeColor(g);
                      return (
                        <tr key={i}>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <div className="stu-av" style={{ background:'linear-gradient(135deg,#7B61FF,#6347D1)', width:30, height:30, fontSize:10 }}>
                                {m.student_name?.split(' ').map(w => w[0]).join('').slice(0, 2) || '--'}
                              </div>
                              <span style={{ fontWeight:600, color:'var(--text1)', fontSize:13 }}>{m.student_name}</span>
                            </div>
                          </td>
                          <td style={{ fontSize:12, color:'var(--text2)' }}>{m.subject}</td>
                          <td><span className="badge badge-purple">{m.exam_type}</span></td>
                          <td><span style={{ fontWeight:700, color:'var(--text1)' }}>{m.marks_obtained}/{m.marks_total}</span></td>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:70, height:6, background:'var(--surface3)', borderRadius:50, overflow:'hidden' }}>
                                <div style={{ height:'100%', width:`${m.percentage}%`, background:(m.percentage||0)>=60?'#27AE60':'#EB5757', borderRadius:50 }} />
                              </div>
                              <span style={{ fontSize:11, fontWeight:700, color:'var(--text2)' }}>{m.percentage}%</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:'50px', background:gc+'18', color:gc }}>{g}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {marks.length > 30 && (
                  <div style={{ padding:'12px 20px', fontSize:12, color:'var(--text3)', textAlign:'center', borderTop:'1px solid var(--border)' }}>
                    Showing 30 of {marks.length} records · Go to Marks Entry for full list
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}