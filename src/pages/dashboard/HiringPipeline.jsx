import React from 'react';
import { Users, BriefcaseBusiness } from 'lucide-react';

const tones = ['#8494b1', '#8e83b8', '#649dba', '#d2a162', '#6c9e8b'];

export function HiringPipeline({ stages = [], positions = 0, unavailable = false }) {
  if (unavailable) return <p className="tenant-empty" role="status">Hiring data unavailable. Refresh to retry.</p>;
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);
  const max = Math.max(1, ...stages.map(stage => stage.count));
  return <div className="hiring-pipeline">
    <div className="hiring-pipeline__summary"><div><span><Users size={15} aria-hidden="true" />Candidates</span><strong>{total.toLocaleString('en-IN')}</strong></div><div><span><BriefcaseBusiness size={15} aria-hidden="true" />Open positions</span><strong>{positions.toLocaleString('en-IN')}</strong></div></div>
    {total ? <ol className="hiring-pipeline__stages" aria-label="Candidates by hiring stage">{stages.map((stage, index) => <li key={stage.name} style={{ '--stage-color': tones[index % tones.length] }}><div><span><i aria-hidden="true" />{stage.name}</span><strong>{stage.count.toLocaleString('en-IN')}</strong></div><div className="hiring-pipeline__track" aria-hidden="true"><span style={{ width: `${stage.count / max * 100}%` }} /></div></li>)}</ol> : <p className="hiring-pipeline__empty">No candidates in the pipeline yet.</p>}
  </div>;
}
