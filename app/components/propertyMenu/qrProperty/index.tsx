import QRCode from "react-qr-code";
import useConfig from "~/components/config";

type PropertyProps = {
    id: string;
}

const QRProperty = (props: PropertyProps) => {
    const config = useConfig();
    let url = config("TRIGGER_URL");

    return (
        <div className={"property-menu-input-row"} key={props.name}>
            <div className={"qr-code-container"}>
                <QRCode
                    size={256}
                    value={url + "/" + props.id}
                    style={{height: "autp", maxWidth: "100%", width: "100%", padding: "10px"}}
                    id={props.id + "-img"} />
                <pre>
                    {url + "/qr/" + props.id}
                </pre>
            </div>
        </div>
    )
}

export default QRProperty;