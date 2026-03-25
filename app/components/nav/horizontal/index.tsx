import "./index.css"
import type {NavItem} from "~/types";
import logo from "./flomation-wordtype-small-white.png";
import {Link, useNavigate} from "react-router";
import {ProfileBall} from "~/components/profileBall";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faArrowRightFromBracket, faChevronDown, faUser, faBriefcase} from "@fortawesome/pro-solid-svg-icons";
import useConfig from "~/components/config";
import {useEffect, useRef, useState} from "react";
import {Tooltip} from "react-tooltip";
import {useOrganisation} from "~/context/organisation/use";

type HorizontalProps = {
    items?: NavItem[]
}

export function HorizontalNav(props: HorizontalProps) {
    const navigate = useNavigate();
    const config = useConfig()
    const [ logoutUrl, setLogoutUrl ] = useState<string>()
    const [ showOrgMenu, setShowOrgMenu ] = useState(false)
    const orgMenuRef = useRef<HTMLDivElement>(null)
    const { organisations, currentOrg, setCurrentOrg, isOrgMode } = useOrganisation()

    useEffect(() => {
        setLogoutUrl(config("LOGIN_URL") + "/logout")
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (orgMenuRef.current && !orgMenuRef.current.contains(e.target as Node)) {
                setShowOrgMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className={"horizontal-nav"}>
            <Link to={"/"}><img src={logo} alt={""} className={"flo-logo"} /></Link>

            <div className={"org-switcher"} ref={orgMenuRef}>
                <button className={"org-switcher-button"} onClick={() => setShowOrgMenu(!showOrgMenu)}>
                    <FontAwesomeIcon icon={isOrgMode ? faBriefcase : faUser} className={"org-switcher-icon"} />
                    <span className={"org-switcher-label"}>{currentOrg ? currentOrg.name : "Personal"}</span>
                    <FontAwesomeIcon icon={faChevronDown} className={"org-switcher-chevron"} />
                </button>

                {showOrgMenu && (
                    <div className={"org-switcher-menu"}>
                        <div
                            className={`org-switcher-item ${!isOrgMode ? "active" : ""}`}
                            onClick={() => { setCurrentOrg(null); setShowOrgMenu(false); }}
                        >
                            <FontAwesomeIcon icon={faUser} className={"org-switcher-item-icon"} />
                            <span>Personal</span>
                        </div>
                        {organisations.map(org => (
                            <div
                                key={org.id}
                                className={`org-switcher-item ${currentOrg?.id === org.id ? "active" : ""}`}
                                onClick={() => { setCurrentOrg(org); setShowOrgMenu(false); }}
                            >
                                <FontAwesomeIcon icon={faBriefcase} className={"org-switcher-item-icon"} />
                                <span>{org.name}</span>
                                <span className={"org-switcher-role"}>{org.role}</span>
                            </div>
                        ))}
                        {!isOrgMode && (
                            <>
                                <div className={"org-switcher-divider"} />
                                <div
                                    className={"org-switcher-item org-switcher-item--create"}
                                    onClick={() => { setShowOrgMenu(false); navigate("/organisation"); }}
                                >
                                    <span>Create New Organisation...</span>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

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
