import type {Route} from "../+types/home";
import Container from "~/components/container";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Executions" },
        { name: "description", content: "Get in the Flo" },
    ];
}

export default function Usage() {
    return (
        <Container>
            <div className={"header"}>Usage</div>
        </Container>
    )
}