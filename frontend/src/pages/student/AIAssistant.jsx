import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function AIAssistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    { role:'assistant', text:`Hi ${user?.name?.split(' ')[0]||'there'}! 👋 I'm your AI study assistant. Ask me anything about your subjects, and I'll help you understand it clearly.` }
  ]);
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [selClass, setSelClass] = useState(null);
  const [subject, setSubject] = useState('');
  const bottomRef = useRef(null);

  useEffect(()=>{
    api.get('/classes/my').then(r=>{
      setClasses(r.data||[]);
      if(r.data.length) setSelClass(r.data[0]);
    });
  },[]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[messages]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q) return;
    setMessages(m=>[...m,{role:'user',text:q}]);
    setInput('');
    setLoading(true);
    try {
      const id = selClass?.id||selClass?.class_id;
      const r = await api.post('/ai/chat',{question:q,class_id:id,subject});
      setMessages(m=>[...m,{role:'assistant',text:r.data.answer||'Sorry, I could not answer that.'}]);
    } catch { toast.error('AI unavailable'); setMessages(m=>[...m,{role:'assistant',text:'Sorry, I am temporarily unavailable. Please try again.'}]); }
    finally { setLoading(false); }
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16,height:'calc(100vh - 120px)'}}>
      <div className="page-header fade-up">
        <div className="page-title">AI Assistant</div>
        <div className="page-sub">Your personal AI study tutor — powered by Groq</div>
      </div>

      {/* Config */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}} className="fade-up-d1">
        {classes.length > 0 && (
          <select className="inp" style={{width:'auto',minWidth:160}} value={selClass?.id||selClass?.class_id||''} onChange={e=>{const c=classes.find(c=>(c.id||c.class_id)==e.target.value);setSelClass(c);}}>
            {classes.map(c=><option key={c.id||c.class_id} value={c.id||c.class_id}>{c.name||c.class_name}</option>)}
          </select>
        )}
        <input className="inp" style={{width:'auto',minWidth:160}} placeholder="Subject (optional)" value={subject} onChange={e=>setSubject(e.target.value)}/>
      </div>

      {/* Chat Window */}
      <div className="card" style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{flex:1,overflowY:'auto',padding:'20px',display:'flex',flexDirection:'column',gap:14}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:'flex',gap:12,alignItems:'flex-start',flexDirection:m.role==='user'?'row-reverse':'row'}}>
              <div style={{width:36,height:36,borderRadius:'50%',flexShrink:0,background:m.role==='user'?'linear-gradient(135deg,#7B61FF,#6347D1)':'linear-gradient(135deg,#27AE60,#1a8a4a)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>
                {m.role==='user'?'👤':'🤖'}
              </div>
              <div style={{maxWidth:'72%',padding:'12px 16px',borderRadius:m.role==='user'?'18px 4px 18px 18px':'4px 18px 18px 18px',background:m.role==='user'?'linear-gradient(135deg,#7B61FF,#6347D1)':'var(--surface2)',color:m.role==='user'?'#fff':'var(--text1)',fontSize:13,lineHeight:1.7,whiteSpace:'pre-wrap',border:m.role==='assistant'?'1px solid var(--border)':'none'}}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#27AE60,#1a8a4a)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🤖</div>
              <div style={{padding:'14px 18px',borderRadius:'4px 18px 18px 18px',background:'var(--surface2)',border:'1px solid var(--border)',display:'flex',gap:5,alignItems:'center'}}>
                <span className="dot" style={{width:7,height:7}}/>
                <span className="dot" style={{width:7,height:7,animationDelay:'0.2s'}}/>
                <span className="dot" style={{width:7,height:7,animationDelay:'0.4s'}}/>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{padding:'16px 20px',borderTop:'1px solid var(--border)',display:'flex',gap:10}}>
          <input className="inp" style={{flex:1,borderRadius:'50px'}} placeholder="Ask me anything about your studies..." value={input}
            onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();}}}/>
          <button className="btn btn-primary" onClick={handleSend} disabled={loading||!input.trim()} style={{borderRadius:'50px',padding:'10px 20px'}}>
            {loading?'...':'Send →'}
          </button>
        </div>
      </div>
    </div>
  );
}