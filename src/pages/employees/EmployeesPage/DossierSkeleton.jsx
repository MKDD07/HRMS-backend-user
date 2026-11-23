import React from 'react';
import { Skeleton } from '../../../components/ui/Skeleton';
import './DossierEditors.scss';

export function DossierSkeleton() {
  return <div className="dossier-skeleton" role="status" aria-label="Loading employee records">{Array.from({ length: 3 }, (_, index) => <div className="dossier-skeleton-card" key={index} aria-hidden="true"><Skeleton className="dossier-skeleton-title"/><Skeleton className="dossier-skeleton-line"/><Skeleton className="dossier-skeleton-line dossier-skeleton-line--short"/></div>)}</div>;
}
