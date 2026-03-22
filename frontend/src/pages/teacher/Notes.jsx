import { useState, useEffect } from 'react';
import { useCurrentClass, useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';

const CATS = ['General','PYQ','Books','Handout','Lab Manual'];
const CAT_STYLE = {
  General:    {bg:'#EEF0FF',color:'#6347D1',icon:'📄'},
  PYQ:        {bg:'#FFF3E8',color:'#F2994A',icon:'📝'},
  Books:      {bg:'#E8FBF0',color:'#27AE60',icon:'📚'},
  Handout:    {bg:'#EBF4FF',color:'#2F80ED',icon:'📋'},
  'Lab Manual':{bg:'#FFF0F0',color:'#EB5757',icon:'🔬'},
};

export default function Notes() {
  const { user } = useAuth();
  const [cls] = useCurrentClass();
  const [notes, setNotes]       = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [activeCat, setActiveCat] = useState('All');
  const [form, setForm]         = useState({title:'',subject:'',category:'General'});
  const [file, setFile]         = useState(null);

  const load = () => {
    if (!cls?.id) return;
    Promise.all([
      api.get('/notes/class/'+cls.id),
      api.get('/classes/'+cls.id+'/my-subjects')
    ]).then(([n,s])=>{
      // Only show THIS teacher's notes
      setNotes((n.data||[]).filter(note => note.teacher_id === user?.roll_no));
      setSubjects(s.data||[]);
      if(s.data.length) setForm(f=>({...f,subject:s.data[0]}));
    }).finally(()=>setLoading(false));
  };

  useEffect(()=>{ setLoading(true); load(); },[cls?.id]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.title||!form.subject||!file) { toast.error('Fill all fields and attach a file'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v])=>fd.append(k,v));
      fd.append('class_id',cls.id); fd.append('file',file);
      await api.post('/notes/', fd, {headers:{'Content-Type':'multipart/form-data'}});
      toast.success('Note uploaded!');
      setShowForm(false); setFile(null); setForm(f=>({...f,title:''}));
      load();
    } catch(err) { toast.error(err.response?.data?.error||'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async id => {
    if (!confirm('Delete this note?')) return;
    try { await api.delete('/notes/'+id); toast.success('Deleted'); load(); }
    catch { toast.error('Failed'); }
  };

  if (loading) return <Loader text="Loading notes..."/>;
  if (!cls) return <div className="empty"><div className="empty-icon">📎</div><div>Select a class first</div></div>;

  const filtered = activeCat==='All' ? notes : notes.filter(n=>n.category===activeCat);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div className="page-header fade-up" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-title">Notes & Files</div>
          <div className="page-sub">{cls.name} — Share study materials with students</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setShowForm(true)}>+ Upload Note</button>
      </div>

      {/* Category Filter */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}} className="fade-up-d1">
        {['All',...CATS].map(cat=>(
          <button key={cat} onClick={()=>setActiveCat(cat)}
            style={{padding:'8px 18px',borderRadius:'50px',border:`2px solid ${activeCat===cat?'#7B61FF':'var(--border2)'}`,background:activeCat===cat?'#EEF0FF':'#fff',color:activeCat===cat?'#6347D1':'var(--text2)',fontSize:13,fontWeight:600,cursor:'pointer',transition:'all 0.18s',fontFamily:'var(--font-main)'}}>
            {cat==='All'?'📁 All':CAT_STYLE[cat]?.icon+' '+cat}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setShowForm(false)}}>
          <div className="modal modal-wide">
            <div className="modal-header">
              <div className="modal-title">📎 Upload Note</div>
              <button className="modal-close" onClick={()=>setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row form-row-2">
                  <div className="field"><label className="lbl">Title *</label><input className="inp" placeholder="Note title..." value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>
                  <div className="field"><label className="lbl">Subject *</label><select className="inp" value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}>{subjects.map(s=><option key={s}>{s}</option>)}</select></div>
                </div>
                <div className="form-row form-row-2">
                  <div className="field"><label className="lbl">Category</label><select className="inp" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
                  <div className="field"><label className="lbl">File *</label><input className="inp" type="file" onChange={e=>setFile(e.target.files[0])} style={{padding:'8px 16px'}}/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Uploading...':'Upload Note'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card"><div className="empty"><div className="empty-icon">📎</div><div style={{fontWeight:600,color:'var(--text2)'}}>No notes yet</div><button className="btn btn-primary btn-sm" style={{marginTop:12}} onClick={()=>setShowForm(true)}>Upload First Note</button></div></div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}} className="fade-up-d1">
          {filtered.map(n => {
            const cs = CAT_STYLE[n.category]||CAT_STYLE.General;
            return (
              <div key={n.id} className="card" style={{padding:'18px 20px'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                  <div style={{width:42,height:42,borderRadius:14,background:cs.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{cs.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--text1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.title}</div>
                    <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:'50px',background:cs.bg,color:cs.color}}>{n.category}</span>
                  </div>
                </div>
                <div style={{fontSize:11,color:'var(--text3)',marginBottom:12}}>{n.subject} · {new Date(n.uploaded_at||Date.now()).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
                <div style={{display:'flex',gap:8,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                  {n.file_name && <button className="btn btn-ghost btn-xs" style={{flex:1,justifyContent:'center'}} onClick={()=>{const t=localStorage.getItem('sas_token');fetch(`/api/notes/download/${n.id}`,{headers:{Authorization:`Bearer ${t}`}}).then(r=>r.blob()).then(b=>{const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=n.file_name;a.click();URL.revokeObjectURL(u);});}}>⬇ Download</button>}
                  <button className="btn btn-danger btn-xs" onClick={()=>handleDelete(n.id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}