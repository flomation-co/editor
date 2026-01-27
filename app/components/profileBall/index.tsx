import "./index.css"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faGear} from "@fortawesome/pro-solid-svg-icons";

export function ProfileBall() {
    return (
        <div className={"profile-ball"}>
            <div className={"profile-pic"}>
                <div className={"profile-pic-name"}>
                    <FontAwesomeIcon icon={faGear} />
                </div>
            </div>
        </div>
    )
}