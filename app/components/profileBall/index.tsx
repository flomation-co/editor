import "./index.css"
import { Icon } from "~/components/icons/Icon";

export function ProfileBall() {
    return (
        <div className={"profile-ball"}>
            <div className={"profile-pic"}>
                <div className={"profile-pic-name"}>
                    <Icon name="gear" />
                </div>
            </div>
        </div>
    )
}