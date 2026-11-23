import { Button } from '../../../components/ui/Button';
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, pageSize, total, onChange, noun = 'records' }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="p-3 border-t border-[var(--color-border)] flex items-center justify-between text-[13px] text-[var(--color-text-muted)]">
      <span>
        Showing {from} to {to} of {total} {noun}
      </span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" iconOnly type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page" className="">
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="px-2 font-semibold text-[var(--color-text)]">
          {page} / {totalPages}
        </span>
        <Button size="sm" variant="outline" iconOnly type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page" className="">
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
