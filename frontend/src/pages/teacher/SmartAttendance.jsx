import { useState, useEffect, useRef, useCallback } from 'react'
import { useCurrentClass } from '../../context/AuthContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import Loader from '../../components/Loader'

const CAPTURE_INTERVAL = 30000  // 30 seconds between frames

export default function SmartAttendance() {
  const [cls]          = useCurrentClass()
  const [subject,      setSubject]      = useState('')
  const [subjects,     setSubjects]     = useState([])
  const [sessionId,    setSessionId]    = useState(null)
  const [isRunning,    setIsRunning]    = useState(false)
  const [detections,   setDetections]   = useState([])  // latest frame boxes
  const [attendance,   setAttendance]   = useState([])  // all students + live status
  const [faceStats,    setFaceStats]    = useState(null)
  const [locked,       setLocked]       = useState(false)
  const [summary,      setSummary]      = useState(null)  // shown after session ends
  const [processing,   setProcessing]   = useState(false)
  const [lastCapture,  setLastCapture]  = useState(null)
  const [countdown,    setCountdown]    = useState(0)
  const [tab,          setTab]          = useState('camera')  // camera | register | audit
  const [regRoll,      setRegRoll]      = useState('')
  const [regPhoto,     setRegPhoto]     = useState(null)  // base64
  const [regLoading,   setRegLoading]   = useState(false)
  const [auditLog,     setAuditLog]     = useState([])

  const videoRef      = useRef(null)
  const canvasRef     = useRef(null)
  const overlayRef    = useRef(null)
  const streamRef     = useRef(null)
  const intervalRef   = useRef(null)
  const countdownRef  = useRef(null)

  // Load subjects when class changes
  useEffect(() => {
    if (!cls?.id) return
    api.get('/classes/' + cls.id + '/my-subjects')
      .then(r => {
        const subjs = r.data || []
        setSubjects(subjs)
        if (subjs.length > 0) setSubject(subjs[0])
      }).catch(() => {})
    loadFaceStats()
  }, [cls?.id])

  // Refresh attendance list every 10s while running
  useEffect(() => {
    if (!isRunning) return
    const t = setInterval(loadAttendance, 10000)
    return () => clearInterval(t)
  }, [isRunning, subject, cls?.id])

  useEffect(() => {
    loadAttendance()
    loadLockStatus()
  }, [subject, cls?.id])

  const loadAttendance = () => {
    if (!cls?.id || !subject) return
    api.get('/smart/session-attendance?class_id='+cls.id+'&subject='+encodeURIComponent(subject))
      .then(r => { setAttendance(r.data.students || []); setLocked(r.data.locked) })
      .catch(() => {})
  }

  const loadFaceStats = () => {
    if (!cls?.id) return
    api.get('/smart/face-status/'+cls.id)
      .then(r => setFaceStats(r.data)).catch(() => {})
  }

  const loadLockStatus = () => {
    if (!cls?.id || !subject) return
    api.get('/smart/lock-status?class_id='+cls.id+'&subject='+encodeURIComponent(subject))
      .then(r => { setLocked(r.data.locked); setAuditLog(r.data.audit_trail || []) })
      .catch(() => {})
  }

  // Start camera stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (e) {
      toast.error('Camera access denied. Please allow camera permission.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }

  // Capture a frame from video and send to backend
  const captureAndProcess = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || processing) return
    const video  = videoRef.current
    const canvas = canvasRef.current
    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    const b64 = canvas.toDataURL('image/jpeg', 0.85)

    setProcessing(true)
    setLastCapture(new Date().toLocaleTimeString())

    try {
      const r = await api.post('/smart/process-frame', {
        frame_b64: b64,
        class_id:  cls.id,
        subject,
        session_id: sessionId
      })
      setDetections(r.data.detections || [])
      drawOverlay(r.data.detections || [], canvas.width, canvas.height)
      loadAttendance()
      if (r.data.error) toast.error(r.data.error)
    } catch (e) {
      toast.error('Frame processing failed')
    } finally {
      setProcessing(false)
    }
  }, [processing, cls?.id, subject, sessionId])

  // Draw green/yellow boxes on overlay canvas
  const drawOverlay = (dets, w, h) => {
    const overlay = overlayRef.current
    if (!overlay) return
    overlay.width  = w || 640
    overlay.height = h || 480
    const ctx = overlay.getContext('2d')
    ctx.clearRect(0, 0, overlay.width, overlay.height)

    dets.forEach(d => {
      const { top, right, bottom, left } = d.box
      const isKnown  = d.status === 'present'
      const color    = isKnown ? '#4ade80' : '#fbbf24'
      const label    = isKnown ? `${d.name} (${d.confidence}%)` : 'Unknown'

      // Box
      ctx.strokeStyle = color
      ctx.lineWidth   = 3
      ctx.strokeRect(left, top, right - left, bottom - top)

      // Label background
      ctx.fillStyle = color
      const textW   = ctx.measureText(label).width + 12
      ctx.fillRect(left, top - 26, textW, 24)

      // Label text
      ctx.fillStyle   = '#000'
      ctx.font        = 'bold 13px monospace'
      ctx.fillText(label, left + 6, top - 8)
    })
  }

  // START SESSION
  const startSession = async () => {
    if (!subject) { toast.error('Select a subject first'); return }
    if (!cls?.id) { toast.error('Select a class first'); return }

    try {
      const r = await api.post('/smart/session/start', { class_id: cls.id, subject })
      setSessionId(r.data.session_id)
      setIsRunning(true)
      setSummary(null)
      setDetections([])
      await startCamera()
      loadAttendance()

      // Capture first frame after 2s (camera warm-up)
      setTimeout(() => captureAndProcess(), 2000)

      // Then every 30s
      intervalRef.current = setInterval(() => captureAndProcess(), CAPTURE_INTERVAL)

      // Countdown timer
      setCountdown(CAPTURE_INTERVAL / 1000)
      countdownRef.current = setInterval(() => {
        setCountdown(c => c <= 1 ? CAPTURE_INTERVAL / 1000 : c - 1)
      }, 1000)

      toast.success('Smart attendance session started!')
    } catch (e) {
      toast.error('Failed to start session')
    }
  }

  // END SESSION
  const endSession = async () => {
    clearInterval(intervalRef.current)
    clearInterval(countdownRef.current)
    stopCamera()
    setIsRunning(false)
    setCountdown(0)

    try {
      // First mark everyone not detected as absent
      await api.post('/smart/finalize-absent', { class_id: cls.id, subject })

      // End session + lock
      const r = await api.post('/smart/session/end', {
        session_id: sessionId, class_id: cls.id, subject
      })
      setSummary(r.data.summary)
      setLocked(true)
      loadAttendance()
      loadLockStatus()
      toast.success('Session ended. Attendance saved and locked.')
    } catch (e) {
      toast.error('Failed to end session cleanly')
    }
  }

  // Manual correction after session
  const manualCorrect = async (roll, currentStatus) => {
    const newStatus = currentStatus === 'Present' ? 'Absent' : 'Present'
    try {
      await api.post('/smart/manual-correct', {
        class_id: cls.id, subject, roll_no: roll, status: newStatus, reason: 'teacher_correction'
      })
      loadAttendance()
      loadLockStatus()
      toast.success(`Marked ${newStatus}`)
    } catch { toast.error('Failed to update') }
  }

  // Register face
  const handleRegPhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setRegPhoto(ev.target.result)
    reader.readAsDataURL(file)
  }

  const registerFace = async () => {
    if (!regRoll || !regPhoto) { toast.error('Select student and photo'); return }
    setRegLoading(true)
    try {
      const r = await api.post('/smart/register-face', { roll_no: regRoll, image_b64: regPhoto })
      toast.success(r.data.message)
      setRegPhoto(null); setRegRoll('')
      loadFaceStats()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Registration failed')
    } finally { setRegLoading(false) }
  }

  const present = attendance.filter(s => s.status === 'Present').length
  const absent  = attendance.filter(s => s.status === 'Absent').length
  const pending = attendance.filter(s => s.status === 'Pending').length

  if (!cls) return (
    <div className="empty">⬅ Select a class from the sidebar to use Smart Attendance</div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Header */}
      <div className="card fade-up" style={{padding:'16px 20px',
        background: isRunning
          ? 'linear-gradient(135deg,rgba(74,222,128,0.08),rgba(45,212,191,0.06))'
          : 'var(--card-bg)',
        border: isRunning ? '2px solid rgba(74,222,128,0.3)' : '1px solid var(--border)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:'var(--text1)',display:'flex',gap:10,alignItems:'center'}}>
              🎥 Smart Attendance
              {isRunning && (
                <span style={{fontSize:12,fontWeight:600,color:'var(--green)',fontFamily:'var(--font-mono)',
                  padding:'3px 10px',borderRadius:20,background:'rgba(74,222,128,0.12)',
                  border:'1px solid rgba(74,222,128,0.3)',animation:'pulse 2s infinite'}}>
                  ● LIVE
                </span>
              )}
              {locked && !isRunning && (
                <span style={{fontSize:12,color:'var(--text3)',fontFamily:'var(--font-mono)',
                  padding:'3px 10px',borderRadius:20,background:'var(--surface)'}}>
                  🔒 Locked
                </span>
              )}
            </div>
            <div style={{fontSize:12,color:'var(--text3)',marginTop:4}}>
              {cls.name}{cls.section?' · '+cls.section:''}
              {faceStats && (
                <span style={{marginLeft:10,color:faceStats.registered===faceStats.total?'var(--green)':'var(--gold)'}}>
                  · {faceStats.registered}/{faceStats.total} faces registered
                </span>
              )}
            </div>
          </div>

          {/* Subject + toggle */}
          <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
            <select className="inp" style={{width:'auto',minWidth:160,margin:0}} value={subject}
              onChange={e=>setSubject(e.target.value)} disabled={isRunning}>
              <option value="">Select subject</option>
              {subjects.map(s=><option key={s}>{s}</option>)}
            </select>

            {/* BIG ON/OFF toggle */}
            <button
              onClick={isRunning ? endSession : startSession}
              disabled={!subject}
              style={{
                padding:'10px 28px', borderRadius:30, fontWeight:800, fontSize:14,
                cursor: subject ? 'pointer' : 'not-allowed',
                border: 'none',
                background: isRunning
                  ? 'linear-gradient(135deg,#f87171,#ef4444)'
                  : 'linear-gradient(135deg,#4ade80,#22c55e)',
                color: '#fff',
                boxShadow: isRunning
                  ? '0 4px 20px rgba(248,113,113,0.4)'
                  : '0 4px 20px rgba(74,222,128,0.4)',
                transition: 'all 0.2s'
              }}>
              {isRunning ? '⏹ End Session' : '▶ Start Session'}
            </button>
          </div>
        </div>

        {/* Live stats bar */}
        {isRunning && (
          <div style={{display:'flex',gap:20,marginTop:12,fontSize:12,flexWrap:'wrap'}}>
            <span style={{color:'var(--green)',fontWeight:700}}>✓ {present} Present</span>
            <span style={{color:'var(--red)',fontWeight:700}}>✗ {absent} Absent</span>
            <span style={{color:'var(--text3)'}}>⏳ {pending} Pending</span>
            <span style={{color:'var(--text3)',marginLeft:'auto',fontFamily:'var(--font-mono)'}}>
              {processing ? '🔄 Processing frame...' : `Next capture in ${countdown}s`}
              {lastCapture && ` · Last: ${lastCapture}`}
            </span>
          </div>
        )}
      </div>

      {/* Session ended summary */}
      {summary && (
        <div className="card fade-up" style={{padding:'20px 24px',
          background:'rgba(74,222,128,0.06)',border:'2px solid rgba(74,222,128,0.25)'}}>
          <div style={{fontSize:16,fontWeight:800,color:'var(--green)',marginBottom:12}}>
            ✓ Session Complete — Attendance Locked
          </div>
          <div style={{display:'flex',gap:24,flexWrap:'wrap'}}>
            {[
              {label:'Present',  val:summary.present,  clr:'var(--green)'},
              {label:'Absent',   val:summary.absent,   clr:'var(--red)'},
              {label:'Total',    val:summary.total,    clr:'var(--text1)'},
              {label:'Detected by Camera', val:summary.detected, clr:'var(--teal)'},
            ].map((s,i)=>(
              <div key={i} style={{textAlign:'center'}}>
                <div style={{fontSize:32,fontWeight:800,fontFamily:'var(--font-display)',color:s.clr}}>{s.val}</div>
                <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-mono)',textTransform:'uppercase'}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:12,fontSize:12,color:'var(--text3)'}}>
            🔒 Attendance locked. Manual corrections are still possible and will be logged in the audit trail.
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:8}}>
        {[['camera','🎥 Camera & Live'],['register','📷 Register Faces'],['audit','📋 Audit Trail']].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)}
            className={'btn btn-sm '+(tab===v?'btn-primary':'btn-ghost')}>{l}</button>
        ))}
      </div>

      {/* ── CAMERA TAB ── */}
      {tab==='camera' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:14,alignItems:'start'}}>

          {/* Camera feed */}
          <div className="card" style={{overflow:'hidden'}}>
            <div style={{position:'relative',background:'#000',minHeight:320,borderRadius:12,overflow:'hidden'}}>
              <video ref={videoRef} autoPlay playsInline muted
                style={{width:'100%',display:'block',borderRadius:12}}/>
              {/* Face detection overlay canvas */}
              <canvas ref={overlayRef}
                style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none'}}/>
              {/* Hidden capture canvas */}
              <canvas ref={canvasRef} style={{display:'none'}}/>

              {/* No session placeholder */}
              {!isRunning && (
                <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',
                  alignItems:'center',justifyContent:'center',gap:12,
                  background:'rgba(0,0,0,0.85)'}}>
                  <div style={{fontSize:48}}>🎥</div>
                  <div style={{fontSize:14,color:'rgba(255,255,255,0.7)',textAlign:'center',maxWidth:260}}>
                    {subject
                      ? 'Press Start Session to begin smart attendance'
                      : 'Select a subject first, then start the session'}
                  </div>
                  {faceStats && faceStats.registered === 0 && (
                    <div style={{fontSize:12,color:'var(--gold)',textAlign:'center',maxWidth:260}}>
                      ⚠ No student faces registered yet. Go to Register Faces tab first.
                    </div>
                  )}
                </div>
              )}

              {/* Processing indicator */}
              {processing && (
                <div style={{position:'absolute',top:10,right:10,
                  padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:700,
                  background:'rgba(147,51,234,0.85)',color:'#fff',fontFamily:'var(--font-mono)'}}>
                  🔄 Scanning...
                </div>
              )}

              {/* Green box legend */}
              {isRunning && detections.length > 0 && (
                <div style={{position:'absolute',bottom:10,left:10,display:'flex',gap:8}}>
                  <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,
                    background:'rgba(74,222,128,0.85)',color:'#000',fontWeight:700}}>
                    🟩 Recognised
                  </span>
                  <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,
                    background:'rgba(251,191,36,0.85)',color:'#000',fontWeight:700}}>
                    🟨 Unknown
                  </span>
                </div>
              )}
            </div>

            {/* Manual capture button */}
            {isRunning && (
              <div style={{padding:'12px 16px',borderTop:'1px solid var(--border)',
                display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>
                  Auto-captures every 30 seconds
                </span>
                <button onClick={captureAndProcess} disabled={processing}
                  className="btn btn-ghost btn-sm" style={{fontSize:12}}>
                  {processing ? '🔄 Processing...' : '📸 Capture Now'}
                </button>
              </div>
            )}
          </div>

          {/* Live student list */}
          <div className="card" style={{maxHeight:520,display:'flex',flexDirection:'column'}}>
            <div className="card-header" style={{flexShrink:0}}>
              <div className="card-title">Live Attendance</div>
              <div style={{display:'flex',gap:6}}>
                <span className="badge badge-green">{present}</span>
                <span className="badge badge-red">{absent}</span>
              </div>
            </div>
            <div style={{overflowY:'auto',flex:1}}>
              {attendance.length===0
                ? <div className="empty" style={{padding:20}}>No students enrolled</div>
                : attendance.map((s,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,
                    padding:'9px 16px',borderBottom:'1px solid var(--border)',
                    background:s.status==='Present'?'rgba(74,222,128,0.04)':
                               s.status==='Absent'?'rgba(248,113,113,0.04)':'transparent'}}>
                    <div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,
                      background:s.status==='Present'?'var(--green)':
                                 s.status==='Absent'?'var(--red)':'var(--border)'}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:'var(--text1)',
                        whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {s.gender==='female'?'👩':'👨'} {s.name}
                      </div>
                      <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>
                        {s.roll_no}
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                      <span style={{fontSize:11,fontWeight:700,
                        color:s.status==='Present'?'var(--green)':
                             s.status==='Absent'?'var(--red)':'var(--text3)'}}>
                        {s.status}
                      </span>
                      {/* Manual override button */}
                      <button onClick={()=>manualCorrect(s.roll_no, s.status)}
                        title={locked?"Manual correction (will be audited)":"Toggle"}
                        style={{background:'none',border:'1px solid var(--border)',
                          borderRadius:6,padding:'2px 6px',cursor:'pointer',
                          fontSize:11,color:'var(--text3)'}}>
                        {s.status==='Present'?'→Ab':'→Pr'}
                        {locked && ' ✏️'}
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── REGISTER FACES TAB ── */}
      {tab==='register' && (
        <div style={{display:'grid',gridTemplateColumns:'360px 1fr',gap:14,alignItems:'start'}}>

          {/* Upload form */}
          <div className="card fade-up">
            <div className="card-header">
              <div className="card-title">📷 Register Student Face</div>
            </div>
            <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label className="lbl">Student Roll Number</label>
                <input className="inp" placeholder="e.g. CS2021045" value={regRoll}
                  onChange={e=>setRegRoll(e.target.value.toUpperCase())}/>
              </div>
              <div>
                <label className="lbl">Student Photo</label>
                <input type="file" accept="image/*" onChange={handleRegPhoto}
                  style={{width:'100%',padding:'8px',borderRadius:10,border:'1px solid var(--border)',
                    background:'var(--surface)',color:'var(--text2)',fontSize:12}}/>
                <div style={{fontSize:11,color:'var(--text3)',marginTop:6,lineHeight:1.5}}>
                  📌 Use a clear, front-facing photo. One face only. Good lighting. No glasses preferred.
                </div>
              </div>

              {regPhoto && (
                <div style={{borderRadius:12,overflow:'hidden',border:'2px solid var(--border)'}}>
                  <img src={regPhoto} alt="Preview"
                    style={{width:'100%',maxHeight:200,objectFit:'cover',display:'block'}}/>
                </div>
              )}

              <button onClick={registerFace} disabled={regLoading||!regRoll||!regPhoto}
                className="btn btn-primary" style={{width:'100%',justifyContent:'center'}}>
                {regLoading ? '⏳ Registering...' : '✓ Register Face'}
              </button>
            </div>
          </div>

          {/* Students face status table */}
          <div className="card fade-up">
            <div className="card-header">
              <div className="card-title">Face Registration Status</div>
              {faceStats && (
                <span className={'badge badge-'+(faceStats.registered===faceStats.total?'green':'gold')}>
                  {faceStats.registered}/{faceStats.total} registered
                </span>
              )}
            </div>
            {!faceStats
              ? <Loader/>
              : !faceStats.fr_available && (
                <div style={{padding:'12px 20px',borderBottom:'1px solid var(--border)',
                  background:'rgba(251,191,36,0.07)',fontSize:12,color:'var(--gold)'}}>
                  ⚠ face_recognition library not installed on server. Photos will be saved but face matching won't work until you run:<br/>
                  <code style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text1)'}}>
                    pip install face_recognition
                  </code>
                </div>
              )
            }
            <table className="tbl">
              <thead><tr><th>Student</th><th>Roll No</th><th>Face Status</th><th>Action</th></tr></thead>
              <tbody>
                {(faceStats?.students||[]).map((s,i)=>(
                  <tr key={i}>
                    <td><strong style={{color:'var(--text1)'}}>{s.name}</strong></td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text3)'}}>{s.roll_no}</td>
                    <td>
                      {s.has_face
                        ? <span className="badge badge-green">✓ Registered</span>
                        : <span className="badge badge-red">✗ Not registered</span>
                      }
                    </td>
                    <td>
                      <button onClick={()=>{setRegRoll(s.roll_no);setTab('register')}}
                        className="btn btn-ghost btn-sm" style={{fontSize:11}}>
                        {s.has_face?'Update':'Register'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── AUDIT TRAIL TAB ── */}
      {tab==='audit' && (
        <div className="card fade-up">
          <div className="card-header">
            <div>
              <div className="card-title">📋 Attendance Audit Trail</div>
              <div className="card-sub">Manual corrections made after session lock</div>
            </div>
            <span className={'badge badge-'+(locked?'teal':'text3')}>
              {locked?'🔒 Locked':'🔓 Unlocked'}
            </span>
          </div>
          {auditLog.length===0
            ? <div className="empty">No manual corrections recorded for today</div>
            : (
              <table className="tbl">
                <thead>
                  <tr><th>Student</th><th>Old Status</th><th>New Status</th><th>Changed By</th><th>Time</th><th>Reason</th></tr>
                </thead>
                <tbody>
                  {auditLog.map((a,i)=>(
                    <tr key={i}>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{a.student_roll}</td>
                      <td><span className={'badge badge-'+(a.old_status==='Present'?'green':'red')} style={{fontSize:10}}>
                        {a.old_status||'—'}
                      </span></td>
                      <td><span className={'badge badge-'+(a.new_status==='Present'?'green':'red')} style={{fontSize:10}}>
                        {a.new_status}
                      </span></td>
                      <td style={{fontSize:12,color:'var(--text2)'}}>{a.changed_by}</td>
                      <td style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>
                        {a.changed_at?.slice(11,16)}
                      </td>
                      <td><span className="badge badge-purple" style={{fontSize:9}}>{a.reason}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      )}
    </div>
  )
}