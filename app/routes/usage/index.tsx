import type {Route} from "../+types/home";
import Container from "~/components/container";
import type {HelpContent} from "~/components/helpPane";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Executions" },
        { name: "description", content: "Get in the Flo" },
    ];
}

const USAGE_HELP: HelpContent = {
    title: "About Usage",
    intro: "A running total of how much your automations have been used, so there are no surprises.",
    points: [
        "See how much flow-running time you have used",
        "Compare usage against your plan's allowance",
        "Spot which periods were busiest",
        "Plan ahead before you reach a limit",
    ],
    tip: "Usage is measured by how long your flows spend running, added up over the month.",
};

export default function Usage() {
    return (
        <Container help={USAGE_HELP}>
            <div className={"header"}>Usage</div>
        </Container>
    )
}