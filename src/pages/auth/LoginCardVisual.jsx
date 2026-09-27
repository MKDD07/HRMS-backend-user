import React from 'react';

export function LoginCardVisual({ index }) {
  switch (index) {
    case 0: return <div className="login-viz viz-people"><div className="viz-avatars">{['AK', 'JR', 'SM', '+'].map(v => <i className="viz-mark" key={v}>{v}</i>)}</div><div className="viz-network"><span/><span/><span/></div><small>One connected team</small></div>;
    case 1: return <div className="login-viz viz-attendance"><div className="viz-ring viz-mark"><ClockFace /></div><div><strong>In rhythm</strong><span className="viz-spark">{[35, 65, 50, 80, 60, 95, 85].map((h, i) => <i className="viz-mark" key={i} style={{ height: `${h}%` }}/>)}</span><small>A week in balance</small></div></div>;
    case 2: return <div className="login-viz viz-calendar"><div className="viz-calendar-grid">{Array.from({ length: 21 }, (_, i) => <i className={`viz-mark ${[9,10,11,16,17].includes(i) ? 'day-off' : ''}`} key={i}>{i + 1}</i>)}</div><small>Make space for time off</small></div>;
    case 3: return <div className="login-viz viz-pay"><div className="viz-donut viz-mark"/><div className="viz-legend"><span><i/>Earnings</span><span><i/>Benefits</span><span><i/>Deductions</span></div></div>;
    case 4: return <div className="login-viz viz-documents">{['Contracts', 'Policies', 'Certificates'].map((v, i) => <div className="viz-mark" key={v}><span>{v}</span><i style={{ width: `${65 - i * 15}%` }}/><b>&#10003;</b></div>)}</div>;
    case 5: return <div className="login-viz viz-journey">{['Welcome', 'Connect', 'Settle in'].map((v, i) => <div className="viz-mark" key={v}><b>{i + 1}</b><small>{v}</small></div>)}</div>;
    case 6: return <div className="login-viz viz-growth"><svg viewBox="0 0 230 80"><path className="viz-grid" d="M5 15H225 M5 40H225 M5 65H225"/><path className="viz-area viz-mark" d="M5 68L40 57L75 61L110 35L145 40L185 20L225 8V78H5Z"/><path className="viz-line" d="M5 68L40 57L75 61L110 35L145 40L185 20L225 8"/>{[[5,68],[40,57],[75,61],[110,35],[145,40],[185,20],[225,8]].map(([cx,cy]) => <circle className="viz-mark" key={cx} cx={cx} cy={cy} r="3"/>)}</svg><small>Progress worth celebrating</small></div>;
    default: return <div className="login-viz viz-culture">{[['Belong',70],['Support',90],['Thrive',80]].map(([label,width]) => <div key={label}><small>{label}</small><span><i className="viz-mark" style={{ width: `${width}%` }}/></span></div>)}<div className="viz-hearts">&#9825; &nbsp; &#9825; &nbsp; &#9825;</div></div>;
  }
}
function ClockFace() { return <svg viewBox="0 0 40 40"><path d="M20 9V21L28 25" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>; }
