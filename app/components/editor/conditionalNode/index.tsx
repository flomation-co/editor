import React, { memo, useCallback } from 'react';
import { Icon } from "~/components/icons/Icon";

export default memo(({ data, isConnectable }) => {
    return (
        <>
            <div className={"node-name"}>
                {data.config && data.config.name && (
                    <>
                        {data.config.name}
                    </>
                )}
            </div>

            {/* Node Type Specific Code here*/}

            {data.config && data.config.label && (
                <div className={"node-label"}>
                    {data.config.label}
                </div>
            )}
        </>
    );
});