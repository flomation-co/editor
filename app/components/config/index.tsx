export default function useConfig() {
    return (name: string, defaultValue?: string) => {
        if (typeof window !== "undefined") {
            if (window && window.properties && window.properties.hasOwnProperty(name)) {
                return window.properties[name];
            }
        }

        return defaultValue;
    }
}