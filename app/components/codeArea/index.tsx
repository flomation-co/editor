import {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";
import "./index.css";

type CodeAreaProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Height of the code area in visible rows. */
    rows?: number;
    id?: string;
};

/**
 * A monospace editing surface with a line-number gutter.
 *
 * Numbers count logical lines, and the text wraps — a system prompt is
 * prose, so forcing no-wrap to keep the numbering trivially 1:1 would
 * push paragraphs off the right edge. Instead a hidden mirror lays the
 * same text out in the same box, and each gutter row is given its
 * wrapped line's measured height, so a number stays level with the
 * first visual row of its line however far that line wraps.
 */
export default function CodeArea({value, onChange, placeholder, rows = 18, id}: CodeAreaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const [heights, setHeights] = useState<number[]>([]);

    const lines = value.split("\n");

    const measure = useCallback(() => {
        const mirror = mirrorRef.current;
        const textarea = textareaRef.current;
        if (!mirror || !textarea) return;
        // clientWidth excludes the textarea's scrollbar; a percentage
        // width would not, and the few pixels of difference are enough
        // to wrap a line one word earlier in the mirror than in the
        // field, which shifts every number below it.
        mirror.style.width = `${textarea.clientWidth}px`;
        const next = Array.from(mirror.children).map(child => (child as HTMLElement).offsetHeight);
        setHeights(previous =>
            previous.length === next.length && previous.every((h, i) => h === next[i]) ? previous : next
        );
    }, []);

    // Re-measure after every render that could change the layout: the
    // text itself, and the width the textarea was given.
    useLayoutEffect(measure, [value, measure]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(measure);
        observer.observe(textarea);
        return () => observer.disconnect();
    }, [measure]);

    const syncScroll = () => {
        if (gutterRef.current && textareaRef.current) {
            gutterRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    };

    return (
        <div className="code-area">
            <div className="code-area-gutter" ref={gutterRef} aria-hidden="true">
                {lines.map((_, i) => (
                    <div key={i} className="code-area-gutter-line" style={{height: heights[i]}}>
                        {i + 1}
                    </div>
                ))}
            </div>

            <textarea
                id={id}
                ref={textareaRef}
                className="code-area-field"
                style={{height: `calc(${rows} * var(--code-area-line) + 20px)`}}
                value={value}
                placeholder={placeholder}
                spellCheck={false}
                onChange={e => onChange(e.target.value)}
                onScroll={syncScroll}
            />

            <div className="code-area-mirror" ref={mirrorRef} aria-hidden="true">
                {lines.map((line, i) => (
                    // A zero-width space keeps an empty line one row tall.
                    <div key={i}>{line === "" ? "​" : line}</div>
                ))}
            </div>
        </div>
    );
}
