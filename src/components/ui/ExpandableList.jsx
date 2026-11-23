import React, { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './Button';
import './ExpandableList.scss';

export function ExpandableList({ items = [], limit = 3, renderItem, empty = 'Nothing to show.', className = '' }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  if (!items.length) return <p className="tenant-empty">{empty}</p>;
  return <div className={`expandable-list ${className}`}>
    <div>{items.slice(0, limit).map(renderItem)}</div>
    {items.length > limit && <>
      <div id={id} className={`expandable-list__reveal ${expanded ? 'is-expanded' : ''}`} aria-hidden={!expanded} inert={!expanded}>
        <div>{items.slice(limit).map((item, index) => renderItem(item, index + limit))}</div>
      </div>
      <div className="expandable-list__footer"><Button size="sm" variant="fadeout" endIcon={expanded ? ChevronUp : ChevronDown} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>{expanded ? 'View less' : `View more (${items.length - limit})`}</Button></div>
    </>}
  </div>;
}
