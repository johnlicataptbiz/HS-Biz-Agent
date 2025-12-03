import React from 'react';

interface PaginatedListProps<T> {
  items: T[];
  pageSize?: number;
  page: number;
  onPageChange: (p: number) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
}

// Simple, reusable client-side pagination control
export function PaginatedList<T>({ items, pageSize = 10, page, onPageChange, renderItem }: PaginatedListProps<T>) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const start = (page - 1) * pageSize;
  const current = items.slice(start, start + pageSize);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {current.map((it, idx) => (
          <div key={start + idx}>{renderItem(it, start + idx)}</div>
        ))}
        {current.length === 0 && (
          <div className="text-center text-slate-500 py-8">No items</div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">Page {page} of {totalPages}</div>
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

