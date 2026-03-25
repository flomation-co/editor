import "./index.css"
import {useEffect, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faArrowLeft, faArrowRight} from "@fortawesome/free-solid-svg-icons";

export type PaginationControlsProps = {
    pageSize?: number,
    totalCount?: number,
    currentPage?: number,
    onPageChange?: (offset: number, limit: number) => void,
    disableLeftPagination?: boolean,
    disableRightPagination?: boolean,
}

export function PaginationControls(props : PaginationControlsProps) {
    const [ pageSize, setPageSize ] = useState<number>(props.pageSize | 10)
    const [ currentPage, setCurrentPage ] = useState<number>(props.currentPage | 1)

    function handlePageLeft() {
        if (currentPage > 1) {
            setCurrentPage(currentPage-1)
        }
    }

    function handlePageRight() {
        if (!props.totalCount || (currentPage < Math.ceil(props.totalCount / pageSize))) {
            setCurrentPage(currentPage+1)
        }
    }

    useEffect(() => {
        if (props.onPageChange) {
            props.onPageChange(currentPage-1, pageSize)
        }
    }, [currentPage]);

    const totalPages = props.totalCount ? Math.ceil(props.totalCount / pageSize) : 0;

    // Build condensed page numbers: always show first, last, current, and neighbours
    const getVisiblePages = (): (number | 'ellipsis')[] => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const pages: (number | 'ellipsis')[] = [];
        pages.push(1);

        if (currentPage > 3) {
            pages.push('ellipsis');
        }

        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        if (currentPage < totalPages - 2) {
            pages.push('ellipsis');
        }

        pages.push(totalPages);

        return pages;
    };

    return (
        <div className={"pagination-container"}>
            <div className={"pagination-controls"}>
                <button className={props.disableLeftPagination || currentPage < 2 ? "pagination-button-disabled" : "pagination-button"} disabled={props.disableLeftPagination || currentPage < 2} onClick={() => {handlePageLeft()}}><FontAwesomeIcon icon={faArrowLeft} /></button>

                {totalPages > 0 && (
                    <>
                        {getVisiblePages().map((page, idx) => {
                            if (page === 'ellipsis') {
                                return <span key={`ellipsis-${idx}`} className="pagination-ellipsis">&hellip;</span>;
                            }
                            return (
                                <button key={page} className={page === currentPage ? "pagination-button pagination-button-active" : "pagination-button"} onClick={() => {setCurrentPage(page)}}>{page}</button>
                            );
                        })}
                    </>
                )}

                {!props.totalCount && (
                    <>
                        <button className={"pagination-button pagination-button-active"}>{currentPage}</button>
                    </>
                )}

                <button className={props.disableRightPagination || currentPage >= totalPages ? "pagination-button-disabled" : "pagination-button"} disabled={props.disableRightPagination || currentPage >= totalPages} onClick={() => {handlePageRight()}}><FontAwesomeIcon icon={faArrowRight} /></button>
            </div>
        </div>
    )
}
