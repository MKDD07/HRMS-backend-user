import { Button } from './Button';
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  className = ''
}) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return (
    <div className={`pagination ${className}`}>
      <div className="pagination__info">
        Showing <span className="font-semibold text-slate-200">{startItem}</span> to{' '}
        <span className="font-semibold text-slate-200">{endItem}</span> of{' '}
        <span className="font-semibold text-slate-200">{totalItems}</span> entries
      </div>

      <div className="pagination__controls">
        <Button type="button" className="pagination__btn" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Previous page" variant="outline" wrapContent={false} iconOnly={true} size="sm">
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {pages.map((p) => (
          <Button key={p} type="button" className={`pagination__btn ${currentPage === p ? 'pagination__btn--active' : ''}`} onClick={() => onPageChange(p)} variant={currentPage === p ? "colored" : "fadeout"} wrapContent={false}>
            {p}
          </Button>
        ))}

        <Button type="button" className="pagination__btn" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} aria-label="Next page" variant="outline" wrapContent={false} iconOnly={true} size="sm">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
