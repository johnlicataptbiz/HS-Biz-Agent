import React, { useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PageSizeOption = number;

function clampPage(page: number, totalPages: number) {
  if (!Number.isFinite(page) || page < 1) return 1;
  if (!Number.isFinite(totalPages) || totalPages < 1) return 1;
  return Math.min(page, totalPages);
}

function getPageItems(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items = new Set<number>([1, total, current]);
  for (let delta = 1; delta <= 2; delta++) {
    if (current - delta > 1) items.add(current - delta);
    if (current + delta < total) items.add(current + delta);
  }
  return Array.from(items).sort((a, b) => a - b);
}

export default function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  pageSizeOptions = [10, 15, 20, 50],
  onPageSizeChange,
  className = '',
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: PageSizeOption[];
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil((totalItems || 0) / Math.max(1, pageSize || 1)));

  useEffect(() => {
    const clamped = clampPage(page, totalPages);
    if (clamped !== page) onPageChange(clamped);
  }, [page, totalPages, onPageChange]);

  const start = totalItems === 0 ? 0 : (clampPage(page, totalPages) - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(totalItems, clampPage(page, totalPages) * pageSize);

  const pages = useMemo(() => getPageItems(clampPage(page, totalPages), totalPages), [page, totalPages]);

  if (totalItems <= pageSize && totalPages <= 1 && !onPageSizeChange) return null;

  return (
    <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${className}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
        Showing <span className="text-slate-300">{start}</span>–<span className="text-slate-300">{end}</span> of{' '}
        <span className="text-slate-300">{totalItems}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-end">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
            Per page
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="glass-button px-3 py-2 text-slate-300 text-[10px] font-extrabold uppercase tracking-widest"
              aria-label="Items per page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt} className="bg-white">
                  {opt}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          onClick={() => onPageChange(clampPage(page - 1, totalPages))}
          disabled={page <= 1}
          className="glass-button px-3 py-2 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            const prev = idx > 0 ? pages[idx - 1] : null;
            const showEllipsis = prev !== null && p - prev > 1;
            return (
              <React.Fragment key={p}>
                {showEllipsis && (
                  <span className="px-2 text-slate-600 text-xs font-bold select-none" aria-hidden="true">
                    …
                  </span>
                )}
                <button
                  onClick={() => onPageChange(p)}
                  className={`px-3 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-colors border ${
                    p === page
                      ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200'
                      : 'glass-button border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(clampPage(page + 1, totalPages))}
          disabled={page >= totalPages}
          className="glass-button px-3 py-2 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
