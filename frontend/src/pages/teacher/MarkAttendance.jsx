import { useState, useEffect, useRef } from 'react';
import { useCurrentClass } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';

export default function MarkAttendance() {
  const [cls] = useCurrentClass();
  const [subjects, setSubjects]   = useState([]);
  const [subject,  setSubject]    = useState('');
  const [students, setStudents]   = useState([]);
  const [attendance, setAtt]      = useState({});
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving]       = useState(false);
  const [saved,  setSaved]        = useState(false);
  const [totalLec, setTotalLec]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [tab, setTab]             = useState('mark');
  const [summary, setSummary]     = useState([]);
  const [history, setHistory]     = useState([]);
  const [histDate, setHistDate]   = useState(new Date().toISOString().split('T')[0]);
  const [histLoading, setHistLoading] = useState(false);
  const [detained, setDetained]   = useState(null);
  const [detThreshold, setDetThreshold] = useState(75);
  const [detLoading, setDetLoading] = useState(false);
  const [announcing, setAnnouncing] = useState(false);
  const [smartSearch, setSmartSearch] = useState('');

  // Smart attendance state
  const [smartTab, setSmartTab]   = useState('search'); // search | camera | register
  const [faceStatus, setFaceStatus] = useState(null);
  const [session, setSession]     = useState(null);
  const [sessionAtt, setSessionAtt] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [detections, setDetections] = useState([]);
  const [regRoll, setRegRoll]     = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!cls?.id) return;
    api.get('/classes/' + cls.id + '/my-subjects').then(r => {
      setSubjects(r.data || []);
      if (r.data.length > 0) setSubject(r.data[0]);
    });
  }, [cls?.id]);

  useEffect(() => {
    if (!cls?.id || !subject) return;
    setLoading(true); setSaved(false);
    Promise.all([
      api.get('/classes/' + cls.id + '/students'),
      api.get('/attendance/today/' + cls.id + '?subject=' + encodeURIComponent(subject)),
    ]).then(([s, tod]) => {
      const stds = s.data || [];
      setStudents(stds);
      const existing = {};
      (tod.data || []).forEach(r => { existing[r.roll_no] = r.status; });
      const init = {};
      stds.forEach(st => { init[st.roll_no] = existing[st.roll_no] || 'Present'; });
      setAtt(init);
    }).finally(() => setLoading(false));
  }, [cls?.id, subject]);

  useEffect(() => {
    if (tab !== 'summary' || !cls?.id || !subject) return;
    api.get('/attendance/summary/' + cls.id + '?subject=' + encodeURIComponent(subject))
      .then(r => {
        api.get('/classes/' + cls.id + '/students').then(s => {
          const nm = {};
          (s.data || []).forEach(st => { nm[st.roll_no] = st; });
          setSummary((r.data || []).map(row => ({ ...row, ...nm[row.roll_no] })).sort((a,b) => (a.percentage||0) - (b.percentage||0)));
        });
      });
  }, [tab, cls?.id, subject]);

  useEffect(() => {
    if (tab !== 'history' || !cls?.id || !subject) return;
    setHistLoading(true);
    Promise.all([
      api.get('/classes/' + cls.id + '/students'),
      api.get('/attendance/today/' + cls.id + '?subject=' + encodeURIComponent(subject) + '&date=' + histDate),
    ]).then(([s, h]) => {
      const stds = s.data || [];
      const attMap = {};
      (h.data || []).forEach(r => { attMap[r.roll_no] = r.status; });
      setHistory(stds.map(st => ({ ...st, status: attMap[st.roll_no] || 'Not Marked' })));
    }).finally(() => setHistLoading(false));
  }, [tab, cls?.id, subject, histDate]);

  useEffect(() => {
    if (tab !== 'detained' || !cls?.id) return;
    loadDetained();
  }, [tab, cls?.id]);

  useEffect(() => {
    if (tab !== 'smart' || !cls?.id) return;
    api.get('/smart/face-status/' + cls.id).then(r => setFaceStatus(r.data)).catch(() => {});
  }, [tab, cls?.id]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const loadDetained = async () => {
    if (!cls?.id) return;
    setDetLoading(true);
    try {
      const r = await api.post('/attendance/detained-list', { class_id: cls.id, threshold: detThreshold });
      setDetained(r.data);
    } catch { toast.error('Failed to load detained list'); }
    finally { setDetLoading(false); }
  };

  const sendDetentionNotice = async () => {
    if (!detained?.detained?.length) return;
    setAnnouncing(true);
    try {
      await api.post('/attendance/detained-announce', {
        class_id: cls.id,
        threshold: detThreshold,
        detained: detained.detained,
      });
      toast.success('Detention notices sent to ' + detained.detained.length + ' students!');
    } catch { toast.error('Failed to send notices'); }
    finally { setAnnouncing(false); }
  };

  const toggle  = roll => setAtt(a => ({ ...a, [roll]: a[roll]==='Present' ? 'Absent' : 'Present' }));
  const markAll = s => { const a = {}; students.forEach(st => a[st.roll_no] = s); setAtt(a); };

  const handleSave = async (useDate) => {
    if (!cls?.id || !subject) { toast.error('Select class and subject'); return; }
    setSaving(true);
    try {
      await api.post('/attendance/mark', {
        class_id: cls.id, subject, date: useDate || date,
        records: students.map(s => ({ roll_no: s.roll_no, status: attendance[s.roll_no] || 'Absent' })),
      });
      if (totalLec) await api.post('/attendance/semester-config', { class_id: cls.id, subject, total_lectures: parseInt(totalLec) });
      toast.success('Attendance saved! ✅'); setSaved(true);
    } catch(err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  // ── SMART ATTENDANCE ──
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width:640, height:480 } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { toast.error('Cannot access camera. Please allow camera permission.'); }
  };

  const stopCamera = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setStreaming(false);
  };

  const startSession = async () => {
    if (!cls?.id || !subject) { toast.error('Select class and subject first'); return; }
    try {
      const r = await api.post('/smart/session/start', { class_id: cls.id, subject });
      setSession(r.data);
      toast.success('Session started! Point camera at students.');
      await startCamera();
      setStreaming(true);
      // Poll for live attendance board
      const pollAtt = async () => {
        try {
          const a = await api.get(`/smart/session-attendance?class_id=${cls.id}&subject=${encodeURIComponent(subject)}`);
          setSessionAtt(a.data.students || []);
        } catch {}
      };
      pollAtt();
      intervalRef.current = setInterval(async () => {
        // Capture frame
        if (!canvasRef.current || !videoRef.current || !videoRef.current.readyState >= 2) return;
        const ctx = canvasRef.current.getContext('2d');
        canvasRef.current.width  = 320;
        canvasRef.current.height = 240;
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        const frame_b64 = canvasRef.current.toDataURL('image/jpeg', 0.7).split(',')[1];
        try {
          const res = await api.post('/smart/process-frame', {
            frame_b64, class_id: cls.id, subject,
            session_id: r.data?.session_id || session?.session_id,
          });
          setDetections(res.data.detections || []);
          setFrameCount(c => c + 1);
          pollAtt();
        } catch {}
      }, 2000);
    } catch(err) { toast.error(err.response?.data?.error || 'Failed to start session'); }
  };

  const endSession = async () => {
    clearInterval(intervalRef.current); intervalRef.current = null;
    setStreaming(false);
    try {
      await api.post('/smart/session/end', {
        session_id: session?.session_id,
        class_id: cls.id, subject,
      });
      await api.post('/smart/finalize-absent', { class_id: cls.id, subject });
      toast.success('Session ended! Absent students marked automatically.');
      setSession(null); setDetections([]);
      stopCamera();
      // Reload attendance
      const a = await api.get(`/smart/session-attendance?class_id=${cls.id}&subject=${encodeURIComponent(subject)}`);
      setSessionAtt(a.data.students || []);
    } catch(err) { toast.error(err.response?.data?.error || 'Failed to end session'); }
  };

  const registerFace = async (roll, imageB64) => {
    setRegLoading(true);
    try {
      const r = await api.post('/smart/register-face', { roll_no: roll, image_b64: imageB64 });
      toast.success(r.data.message || 'Photo registered!');
      const fs = await api.get('/smart/face-status/' + cls.id);
      setFaceStatus(fs.data);
    } catch(err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setRegLoading(false); }
  };

  const captureForRegister = async (roll) => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    canvasRef.current.width  = 320; canvasRef.current.height = 240;
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
    const b64 = canvasRef.current.toDataURL('image/jpeg', 0.85).split(',')[1];
    await registerFace(roll, b64);
  };

  const present = Object.values(attendance).filter(v=>v==='Present').length;
  const absent  = students.length - present;
  const pct     = students.length ? Math.round(present/students.length*100) : 0;
  const smartStudents = students.filter(s =>
    !smartSearch || s.name.toLowerCase().includes(smartSearch.toLowerCase()) ||
    s.roll_no.toLowerCase().includes(smartSearch.toLowerCase())
  );

  if (!cls) return (
    <div className="empty">
      <div className="empty-icon">🏫</div><div className="empty-title">No class selected</div>
      <div className="empty-sub">Select a class from the switcher in the top bar</div>
    </div>
  );

  const TABS = [
    { id:'mark',    label:'✅ Mark' },
    { id:'smart',   label:'⚡ Smart' },
    { id:'summary', label:'📊 Summary' },
    { id:'history', label:'📅 History' },
    { id:'detained',label:'⚠️ Detained' },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Controls */}
      <div className="card fade-up">
        <div className="card-header">
          <div>
            <div className="card-title">🗓️ Attendance Controls</div>
            <div className="card-sub">{cls.name}{cls.section?' · '+cls.section:''} — your subjects only</div>
          </div>
          {saved && <span className="badge badge-green">✓ Saved</span>}
        </div>
        <div className="card-body">
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div className="field" style={{ flex:1, minWidth:150 }}>
              <label className="lbl">Subject</label>
              <select className="inp" value={subject} onChange={e => { setSubject(e.target.value); setSaved(false); }}>
                {subjects.length===0 ? <option value="">No subjects assigned</option> : subjects.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="lbl">Date</label>
              <input className="inp" type="date" value={date} max={new Date().toISOString().split('T')[0]} onChange={e => { setDate(e.target.value); setSaved(false); }}/>
            </div>
            <div className="field">
              <label className="lbl">Total Semester Lectures</label>
              <input className="inp" type="number" placeholder="e.g. 60" value={totalLec} onChange={e => setTotalLec(e.target.value)} style={{ width:170 }}/>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="card" style={{ padding:'14px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          {[{l:'Present',v:present,c:'#27AE60',bg:'#E8FBF0'},{l:'Absent',v:absent,c:'#EB5757',bg:'#FFF0F0'},{l:'Total',v:students.length,c:'#6347D1',bg:'#EEF0FF'}].map(s => (
            <div key={s.l} style={{ textAlign:'center', padding:'8px 16px', background:s.bg, borderRadius:14 }}>
              <div style={{ fontSize:22, fontWeight:800, color:s.c }}>{s.v}</div>
              <div style={{ fontSize:10, fontWeight:600, color:s.c }}>{s.l}</div>
            </div>
          ))}
          <div style={{ flex:1, minWidth:160 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <span style={{ fontSize:12, color:'var(--text3)' }}>Rate</span>
              <span style={{ fontSize:13, fontWeight:700, color:pct>=75?'#27AE60':'#EB5757' }}>{pct}%</span>
            </div>
            <div style={{ height:10, background:'var(--surface3)', borderRadius:50, overflow:'hidden', position:'relative' }}>
              <div style={{ position:'absolute', top:0, left:'75%', width:2, height:'100%', background:'rgba(0,0,0,0.2)' }}/>
              <div style={{ height:'100%', width:pct+'%', borderRadius:50, background:pct>=75?'linear-gradient(90deg,#27AE60,#6FCF97)':'linear-gradient(90deg,#EB5757,#F2994A)', transition:'width 0.5s' }}/>
            </div>
            <div style={{ fontSize:9, color:'var(--text3)', marginTop:2 }}>▲ 75% required</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => markAll('Present')} className="btn btn-success btn-sm">✓ All Present</button>
            <button onClick={() => markAll('Absent')}  className="btn btn-danger btn-sm">✗ All Absent</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'9px 18px', borderRadius:'50px',
            border:`2px solid ${tab===t.id?'#7B61FF':'var(--border2)'}`,
            background:tab===t.id?'linear-gradient(135deg,#7B61FF,#6347D1)':'var(--card-bg)',
            color:tab===t.id?'#fff':'var(--text2)', fontSize:12, fontWeight:600,
            cursor:'pointer', fontFamily:'var(--font)', transition:'all 0.18s',
            boxShadow:tab===t.id?'0 6px 20px rgba(99,71,209,0.28)':'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── MARK TAB ── */}
      {tab==='mark' && (
        <div className="card fade-up">
          <div className="card-header">
            <div className="card-title">{subject} — {new Date(date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}</div>
            <span className="badge badge-purple">{students.length} students</span>
          </div>
          <div className="card-body">
            {loading ? <Loader/> : students.length===0 ? (
              <div className="empty"><div className="empty-icon">👥</div><div className="empty-sub">No students enrolled</div></div>
            ) : (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:16 }}>
                  {students.map(s => {
                    const isP = attendance[s.roll_no]==='Present';
                    return (
                      <div key={s.roll_no} onClick={() => toggle(s.roll_no)}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:16, cursor:'pointer', background:isP?'#E8FBF0':'#FFF0F0', border:`2px solid ${isP?'#A8E6C3':'#FFBDBD'}`, transition:'all 0.15s', userSelect:'none' }}>
                        <div style={{ width:38, height:38, borderRadius:'50%', flexShrink:0, background:isP?'linear-gradient(135deg,#27AE60,#1a8a4a)':'linear-gradient(135deg,#EB5757,#c0392b)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, color:'#fff' }}>
                          {s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
                          <div style={{ fontSize:10, color:'var(--text3)' }}>{s.roll_no}</div>
                        </div>
                        <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0, background:isP?'#27AE60':'#EB5757', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:13, fontWeight:800 }}>
                          {isP?'P':'A'}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => handleSave()} disabled={saving} className="btn btn-primary btn-full" style={{ padding:'13px' }}>
                  {saving ? 'Saving...' : `✅ Save Attendance for ${date}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SMART TAB ── */}
      {tab==='smart' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Smart sub-tabs */}
          <div style={{ display:'flex', gap:8 }}>
            {[{id:'search',label:'🔍 Search Mode'},{id:'camera',label:'📸 Camera Mode'},{id:'register',label:'👤 Register Faces'}].map(t => (
              <button key={t.id} onClick={() => setSmartTab(t.id)} style={{
                padding:'8px 16px', borderRadius:'50px',
                border:`2px solid ${smartTab===t.id?'#27AE60':'var(--border2)'}`,
                background:smartTab===t.id?'linear-gradient(135deg,#27AE60,#1a8a4a)':'var(--card-bg)',
                color:smartTab===t.id?'#fff':'var(--text2)', fontSize:12, fontWeight:600,
                cursor:'pointer', fontFamily:'var(--font)', transition:'all 0.15s',
              }}>{t.label}</button>
            ))}
          </div>

          {/* Search Mode */}
          {smartTab==='search' && (
            <div className="card fade-up">
              <div className="card-header">
                <div><div className="card-title">🔍 Smart Search Mode</div><div className="card-sub">Search and tap to toggle</div></div>
                <span className="badge badge-purple">{present}/{students.length} present</span>
              </div>
              <div className="card-body">
                <div style={{ position:'relative', marginBottom:14 }}>
                  <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'var(--text3)' }}>🔍</span>
                  <input className="inp" placeholder="Search by name or roll number..." value={smartSearch} onChange={e => setSmartSearch(e.target.value)} style={{ paddingLeft:42 }}/>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                  {smartStudents.map(s => {
                    const isP = attendance[s.roll_no]==='Present';
                    return (
                      <div key={s.roll_no} onClick={() => toggle(s.roll_no)}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:14, cursor:'pointer', background:isP?'#E8FBF0':'var(--surface2)', border:`2px solid ${isP?'#A8E6C3':'var(--border)'}`, transition:'all 0.15s', userSelect:'none' }}>
                        <div style={{ width:34, height:34, borderRadius:'50%', flexShrink:0, background:isP?'#27AE60':'var(--surface3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:isP?'#fff':'var(--text3)' }}>
                          {isP?'✓':s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'var(--text1)' }}>{s.name}</span>
                          <span style={{ fontSize:10, color:'var(--text3)', marginLeft:8 }}>{s.roll_no}</span>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, padding:'3px 12px', borderRadius:'50px', background:isP?'#27AE60':'#EB5757', color:'#fff' }}>{isP?'Present':'Absent'}</span>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => handleSave()} disabled={saving} className="btn btn-primary btn-full" style={{ padding:'12px' }}>
                  {saving?'Saving...':`✅ Save for ${date}`}
                </button>
              </div>
            </div>
          )}

          {/* Camera Mode */}
          {smartTab==='camera' && (
            <div className="card fade-up">
              <div className="card-header">
                <div>
                  <div className="card-title">📸 AI Camera Attendance</div>
                  <div className="card-sub">
                    {faceStatus ? `${faceStatus.registered}/${faceStatus.total} students have faces registered` : 'Loading face status...'}
                    {faceStatus && !faceStatus.fr_available && <span className="badge badge-orange" style={{ marginLeft:8 }}>Face Recognition Unavailable</span>}
                  </div>
                </div>
                {session && <span className="badge badge-green">🔴 Session Active</span>}
              </div>
              <div className="card-body">
                {faceStatus && !faceStatus.fr_available && (
                  <div style={{ padding:'12px 16px', borderRadius:14, background:'#FFF3E8', border:'1px solid #FFD4A8', marginBottom:14, fontSize:12, color:'#F2994A' }}>
                    ⚠️ Face recognition library not available on server. You can still register photos for future use, but automatic detection won't work. Use Search Mode instead.
                  </div>
                )}

                {/* Camera feed */}
                <div style={{ position:'relative', marginBottom:14, borderRadius:16, overflow:'hidden', background:'#000', aspectRatio:'4/3', maxWidth:480 }}>
                  <video ref={videoRef} autoPlay playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  <canvas ref={canvasRef} style={{ display:'none' }} />
                  {/* Detection overlays */}
                  {detections.map((d, i) => (
                    <div key={i} style={{
                      position:'absolute',
                      left:`${(d.box?.[0]||0)/640*100}%`, top:`${(d.box?.[1]||0)/480*100}%`,
                      width:`${(d.box?.[2]||0)/640*100}%`, height:`${(d.box?.[3]||0)/480*100}%`,
                      border:`2px solid ${d.status==='matched'?'#27AE60':'#EB5757'}`,
                      borderRadius:4, pointerEvents:'none',
                    }}>
                      <div style={{ position:'absolute', bottom:-22, left:0, background:d.status==='matched'?'#27AE60':'#EB5757', color:'#fff', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:4, whiteSpace:'nowrap' }}>
                        {d.name || 'Unknown'}
                      </div>
                    </div>
                  ))}
                  {streaming && (
                    <div style={{ position:'absolute', top:10, right:10, background:'#EB5757', color:'#fff', borderRadius:'50px', padding:'4px 12px', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:'#fff', animation:'pulse 1s infinite' }}/>
                      LIVE · {frameCount} frames
                    </div>
                  )}
                </div>

                <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                  {!streaming ? (
                    <button onClick={startSession} className="btn btn-primary" disabled={!subject}>
                      🎬 Start Camera Session
                    </button>
                  ) : (
                    <button onClick={endSession} className="btn btn-danger">
                      ⏹️ End Session & Finalize
                    </button>
                  )}
                  {!streaming && streamRef.current && (
                    <button onClick={stopCamera} className="btn btn-ghost btn-sm">Stop Camera</button>
                  )}
                </div>

                {/* Live attendance board */}
                {sessionAtt.length > 0 && (
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:8 }}>Live Attendance Board</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                      {sessionAtt.map(s => {
                        const clr = s.status==='Present'?'#27AE60':s.status==='Absent'?'#EB5757':'#F2994A';
                        const bg  = s.status==='Present'?'#E8FBF0':s.status==='Absent'?'#FFF0F0':'#FFF3E8';
                        return (
                          <div key={s.roll_no} style={{ padding:'8px 10px', borderRadius:12, background:bg, border:`1px solid ${clr}33` }}>
                            <div style={{ fontSize:11, fontWeight:700, color:clr, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
                            <div style={{ fontSize:9, color:clr, opacity:0.8 }}>{s.status}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Register Faces */}
          {smartTab==='register' && (
            <div className="card fade-up">
              <div className="card-header">
                <div>
                  <div className="card-title">👤 Register Student Faces</div>
                  <div className="card-sub">Capture or upload photo for each student</div>
                </div>
                {faceStatus && <span className="badge badge-purple">{faceStatus.registered}/{faceStatus.total} registered</span>}
              </div>
              <div className="card-body">
                {/* Camera for capture */}
                <div style={{ display:'flex', gap:14, marginBottom:16, flexWrap:'wrap' }}>
                  <video ref={videoRef} autoPlay playsInline style={{ width:200, height:150, objectFit:'cover', borderRadius:12, background:'#000' }}/>
                  <canvas ref={canvasRef} style={{ display:'none' }}/>
                  <div>
                    <div className="field" style={{ marginBottom:10 }}>
                      <label className="lbl">Student Roll No</label>
                      <input className="inp" placeholder="e.g. CS001" value={regRoll} onChange={e => setRegRoll(e.target.value)} style={{ width:160 }}/>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={startCamera}>📷 Start Camera</button>
                      <button className="btn btn-primary btn-sm" disabled={!regRoll||regLoading} onClick={() => captureForRegister(regRoll)}>
                        {regLoading?'Saving...':'📸 Capture'}
                      </button>
                    </div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginTop:8 }}>Or upload a photo file:</div>
                    <input type="file" accept="image/*" style={{ fontSize:11, marginTop:4 }}
                      onChange={async e => {
                        if (!e.target.files[0] || !regRoll) { toast.error('Enter roll number first'); return; }
                        const reader = new FileReader();
                        reader.onload = async ev => { await registerFace(regRoll, ev.target.result.split(',')[1]); };
                        reader.readAsDataURL(e.target.files[0]);
                      }}/>
                  </div>
                </div>

                {/* Students list with face status */}
                {faceStatus?.students && (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
                    {faceStatus.students.map(s => (
                      <div key={s.roll_no} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:14, background:s.has_face?'#E8FBF0':'var(--surface2)', border:`1px solid ${s.has_face?'#A8E6C3':'var(--border)'}` }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', background:s.has_face?'#27AE60':'var(--surface3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:s.has_face?'#fff':'var(--text3)', fontWeight:700 }}>
                          {s.has_face?'✓':s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'var(--text1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
                          <div style={{ fontSize:9, color:'var(--text3)' }}>{s.roll_no}</div>
                        </div>
                        <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:'50px', background:s.has_face?'#E8FBF0':'#FFF0F0', color:s.has_face?'#27AE60':'#EB5757' }}>
                          {s.has_face?'Registered':'Not Set'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SUMMARY TAB ── */}
      {tab==='summary' && (
        <div className="card fade-up">
          <div className="card-header">
            <div><div className="card-title">📊 Student Summary — {subject}</div><div className="card-sub">Cumulative attendance per student</div></div>
            <span className={`badge badge-${summary.filter(s=>(s.percentage||0)<75).length>0?'red':'green'}`}>{summary.filter(s=>(s.percentage||0)<75).length} at risk</span>
          </div>
          {summary.length===0 ? <div className="empty"><div className="empty-icon">📊</div><div className="empty-sub">No attendance records yet</div></div> : (
            <table className="tbl">
              <thead><tr><th>Student</th><th>Roll No</th><th>Present</th><th>Absent</th><th>Total</th><th>Percentage</th><th>Status</th></tr></thead>
              <tbody>
                {summary.map(s => {
                  const safe = (s.percentage||0)>=75;
                  return (
                    <tr key={s.roll_no}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div className="stu-av" style={{ background:safe?'linear-gradient(135deg,#27AE60,#1a8a4a)':'linear-gradient(135deg,#EB5757,#c0392b)', width:32, height:32, fontSize:11 }}>
                            {(s.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2)}
                          </div>
                          <span style={{ fontWeight:600, color:'var(--text1)', fontSize:13 }}>{s.name}</span>
                        </div>
                      </td>
                      <td><span className="badge badge-purple">{s.roll_no}</span></td>
                      <td><span style={{ fontWeight:700, color:'#27AE60' }}>{s.present||0}</span></td>
                      <td><span style={{ fontWeight:700, color:'#EB5757' }}>{(s.total||0)-(s.present||0)}</span></td>
                      <td style={{ color:'var(--text2)' }}>{s.total||0}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:80, height:7, background:'var(--surface3)', borderRadius:50, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${s.percentage||0}%`, background:safe?'#27AE60':'#EB5757', borderRadius:50 }}/>
                          </div>
                          <span style={{ fontSize:12, fontWeight:700, color:safe?'#27AE60':'#EB5757' }}>{s.percentage||0}%</span>
                        </div>
                      </td>
                      <td><span className={`badge badge-${safe?'green':'red'}`}>{safe?'✅ Safe':'⚠️ At Risk'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab==='history' && (
        <div className="card fade-up">
          <div className="card-header">
            <div><div className="card-title">📅 Edit Previous Attendance</div><div className="card-sub">View and re-save for any past date</div></div>
          </div>
          <div className="card-body">
            <div style={{ display:'flex', gap:14, marginBottom:16, flexWrap:'wrap', alignItems:'flex-end' }}>
              <div className="field">
                <label className="lbl">Select Date</label>
                <input className="inp" type="date" max={new Date().toISOString().split('T')[0]} value={histDate} onChange={e => setHistDate(e.target.value)}/>
              </div>
              <div style={{ fontSize:12, color:'var(--text3)', paddingBottom:2 }}>
                Editing: <strong style={{ color:'var(--text1)' }}>{subject}</strong> · {histDate}
              </div>
            </div>
            {histLoading ? <Loader text="Loading..."/> : (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, marginBottom:14 }}>
                  {history.map(s => {
                    const cur = attendance[s.roll_no];
                    const isP = cur==='Present';
                    const notMarked = !cur||cur==='Not Marked';
                    return (
                      <div key={s.roll_no} onClick={() => !notMarked && toggle(s.roll_no)}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:14, cursor:notMarked?'default':'pointer', background:notMarked?'var(--surface2)':isP?'#E8FBF0':'#FFF0F0', border:`2px solid ${notMarked?'var(--border)':isP?'#A8E6C3':'#FFBDBD'}`, transition:'all 0.15s' }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0, background:notMarked?'var(--surface3)':isP?'#27AE60':'#EB5757', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:notMarked?'var(--text3)':'#fff' }}>
                          {notMarked?'?':isP?'P':'A'}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'var(--text1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
                          <div style={{ fontSize:9, color:'var(--text3)' }}>{s.roll_no}</div>
                        </div>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:'50px', background:notMarked?'var(--surface3)':isP?'#E8FBF0':'#FFF0F0', color:notMarked?'var(--text3)':isP?'#27AE60':'#EB5757' }}>
                          {notMarked?'Not Marked':isP?'Present':'Absent'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => markAll('Present')} className="btn btn-success btn-sm">✓ All Present</button>
                  <button onClick={() => markAll('Absent')}  className="btn btn-danger btn-sm">✗ All Absent</button>
                  <button onClick={() => handleSave(histDate)} disabled={saving} className="btn btn-primary" style={{ marginLeft:'auto' }}>
                    {saving?'Saving...':`💾 Save for ${histDate}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── DETAINED TAB ── */}
      {tab==='detained' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="card fade-up">
            <div className="card-header">
              <div><div className="card-title">⚠️ Detained Students List</div><div className="card-sub">Students below attendance threshold</div></div>
            </div>
            <div className="card-body">
              <div style={{ display:'flex', gap:14, alignItems:'flex-end', marginBottom:16 }}>
                <div className="field">
                  <label className="lbl">Attendance Threshold (%)</label>
                  <input className="inp" type="number" min="50" max="100" value={detThreshold} onChange={e => setDetThreshold(Number(e.target.value))} style={{ width:120 }}/>
                </div>
                <button onClick={loadDetained} disabled={detLoading} className="btn btn-primary btn-sm">
                  {detLoading?'Loading...':'🔍 Generate List'}
                </button>
              </div>
              {detained && (
                <div style={{ display:'flex', gap:14, marginBottom:16, flexWrap:'wrap' }}>
                  {[
                    {l:'Total Students',v:detained.total_students,c:'#6347D1',bg:'#EEF0FF'},
                    {l:'Detained',v:detained.total_detained,c:'#EB5757',bg:'#FFF0F0'},
                    {l:'Safe',v:detained.total_students-detained.total_detained,c:'#27AE60',bg:'#E8FBF0'},
                  ].map(s=>(
                    <div key={s.l} style={{ padding:'12px 18px', borderRadius:14, background:s.bg, textAlign:'center' }}>
                      <div style={{ fontSize:24, fontWeight:800, color:s.c }}>{s.v}</div>
                      <div style={{ fontSize:10, fontWeight:600, color:s.c }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {detained?.detained?.length > 0 && (
            <div className="card fade-up">
              <div className="card-header">
                <div><div className="card-title">📋 Detained Students</div><div className="card-sub">Below {detThreshold}% threshold</div></div>
                <button onClick={sendDetentionNotice} disabled={announcing} className="btn btn-danger btn-sm">
                  {announcing?'Sending...':'📢 Send Notices'}
                </button>
              </div>
              <div style={{ padding:'8px 0' }}>
                {detained.detained.map((s,i) => (
                  <div key={s.roll_no} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px', borderBottom:i<detained.detained.length-1?'1px solid var(--border)':'none' }}>
                    <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#EB5757,#c0392b)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:13, fontWeight:700, flexShrink:0 }}>
                      {s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text1)' }}>{s.name}</div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{s.roll_no}</div>
                      <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                        {(s.subjects||s.detained_in||[]).map(sub => (
                          <span key={sub.subject||sub} style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:'50px', background:'#FFF0F0', color:'#EB5757' }}>
                            {sub.subject||sub}: {sub.pct||'—'}%
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:20, fontWeight:900, color:'#EB5757' }}>{s.overall_pct||s.pct||'—'}%</div>
                      <div style={{ fontSize:9, color:'#EB5757', fontWeight:600 }}>Overall</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {detained?.detained?.length === 0 && detained && (
            <div className="card"><div className="empty"><div className="empty-icon">✅</div><div className="empty-title">No detained students!</div><div className="empty-sub">All students above {detThreshold}%</div></div></div>
          )}
        </div>
      )}
    </div>
  );
}