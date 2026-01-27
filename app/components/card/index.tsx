import "./index.css"

export default function Card({ children }: { children: React.ReactNode }) {

    return (
        <div className={"card card-lg"}>
            {children}
        </div>
    )
}