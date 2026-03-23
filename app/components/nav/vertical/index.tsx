import "./index.css"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleExclamation, faCubesStacked, faChartColumn, faLandmark, faPersonRunning, faBriefcase, faPeoplePulling, faHouse, faArrowsSplitUpAndLeft, faPlay, faBoltLightning, faPlug, faFeed, faPieChart, faLifeRing, faPeopleGroup, faCheckCircle, faBook } from '@fortawesome/free-solid-svg-icons'

import {Link, NavLink, useNavigate} from "react-router";
import {useEffect, useState} from "react";
import api from "~/lib/api";
import {faArrowUpRightFromSquare, faHourglassStart, faKey, faWrench} from "@fortawesome/pro-solid-svg-icons";
import {faDiscord} from "@fortawesome/free-brands-svg-icons";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {useOrganisation} from "~/context/organisation/use";
import {usePermissions} from "~/context/permissions/use";
import {PERMISSIONS} from "~/types";

type VerticalNavProps = {
    active?: string
}

const config = useConfig();
const API_URL = config("AUTOMATE_API_URL");
const DEFAULT_STATUS_INTERVAL = 5000;

export function VerticalNav(props: VerticalNavProps) {
    const navigate = useNavigate();
    const token = useCookieToken();

    const [ showAutomate, setShowAutomate ] = useState<boolean>(true);
    const [ showConfigure, setShowConfigure ] = useState<boolean>(true);
    const { organisations } = useOrganisation();
    const { hasPermission } = usePermissions();
    const [ showManage, setShowManage ] = useState<boolean>(false);
    const [ showAdminister, setShowAdminister ] = useState<boolean>(false);
    const [ currentlyActive, setCurrentlyActive ] = useState(props.active);
    const [ isStatusGood, setIsStatusGood ] = useState<boolean>(false);
    const [ isStatusPending, setIsStatusPending ] = useState<boolean>(true);

    useEffect(() => {
        setShowManage(true);
    }, [organisations]);

    function createNewFlo() {
        const config = useConfig();
        let url = config("AUTOMATE_API_URL");
        api.post(url + '/api/v1/flo', {
            "name": "Untitled Flo"
        }, {
            headers: {
                'Content-Type': 'application/json',
                "Authorization": "Bearer " + token
            }
        })
            .then(response => {
                if (response) {
                    const flo_id = response.data.id;
                    navigate("/flo/" + flo_id);
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    const updateStatus = () => {
        api.get(API_URL + '/version')
            .then(() => {
                setIsStatusGood(true);
                setIsStatusPending(false);
            })
            .catch(() => {
                console.error("Unable to contact API server", API_URL);
                setIsStatusGood(false);
                setIsStatusPending(false);
            });
    }

    useEffect(() => {
        updateStatus();

        const interval = setInterval(() => {
            updateStatus();
        }, DEFAULT_STATUS_INTERVAL);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className={"vertical-nav"}>
            <div className={"vertical-nav-container"}>
                <div className={"vertical-nav-top-section"}>
                    <div className={"menu-section-list"}>
                        <NavLink to={"/"} className={currentlyActive == "dashboard" ? "menu-section-list-item menu-section-list-item-selected" : "menu-section-list-item"} onClick={() => {setCurrentlyActive("dashboard")}}><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faHouse}/></div><span className={"menu-section-list-item-label"}>Dashboard</span></NavLink>
                    </div>

                    {showAutomate && (
                        <>
                            <div className={"menu-section-header"}>Automate</div>
                            <div className={"menu-section-list"}>
                                <NavLink to={"/flow"} className={"menu-section-list-item"} onClick={() => {setCurrentlyActive("flows")}}><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faArrowsSplitUpAndLeft} /></div><span className={"menu-section-list-item-label"}>Flows</span></NavLink>
                                <NavLink to={"/execution"} className={"menu-section-list-item"} onClick={() => {setCurrentlyActive("execution")}}><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faPlay} /></div><span className={"menu-section-list-item-label"}>Executions</span></NavLink>
                            </div>
                        </>
                    )}

                    {showConfigure && (
                        <>
                            <div className={"menu-section-header"}>Configure</div>
                            <div className={"menu-section-list"}>
                                {(hasPermission(PERMISSIONS.ENVIRONMENT_VIEW) || hasPermission(PERMISSIONS.ENVIRONMENT_MANAGE)) && (
                                    <NavLink to={"/environment"} className={"menu-section-list-item"}><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faWrench} /></div><span className={"menu-section-list-item-label"}>Environments</span></NavLink>
                                )}
                                {(hasPermission(PERMISSIONS.RUNNER_VIEW) || hasPermission(PERMISSIONS.RUNNER_MANAGE)) && (
                                    <NavLink to={"/runner"} className={"menu-section-list-item"}><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faPersonRunning} /></div><span className={"menu-section-list-item-label"}>Runners</span></NavLink>
                                )}
                                {hasPermission(PERMISSIONS.RUNNER_MANAGE) && (
                                    <NavLink to={"/queue"} className={"menu-section-list-item"}><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faCubesStacked} /></div><span className={"menu-section-list-item-label"}>Queues</span></NavLink>
                                )}
                            </div>
                        </>
                    )}

                    {showManage && (
                        <>
                            <div className={"menu-section-header"}>Manage</div>
                            <div className={"menu-section-list"}>
                                {(hasPermission(PERMISSIONS.ORGANISATION_VIEW) || hasPermission(PERMISSIONS.ORGANISATION_MANAGE)) && (
                                    <NavLink to={"/organisation"} className={"menu-section-list-item"}><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faBriefcase} /></div><span className={"menu-section-list-item-label"}>Organisation</span></NavLink>
                                )}
                                {hasPermission(PERMISSIONS.ORGANISATION_MANAGE) && (
                                    <NavLink to={"/team"} className={"menu-section-list-item"}><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faPeoplePulling} /></div><span className={"menu-section-list-item-label"}>Groups</span></NavLink>
                                )}
                                {/*<NavLink to={"/usage"} className={"menu-section-list-item"}><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faPieChart} /></div><span className={"menu-section-list-item-label"}>Usage</span></NavLink>*/}
                            </div>
                        </>
                    )}

                    {showAdminister && (
                        <>
                            <div className={"menu-section-header"}>Administer</div>
                            <div className={"menu-section-list"}>
                                <NavLink to={"/customers"} className={"menu-section-list-item"}><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faLandmark} /></div><span className={"menu-section-list-item-label"}>Customers</span></NavLink>
                                <NavLink to={"/report"} className={"menu-section-list-item"}><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faChartColumn} /></div><span className={"menu-section-list-item-label"}>Reports</span></NavLink>
                            </div>
                        </>
                    )}
                </div>

                <div className={"vertical-nav-bottom-section"}>
                    {hasPermission(PERMISSIONS.FLOW_CREATE) && (
                        <a className={"menu-section-button"} onClick={() => {createNewFlo()}}>New Flow</a>
                    )}

                    <div className={"menu-section-list"}>
                        {/*<NavLink to={"/docs"} className={"menu-section-list-item"}><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faBook}/></div><span className={"menu-section-list-item-label"}>Documentation</span></NavLink>*/}
                        {/*<NavLink to={"/support"} className={"menu-section-list-item"}><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faLifeRing} /></div><span className={"menu-section-list-item-label"}>Help &amp; Feedback</span></NavLink>*/}
                        <Link to={"https://discord.gg/y3Td3kw5tA"} className={"menu-section-list-item"} target={"_blank"}><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faDiscord} /></div><span className={"menu-section-list-item-label"}>Community <FontAwesomeIcon icon={faArrowUpRightFromSquare} /></span></Link>
                        <NavLink to={""} className={"menu-section-list-item"}>
                            <div className={"menu-section-list-icon"}>
                                {!isStatusPending && (
                                    <>
                                        {isStatusGood && (
                                            <FontAwesomeIcon icon={faCheckCircle} style={{color: "#0a0"}} />
                                        )}
                                        {!isStatusGood && (
                                            <FontAwesomeIcon icon={faCircleExclamation} style={{color: "#f00"}} />
                                        )}
                                    </>
                                )}
                                {isStatusPending && (
                                    <FontAwesomeIcon icon={faHourglassStart} style={{color: "#00ffd9"}} className={"spinner"} />
                                )}

                            </div>
                            <span className={"menu-section-list-item-label"}>System Status</span>
                        </NavLink>
                    </div>
                </div>
            </div>
        </div>
    )
}