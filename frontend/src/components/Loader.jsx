export default function Loader({ text = 'Loading...' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'64px 20px', gap:16 }}>
      <div className="dot-loader">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
      {text && <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{text}</div>}
    </div>
  );
}