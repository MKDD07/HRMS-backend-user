import React from 'react';
import { Button } from './Button';
import './TenantPanel.scss';

/** Shared card heading. Actions are Button props plus id, label and visible. */
export function TenantPanelHeader({ title, subtitle, actions = [], controls, icon: Icon, headingLevel = 2, className = '' }) {
  const Heading = [2, 3, 4].includes(headingLevel) ? `h${headingLevel}` : 'h2';
  const visibleActions = actions.filter(action => action && action.visible !== false).slice(0, 2);
  return <div className={`card-head ${className}`.trim()}>
    <div>
      <Heading>{Icon && <Icon size={16} aria-hidden="true" />}{title}</Heading>
      {subtitle && <p>{subtitle}</p>}
    </div>
    {(controls || visibleActions.length > 0) && <div>
      {controls}
      {visibleActions.map(({ id, label, visible, size, className: btnClass, variant = '', ...props }, index) =>
        <Button key={id || index} {...props} variant={variant || 'outline'} size="sm">{label}</Button>
      )}
    </div>}
  </div>;
}

/** One bordered card shell; children own their content, never the heading markup. */
export function TenantPanel({ title, subtitle, actions, controls, icon, headingLevel, children, className = '', ...props }) {
  const cardClass = ['card', className].filter(Boolean).join(' ');
  return <div {...props} className={cardClass}>
    <TenantPanelHeader title={title} subtitle={subtitle} actions={actions} controls={controls} icon={icon} headingLevel={headingLevel} />
    {children}
  </div>;
}
