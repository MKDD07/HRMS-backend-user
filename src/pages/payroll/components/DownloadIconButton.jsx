import React from 'react';
import { Download } from 'lucide-react';

/** Icon-only download button used in every table. */
export function DownloadIconButton({ onClick, title = 'Download payslip PDF', size = 'sm' }) {
  const pad = size === 'md' ? 'p-2' : 'p-1.5';
  const icon = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`${pad} rounded-lg border border-[#e2e9da] bg-white hover:bg-[#f2f5ed] text-[#3e5432] hover:text-[#587443] transition-colors`}
    >
      <Download className={icon} />
    </button>
  );
}
