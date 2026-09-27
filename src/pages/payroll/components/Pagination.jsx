import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, pageSize, total, onChange, noun = 'records' }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="p-3 border-t border-[#e2e9da] flex items-center justify-between text-[13px] text-[#7d8e70]">
      <span>
        Showing {from} to {to} of {total} {noun}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
          className="p-1.5 rounded-md border border-[#e2e9da] hover:bg-[#f8faf5] disabled:opacity-40"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="px-2 font-semibold text-[#3e5432]">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
          className="p-1.5 rounded-md border border-[#e2e9da] hover:bg-[#f8faf5] disabled:opacity-40"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
