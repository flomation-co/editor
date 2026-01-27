import React, { memo, useCallback } from 'react';
import {library} from '@fortawesome/fontawesome-svg-core'
import {fas} from '@fortawesome/pro-solid-svg-icons'
import {fab} from '@fortawesome/free-brands-svg-icons'

// RG: PERFORMANCE IMPROVEMENT: add the fontawesome icons to the library outside of the node so not to re-add on every render
library.add(fab, fas);

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