import React, {useState} from "react";
import QRCode from "react-qr-code";
import useConfig from "~/components/config";
import type {Trigger} from "~/types";
import "./index.css";
import { Icon } from "~/components/icons/Icon";

type Props = {
    node: any;
    triggers?: Trigger[];
}

const TriggerURLProperty = (props: Props) => {
    const config = useConfig();
    const [copied, setCopied] = useState(false);

    const nodeLabel = props.node?.data?.label || "";
    const nodeType = props.node?.data?.config?.type;

    // Only render for trigger nodes (type 1)
    if (nodeType !== 1) return null;

    // Map node label to trigger type name
    const typeName = nodeLabel.replace("trigger/", "").replace(/_/g, "-");

    // Find the matching trigger from the flow's triggers
    const trigger = props.triggers?.find(t => t.type_name === typeName);
    if (!trigger) {
        return (
            <div className="trigger-url-section">
                <div className="trigger-url-hint">
                    Save this flow to generate the trigger URL
                </div>
            </div>
        );
    }

    const launchUrl = config("TRIGGER_URL") || config("LAUNCH_URL") || "";
    let triggerUrl = "";
    let triggerPath = "";
    let showQR = false;
    let showSnippet = false;
    let snippetCode = "";

    switch (typeName) {
        case "webhook":
            triggerPath = `/webhook/${trigger.id}`;
            triggerUrl = launchUrl + triggerPath;
            break;
        case "qr":
            triggerPath = `/qr/${trigger.id}`;
            triggerUrl = launchUrl + triggerPath;
            showQR = true;
            break;
        case "form":
            triggerPath = `/form/${trigger.id}`;
            triggerUrl = launchUrl + triggerPath;
            break;
        case "image":
            triggerPath = `/image/${trigger.id}`;
            triggerUrl = launchUrl + triggerPath;
            showSnippet = true;
            snippetCode = `<img src="${triggerUrl}" width="1" height="1" alt="" style="display:none" />`;
            break;
        default:
            return null;
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="trigger-url-section">
            <div className="trigger-url-label">Trigger URL</div>
            <div className="trigger-url-box">
                <code className="trigger-url-text">{triggerUrl}</code>
                <button className="trigger-url-copy" onClick={() => copyToClipboard(triggerUrl)}>
                    <Icon name={copied? "check" : "copy"} />
                </button>
            </div>

            {showQR && (
                <div className="trigger-qr-container">
                    <QRCode
                        size={180}
                        value={triggerUrl}
                        style={{height: "auto", maxWidth: "100%", width: "100%", padding: "10px", background: "#fff", borderRadius: "8px"}}
                    />
                </div>
            )}

            {showSnippet && (
                <>
                    <div className="trigger-url-label" style={{marginTop: "10px"}}>Embed Code</div>
                    <div className="trigger-url-box">
                        <code className="trigger-url-text">{snippetCode}</code>
                        <button className="trigger-url-copy" onClick={() => copyToClipboard(snippetCode)}>
                            <Icon name={copied? "check" : "copy"} />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default TriggerURLProperty;
