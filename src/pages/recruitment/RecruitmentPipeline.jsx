import React, { useState } from 'react';
import { CalendarDays, FileCheck, ArrowUpRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/ui/Button';

const stages = [['Applied','#5687bb'],['Screening','#8b73c8'],['Interview','#d89932'],['Offered','#37977b'],['Hired','#39906c'],['Rejected','#ba6975'],['Withdrawn','#7b8591']];
export function RecruitmentPipeline({ records, data, onEdit }) {
  const [jobId,setJobId] = useState('');
  const reducedMotion = useReducedMotion();
  const visible = records.filter(record => !jobId || record.job_id === jobId);
  return <div className="recruitment-board">
    <div className="recruitment-board-heading"><div><h2>Candidate pipeline</h2><p>Open a candidate to update their stage, or plan their next interview.</p></div><label><span className="talent-sr-only">Filter pipeline by opening</span><select value={jobId} onChange={event => setJobId(event.target.value)}><option value="">All openings</option>{(data.jobs || []).map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label></div>
    <div className="talent-pipeline recruitment-board-lanes">{stages.map(([stage,color]) => <section key={stage} style={{'--stage-color':color}}><h3><span className="recruitment-stage-dot"/>{stage}<small>{visible.filter(record => record.status === stage).length}</small></h3>
      {visible.filter(record => record.status === stage).map(record => {
        const interview = (data.interviews || []).filter(item => item.candidate_id === record.id && item.status === 'Scheduled').sort((a,b) => (a.date+a.start_time).localeCompare(b.date+b.start_time))[0];
        const active = !['Hired','Rejected','Withdrawn'].includes(record.status);
        return <motion.article className="recruitment-person-card" key={record.id} initial={{opacity:0,y:reducedMotion?0:7}} animate={{opacity:1,y:0}} transition={{duration:reducedMotion?0:.18}}>
          <div className="recruitment-person-heading"><span className="recruitment-initials" aria-hidden="true">{record.title.split(/\s+/).slice(0,2).map(word => word[0]).join('')}</span><div><strong>{record.title}</strong><small>{(data.jobs || []).find(job => job.id === record.job_id)?.title}</small></div></div>
          <p>{record.email}</p>{record.source && <span className="recruitment-source">{record.source}</span>}
          {interview && <div className="recruitment-next-interview"><CalendarDays size={13}/><span>{interview.date} · {interview.start_time} IST</span></div>}
          <div className="recruitment-card-actions"><Button variant="fadeout" size="sm" icon={ArrowUpRight} onClick={() => onEdit({record})}>Review</Button>{active && <><Button variant="fadeout" size="sm" iconOnly icon={CalendarDays} aria-label={`Schedule interview for ${record.title}`} onClick={() => onEdit({collection:'interviews',record:null,defaults:{candidate_id:record.id,title:`Interview: ${record.title}`}})}/>{record.status === 'Interview' && <Button variant="fadeout" size="sm" iconOnly icon={FileCheck} aria-label={`Prepare offer for ${record.title}`} onClick={() => onEdit({collection:'offers',record:null,defaults:{candidate_id:record.id,title:`Offer: ${record.title}`}})}/>}</>}</div>
        </motion.article>;
      })}
      {!visible.some(record => record.status === stage) && <p className="recruitment-lane-empty">No candidates</p>}
    </section>)}</div>
  </div>;
}
