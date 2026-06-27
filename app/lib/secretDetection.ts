// Shared detection of secret-shaped literal values across the editor.
//
// Used in two places that historically duplicated this logic:
//   1. property-menu inputs — warn the user when they paste a token
//      literal into a text field instead of using ${secrets.X}.
//   2. node-inspector outputs — obfuscate values that look sensitive
//      so the run details view doesn't render API keys in plain text.
//
// Adding a new pattern here makes both places stricter at once. Don't
// fork this module to add "just one more" pattern — keep all checks
// in one file so the two surfaces never drift again.

// PATTERNS recognises tokens by their well-known prefix. Each entry
// trades off recall vs precision: every regex anchored to ^ with a
// concrete prefix has near-zero false-positive risk, even if it means
// we miss generic tokens that share the prefix space (e.g. someone's
// nickname literally starting with "AKIA"). The high-entropy fallback
// later in this file is what catches everything else.
const PREFIX_PATTERNS: RegExp[] = [
    // Stripe-style ("sk_live_", "rk_test_", "pk_…") and other vendors
    // that adopted the same convention. Underscore OR hyphen separator
    // catches both legacy and current formats.
    /^(sk|pk|rk)[-_][a-zA-Z0-9]{20,}/,
    // GitHub: ghp (PAT), gho (OAuth), ghu (user-to-server),
    // ghs (server-to-server), ghr (refresh).
    /^(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{20,}/,
    // Slack: xoxb (bot), xoxp (user), xoxs (workspace), xoxa (app),
    // xapp (app-level token, used for socket mode).
    /^xox[bpsa]-[a-zA-Z0-9-]+/,
    /^xapp-[a-zA-Z0-9-]+/,
    // AWS access key ID (the secret access key has no prefix; the
    // high-entropy base64 check below catches it).
    /^AKIA[A-Z0-9]{16}/,
    // JWT (signed Bearer tokens): three dot-separated base64url parts;
    // the first always starts with eyJ because it's a base64-encoded
    // JSON object opening "{".
    /^eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]+/,
    // GitLab personal/group access tokens.
    /^glpat-[a-zA-Z0-9_-]{20,}/,
    // Anthropic API keys.
    /^sk-ant-[a-zA-Z0-9_-]{20,}/,
    // Twilio Account SID / API key SID — these aren't strictly secret
    // on their own but they always travel paired with an auth token
    // and treating them as sensitive trains the user to put both in
    // environment storage.
    /^AC[a-f0-9]{32}$/i,
    /^AP[a-f0-9]{32}$/i,
    // HubSpot.
    /^pat-[a-z0-9-]{20,}/,
    /^hapi_[a-zA-Z0-9]{20,}/,
    // Hex blob 40–64 chars (catches generic SHA-1/SHA-256-shaped
    // secrets, including AWS-style secret access keys that survived
    // hex-encoding). Anchored exactly to length to avoid matching
    // arbitrary identifiers.
    /^[a-f0-9]{40,64}$/,
    // PEM-encoded private key block — common copy-paste mistake.
    /^-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY/,
];

// SENSITIVE_KEY_NAME matches against object property names (used by
// the node inspector). A key called "api_key" should be obfuscated
// even if the value happens not to match a prefix pattern.
export const SENSITIVE_KEY_NAME =
    /secret|password|key|token|credential|auth|access_token|refresh_token|api_key|apikey/i;

// MIN_LENGTH is the floor below which we don't bother checking. Short
// strings are dominated by false positives (a user's title "sk-rep"
// happens to start with "sk-"). Real tokens are always >=20 chars.
const MIN_LENGTH = 20;

// MAX_LENGTH is the ceiling above which we don't bother checking and
// it would be UNSAFE to even try. Even linear-complexity regexes
// (HIGH_ENTROPY_BASE64 etc.) consume internal recursion stack on V8
// proportional to input length, and multi-MB strings — like
// base64-encoded video output from Veo / audio output from TTS —
// reliably blow `Maximum call stack size exceeded` from RegExp.test.
// 8 KB covers every realistic secret shape (TLS keys ~2–4 KB, API
// tokens < 100 bytes, JWT < 4 KB); anything bigger is media or
// document content that simply cannot be a credential.
const MAX_LENGTH = 8 * 1024;

