import type {Route} from "../+types/home";
import Container from "~/components/container";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Organisations" },
        { name: "description", content: "Get in the Flo" },
    ];
}

export default function Organisations() {
    return (
        <Container>
            <div className={"header"}>Organisations</div>
        </Container>
    )
}