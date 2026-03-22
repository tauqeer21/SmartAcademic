import { useState, useEffect } from 'react';
import { useCurrentClass, useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';

const PRIORITIES = ['low','medium','high'];
const PRIORITY_STYLE = { high:{bg:'#FFF0F0',color:'#EB5757'}, medium:{bg:'#FFF3E8',color:'#F2994A'}, low:{bg:'#EEF0FF',color:'#6347D1'} };
const PRIORITY_ICON  = { high:'🔴', medium:'🟡', low:'🔵' };

export default function Announcements() {
  const { user } = useAuth();
  const [cls] = useCurrentClass();
  const [list, setList]         = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({title:'',body:'',subject:'General',priority:'medium'});

  const load = () => {
    if (!cls?.id) return;
    Promise.all([
      api.get('/announcements/class/'+cls.id),
      api.get('/classes/'+cls.id+'/my-subjects')
    ]).then(([a,s])=>{
      // Only show THIS teacher's announcements
      setList((a.data||[]).filter(ann => ann.teacher_id === user?.roll_no));
      setSubjects(['General',...(s.data||[])]);
    }).finally(()=>setLoading(false));
  };

  useEffect(()=>{ setLoading(true); load(); },[cls?.id]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.title||!form.body) { toast.error('Fill title and message'); return; }
    setSaving(true);
    try {
      await api.post('/announcements/', {...form, class_id:cls.id});
      toast.success('Announcement posted!');
      setShowForm(false); setForm({title:'',body:'',subject:'General',priority:'medium'});
      load();
    } catch(err) { toast.error(err.response?.data?.error||'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async id => {
    if (!confirm('Delete this announcement?')) return;
    try { await api.delete('/announcements/'+id); toast.success('Deleted'); load(); }
    catch { toast.error('Failed'); }
  };

  if (loading) return <Loader text="Loading announcements..."/>;
  if (!cls) return <div className="empty"><div className="empty-icon">📢</div><div>Select a class first</div></div>;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div className="page-header fade-up" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-title">Announcements</div>
          <div className="page-sub">{cls.name} — Post updates to your students</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setShowForm(true)}>📢 New Announcement</button>
      </div>

      {showForm && (
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setShowForm(false)}}>
          <div className="modal modal-wide">
            <div className="modal-header">
              <div className="modal-title">📢 Post Announcement</div>
              <button className="modal-close" onClick={()=>setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="field" style={{marginBottom:14}}>
                  <label className="lbl">Title *</label>
                  <input className="inp" placeholder="Announcement title..." value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>
                </div>
                <div className="form-row form-row-2" style={{marginBottom:14}}>
                  <div className="field">
                    <label className="lbl">Subject</label>
                    <select className="inp" value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}>
                      {subjects.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="lbl">Priority</label>
                    <select className="inp" value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
                      {PRIORITIES.map(p=><option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label className="lbl">Message *</label>
                  <textarea className="inp" rows={4} placeholder="Write your announcement here..." value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}/>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Posting...':'Post Announcement'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="card"><div className="empty"><div className="empty-icon">📢</div><div style={{fontWeight:600,color:'var(--text2)'}}>No announcements yet</div><button className="btn btn-primary btn-sm" style={{marginTop:12}} onClick={()=>setShowForm(true)}>Post First Announcement</button></div></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}} className="fade-up-d1">
          {list.map(a => {
            const ps = PRIORITY_STYLE[a.priority]||PRIORITY_STYLE.low;
            return (
              <div key={a.id} className="card" style={{padding:'20px 24px'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                  <div style={{width:44,height:44,borderRadius:14,background:ps.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>
                    {PRIORITY_ICON[a.priority]||'🔵'}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                      <span style={{fontSize:15,fontWeight:700,color:'var(--text1)'}}>{a.title}</span>
                      <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:'50px',background:ps.bg,color:ps.color}}>{a.priority}</span>
                      <span className="badge badge-purple">{a.subject}</span>
                    </div>
                    <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.6,marginBottom:8}}>{a.body}</p>
                    <div style={{fontSize:11,color:'var(--text3)'}}>
                      {new Date(a.created_at||Date.now()).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
                    </div>
                  </div>
                  <button className="btn btn-danger btn-xs" onClick={()=>handleDelete(a.id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}