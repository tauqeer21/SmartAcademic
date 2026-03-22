import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Loader from '../../components/Loader';

const CAT_STYLE = {
  General:    {bg:'#EEF0FF',color:'#6347D1',icon:'📄'},
  PYQ:        {bg:'#FFF3E8',color:'#F2994A',icon:'📝'},
  Books:      {bg:'#E8FBF0',color:'#27AE60',icon:'📚'},
  Handout:    {bg:'#EBF4FF',color:'#2F80ED',icon:'📋'},
  'Lab Manual':{bg:'#FFF0F0',color:'#EB5757',icon:'🔬'},
};
const CATS = ['All','General','PYQ','Books','Handout','Lab Manual'];

export default function StudentNotes() {
  const [notes, setNotes]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('All');

  useEffect(()=>{
    api.get('/notes/mine').then(r=>setNotes(r.data||[])).finally(()=>setLoading(false));
  },[]);

  if (loading) return <Loader text="Loading notes..."/>;

  const filtered = activeCat==='All' ? notes : notes.filter(n=>n.category===activeCat);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div className="page-header fade-up">
        <div className="page-title">Notes & Files</div>
        <div className="page-sub">Study materials shared by your teachers</div>
      </div>

      {/* Category Filter */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}} className="fade-up-d1">
        {CATS.map(cat=>(
          <button key={cat} onClick={()=>setActiveCat(cat)}
            style={{padding:'8px 18px',borderRadius:'50px',border:`2px solid ${activeCat===cat?'#7B61FF':'var(--border2)'}`,background:activeCat===cat?'#EEF0FF':'#fff',color:activeCat===cat?'#6347D1':'var(--text2)',fontSize:13,fontWeight:600,cursor:'pointer',transition:'all 0.18s',fontFamily:'var(--font-main)'}}>
            {cat==='All'?'📁 All':(CAT_STYLE[cat]?.icon||'📄')+' '+cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card"><div className="empty"><div className="empty-icon">📎</div><div>No notes available in this category</div></div></div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}} className="fade-up-d1">
          {filtered.map(n=>{
            const cs = CAT_STYLE[n.category]||CAT_STYLE.General;
            return (
              <div key={n.id} className="card" style={{padding:'18px 20px',transition:'transform 0.2s',cursor:'default'}}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)'}}
                onMouseLeave={e=>{e.currentTarget.style.transform=''}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                  <div style={{width:44,height:44,borderRadius:14,background:cs.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{cs.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--text1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.title}</div>
                    <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:'50px',background:cs.bg,color:cs.color}}>{n.category}</span>
                  </div>
                </div>
                <div style={{fontSize:11,color:'var(--text3)',marginBottom:12}}>{n.subject} · {n.teacher_name} · {new Date(n.uploaded_at||Date.now()).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
                {n.file_name && (
                  <button
                    style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'9px 16px',borderRadius:'50px',background:cs.bg,color:cs.color,fontSize:12,fontWeight:600,border:`2px solid ${cs.color}22`,transition:'all 0.18s',cursor:'pointer',fontFamily:'var(--font)',width:'100%'}}
                    onMouseEnter={e=>{e.currentTarget.style.background=cs.color;e.currentTarget.style.color='#fff'}}
                    onMouseLeave={e=>{e.currentTarget.style.background=cs.bg;e.currentTarget.style.color=cs.color}}
                    onClick={()=>{
                      const tok=localStorage.getItem('sas_token');
                      fetch(`/api/notes/download/${n.id}`,{headers:{Authorization:`Bearer ${tok}`}})
                        .then(r=>r.blob()).then(b=>{
                          const url=URL.createObjectURL(b);
                          const a=document.createElement('a');a.href=url;a.download=n.file_name;a.click();
                          URL.revokeObjectURL(url);
                        });
                    }}>
                    ⬇ Download
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}