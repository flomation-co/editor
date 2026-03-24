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
                    <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
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
                                <button className="modal-btn-secondary" onClick={(e) => handleDismiss(e)}>Cancel</button>
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
