import React from 'react';
import './EmployeeProfileSkeleton.scss';

export function GoalsSkeleton() {
  return <div className="profile-goals" role="status" aria-label="Loading employee goals">{[0, 1, 2].map(index => <div className="card overview-card goal-card" aria-hidden="true" key={index}><div className="goal-card__header"><span className="profile-placeholder goal-card__skeleton-icon" /><div className="goal-card__skeleton-heading"><span className="profile-placeholder goal-card__skeleton-title" /><span className="profile-placeholder goal-card__skeleton-meta" /></div><span className="profile-placeholder goal-card__skeleton-edit" /></div><div className="goal-card__body"><span className="profile-placeholder goal-card__skeleton-summary" />{[0, 1].map(result => <div className="goal-card__result" key={result}><span className="profile-placeholder goal-card__skeleton-label" /><span className="profile-placeholder goal-card__skeleton-bar" /></div>)}</div></div>)}</div>;
}
