import React from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { Button } from './Button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className = '',
}) => {
  if (totalItems === 0) {
    return null;
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-2 text-xs text-[#8a8f98] border-t border-white/[0.06] ${className}`}
      aria-label="Pagination"
    >
      <div className="font-mono">
        Showing <span className="text-[#f7f8f8] font-medium">{startItem}</span>–<span className="text-[#f7f8f8] font-medium">{endItem}</span> of{' '}
        <span className="text-[#f7f8f8] font-medium">{totalItems}</span> items
      </div>

      <div className="flex items-center gap-2">
        <span className="mr-2 font-mono">
          Page <span className="text-[#f7f8f8] font-medium">{currentPage}</span> of{' '}
          <span className="text-[#f7f8f8] font-medium">{Math.max(1, totalPages)}</span>
        </span>

        <Button
          variant="utility"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          icon={<CaretLeft size={14} weight="bold" />}
          aria-label="Previous page"
        >
          Prev
        </Button>

        <Button
          variant="utility"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          icon={<CaretRight size={14} weight="bold" />}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
