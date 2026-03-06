import "./index.css"
import {useEffect, useState} from "react";

type LogOutputProps = {
    result? : object
}

export function LogOutput(props : LogOutputProps) {
    const [ lines, setLines ] = useState<object[]>()

    useEffect(() => {
        if (props && props.logs && props.logs.logs) {
            const lines = props.logs.logs.split("\n");

            let logs : object[] = [];

            for (let l = 0; l < lines.length; l++) {
                if (lines[l]) {
                    const log = JSON.parse(lines[l]);
                    logs.push(log)
                }
            }

            setLines(logs);
        }
    }, []);

    useEffect(() => {
        console.log("lines", lines);
    }, [ lines ]);

    return (
        <pre className={"code-block"}>
            {lines && lines?.map((line, index) => {
                return (
                    <div className={"log-" + line.level}>{line.time} {line.msg} {line.level == "error" ? "- " + line.error : ""}</div>
                )
            })}
        </pre>
    )
}