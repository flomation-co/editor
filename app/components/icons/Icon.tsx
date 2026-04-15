import { type CSSProperties, memo } from "react";
import { iconPaths, iconAliases, type IconName } from "./paths";

export type { IconName } from "./paths";

export interface IconProps {
  /** Icon name — accepts canonical names and FA-style aliases */
  name: string;
  /** CSS size string applied to width and height (default: "1em") */
  size?: string;
  /** Explicit pixel size — overrides `size` */
  px?: number;
  /** CSS colour (default: "currentColor") */
  colour?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  /** FontAwesome spin-equivalent — adds CSS animation */
  spin?: boolean;
}

const spinKeyframes = `
@keyframes icon-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

let spinStyleInjected = false;

function injectSpinStyle() {
  if (spinStyleInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = spinKeyframes;
  document.head.appendChild(style);
  spinStyleInjected = true;
}

/**
 * Renders an inline SVG icon by name.
 *
 * Replaces FontAwesomeIcon throughout the editor. Accepts the same
 * kebab-case icon names used in action manifests and FA imports.
 */
function IconInner({
  name,
  size,
  px,
  colour = "currentColor",
  className,
  style,
  title,
  spin,
}: IconProps) {
  // Resolve aliases
  const resolved = (iconAliases[name as keyof typeof iconAliases] ?? name) as IconName;
  const entry = iconPaths[resolved];

  if (!entry) {
    // Fallback: render a simple question-mark circle for unknown icons
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        width={px ? `${px}px` : size ?? "1em"}
        height={px ? `${px}px` : size ?? "1em"}
        fill={colour}
        className={className}
        style={{ display: "inline-block", verticalAlign: "-0.125em", ...style }}
        role={title ? "img" : "presentation"}
        aria-hidden={!title}
      >
        {title && <title>{title}</title>}
        <circle cx="256" cy="256" r="240" fill="none" stroke={colour} strokeWidth="32" />
        <text x="256" y="256" textAnchor="middle" dominantBaseline="central" fontSize="300" fill={colour}>?</text>
      </svg>
    );
  }

  const [w, h, d] = entry;
  const dim = px ? `${px}px` : size ?? "1em";

  if (spin) injectSpinStyle();

  const mergedStyle: CSSProperties = {
    display: "inline-block",
    verticalAlign: "-0.125em",
    ...style,
    ...(spin ? { animation: "icon-spin 1s linear infinite" } : {}),
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      width={dim}
      height={dim}
      fill={colour}
      className={className}
      style={mergedStyle}
      role={title ? "img" : "presentation"}
      aria-hidden={!title}
    >
      {title && <title>{title}</title>}
      <path d={d} />
    </svg>
  );
}

export const Icon = memo(IconInner);
export default Icon;
