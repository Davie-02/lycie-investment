interface AdminPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function AdminPagination({ page, pageSize, total, onPageChange }: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <nav className="admin-pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn-ghost"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span className="text-muted mono">
        Page {page} of {totalPages} ({total} total)
      </span>
      <button
        type="button"
        className="btn-ghost"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
