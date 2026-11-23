import React from 'react';
import { ArrowUpRight } from 'lucide-react';

/**
 * Universal Button Component
 *
 * @param {'colored' | 'outline' | 'fadeout' | 'focus' | 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'} variant
 * @param {'sm' | 'md' | 'lg'} size
 * @param {React.ComponentType} icon - Leading icon
 * @param {React.ComponentType} endIcon - Trailing icon
 * @param {boolean} iconOnly - Set true if square icon button without text
 * @param {boolean} pill - Full rounded pill
 * @param {boolean} active - Active / pressed state
 * @param {boolean} loading - Loading state
 * @param {boolean} disabled - Disabled state
 */
export function Button({
  children,
  variant = 'colored',
  size = 'md',
  icon: Icon,
  endIcon: EndIcon,
  iconOnly = false,
  viewAll = false,
  pill = false,
  loading = false,
  active = false,
  disabled = false,
  wrapContent = true,
  layout,
  className = '',
  onClick,
  type = 'button',
  ...props
}) {
  const actionLabel = viewAll ? React.Children.toArray(children).filter(child => typeof child === 'string').join('') : undefined;
  const variantClass = `btn--${variant}`;
  const sizeClass = iconOnly ? `btn--icon-${size}` : (size !== 'md' ? `btn--${size}` : 'btn--md');
  const pillClass = pill ? 'btn--pill' : '';
  const loadingClass = loading ? 'btn--loading' : '';
  const activeClass = active ? 'is-active' : '';

  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;

  return (
    <button
      type={type}
      className={`btn ${variantClass} ${sizeClass} ${pillClass} ${loadingClass} ${activeClass} ${layout ? `btn--layout-${layout}` : ''} ${viewAll ? 'btn--view-all' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      aria-pressed={active ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      onClick={onClick}
      aria-label={actionLabel}
      title={actionLabel}
      {...props}
    >
      {!viewAll && Icon && !loading && (
        React.isValidElement(Icon) ? Icon : <Icon size={iconSize} className="shrink-0" />
      )}
      {viewAll ? <ArrowUpRight size={16} aria-hidden="true" /> : wrapContent ? (children && <span>{children}</span>) : children}
      {!viewAll && EndIcon && !loading && (
        React.isValidElement(EndIcon) ? EndIcon : <EndIcon size={iconSize} className="shrink-0" />
      )}
    </button>
  );
}

export function ButtonGroup({ children, className = '' }) {
  return <div className={`btn-group ${className}`.trim()}>{children}</div>;
}

export default Button;
