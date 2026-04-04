import "./index.css"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleExclamation, faCubesStacked, faChartColumn, faChartLine, faLandmark, faPersonRunning, faBriefcase, faPeoplePulling, faHouse, faArrowsSplitUpAndLeft, faPlay, faBoltLightning, faPlug, faFeed, faPieChart, faLifeRing, faPeopleGroup, faCheckCircle, faBook, faChevronLeft, faChevronRight, faRobot } from '@fortawesome/free-solid-svg-icons'

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
import {Tooltip} from "react-tooltip";

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
    const { organisations, isOrgMode } = useOrganisation();
    const { hasPermission } = usePermissions();
    const [ showManage, setShowManage ] = useState<boolean>(false);
    const [ showAdminister, setShowAdminister ] = useState<boolean>(false);
    const [ currentlyActive, setCurrentlyActive ] = useState(props.active);
    const [ isStatusGood, setIsStatusGood ] = useState<boolean>(false);
    const [ isStatusPending, setIsStatusPending ] = useState<boolean>(true);
    const [ collapsed, setCollapsed ] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('flomation-nav-collapsed') === 'true';
        }
        return false;
    });

    const toggleCollapsed = () => {
        setCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('flomation-nav-collapsed', String(next));
            return next;
        });
    };

    useEffect(() => {
        setShowManage(true);
    }, [organisations]);

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
        <div className={`vertical-nav ${collapsed ? 'vertical-nav--collapsed' : ''}`}>
            <div className={"vertical-nav-container"}>
                <div className={"vertical-nav-top-section"}>
                    <div className={"menu-section-list"}>
                        <NavLink to={"/"} className={currentlyActive == "dashboard" ? "menu-section-list-item menu-section-list-item-selected" : "menu-section-list-item"} onClick={() => {setCurrentlyActive("dashboard")}} data-tooltip-id="nav-tip" data-tooltip-content="Dashboard" data-tooltip-place="right"><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faHouse}/></div><span className={"menu-section-list-item-label"}>Dashboard</span></NavLink>
                    </div>

                    {showAutomate && (
                        <>
                            <div className={"menu-section-header"}>Automate</div>
                            <div className={"menu-section-list"}>
                                <NavLink to={"/flow"} className={"menu-section-list-item"} onClick={() => {setCurrentlyActive("flows")}} data-tooltip-id="nav-tip" data-tooltip-content="Flows" data-tooltip-place="right"><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faArrowsSplitUpAndLeft} /></div><span className={"menu-section-list-item-label"}>Flows</span></NavLink>
                                {hasPermission(PERMISSIONS.AGENT_VIEW) && (
                                    <NavLink to={"/agent"} className={"menu-section-list-item"} onClick={() => {setCurrentlyActive("agents")}} data-tooltip-id="nav-tip" data-tooltip-content="Agents" data-tooltip-place="right"><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faRobot} /></div><span className={"menu-section-list-item-label"}>Agents</span></NavLink>
                                )}
                                <NavLink to={"/execution"} className={"menu-section-list-item"} onClick={() => {setCurrentlyActive("execution")}} data-tooltip-id="nav-tip" data-tooltip-content="Executions" data-tooltip-place="right"><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faPlay} /></div><span className={"menu-section-list-item-label"}>Executions</span></NavLink>
                            </div>
                        </>
                    )}

                    {showConfigure && (
                        <>
                            <div className={"menu-section-header"}>Configure</div>
                            <div className={"menu-section-list"}>
                                {(hasPermission(PERMISSIONS.ENVIRONMENT_VIEW) || hasPermission(PERMISSIONS.ENVIRONMENT_MANAGE)) && (
                                    <NavLink to={"/environment"} className={"menu-section-list-item"} data-tooltip-id="nav-tip" data-tooltip-content="Environments" data-tooltip-place="right"><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faWrench} /></div><span className={"menu-section-list-item-label"}>Environments</span></NavLink>
                                )}
                                {(hasPermission(PERMISSIONS.RUNNER_VIEW) || hasPermission(PERMISSIONS.RUNNER_MANAGE)) && (
                                    <NavLink to={"/runner"} className={"menu-section-list-item"} data-tooltip-id="nav-tip" data-tooltip-content="Runners" data-tooltip-place="right"><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faPersonRunning} /></div><span className={"menu-section-list-item-label"}>Runners</span></NavLink>
                                )}
                                {isOrgMode && hasPermission(PERMISSIONS.RUNNER_MANAGE) && (
                                    <NavLink to={"/queue"} className={"menu-section-list-item"} data-tooltip-id="nav-tip" data-tooltip-content="Queues" data-tooltip-place="right"><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faCubesStacked} /></div><span className={"menu-section-list-item-label"}>Queues</span></NavLink>
                                )}
                            </div>
                        </>
                    )}

                    {showManage && (
                        <>
                            <div className={"menu-section-header"}>Manage</div>
                            <div className={"menu-section-list"}>
                                {(hasPermission(PERMISSIONS.ORGANISATION_VIEW) || hasPermission(PERMISSIONS.ORGANISATION_MANAGE)) && (
                                    <NavLink to={"/organisation"} className={"menu-section-list-item"} data-tooltip-id="nav-tip" data-tooltip-content="Organisation" data-tooltip-place="right"><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faBriefcase} /></div><span className={"menu-section-list-item-label"}>Organisation</span></NavLink>
                                )}
                                {isOrgMode && hasPermission(PERMISSIONS.ORGANISATION_MANAGE) && (
                                    <NavLink to={"/team"} className={"menu-section-list-item"} data-tooltip-id="nav-tip" data-tooltip-content="Teams" data-tooltip-place="right"><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faPeoplePulling} /></div><span className={"menu-section-list-item-label"}>Teams</span></NavLink>
                                )}
                            </div>
                        </>
                    )}

                    {showAdminister && (
                        <>
                            <div className={"menu-section-header"}>Administer</div>
                            <div className={"menu-section-list"}>
                                <NavLink to={"/customers"} className={"menu-section-list-item"} data-tooltip-id="nav-tip" data-tooltip-content="Customers" data-tooltip-place="right"><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faLandmark} /></div><span className={"menu-section-list-item-label"}>Customers</span></NavLink>
                                <NavLink to={"/report"} className={"menu-section-list-item"} data-tooltip-id="nav-tip" data-tooltip-content="Reports" data-tooltip-place="right"><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faChartColumn} /></div><span className={"menu-section-list-item-label"}>Reports</span></NavLink>
                            </div>
                        </>
                    )}
                </div>

                <div className={"vertical-nav-bottom-section"}>
                    <div className={"menu-section-list"}>
                        <Link to={"https://discord.gg/y3Td3kw5tA"} className={"menu-section-list-item"} target={"_blank"} data-tooltip-id="nav-tip" data-tooltip-content="Community" data-tooltip-place="right"><div className={"menu-section-list-icon"}><FontAwesomeIcon icon={faDiscord} /></div><span className={"menu-section-list-item-label"}>Community <FontAwesomeIcon icon={faArrowUpRightFromSquare} /></span></Link>
                        <NavLink to={"/status"} className={"menu-section-list-item"} data-tooltip-id="nav-tip" data-tooltip-content="System Status" data-tooltip-place="right">
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

                    <button className="nav-collapse-btn" onClick={toggleCollapsed}>
                        <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} />
                        <span className="nav-collapse-label">{collapsed ? '' : 'Collapse'}</span>
                    </button>
                </div>
            </div>
            <Tooltip id="nav-tip" />
        </div>
    )
}