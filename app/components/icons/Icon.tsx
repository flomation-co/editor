import { type CSSProperties, memo } from "react";
import { iconPaths, iconAliases, type IconName } from "./paths";

export type { IconName } from "./paths";

export interface IconProps {
  /** Icon name — accepts canonical names, FA-style aliases, and composite "base+badge" format */
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

function resolveIcon(name: string): [number, number, string] | undefined {
  const resolved = (iconAliases[name as keyof typeof iconAliases] ?? name) as IconName;
  return iconPaths[resolved];
}

/**
 * Renders an inline SVG icon by name.
 *
 * Supports composite icons using "base+badge" format (e.g., "gmail+paper-plane").
 * The base icon renders at full size and the badge renders as a small overlay
 * in the bottom-right corner with a circular background.
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
  const dim = px ? `${px}px` : size ?? "1em";

  if (spin) injectSpinStyle();

  const mergedStyle: CSSProperties = {
    display: "inline-block",
    verticalAlign: "-0.125em",
    ...style,
    ...(spin ? { animation: "icon-spin 1s linear infinite" } : {}),
  };

  // Composite icon: "base+badge" format
  if (name.includes("+")) {
    const [baseName, badgeName] = name.split("+", 2);
    const base = resolveIcon(baseName);
    const badge = resolveIcon(badgeName);

    if (base && badge) {
      const [bw, bh, bd] = base;
      const [aw, ah, ad] = badge;

      // Render in a normalised 100x100 viewBox
      // Base icon at ~75% in the top-left area
      // Badge at ~55% in the bottom-right with a bg circle for contrast
      const baseScale = 0.72;
      const badgeSize = 52;
      const badgeX = 100 - badgeSize;
      const badgeY = 100 - badgeSize;
      const badgeCX = badgeX + badgeSize / 2;
      const badgeCY = badgeY + badgeSize / 2;
      const badgePad = 4;

      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 100"
          width={dim}
          height={dim}
          className={className}
          style={mergedStyle}
          role={title ? "img" : "presentation"}
          aria-hidden={!title}
        >
          {title && <title>{title}</title>}
          {/* Base icon — top-left area at 72% */}
          <g transform={`scale(${(100 * baseScale) / bw},${(100 * baseScale) / bh})`}>
            <path d={bd} fill={colour} />
          </g>
          {/* Badge background circle */}
          <circle cx={badgeCX} cy={badgeCY} r={badgeSize / 2 + badgePad} fill="var(--node-bg, #1a1025)" />
          {/* Badge icon */}
          <g transform={`translate(${badgeX},${badgeY}) scale(${badgeSize / aw},${badgeSize / ah})`}>
            <path d={ad} fill={colour} />
          </g>
        </svg>
      );
    }
  }

  // Single icon
  const entry = resolveIcon(name);

  if (!entry) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        width={dim}
        height={dim}
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
