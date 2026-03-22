import { useState, useEffect, useRef } from 'react';
import { useCurrentClass } from '../context/AuthContext';
import api from '../api/axios';

export default function ClassSwitcher() {
  const [classes, setClasses] = useState([]);
  const [open, setOpen]       = useState(false);
  const [cls, setCls]         = useCurrentClass();
  const ref = useRef(null);

  useEffect(() => {
    api.get('/classes/my').then(r => {
      const list = r.data || [];
      setClasses(list);
      // Auto-select first class if none selected
      if (!cls && list.length > 0) {
        setCls(list[0]);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function select(c) {
    setCls(c);   // This triggers useCurrentClass() in every page → data reloads
    setOpen(false);
  }

  if (classes.length === 0) return null;
  if (classes.length === 1) return (
    <div style={{
      display:'flex', alignItems:'center', gap:7,
      height:36, padding:'0 14px',
      borderRadius:'50px',
      border:'2px solid var(--border2)',
      background:'var(--card-bg)',
      color:'var(--text2)', fontSize:12, fontWeight:600,
    }}>
      <span>🏫</span>
      <span>{cls?.name}{cls?.section ? ' · ' + cls.section : ''}</span>
    </div>
  );

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          display:'flex', alignItems:'center', gap:8,
          height:38, padding:'0 16px',
          borderRadius:'50px',
          border:`2px solid ${open ? 'var(--primary)' : 'var(--border2)'}`,
          background: open ? 'var(--primary-bg)' : 'var(--card-bg)',
          color: open ? 'var(--primary)' : 'var(--text2)',
          fontSize:12, fontWeight:600,
          cursor:'pointer', fontFamily:'var(--font)',
          maxWidth:220, transition:'all 0.18s',
        }}>
        <span style={{ fontSize:14 }}>🏫</span>
        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:140 }}>
          {cls ? `${cls.name}${cls.section ? ' · ' + cls.section : ''}` : 'Select class'}
        </span>
        <span style={{ fontSize:9, transform: open ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:300,
          background:'var(--card-bg)', borderRadius:20, overflow:'hidden',
          boxShadow:'0 16px 48px rgba(99,71,209,0.18)',
          minWidth:240, maxHeight:320, overflowY:'auto',
          border:'1px solid var(--border2)',
        }}>
          <div style={{ padding:'12px 16px 8px', fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
            Switch Class
          </div>
          {classes.map((c, i) => (
            <div key={c.id} onClick={() => select(c)}
              style={{
                padding:'12px 16px', cursor:'pointer',
                borderBottom: i < classes.length - 1 ? '1px solid var(--border)' : 'none',
                background: cls?.id === c.id ? 'var(--primary-bg)' : 'transparent',
                transition:'background 0.14s',
                display:'flex', alignItems:'center', gap:12,
              }}
              onMouseEnter={e => { if (cls?.id !== c.id) e.currentTarget.style.background = 'var(--surface2)'; }}
              onMouseLeave={e => { if (cls?.id !== c.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                width:36, height:36, borderRadius:10, flexShrink:0,
                background: cls?.id === c.id ? 'var(--primary)' : 'var(--surface3)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:16,
              }}>🏫</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color: cls?.id === c.id ? 'var(--primary)' : 'var(--text1)' }}>
                  {c.name}{c.section ? ' · ' + c.section : ''}
                </div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {c.subjects || 'No subjects assigned'}
                </div>
              </div>
              {cls?.id === c.id && (
                <span style={{ fontSize:16, color:'var(--primary)', flexShrink:0 }}>✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}