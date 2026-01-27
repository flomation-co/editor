import {useEffect, useState} from "react";
import {Tooltip} from "react-tooltip";

export enum ExecutionStateValue {
    'created',
    'allocated',
    'running',
    'executed'
}

export enum CompletionStateValue {
    'unknown',
    'success',
    'fail',
    'cancel'
}

type ExecutionStateProps = {
    state: ExecutionStateValue
    completionState?: CompletionStateValue
};

const ExecutionLabels = [
    'Queued',
    'Allocated',
    'Running',
    'Executed'
];

const CompletionLabels = [
    'Pending',
    'Success',
    'Failed',
    'Cancelled'
];

const ExecutionTooltips = [
    "The execution has been created and is awaiting allocation to a runner",
    "The execution has been allocated to a runner, the flow should begin shortly",
    "The flow is running",
    "The flow has finished"
];

const CompletionTooltips = [
    "The execution is pending",
    "The execution has completed successfully",
    "The execution has failed",
    "The execution has been cancelled"
];

export function ExecuteState(props : ExecutionStateProps) {
    const [ stateClass, setStateClass ] = useState("execution-state-label execution-state-created");
    const [ stateLabel, setStateLabel ] = useState("Created");
    const [ tooltipValue, setTooltipValue ] = useState("Test");

    useEffect(() => {
        setTooltipValue(CompletionTooltips[CompletionStateValue[props.completionState]]);

        switch (ExecutionStateValue[props.state]) {
            case ExecutionStateValue.executed:
                setStateLabel(CompletionLabels[CompletionStateValue[props.completionState]]);
                switch (CompletionStateValue[props.completionState]) {
                    case CompletionStateValue.unknown:
                        setStateClass("execution-state-label execution-state-created")
                        break;

                    case CompletionStateValue.success:
                        setStateClass("execution-state-label execution-state-success")
                        break;

                    case CompletionStateValue.fail:
                        setStateClass("execution-state-label execution-state-failed")
                        break;

                    case CompletionStateValue.cancel:
                        setStateClass("execution-state-label execution-state-cancelled")
                        break;
                }

                break;

            case ExecutionStateValue.running:
                setStateLabel(ExecutionLabels[ExecutionStateValue[props.state]]);
                setStateClass("execution-state-label execution-state-running");
                break;

            default:
                setStateLabel(ExecutionLabels[ExecutionStateValue[props.state]]);
                setStateClass("execution-state-label execution-state-created");
        }
    }, [props.state, props.completionState, stateLabel, stateClass]);

    return (
        <>
            <span className={stateClass} data-tooltip-id={"execution-state-tooltip"} data-tooltip-content={tooltipValue} data-tooltip-place={"bottom"}>{stateLabel}</span>
            <Tooltip id={"execution-state-tooltip"} />
        </>
    )
}