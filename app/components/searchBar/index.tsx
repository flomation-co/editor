import { useState } from "react";
import "./index.css";
import { Icon } from "~/components/icons/Icon";

type SearchBarProps = {
    value: string | null;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    onExpandChange?: (expanded: boolean) => void;
};

export default function SearchBar({ value, onChange, placeholder = "Search...", disabled = false, onExpandChange }: SearchBarProps) {
    const [expanded, setExpanded] = useState(!!value);

    const updateExpanded = (val: boolean) => {
        setExpanded(val);
        onExpandChange?.(val);
    };

    const handleClear = () => {
        onChange("");
        updateExpanded(false);
    };

    if (disabled) return <div className="search-bar-spacer" />;

    return (
        <div className="search-bar-wrap">
            {expanded ? (
                <div className="search-bar-input-wrap">
                    <Icon name="magnifying-glass" className="search-bar-icon" />
                    <input
                        type="text"
                        className="search-bar-input"
                        placeholder={placeholder}
                        autoFocus
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                        onBlur={() => { if (!value) updateExpanded(false); }}
                    />
                    <button className="search-bar-close" onClick={handleClear}>
                        <Icon name="xmark" />
                    </button>
                </div>
            ) : (
                <button className="search-bar-btn" onClick={() => updateExpanded(true)}>
                    <Icon name="magnifying-glass" /><span>Search</span>
                </button>
            )}
        </div>
    );
}
