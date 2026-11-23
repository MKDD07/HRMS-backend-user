import React from 'react';
import { Button } from './Button';
import './TenantHeader.scss';

// Serializable settings follow TenantHeader.schema.json; actions supply callbacks and state.
export function TenantHeader({ settings = {}, actions = {}, className = '', refreshAccessory = null }) {
  const { subheading, heading, paragraph, buttons = [] } = settings;
  const visible = buttons.filter(b => b.visible !== false && actions[b.id]?.visible !== false).slice(0, 3);
  return <header className={['tenant-header', className].filter(Boolean).join(' ')}>
    <div className="tenant-header__content">
      {subheading && <span className="tenant-eyebrow">{subheading}</span>}
      {heading && <h1>{heading}</h1>}
      {paragraph && <p>{paragraph}</p>}
    </div>
    {(refreshAccessory || visible.length > 0) && <div className="tenant-header__actions">
      {refreshAccessory}
      {visible.map(button => {
        const state = actions[button.id] || {};
        return <Button key={button.id} variant={button.variant || 'colored'} icon={state.icon} onClick={state.onClick} loading={state.loading} disabled={button.disabled || state.disabled || !state.onClick} id={state.id} title={state.title} active={state.active} aria-expanded={state['aria-expanded']} aria-controls={state['aria-controls']} aria-pressed={state['aria-pressed'] ?? (state.active ? true : undefined)}>{button.label}</Button>;
      })}
    </div>}
  </header>;
}
export default TenantHeader;
