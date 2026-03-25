import {HorizontalNav} from "~/components/nav/horizontal";
import {VerticalNav} from "~/components/nav/vertical";
import FeedbackButton from "~/components/feedback";
import {useState} from "react";

type ContainerProps = {
    children: any,
    noPadding?: boolean
    active?: string
    onClick?: () => void
}

export default function Container(props: ContainerProps) {
    const handleClick = (e) => {

        if (props.onClick) {
            props.onClick();
        }
    }

    return (
        <div className={"page-row-container"} onClick={handleClick}>
            <HorizontalNav></HorizontalNav>
            <div className={"page-column-container"}>
                <VerticalNav></VerticalNav>
                <div className={"page-container"}>
                    {props.noPadding && (
                        <>
                            {props.children}
                        </>
                    )}

                    {!props.noPadding && (
                        <div className={"flo-container"}>
                            {props.children}
                        </div>
                    )}
                </div>
            </div>
            <FeedbackButton />
        </div>
    )
}

