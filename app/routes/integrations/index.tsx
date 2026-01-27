import type {Route} from "../+types/home";
import Container from "~/components/container";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Integrations" },
        { name: "description", content: "Get in the Flo" },
    ];
}

export default function Integrations() {
    return (
        <Container>
            <div className={"header"}>Integrations &amp; APIs</div>
        </Container>
    )
}