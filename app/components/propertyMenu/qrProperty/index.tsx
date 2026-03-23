import QRCode from "react-qr-code";
import useConfig from "~/components/config";

type PropertyProps = {
    id: string;
}

const QRProperty = (props: PropertyProps) => {
    const config = useConfig();
    let url = config("TRIGGER_URL");

    return (
        <div className={"property-menu-input-row"} key={props.id}>
            <div className={"qr-code-container"}>
                <QRCode
                    size={256}
                    value={url + "/qr/" + props.id}
                    style={{height: "auto", maxWidth: "100%", width: "100%", padding: "10px"}}
                    id={props.id + "-img"} />
                <pre style={{fontSize: "10px", wordBreak: "break-all", whiteSpace: "pre-wrap", color: "rgba(255,255,255,0.5)"}}>
                    {url + "/qr/" + props.id}
                </pre>
            </div>
        </div>
    )
}

export default QRProperty;
