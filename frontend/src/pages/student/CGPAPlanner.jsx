import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const GRADE_POINTS = { 'O':10, 'A+':9, 'A':8, 'B+':7, 'B':6, 'C':5, 'F':0 };

export default function CGPACalculator() {
  const [tab, setTab] = useState('sgpa'); // sgpa | cgpa | bunk
  // SGPA
  const [subjects, setSubjects] = useState([{ name:'', credits:4, grade:'A' }]);
  // CGPA goal (backend connected)
  const [goal, setGoal]       = useState({ current_cgpa:'', current_semesters:'', target_cgpa:'', target_semester:'', credits_per_sem:24 });
  const [goalResult, setGoalResult] = useState(null);
  const [savingGoal, setSavingGoal] = useState(false);
  // Bunk calculator
  const [bunk, setBunk]       = useState({ total:60, present:45, toSkip:0 });

  // Load saved CGPA goal from backend
  useEffect(() => {
    api.get('/analytics/cgpa-goal').then(r => {
      if (r.data) {
        setGoal({
          current_cgpa:     r.data.current_cgpa||'',
          current_semesters:r.data.current_semesters||'',
          target_cgpa:      r.data.target_cgpa||'',
          target_semester:  r.data.target_semester||'',
          credits_per_sem:  r.data.credits_per_sem||24,
        });
        setGoalResult(r.data);
      }
    }).catch(()=>{});
  }, []);

  // SGPA calculation
  const sgpa = () => {
    const valid = subjects.filter(s=>s.credits>0&&GRADE_POINTS[s.grade]!==undefined);
    if (!valid.length) return 0;
    const totalCredits = valid.reduce((s,c)=>s+Number(c.credits),0);
    const totalPoints  = valid.reduce((s,c)=>s+Number(c.credits)*GRADE_POINTS[c.grade],0);
    return totalCredits ? (totalPoints/totalCredits).toFixed(2) : 0;
  };
  const currentSGPA = sgpa();

  // Bunk calculation
  const bunkCalc = () => {
    const { total, present } = bunk;
    const t = Number(total); const p = Number(present);
    const pct = t ? Math.round(p/t*100) : 0;
    const need = Math.ceil(0.75*t);
    const canMiss = Math.max(0, p - need);
    const mustAttend = Math.max(0, need - p);
    const safe = pct >= 75;
    return { pct, need, canMiss, mustAttend, safe };
  };
  const bc = bunkCalc();

  const saveGoal = async () => {
    if (!goal.target_cgpa||!goal.target_semester) { toast.error('Target CGPA and semester required'); return; }
    setSavingGoal(true);
    try {
      const r = await api.post('/analytics/cgpa-goal', {
        current_cgpa: parseFloat(goal.current_cgpa)||0,
        current_semesters: parseInt(goal.current_semesters)||0,
        target_cgpa: parseFloat(goal.target_cgpa),
        target_semester: parseInt(goal.target_semester),
        credits_per_sem: parseInt(goal.credits_per_sem)||24,
      });
      setGoalResult(r.data);
      toast.success('CGPA goal saved! 🎯');
    } catch(err) { toast.error(err.response?.data?.error||'Failed'); }
    finally { setSavingGoal(false); }
  };

  const addSubject   = () => setSubjects(s=>[...s,{name:'',credits:4,grade:'A'}]);
  const removeSubject= i  => setSubjects(s=>s.filter((_,j)=>j!==i));
  const updateSubj   = (i,f,v) => setSubjects(s=>s.map((x,j)=>j===i?{...x,[f]:v}:x));

  const sgpaColor = s => s>=9?'#27AE60':s>=7?'#6347D1':s>=5?'#F2994A':'#EB5757';

  const TABS = [
    {id:'sgpa',label:'🎓 SGPA Calculator'},
    {id:'cgpa',label:'🎯 CGPA Goal Planner'},
    {id:'bunk',label:'📊 Bunk Calculator'},
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div className="page-header fade-up">
        <div className="page-title">CGPA & Bunk Calculator</div>
        <div className="page-sub">Calculate SGPA, plan your CGPA goals, and check safe bunks</div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'10px 22px', borderRadius:'50px',
            border:`2px solid ${tab===t.id?'#7B61FF':'var(--border2)'}`,
            background:tab===t.id?'linear-gradient(135deg,#7B61FF,#6347D1)':'var(--card-bg)',
            color:tab===t.id?'#fff':'var(--text2)', fontSize:12, fontWeight:600,
            cursor:'pointer', fontFamily:'var(--font)', transition:'all 0.18s',
            boxShadow:tab===t.id?'0 6px 20px rgba(99,71,209,0.28)':'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── SGPA ── */}
      {tab==='sgpa' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* SGPA Result */}
          <div style={{ textAlign:'center', padding:'32px', background:`linear-gradient(135deg,${sgpaColor(currentSGPA)}18,${sgpaColor(currentSGPA)}08)`, borderRadius:24, border:`2px solid ${sgpaColor(currentSGPA)}33` }}>
            <div style={{ fontSize:72, fontWeight:900, color:sgpaColor(currentSGPA), letterSpacing:'-2px', lineHeight:1 }}>{currentSGPA}</div>
            <div style={{ fontSize:16, fontWeight:700, color:sgpaColor(currentSGPA), marginTop:8 }}>SGPA</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>
              {currentSGPA>=9?'Outstanding!':currentSGPA>=8?'Excellent!':currentSGPA>=7?'Very Good':currentSGPA>=6?'Good':currentSGPA>=5?'Average':'Needs Improvement'}
            </div>
          </div>

          {/* Subject rows */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">📚 Your Subjects</div>
              <button onClick={addSubject} className="btn btn-primary btn-sm">+ Add Subject</button>
            </div>
            <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {subjects.map((s,i)=>(
                <div key={i} style={{ display:'flex', gap:12, alignItems:'center' }}>
                  <input className="inp" placeholder={`Subject ${i+1}`} value={s.name} onChange={e=>updateSubj(i,'name',e.target.value)} style={{ flex:2, minWidth:100 }}/>
                  <div className="field" style={{ flex:1, minWidth:80, marginBottom:0 }}>
                    <input className="inp" type="number" min="1" max="6" placeholder="Credits" value={s.credits} onChange={e=>updateSubj(i,'credits',e.target.value)}/>
                  </div>
                  <select className="inp" value={s.grade} onChange={e=>updateSubj(i,'grade',e.target.value)} style={{ flex:1, minWidth:80 }}>
                    {Object.entries(GRADE_POINTS).map(([g,p])=><option key={g} value={g}>{g} ({p})</option>)}
                  </select>
                  <div style={{ textAlign:'center', minWidth:40, fontWeight:700, color:sgpaColor(GRADE_POINTS[s.grade]||0), fontSize:14 }}>
                    {((Number(s.credits)||0)*(GRADE_POINTS[s.grade]||0)).toFixed(0)}
                  </div>
                  {subjects.length>1&&<button onClick={()=>removeSubject(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)', fontSize:18, flexShrink:0 }}>✕</button>}
                </div>
              ))}
              <div style={{ marginTop:8, padding:'12px 16px', background:'var(--surface2)', borderRadius:14, display:'flex', gap:20 }}>
                <div><span style={{ fontSize:11, color:'var(--text3)' }}>Total Credits: </span><strong style={{ color:'var(--text1)' }}>{subjects.reduce((s,c)=>s+Number(c.credits),0)}</strong></div>
                <div><span style={{ fontSize:11, color:'var(--text3)' }}>Total Grade Points: </span><strong style={{ color:'var(--text1)' }}>{subjects.reduce((s,c)=>s+Number(c.credits)*(GRADE_POINTS[c.grade]||0),0)}</strong></div>
                <div style={{ marginLeft:'auto' }}><span style={{ fontSize:11, color:'var(--text3)' }}>SGPA: </span><strong style={{ color:sgpaColor(currentSGPA), fontSize:15 }}>{currentSGPA}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CGPA GOAL ── */}
      {tab==='cgpa' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="card fade-up">
            <div className="card-header">
              <div><div className="card-title">🎯 CGPA Goal Planner</div><div className="card-sub">Find out what SGPA you need each semester</div></div>
              {goalResult && <span className="badge badge-purple">Saved ✓</span>}
            </div>
            <div className="card-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
                <div className="field">
                  <label className="lbl">Current CGPA</label>
                  <input className="inp" type="number" step="0.01" min="0" max="10" placeholder="e.g. 7.5" value={goal.current_cgpa} onChange={e=>setGoal(g=>({...g,current_cgpa:e.target.value}))}/>
                </div>
                <div className="field">
                  <label className="lbl">Completed Semesters</label>
                  <input className="inp" type="number" min="0" max="8" placeholder="e.g. 3" value={goal.current_semesters} onChange={e=>setGoal(g=>({...g,current_semesters:e.target.value}))}/>
                </div>
                <div className="field">
                  <label className="lbl">Target CGPA *</label>
                  <input className="inp" type="number" step="0.01" min="0" max="10" placeholder="e.g. 8.5" value={goal.target_cgpa} onChange={e=>setGoal(g=>({...g,target_cgpa:e.target.value}))}/>
                </div>
                <div className="field">
                  <label className="lbl">By Semester *</label>
                  <input className="inp" type="number" min="1" max="8" placeholder="e.g. 8" value={goal.target_semester} onChange={e=>setGoal(g=>({...g,target_semester:e.target.value}))}/>
                </div>
                <div className="field">
                  <label className="lbl">Credits per Semester</label>
                  <input className="inp" type="number" min="1" placeholder="e.g. 24" value={goal.credits_per_sem} onChange={e=>setGoal(g=>({...g,credits_per_sem:e.target.value}))}/>
                </div>
              </div>
              <button onClick={saveGoal} disabled={savingGoal} className="btn btn-primary">
                {savingGoal?'Saving...':'🎯 Calculate & Save Goal'}
              </button>
            </div>
          </div>

          {goalResult && (
            <div className="card fade-up-d1" style={{ padding:0, overflow:'hidden' }}>
              {/* Result banner */}
              <div style={{ padding:'28px 28px 20px', background:goalResult.feasible?'linear-gradient(135deg,#E8FBF0,#F0FBF4)':'linear-gradient(135deg,#FFF0F0,#FFF5F5)', textAlign:'center' }}>
                <div style={{ fontSize:12, fontWeight:700, color:goalResult.feasible?'#27AE60':'#EB5757', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>
                  {goalResult.feasible ? '✅ Goal is Achievable!' : '⚠️ Goal Not Achievable'}
                </div>
                <div style={{ fontSize:64, fontWeight:900, color:goalResult.feasible?'#27AE60':'#EB5757', letterSpacing:'-2px', lineHeight:1 }}>
                  {goalResult.required_sgpa||'—'}
                </div>
                <div style={{ fontSize:15, fontWeight:600, color:'var(--text2)', marginTop:8 }}>Required SGPA per remaining semester</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:6, maxWidth:400, margin:'10px auto 0' }}>{goalResult.message}</div>
              </div>

              {/* Stats row */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0, borderTop:'1px solid var(--border)' }}>
                {[
                  {l:'Current CGPA',  v:goalResult.current_cgpa},
                  {l:'Target CGPA',   v:goalResult.target_cgpa},
                  {l:'Sems Remaining',v:goalResult.sems_remaining},
                  {l:'Required %',    v:`${goalResult.required_pct||0}%`},
                ].map((s,i)=>(
                  <div key={s.l} style={{ padding:'18px', textAlign:'center', borderRight:i<3?'1px solid var(--border)':'none' }}>
                    <div style={{ fontSize:22, fontWeight:800, color:'var(--text1)' }}>{s.v}</div>
                    <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, marginTop:4 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BUNK CALCULATOR ── */}
      {tab==='bunk' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="card fade-up">
            <div className="card-header"><div className="card-title">📊 Bunk Calculator</div><div className="card-sub">How many classes can you safely skip?</div></div>
            <div className="card-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
                <div className="field">
                  <label className="lbl">Total Classes Held</label>
                  <input className="inp" type="number" min="0" value={bunk.total} onChange={e=>setBunk(b=>({...b,total:e.target.value}))}/>
                </div>
                <div className="field">
                  <label className="lbl">Classes Attended</label>
                  <input className="inp" type="number" min="0" max={bunk.total} value={bunk.present} onChange={e=>setBunk(b=>({...b,present:e.target.value}))}/>
                </div>
              </div>

              {/* Result */}
              <div style={{ borderRadius:20, overflow:'hidden', border:'2px solid ' + (bc.safe?'#A8E6C3':'#FFBDBD') }}>
                <div style={{ padding:'20px 24px', background:bc.safe?'linear-gradient(135deg,#E8FBF0,#F0FBF4)':'linear-gradient(135deg,#FFF0F0,#FFF5F5)', textAlign:'center' }}>
                  <div style={{ fontSize:64, fontWeight:900, color:bc.safe?'#27AE60':'#EB5757', lineHeight:1 }}>{bc.pct}%</div>
                  <div style={{ fontSize:14, fontWeight:700, color:bc.safe?'#27AE60':'#EB5757', marginTop:6 }}>
                    {bc.safe ? '✅ You are SAFE' : '⚠️ ATTENDANCE AT RISK'}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:0 }}>
                  {[
                    {l:'Attended',    v:bunk.present,    c:'#6347D1', bg:'#EEF0FF'},
                    {l:'Required (75%)',v:bc.need,       c:'#2F80ED', bg:'#EBF4FF'},
                    {l:'Can Skip',    v:bc.canMiss,      c:bc.canMiss>0?'#27AE60':'#EB5757', bg:bc.canMiss>0?'#E8FBF0':'#FFF0F0'},
                    {l:'Must Attend', v:bc.mustAttend,   c:bc.mustAttend>0?'#EB5757':'#27AE60', bg:bc.mustAttend>0?'#FFF0F0':'#E8FBF0'},
                  ].map((s,i)=>(
                    <div key={s.l} style={{ padding:'16px', textAlign:'center', background:s.bg, borderLeft:i>0?'1px solid var(--border)':'none' }}>
                      <div style={{ fontSize:28, fontWeight:900, color:s.c }}>{s.v}</div>
                      <div style={{ fontSize:10, color:s.c, fontWeight:700, marginTop:4 }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {bc.safe ? (
                <div style={{ marginTop:14, padding:'14px 18px', background:'#E8FBF0', borderRadius:14, fontSize:13, color:'#27AE60', fontWeight:500 }}>
                  ✅ You can safely skip up to <strong>{bc.canMiss}</strong> more class{bc.canMiss!==1?'es':''} and still maintain 75% attendance.
                </div>
              ) : (
                <div style={{ marginTop:14, padding:'14px 18px', background:'#FFF0F0', borderRadius:14, fontSize:13, color:'#EB5757', fontWeight:500 }}>
                  ⚠️ You need to attend at least <strong>{bc.mustAttend}</strong> more consecutive class{bc.mustAttend!==1?'es':''} to reach 75%.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}