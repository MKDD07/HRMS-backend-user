import React from 'react';

export function Card({
  children,
  className = '',
  hover = false,
  onClick,
  ...props
}) {
  return (
    <div
      className={`card ${hover ? 'hover:-translate-y-0.5 hover:border-gray-300 transition-all cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={`flex items-center justify-between mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }) {
  return <h3 className={`text-base font-semibold text-[#27292C] ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = '' }) {
  return <p className={`text-[13px] text-[#5F6368] mt-0.5 ${className}`}>{children}</p>;
}

export function CardContent({ children, className = '' }) {
  return <div className={`space-y-3 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return <div className={`mt-4 pt-3 border-t border-[#F3F4F6] flex items-center justify-between text-[13px] text-[#5F6368] ${className}`}>{children}</div>;
}
