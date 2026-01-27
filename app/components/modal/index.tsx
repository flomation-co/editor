import "./index.css"
import React, {useEffect, useState} from "react";

type ButtonActionProps = {
    label: string;
    primary: boolean;
    onClick: () => void;
}

type ModalProps = {
    label: string,
    footerMessage?: string,
    visible: boolean
    children?: any
    canDismiss?: boolean
    onDismiss?: () => void;
    actions?: ButtonActionProps[];
}

export default function Modal(props : ModalProps) {
    const [ isVisible, setIsVisible ] = useState<boolean>(props.visible);

    function handleDismiss(e) {
        e.stopPropagation();
        e.preventDefault();

        if (props.canDismiss) {
            if (props.onDismiss) {
                props.onDismiss();
            }

            setIsVisible(false);
        }
    }

    return (
        <>
            {isVisible && (
                <div className={"modal-background"} onClick={(e) => {handleDismiss(e)}}>
                    <div className={"property-menu"} >
                        <>
                            <div className={"property-menu-title"}>{props.label}</div>
                            <div className={"property-divider"}></div>
                            <div className={"modal-body"}>
                                {props.children}
                            </div>
                            {/*<div className={"property-divider"}></div>*/}
                            <>
                                <div className={"modal-footer-text"}>
                                    {props.footerMessage && (
                                        <>{props.footerMessage}</>
                                    )}
                                </div>
                                <div className={"modal-footer-actions"}>
                                    {props.canDismiss && (
                                        <button>Close</button>
                                    )}

                                    {props.actions?.map((action, idx) => {
                                        return (
                                            <button key={idx} onClick={action.onClick} className={action.primary ? "modal-button-primary" : "modal-button"}>{action.label}</button>
                                        )
                                    })}
                                </div>
                            </>
                        </>
                    </div>
                </div>
            )}
        </>
    )
}