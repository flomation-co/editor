import {HorizontalNav} from "~/components/nav/horizontal";
import {VerticalNav} from "~/components/nav/vertical";
import FeedbackButton from "~/components/feedback";
import HelpPane, {type HelpContent} from "~/components/helpPane";

type ContainerProps = {
    children: any,
    noPadding?: boolean
    active?: string
    onClick?: () => void
    /**
     * Optional plain-English description of the page, shown in a collapsible
     * right-hand help pane. This is the standard way to describe a page: pass
     * `help` and the pane fills the otherwise-empty right rail. Only applies to
     * the padded layout (not `noPadding` full-bleed pages like the flow canvas).
     */
    help?: HelpContent
}

export default function Container(props: ContainerProps) {
    const handleClick = () => {
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

                    {!props.noPadding && props.help && (
                        <div className={"flo-container flo-container--with-help"}>
                            <div className={"help-main"}>
                                {props.children}
                            </div>
                            <HelpPane {...props.help} />
                        </div>
                    )}

                    {!props.noPadding && !props.help && (
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
