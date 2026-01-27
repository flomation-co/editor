import "./index.css"
import type {NavItem} from "~/types";
import logo from "./flomation-wordtype-small-white.png";
import {Link} from "react-router";
import {ProfileBall} from "~/components/profileBall";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faArrowRightFromBracket, faGear} from "@fortawesome/pro-solid-svg-icons";
import useConfig from "~/components/config";
import {useEffect, useState} from "react";
import {Tooltip} from "react-tooltip";

type HorizontalProps = {
    items?: NavItem[]
}

export function HorizontalNav(props: HorizontalProps) {
    const config = useConfig()
    const [ logoutUrl, setLogoutUrl ] = useState<string>()

    useEffect(() => {
        setLogoutUrl(config("LOGIN_URL") + "/logout")
    }, []);

    return (
        <div className={"horizontal-nav"}>
            <Link to={"/"}><img src={logo} alt={""} className={"flo-logo"} /></Link>
            <div className={"nav-menu-items"}>
                {props.items?.map((item) => (
                    <div key={item.name} className={"horizontal-nav-item"}>
                        {item.value}
                    </div>
                ))}
            </div>
            <Link to={"/profile"} data-tooltip-id={"tooltip-nav-settings"} data-tooltip-content={"Settings"} data-tooltip-place={"bottom"}>
                <ProfileBall />
                <Tooltip id={"tooltip-nav-settings"} />
            </Link>

            <a href={logoutUrl} data-tooltip-id={"tooltip-nav-logout"} data-tooltip-content={"Logout"} data-tooltip-place={"bottom-left"}>
                <div className={"profile-ball"}>
                    <div className={"profile-pic"}>
                        <div className={"profile-pic-name"}>
                            <FontAwesomeIcon icon={faArrowRightFromBracket} />
                            <Tooltip id={"tooltip-nav-logout"}/>
                        </div>
                    </div>
                </div>
            </a>
        </div>
    )
}