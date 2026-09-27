import React from 'react';

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
  pill = false,
  loading = false,
  active = false,
  disabled = false,
  className = '',
  onClick,
  type = 'button',
  ...props
}) {
  const variantClass = `btn--${variant}`;
  const sizeClass = iconOnly ? `btn--icon-${size}` : (size !== 'md' ? `btn--${size}` : 'btn--md');
  const pillClass = pill ? 'btn--pill' : '';
  const loadingClass = loading ? 'btn--loading' : '';
  const activeClass = active ? 'is-active' : '';

  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;

  return (
    <button
      type={type}
      className={`btn ${variantClass} ${sizeClass} ${pillClass} ${loadingClass} ${activeClass} ${className}`.trim()}
      disabled={disabled || loading}
      aria-pressed={active ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      onClick={onClick}
      {...props}
    >
      {Icon && !loading && (
        React.isValidElement(Icon) ? Icon : <Icon size={iconSize} className="shrink-0" />
      )}
      {children && <span>{children}</span>}
      {EndIcon && !loading && (
        React.isValidElement(EndIcon) ? EndIcon : <EndIcon size={iconSize} className="shrink-0" />
      )}
    </button>
  );
}

export function ButtonGroup({ children, className = '' }) {
  return <div className={`btn-group ${className}`.trim()}>{children}</div>;
}

export default Button;