// HIGH_ENTROPY_HEX catches long hex blobs that don't match a known
// prefix — generic secret access keys, hash-shaped tokens, etc.
const HIGH_ENTROPY_HEX = /^[a-f0-9]{32,}$/i;

// HIGH_ENTROPY_BASE64 catches long base64 blobs (with optional
// padding). 40+ chars is the practical floor for cryptographic
// material; below that, lots of innocuous identifiers match.
const HIGH_ENTROPY_BASE64 = /^[A-Za-z0-9+/]{40,}={0,2}$/;

// detectSecret returns a user-facing warning message if the value
// looks like a literal secret, or null if it doesn't. Always returns
// null for values that already reference an environment secret or
// managed credential — those are exactly the safe storage we want
// people to use.
//
// Defensively typed against runtime non-string values: an object-
// typed input (e.g. the script nodes' inputs_data, common/array_length's
// `array`) can legitimately carry a native object/array/number into
// VariableInput, and crashing the property menu with
// `value.includes is not a function` is the wrong UX. Non-string
// values can't contain literal secrets at this layer anyway —
// secrets always arrive as text — so it's safe to short-circuit
// to null.
export function detectSecret(value: unknown): string | null {
    if (typeof value !== "string") return null;
    if (!value) return null;

    // Variable references are safe by definition — they aren't the
    // literal secret, they're a pointer to where it's stored.
    if (value.includes("${secrets.") || value.includes("${secret.")) return null;
    if (value.includes("${credentials.") || value.includes("${credential.")) return null;

    // Short-circuit on oversized values BEFORE trimming — `trim()`
    // itself is fine but the regex calls that follow are not, and a
    // 7 MB base64 string trimmed is still 7 MB.
    if (value.length > MAX_LENGTH) return null;

    const trimmed = value.trim();
    if (trimmed.length < MIN_LENGTH) return null;

    for (const pattern of PREFIX_PATTERNS) {
        if (pattern.test(trimmed)) {
            return SECRET_WARNING_MESSAGE;
        }
    }

    // High-entropy fallback. Only single-token strings (no spaces) —
    // a sentence with 40 letters in it isn't a secret. The base64
    // check would otherwise match a long English word string with
    // capitals and numbers interspersed, so we additionally require
    // both a mix of cases AND a digit before treating it as base64.
    if (!/\s/.test(trimmed)) {
        if (HIGH_ENTROPY_HEX.test(trimmed)) return SECRET_WARNING_MESSAGE;
        if (
            HIGH_ENTROPY_BASE64.test(trimmed) &&
            /[A-Z]/.test(trimmed) &&
            /[a-z]/.test(trimmed) &&
            /[0-9]/.test(trimmed)
        ) {
            return SECRET_WARNING_MESSAGE;
        }
    }

    return null;
}

// isSensitiveValue is the node-inspector entry point: returns true
// when a string value should be obfuscated in the run-details view.
// Equivalent to detectSecret(v) !== null, exposed under the older
// name for call-site readability.
export function isSensitiveValue(value: unknown): boolean {
    if (typeof value !== "string") return false;
    return detectSecret(value) !== null;
}

// isSensitive combines key-name matching with value matching. A field
// called "api_key" is sensitive even when its value is shorter than
// the prefix-pattern floor.
export function isSensitive(key: string, value: unknown): boolean {
    if (SENSITIVE_KEY_NAME.test(key)) return true;
    if (value === "********") return true;
    return isSensitiveValue(value);
}

export const SECRET_WARNING_MESSAGE =
    "This value looks like a secret or API key — store it in environment secrets and reference it as ${secrets.name} instead.";
