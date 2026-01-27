import React, { memo, useCallback, useMemo, type ChangeEvent } from 'react';
import {Handle, Position} from '@xyflow/react';

import type { NodeDefinition}  from "~/types";
import {library} from '@fortawesome/fontawesome-svg-core'
import {fas} from '@fortawesome/pro-solid-svg-icons'
import {fab} from '@fortawesome/free-brands-svg-icons'

import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {LabeledHandle} from "~/components/labeled-handle";
import { BaseNode } from "~/components/base-node";

// RG: PERFORMANCE IMPROVEMENT: add the fontawesome icons to the library outside of the node so not to re-add on every render
library.add(fab, fas);

const CustomNode = memo(({ data }: { data: NodeDefinition }) => {
    // RG: PERFORMANCE IMPROVEMENT: cache the icon so not to re-parse on every use
    const icon = useMemo(() => {
        try {
            return data?.config?.icon ? JSON.parse(data.config.icon) : undefined;
        } catch {
            return undefined;
        }
    }, [data?.config?.icon]);

    const onChange = useCallback((evt: ChangeEvent<HTMLInputElement>) => {
        console.log(data.config, evt.target.id, evt.target.value);
    }, []);

    const isRunning = data && data.config && data.running || false;

    return (
        <>
            <div className={"node-name"}>
                {data.config && data.config.name && (
                    <>
                        {data.config.name}
                    </>
                )}

                {data.config && data.config.label && (
                    <div className={"node-label"}>
                        {data.config.label}
                    </div>
                )}
            </div>

            {data && data.config && data.config.type == 1 && (
                <div className={"react-flow__node-input"}>
                    {data && data.config && data.config.icon && (
                        <div className={"node-collapsed-title" }>
                            <FontAwesomeIcon icon={icon} size={"3x"} />
                        </div>
                    )}

                    {data.config && data.config.outputs && data.config.outputs.length > 0 && (
                        <Handle type="source" position={Position.Right} />
                    )}
                </div>
            )}

            {data && data.config && data.config.type == 2 && (
                <div className={"react-flow__node-custom-node"}>
                    {data && data.config && data.config.inputs && data.config.inputs.length > 0 && (
                        <Handle type="target" position={Position.Left} />
                    )}

                    {data && data.config && data.config.icon && (
                        <div className={"node-collapsed-title" }>
                            <FontAwesomeIcon icon={icon} size={"3x"} />
                        </div>
                    )}

                    {data.config && data.config.outputs && data.config.outputs.length > 0 && (
                        <Handle type="source" position={Position.Right} />
                    )}
                </div>
            )}

            {data && data.config && data.config.type == 3 && (
                <div className={"react-flow__node-output"}>
                    {data && data.config && data.config.inputs && data.config.inputs.length > 0 && (
                        <Handle type="target" position={Position.Left} />
                    )}

                    {data && data.config && data.config.icon && (
                        <div className={"node-collapsed-title" }>
                            <FontAwesomeIcon icon={icon} size={"3x"} />
                        </div>
                    )}

                    {data.config && data.config.outputs && data.config.outputs.length > 0 && (
                        <Handle type="source" position={Position.Right} id={"input"}/>
                    )}
                </div>
            )}

            {data && data.config && data.config.type == 4 && (
                <div className={"react-flow__node-conditional"}>
                    {data && data.config && data.config.inputs && data.config.inputs.length > 0 && (
                        <Handle type="target" position={Position.Left} />
                    )}

                    {data && data.config && data.config.icon && (
                        <div className={"node-collapsed-title" }>
                            <FontAwesomeIcon icon={icon} size={"3x"} />
                        </div>
                    )}

                    {data.config && data.config.outputs && data.config.outputs.length > 0 && (
                        <div className={"handle-wrapper"}>
                            <LabeledHandle type="source" position={Position.Right} id={"true-branch"} title={"True"} />
                            <LabeledHandle type="source" position={Position.Right} id={"false-branch"} title={"False"} />
                        </div>
                    )}
                </div>
            )}

            {data && data.config && data.config.type == 5 && (
                <div className={"react-flow__node-looping"}>
                    {data && data.config && data.config.inputs && data.config.inputs.length > 0 && (
                        <Handle type="target" position={Position.Left} />
                    )}

                    {data && data.config && data.config.icon && (
                        <div className={"node-collapsed-title" }>
                            <FontAwesomeIcon icon={icon} size={"3x"} />
                        </div>
                    )}

                    {data.config && data.config.outputs && data.config.outputs.length > 0 && (
                        <>
                            <Handle type="source" position={Position.Bottom} id={"loop"} />
                            <Handle type="source" position={Position.Right} id={"output"} />
                        </>
                    )}
                </div>
            )}
        </>
    );
});

CustomNode.displayName = 'CustomNode';
export default CustomNode;