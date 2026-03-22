// StatCard — Edu Center style
// colorKey: 'purple' | 'green' | 'orange' | 'red' | 'blue'
const MAP = {
  purple: { box: 'sib-purple', num: '#6347D1', before: 'sc-purple' },
  green:  { box: 'sib-green',  num: '#27AE60', before: 'sc-green'  },
  orange: { box: 'sib-orange', num: '#F2994A', before: 'sc-orange' },
  red:    { box: 'sib-red',    num: '#EB5757', before: 'sc-red'    },
  blue:   { box: 'sib-blue',   num: '#2F80ED', before: 'sc-blue'   },
};

export default function StatCard({ icon, num, label, sub, trend, trendDir = 'flat', colorKey = 'purple' }) {
  const m = MAP[colorKey] || MAP.purple;
  const tClass = trendDir === 'up' ? 'st-up' : trendDir === 'down' ? 'st-down' : 'st-flat';
  return (
    <div className={`stat-card ${m.before}`}>
      <div className={`stat-icon-box ${m.box}`}>{icon}</div>
      <div>
        <div className="stat-num" style={{ color: m.num }}>{num ?? '—'}</div>
        <div className="stat-lbl">{label}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
      </div>
      {trend != null && <span className={`stat-trend ${tClass}`}>{trend}</span>}
    </div>
  );
}