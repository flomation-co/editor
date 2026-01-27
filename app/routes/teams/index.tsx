import type {Route} from "../+types/home";
import Container from "~/components/container";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Teams" },
        { name: "description", content: "Get in the Flo" },
    ];
}

export default function Teams() {
    return (
        <Container>
            <div className={"header"}>Teams</div>
        </Container>
    )
}