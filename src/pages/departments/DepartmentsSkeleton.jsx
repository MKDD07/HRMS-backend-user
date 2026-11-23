import React from 'react';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import './DepartmentsSkeleton.scss';

const Line = ({ className = '' }) => <span className={`skeleton departments-skeleton__line ${className}`} />;

export function DepartmentsSkeleton() {
  return <div className="departments-skeleton" role="status" aria-label="Loading departments" aria-busy="true">
    <div aria-hidden="true">
      <MetricOverview loading>
        {[0, 1, 2].map(index => <MetricCard key={index} label="" value="" caption="" />)}
      </MetricOverview>
      <div className="department-cards">
        {[0, 1, 2, 3].map(index => <article className="card overview-card departments-skeleton__card" key={index}>
          <div className="departments-skeleton__heading"><span className="skeleton departments-skeleton__tile" /><Line /></div>
          <Line className="departments-skeleton__title" />
          {index === 0 ? <><Line className="departments-skeleton__caption" />
            <div className="departments-skeleton__leaders">{[0, 1, 2, 3, 4].map(row => <div className="departments-skeleton__person" key={row}><span className="skeleton departments-skeleton__avatar" /><div><Line /><Line /></div></div>)}</div>
          </> : <>
            <div className="departments-skeleton__person"><span className="skeleton departments-skeleton__avatar" /><div><Line /><Line /></div></div>
            {[0, 1].map(row => <div className="departments-skeleton__detail" key={row}><Line /><Line className="departments-skeleton__caption" /></div>)}
          </>}
          <div className="departments-skeleton__footer"><Line /><span className="skeleton departments-skeleton__icon" /></div>
        </article>)}
      </div>
    </div>
  </div>;
}
