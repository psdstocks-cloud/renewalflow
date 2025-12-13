import React from 'react';
import { Button } from './Button';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    // Simple pagination logic: show all if <= 7, else show start, end, and current window
    // For simplicity, showing all or a simplified version for now. 
    // Let's implement a smart visible pages logic.

    let visiblePages = pages;
    if (totalPages > 7) {
        if (currentPage <= 4) {
            visiblePages = [...pages.slice(0, 5), -1, totalPages];
        } else if (currentPage >= totalPages - 3) {
            visiblePages = [1, -1, ...pages.slice(totalPages - 5)];
        } else {
            visiblePages = [1, -1, currentPage - 1, currentPage, currentPage + 1, -1, totalPages];
        }
    }

    return (
        <div className="flex items-center justify-center gap-2 mt-6">
            <Button
                variant="secondary"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
            >
                <i className="fas fa-chevron-left"></i>
            </Button>

            {visiblePages.map((p, i) => (
                typeof p === 'number' && p > 0 ? (
                    <Button
                        key={p}
                        variant={p === currentPage ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => onPageChange(p)}
                        className={p === currentPage ? 'bg-violet-600' : ''}
                    >
                        {p}
                    </Button>
                ) : (
                    <span key={`ellipsis-${i}`} className="text-zinc-500 px-2">...</span>
                )
            ))}

            <Button
                variant="secondary"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
            >
                <i className="fas fa-chevron-right"></i>
            </Button>
        </div>
    );
};
