import "./index.css"
import React, {useEffect, useState} from "react";

type ButtonActionProps = {
    label: string;
    primary: boolean;
    variant?: 'primary' | 'danger';
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
    // dismissLabel overrides the auto-injected dismiss button's
    // label. Defaults to "Cancel" so existing callers (delete
    // confirmations, etc.) keep their current copy. Read-only
    // modals can pass "Close" so the affordance reads as a plain
    // dismiss rather than a back-out-of-action.
    dismissLabel?: string;
    // className adds an extra class to the modal panel — used to opt a specific
    // modal into a wider/custom layout (e.g. the two-column AWS permissions editor).
    className?: string;
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

    function getButtonClass(action: ButtonActionProps) {
        if (action.variant === 'danger') return 'modal-btn-danger';
        if (action.primary) return 'modal-btn-primary';
        return 'modal-btn-secondary';
    }

    return (
        <>
            {isVisible && (
                <div className="modal-overlay" onClick={(e) => {handleDismiss(e)}}>
                    <div className={`modal-panel${props.className ? ' ' + props.className : ''}`} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{props.label}</div>
                            {props.canDismiss && (
                                <button className="modal-close-btn" onClick={(e) => handleDismiss(e)}>&times;</button>
                            )}
                        </div>
                        <div className="modal-body">
                            {props.children}
                        </div>
                        {props.footerMessage && (
                            <div className="modal-footer-text">
                                {props.footerMessage}
                            </div>
                        )}
                        <div className="modal-footer">
                            {props.canDismiss && (
                                <button className="modal-btn-secondary" onClick={(e) => handleDismiss(e)}>
                                    {props.dismissLabel ?? "Cancel"}
                                </button>
                            )}

                            {props.actions?.map((action, idx) => {
                                return (
                                    <button key={idx} onClick={action.onClick} className={getButtonClass(action)}>{action.label}</button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
