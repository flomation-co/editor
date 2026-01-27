import type { Route } from "../+types/home";
import { Editor } from "~/components/editor";
import {useParams} from "react-router";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Editor" },
        { name: "description", content: "Edit a Flo" },
    ];
}

export default function Home() {
    return <Editor id={useParams().id} />;
}
