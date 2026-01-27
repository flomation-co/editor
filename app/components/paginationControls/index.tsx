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
        console.log("Current Page", currentPage);
        if (props.onPageChange) {
            props.onPageChange(currentPage-1, pageSize)
        }
    }, [currentPage]);

    return (
        <div className={"pagination-container"}>
            <div className={"pagination-controls"}>
                <button className={props.disableLeftPagination || currentPage < 2 ? "pagination-button-disabled" : "pagination-button"} disabled={props.disableLeftPagination || currentPage < 2} onClick={() => {handlePageLeft()}}><FontAwesomeIcon icon={faArrowLeft} /></button>

                {props.totalCount && (
                    <>
                        {[...Array(Math.ceil(props.totalCount / pageSize)).keys()].map(key => {
                            return (
                                <button key={key} className={key+1 === currentPage ? "pagination-button pagination-button-active" : "pagination-button"} onClick={() => {setCurrentPage(key+1)}} >{key+1}</button>
                            )
                        })}
                    </>
                )}

                {!props.totalCount && (
                    <>
                        <button className={"pagination-button pagination-button-active"}>{currentPage}</button>
                    </>
                )}

                <button className={props.disableRightPagination || currentPage >= (props.totalCount && Math.ceil(props.totalCount / pageSize)) ? "pagination-button-disabled" : "pagination-button"} disabled={props.disableRightPagination || currentPage >= (props.totalCount && Math.ceil(props.totalCount / pageSize))} onClick={() => {handlePageRight()}}><FontAwesomeIcon icon={faArrowRight} /></button>
            </div>
        </div>
    )
}