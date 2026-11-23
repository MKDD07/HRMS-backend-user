import React from 'react';
import './EmployeeProfileSkeleton.scss';

const Bar = ({ className = '' }) => <span className={`profile-placeholder ${className}`} />;

export function ProfileContentSkeleton() {
  return <div className="profile-loading-content" role="status" aria-label="Loading employee details"><div aria-hidden="true"><div className="profile-loading-grid">{[0, 1].map(index => <div className="profile-loading-card" key={index}><div><Bar className="profile-placeholder--label" /></div><div className="profile-loading-fields">{[0, 1, 2, 3].map(field => <div key={field}><Bar className="profile-placeholder--label" /><Bar className="profile-placeholder--value" /></div>)}</div></div>)}</div></div></div>;
}

export function EmployeeProfileSkeleton() {
  return <div className="card overview-card employee-profile-loading" aria-busy="true" aria-label="Loading employee profile">
    <div className="profile-loading-header" aria-hidden="true"><Bar className="profile-placeholder--avatar" /><div><Bar className="profile-placeholder--name" /><Bar className="profile-placeholder--role" /><div className="profile-loading-tags">{[0, 1].map(index => <Bar className="profile-placeholder--tag" key={index} />)}</div><div className="profile-loading-tags">{[0, 1, 2, 3].map(index => <Bar className="profile-placeholder--contact-icon" key={index} />)}</div></div><Bar className="profile-placeholder--action" /></div>
    <div className="profile-loading-tabs" aria-hidden="true">{[0, 1, 2, 3, 4].map(index => <Bar className="profile-placeholder--tab" key={index} />)}</div>
    <div className="profile-loading-body"><ProfileContentSkeleton /></div>
  </div>;
}
