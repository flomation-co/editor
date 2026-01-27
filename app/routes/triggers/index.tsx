import type {Route} from "../+types/home";
import Container from "~/components/container";
import "./index.css"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPencil, faWifi} from "@fortawesome/free-solid-svg-icons";
import {Link} from "react-router";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Triggers" },
        { name: "description", content: "Get in the Flo" },
    ];
}

export default function Triggers() {
    return (
        <Container>
            <div className={"header"}>Triggers</div>

            <div className={"search-section"}>
                <input type={"text"} className={"search-textbox"} placeholder={"Search..."} onChange={(e) => handleUpdateSearch(e.target.value)}/>
            </div>
            <table className={"flo-table"}>
                <thead className={"flo-table-head"}>
                <tr>
                    <th>Name</th>
                    <th className={"table-column-hide-sm"}>Type</th>
                    <th className={"table-column-hide-sm"}>Last Invoked</th>
                    <th>Actions</th>
                </tr>
                </thead>
                <tbody>
                <tr className={"flo-table-row"}>
                    <td>Watch Folder<span className={"flo-table-subtext"}>Premium</span></td>
                    <td className={"table-column-hide-sm"}>Google Drive / On File Change</td>
                    <td className={"table-column-hide-sm"}>A few moments ago</td>
                    <td>
                        <Link to={{pathname: "/"}}>
                            <FontAwesomeIcon icon={faPencil}/>
                        </Link>
                    </td>
                </tr>
                <tr className={"flo-table-row"}>
                    <td>Incoming Webhook<span className={"flo-table-subtext"}></span></td>
                    <td className={"table-column-hide-sm"}>Incoming Webhook</td>
                    <td className={"table-column-hide-sm"}>Yesterday</td>
                    <td>
                        <Link to={{pathname: "/"}}>
                            <FontAwesomeIcon icon={faPencil}/>
                        </Link>
                    </td>
                </tr>
                </tbody>
            </table>
        </Container>
    )
}