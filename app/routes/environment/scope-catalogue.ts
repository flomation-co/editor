// Credential scope catalogue + selection helpers.
//
// The previous model treated scopes as independent string checkboxes,
// which let contradictory states exist (e.g. both "Read-only" AND
// "Read/Write" ticked for Gmail — Google honours the broader grant
// but the UI implied a choice). This module replaces that with a
// service-oriented structure: one row per service (Gmail, Calendar,
// Drive, ...), a mutually-exclusive access-level segmented control
// per service, and orthogonal toggles for capabilities that aren't
// hierarchical (Gmail's Send is independent of read/write level).
//
// Wire format stays unchanged — the OAuth provider still receives a
// space-delimited scope string. The structured selection lives only
// in the editor's React state, and is collapsed to a string at save
// time. Existing credentials reverse-parse cleanly on load (see
// scopesStringToSelection) and unrecognised scopes drop into an
// "Other scopes" bucket so resaving never silently strips them.

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

/** A mutually-exclusive access level for a service. The 'none' value
 *  must always exist as the first level for any service that supports
 *  opting out. Levels are ordered from least to most permissive — the
 *  reverse-parser picks the HIGHEST matching level when more than one
 *  is satisfied by the saved scope set. */
export type AccessLevel = {
    value: string;
    label: string;
    scopes: string[];
    /** Toggle ids on the same service to auto-enable when this level
     *  is selected. Use when the level's scope semantically subsumes
     *  the toggle's scope — e.g. Google's gmail.modify already
     *  grants send, so picking Read/Write should reflect Send as
     *  ticked. The auto-tick is one-way (no auto-untick when the
     *  level changes away) and the toggle stays user-controllable. */
    implies?: string[];
};

/** Orthogonal capability — a checkbox that's independent of the level
 *  segments. Gmail's "Send" is the canonical example: it's neither
 *  "read" nor "write", and can be enabled alongside any access level. */
export type OrthogonalToggle = {
    id: string;
    label: string;
    scopes: string[];
    /** If true, surfaces the orange "sensitive" badge on the toggle
     *  (mirrors the service-level flag — useful for capabilities that
     *  trigger Google's app-verification requirement on their own). */
    sensitive?: boolean;
};

/** One service row in the picker. Configurable shape: a service can
 *  be required (no controls, scopes always granted), have access
 *  levels, have orthogonal toggles, or both. */
export type ServiceScope = {
    id: string;
    name: string;
    /** Icon name from the editor's registered FA icon set. */
    icon: string;
    /** One-line description shown under the service name. Should
     *  describe the meaningful difference between the levels (the AI
     *  loop equivalent — give the user vocabulary to map their need
     *  to a value). */
    description: string;
    /** Renders the orange "sensitive" badge next to the name. Surface
     *  scopes that Google/Microsoft/etc. mark as restricted and that
     *  require additional app verification for production use. */
    sensitive?: boolean;
    /** If true, the row renders as info-only with a lock badge —
     *  alwaysOnScopes are granted without user choice. Use for
     *  identity scopes that are mechanically necessary for sign-in. */
    required?: boolean;
    /** Scopes granted regardless of any other selection. Identity
     *  rows put their scopes here (openid/profile/email). */
    alwaysOnScopes?: string[];
    /** Mutually-exclusive access levels. First should be the "none"
     *  opt-out for services where the user can decline access. */
    levels?: AccessLevel[];
    /** Independent capability toggles, rendered after the level
     *  segments. */
    toggles?: OrthogonalToggle[];
};

/** Per-service selection state. Mirrors the catalogue's shape: one
 *  entry per service the user has interacted with. Services not in
 *  the map default to "none" level + empty toggles, which is the
 *  correct interpretation of "user hasn't touched this row". */
export type ServiceSelection = {
    /** Current level value (matches an entry in service.levels). */
    level?: string;
    /** Set of enabled toggle ids. */
    toggles: Set<string>;
};

/** The full selection state for an in-flight credential edit. Keyed
 *  by service id. Maintained separately from the catalogue so
 *  catalogue changes don't break existing in-flight edits. */
export type ScopeSelection = Map<string, ServiceSelection>;

// ─────────────────────────────────────────────────────────────────
// Catalogue
// ─────────────────────────────────────────────────────────────────

/** Google scope catalogue.
 *
 *  Identity is required because Google's OAuth flow needs openid +
 *  email + profile to render a "logged in as X" summary in the
 *  consent screen and to populate the credential's display name.
 *
 *  Gmail, Drive marked sensitive because they trigger Google's
 *  restricted-scopes flow (apps requesting these for >100 users
 *  must complete a separate security review). Surfaced in the UI
 *  so the flow author understands the consent implications. */
const googleCatalogue: ServiceScope[] = [
    {
        id: "identity",
        name: "Identity",
        icon: "user",
        description: "OpenID, profile and email — needed for sign-in, can't be unticked.",
        required: true,
        alwaysOnScopes: ["openid", "profile", "email"],
    },
    {
        id: "gmail",
        name: "Gmail",
        icon: "envelope",
        description: "Read/Write covers reading, modifying labels and sending. Tick Send alone (without Read/Write) for flows that should send mail without ever reading the inbox.",
        sensitive: true,
        levels: [
            { value: "none",  label: "None",       scopes: [] },
            { value: "read",  label: "Read",       scopes: ["https://www.googleapis.com/auth/gmail.readonly"] },
            // gmail.modify already grants send capability — implies
            // the Send toggle so the UI reflects the actual permission.
            { value: "write", label: "Read/Write", scopes: ["https://www.googleapis.com/auth/gmail.modify"], implies: ["send"] },
        ],
        toggles: [
            { id: "send", label: "Send", scopes: ["https://www.googleapis.com/auth/gmail.send"] },
        ],
    },
    {
        id: "calendar",
        name: "Calendar",
        icon: "calendar",
        description: "Read sees events; Full can create and delete them.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read", scopes: ["https://www.googleapis.com/auth/calendar.readonly"] },
            { value: "full", label: "Full", scopes: ["https://www.googleapis.com/auth/calendar"] },
        ],
    },
    {
        id: "drive",
        name: "Drive",
        icon: "folder",
        description: "File access is scoped to files this app creates or opens.",
        sensitive: true,
        levels: [
            { value: "none", label: "None",        scopes: [] },
            { value: "read", label: "Read",        scopes: ["https://www.googleapis.com/auth/drive.readonly"] },
            { value: "file", label: "File access", scopes: ["https://www.googleapis.com/auth/drive.file"] },
        ],
    },
    {
        id: "sheets",
        name: "Sheets",
        icon: "table",
        description: "Read pulls cell values; Read/Write can edit spreadsheets.",
        levels: [
            { value: "none",  label: "None",       scopes: [] },
            { value: "read",  label: "Read",       scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] },
            { value: "write", label: "Read/Write", scopes: ["https://www.googleapis.com/auth/spreadsheets"] },
        ],
    },
    {
        id: "docs",
        name: "Docs",
        icon: "file-lines",
        description: "Read pulls document contents; Read/Write lets flows create and edit Google Docs.",
        levels: [
            { value: "none",  label: "None",       scopes: [] },
            { value: "read",  label: "Read",       scopes: ["https://www.googleapis.com/auth/documents.readonly"] },
            { value: "write", label: "Read/Write", scopes: ["https://www.googleapis.com/auth/documents"] },
        ],
    },
    {
        id: "slides",
        name: "Slides",
        icon: "display",
        description: "Read pulls slide contents; Read/Write lets flows create and edit Google Slides decks.",
        levels: [
            { value: "none",  label: "None",       scopes: [] },
            { value: "read",  label: "Read",       scopes: ["https://www.googleapis.com/auth/presentations.readonly"] },
            { value: "write", label: "Read/Write", scopes: ["https://www.googleapis.com/auth/presentations"] },
        ],
    },
    {
        id: "youtube",
        name: "YouTube",
        icon: "video",
        description: "Read lists channels/videos; Full can edit metadata. Upload is independent.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read", scopes: ["https://www.googleapis.com/auth/youtube.readonly"] },
            // youtube (Full) grants upload too — same one-way auto-tick
            // pattern as Gmail Read/Write → Send.
            { value: "full", label: "Full", scopes: ["https://www.googleapis.com/auth/youtube"], implies: ["upload"] },
        ],
        toggles: [
            { id: "upload", label: "Upload videos", scopes: ["https://www.googleapis.com/auth/youtube.upload"] },
        ],
    },
];

/** Microsoft Graph scope catalogue. Identity bundles offline_access
 *  (refresh tokens) and User.Read (display-name read) — neither is
 *  optional for a working Graph integration. */
const microsoftCatalogue: ServiceScope[] = [
    {
        id: "identity",
        name: "Identity",
        icon: "user",
        description: "OpenID, profile, email, offline access and basic user info — required for Microsoft Graph access.",
        required: true,
        alwaysOnScopes: ["openid", "email", "profile", "offline_access", "User.Read"],
    },
    {
        id: "outlook_mail",
        name: "Outlook Mail",
        icon: "envelope",
        description: "Read/Write lets flows draft and modify mail; Send is independent.",
        sensitive: true,
        levels: [
            { value: "none",  label: "None",       scopes: [] },
            { value: "read",  label: "Read",       scopes: ["Mail.Read"] },
            { value: "write", label: "Read/Write", scopes: ["Mail.ReadWrite"] },
        ],
        toggles: [
            { id: "send", label: "Send", scopes: ["Mail.Send"] },
        ],
    },
    {
        id: "calendar",
        name: "Calendar",
        icon: "calendar",
        description: "Read sees events; Read/Write can create, modify and delete them.",
        levels: [
            { value: "none",  label: "None",       scopes: [] },
            { value: "read",  label: "Read",       scopes: ["Calendars.Read"] },
            { value: "write", label: "Read/Write", scopes: ["Calendars.ReadWrite"] },
        ],
    },
    {
        id: "onedrive",
        name: "OneDrive",
        icon: "folder",
        description: "Read/Write covers the user's drive; Full extends to all files in the org.",
        sensitive: true,
        levels: [
            { value: "none",  label: "None",       scopes: [] },
            { value: "read",  label: "Read",       scopes: ["Files.Read"] },
            { value: "write", label: "Read/Write", scopes: ["Files.ReadWrite"] },
            { value: "all",   label: "All files",  scopes: ["Files.ReadWrite.All"] },
        ],
    },
    {
        id: "teams",
        name: "Teams",
        icon: "comments",
        description: "Read covers teams and channels; Send posts channel messages. Chat is read/write only.",
        levels: [
            { value: "none",  label: "None",       scopes: [] },
            { value: "read",  label: "Read",       scopes: ["Team.ReadBasic.All", "Channel.ReadBasic.All"] },
            { value: "chat",  label: "Read/Write Chat", scopes: ["Chat.ReadWrite", "Team.ReadBasic.All", "Channel.ReadBasic.All"] },
        ],
        toggles: [
            { id: "send_channel", label: "Send channel messages", scopes: ["ChannelMessage.Send"] },
        ],
    },
    {
        id: "sharepoint",
        name: "SharePoint",
        icon: "globe",
        description: "Read/Write covers all SharePoint sites the user has access to.",
        sensitive: true,
        levels: [
            { value: "none",  label: "None",       scopes: [] },
            { value: "write", label: "Read/Write", scopes: ["Sites.ReadWrite.All"] },
        ],
    },
];

/** GitHub scope catalogue. GitHub's scopes are mostly discrete
 *  capabilities rather than hierarchical access levels — Repositories
 *  and Organisations are the only ones with a clean public/full
 *  ladder. */
const githubCatalogue: ServiceScope[] = [
    {
        id: "user",
        name: "User",
        icon: "user",
        description: "Read your GitHub profile and email — required for sign-in.",
        required: true,
        alwaysOnScopes: ["read:user", "user:email"],
    },
    {
        id: "repositories",
        name: "Repositories",
        icon: "code-branch",
        description: "Public access reads open repos; Full unlocks private repos too. Commit-status is independent.",
        sensitive: true,
        levels: [
            { value: "none",   label: "None",   scopes: [] },
            { value: "public", label: "Public", scopes: ["public_repo"] },
            { value: "full",   label: "Full",   scopes: ["repo"] },
        ],
        toggles: [
            { id: "status", label: "Commit statuses", scopes: ["repo:status"] },
        ],
    },
    {
        id: "organisations",
        name: "Organisations",
        icon: "people-group",
        description: "Read membership; Write covers invites; Admin can change org settings.",
        sensitive: true,
        levels: [
            { value: "none",  label: "None",  scopes: [] },
            { value: "read",  label: "Read",  scopes: ["read:org"] },
            { value: "write", label: "Write", scopes: ["write:org"] },
            { value: "admin", label: "Admin", scopes: ["admin:org"] },
        ],
    },
    {
        id: "packages",
        name: "Packages",
        icon: "box",
        description: "Read consumes published packages; Full lets you publish and delete.",
        levels: [
            { value: "none",  label: "None",  scopes: [] },
            { value: "read",  label: "Read",  scopes: ["read:packages"] },
            { value: "write", label: "Write", scopes: ["write:packages"] },
            { value: "full",  label: "Full",  scopes: ["write:packages", "delete:packages"] },
        ],
    },
    {
        id: "actions_other",
        name: "Other capabilities",
        icon: "gears",
        description: "Independent capabilities — pick only what your flows actually use.",
        toggles: [
            { id: "workflow",      label: "Workflows",     scopes: ["workflow"] },
            { id: "gists",         label: "Gists",         scopes: ["gist"] },
            { id: "notifications", label: "Notifications", scopes: ["notifications"] },
            { id: "webhooks",      label: "Webhooks",      scopes: ["admin:repo_hook"] },
        ],
    },
];

/** LinkedIn standard scope catalogue. The Organisation capabilities
 *  require LinkedIn's manual partnership approval — surfaced as
 *  sensitive on each individual toggle. */
const linkedinCatalogue: ServiceScope[] = [
    {
        id: "identity",
        name: "Identity",
        icon: "user",
        description: "OpenID, profile and email — required for sign-in.",
        required: true,
        alwaysOnScopes: ["openid", "profile", "email"],
    },
    {
        id: "lite_profile",
        name: "Lite profile",
        icon: "user",
        description: "Read additional profile fields beyond the OpenID basics.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read", scopes: ["r_liteprofile"] },
        ],
    },
    {
        id: "member_social",
        name: "Member posting",
        icon: "paper-plane",
        description: "Post on behalf of the authenticated member.",
        toggles: [
            { id: "post_as_member", label: "Post as member", scopes: ["w_member_social"] },
        ],
    },
    {
        id: "organisation",
        name: "Organisation",
        icon: "briefcase",
        description: "Manage organisation/company pages. Requires LinkedIn partnership approval.",
        sensitive: true,
        toggles: [
            { id: "read_org_posts",  label: "Read organisation posts", scopes: ["r_organization_social"] },
            { id: "post_as_org",     label: "Post as organisation",    scopes: ["w_organization_social"], sensitive: true },
            { id: "manage_org",      label: "Manage organisation",     scopes: ["rw_organization_admin"], sensitive: true },
            { id: "read_ads",        label: "Read ad accounts",        scopes: ["r_ads"] },
            { id: "read_ad_reports", label: "Read ad reports",         scopes: ["r_ads_reporting"] },
        ],
    },
];

/** LinkedIn Community Management API — separate provider, narrower
 *  set of paired read/write scopes. */
const linkedinCommunityCatalogue: ServiceScope[] = [
    {
        id: "member_content",
        name: "Member content",
        icon: "user",
        description: "Read and write the authenticated member's posts.",
        levels: [
            { value: "none",  label: "None",       scopes: [] },
            { value: "read",  label: "Read",       scopes: ["r_member_social"] },
            { value: "write", label: "Read/Write", scopes: ["r_member_social", "w_member_social"] },
        ],
    },
    {
        id: "organisation_content",
        name: "Organisation content",
        icon: "briefcase",
        description: "Read and write organisation page posts.",
        sensitive: true,
        levels: [
            { value: "none",  label: "None",       scopes: [] },
            { value: "read",  label: "Read",       scopes: ["r_organization_social"] },
            { value: "write", label: "Read/Write", scopes: ["r_organization_social", "w_organization_social"] },
        ],
    },
    {
        id: "organisation_admin",
        name: "Organisation admin",
        icon: "gear",
        description: "Manage organisation page settings.",
        sensitive: true,
        toggles: [
            { id: "manage", label: "Manage pages", scopes: ["rw_organization_admin"] },
        ],
    },
];

/** Facebook scope catalogue. Facebook scopes are almost entirely
 *  discrete capabilities — there's no meaningful "read/write" ladder
 *  for most of them. Everything is toggles. */
const facebookCatalogue: ServiceScope[] = [
    {
        id: "pages",
        name: "Pages",
        icon: "file-lines",
        description: "Page management — pick the specific capabilities your flows need.",
        sensitive: true,
        toggles: [
            { id: "manage_posts",      label: "Manage posts",      scopes: ["pages_manage_posts"] },
            { id: "read_engagement",   label: "Read engagement",   scopes: ["pages_read_engagement"] },
            { id: "show_list",         label: "Show list",         scopes: ["pages_show_list"] },
            { id: "read_user_content", label: "Read user content", scopes: ["pages_read_user_content"] },
            { id: "manage_metadata",   label: "Manage metadata",   scopes: ["pages_manage_metadata"] },
            { id: "manage_engagement", label: "Manage engagement", scopes: ["pages_manage_engagement"] },
            { id: "messaging",         label: "Messaging",         scopes: ["pages_messaging"] },
        ],
    },
    {
        id: "instagram",
        name: "Instagram",
        icon: "image",
        description: "Manage linked Instagram Business accounts.",
        sensitive: true,
        toggles: [
            { id: "basic",            label: "Basic access",      scopes: ["instagram_basic"] },
            { id: "content_publish",  label: "Publish content",   scopes: ["instagram_content_publish"] },
            { id: "manage_comments",  label: "Manage comments",   scopes: ["instagram_manage_comments"] },
            { id: "manage_insights",  label: "Insights",          scopes: ["instagram_manage_insights"] },
        ],
    },
    {
        id: "business",
        name: "Business",
        icon: "briefcase",
        description: "Business Manager and ad-account access.",
        sensitive: true,
        toggles: [
            { id: "business_management", label: "Business management", scopes: ["business_management"] },
            { id: "ads_management",      label: "Ads management",      scopes: ["ads_management"], sensitive: true },
            { id: "ads_read",            label: "Read ads",            scopes: ["ads_read"] },
        ],
    },
];

/** Twitter (X) scope catalogue. Tweets and Lists have clean read/
 *  write ladders; the rest are discrete capabilities. offline.access
 *  is always-on because Twitter's tokens are short-lived. */
const twitterCatalogue: ServiceScope[] = [
    {
        id: "identity",
        name: "Identity",
        icon: "user",
        description: "Read profile information and keep refresh tokens for long-running flows.",
        required: true,
        alwaysOnScopes: ["users.read", "offline.access"],
    },
    {
        id: "tweets",
        name: "Tweets",
        icon: "paper-plane",
        description: "Read pulls tweets; Read/Write can post and delete on the user's behalf.",
        sensitive: true,
        levels: [
            { value: "none",  label: "None",       scopes: [] },
            { value: "read",  label: "Read",       scopes: ["tweet.read"] },
            { value: "write", label: "Read/Write", scopes: ["tweet.read", "tweet.write"] },
        ],
    },
    {
        id: "social",
        name: "Social",
        icon: "people-group",
        description: "Follow / like / unfollow capabilities.",
        toggles: [
            { id: "read_follows",   label: "Read follows",    scopes: ["follows.read"] },
            { id: "manage_follows", label: "Manage follows",  scopes: ["follows.write"] },
            { id: "read_likes",     label: "Read likes",      scopes: ["like.read"] },
            { id: "manage_likes",   label: "Manage likes",    scopes: ["like.write"] },
        ],
    },
    {
        id: "lists_bookmarks",
        name: "Lists & bookmarks",
        icon: "list",
        description: "Manage the user's own lists and bookmarks.",
        toggles: [
            { id: "read_lists",       label: "Read lists",     scopes: ["list.read"] },
            { id: "manage_lists",     label: "Manage lists",   scopes: ["list.write"] },
            { id: "read_bookmarks",   label: "Read bookmarks", scopes: ["bookmark.read"] },
            { id: "manage_bookmarks", label: "Manage bookmarks", scopes: ["bookmark.write"] },
        ],
    },
    {
        id: "messaging",
        name: "Messaging & Spaces",
        icon: "comments",
        description: "Read Spaces audio rooms and DM read/write. DMs are gated by Twitter — request only what's needed.",
        sensitive: true,
        toggles: [
            { id: "read_spaces", label: "Read Spaces", scopes: ["space.read"] },
            { id: "read_dms",    label: "Read DMs",    scopes: ["dm.read"], sensitive: true },
            { id: "send_dms",    label: "Send DMs",    scopes: ["dm.write"], sensitive: true },
        ],
    },
];

/** All provider catalogues keyed by their provider slug. Slug values
 *  match what the API's /credential/providers endpoint returns. */
export const providerCatalogue: Record<string, ServiceScope[]> = {
    google: googleCatalogue,
    microsoft: microsoftCatalogue,
    github: githubCatalogue,
    linkedin: linkedinCatalogue,
    linkedin_community: linkedinCommunityCatalogue,
    facebook: facebookCatalogue,
    twitter: twitterCatalogue,
};

// ─────────────────────────────────────────────────────────────────
// Selection ↔ scope-string helpers
// ─────────────────────────────────────────────────────────────────

/** Build the default selection state for a fresh credential of the
 *  given provider. Every service starts at its first level (always
 *  "none" for opt-in services, or the single locked level for
 *  required services). No toggles are enabled by default. */
export function defaultSelection(providerSlug: string): ScopeSelection {
    const catalogue = providerCatalogue[providerSlug] || [];
    const selection: ScopeSelection = new Map();
    for (const svc of catalogue) {
        selection.set(svc.id, {
            level: svc.levels?.[0]?.value,
            toggles: new Set(),
        });
    }
    return selection;
}

/** Flatten a selection into a deduplicated, space-delimited scope
 *  string ready for the OAuth wire. Order is not significant for
 *  any provider's consent screen — we sort alphabetically for
 *  deterministic output (helps with diffing saved credentials). */
export function selectionToScopeString(
    providerSlug: string,
    selection: ScopeSelection,
    otherScopes: Set<string> = new Set(),
): string {
    const catalogue = providerCatalogue[providerSlug] || [];
    const accum = new Set<string>();

    for (const svc of catalogue) {
        // alwaysOnScopes are unconditional — fire whether the service
        // is "selected" or not.
        for (const s of svc.alwaysOnScopes || []) accum.add(s);

        const svcSelection = selection.get(svc.id);
        if (!svcSelection) continue;

        if (svc.levels && svcSelection.level) {
            const level = svc.levels.find(l => l.value === svcSelection.level);
            for (const s of level?.scopes || []) accum.add(s);
        }
        for (const toggleId of svcSelection.toggles) {
            const toggle = svc.toggles?.find(t => t.id === toggleId);
            for (const s of toggle?.scopes || []) accum.add(s);
        }
    }

    // Preserve any scopes the catalogue doesn't know about — these
    // came from a saved credential whose scope list contained
    // legacy/custom values. Dropping them on resave would be a
    // silent permission downgrade.
    for (const s of otherScopes) accum.add(s);

    return Array.from(accum).sort().join(" ");
}

/** Parse a saved space-delimited scope string back into structured
 *  selection state. The matching is greedy: for each service's
 *  levels, we pick the HIGHEST level whose scopes are all present
 *  in the saved set. Toggles match individually.
 *
 *  Returns both the selection AND the set of scope strings that
 *  didn't match anywhere in the catalogue. The caller renders the
 *  latter in an "Other scopes" expandable so resaving preserves
 *  them. */
export function scopesStringToSelection(
    providerSlug: string,
    scopeString: string,
): { selection: ScopeSelection; otherScopes: Set<string> } {
    const catalogue = providerCatalogue[providerSlug] || [];
    const saved = new Set<string>(scopeString.split(/\s+/).filter(Boolean));
    const consumed = new Set<string>();
    const selection: ScopeSelection = new Map();

    for (const svc of catalogue) {
        const svcSelection: ServiceSelection = { toggles: new Set() };

        // alwaysOnScopes — mark consumed but don't influence
        // selection state (they're not user-controlled).
        for (const s of svc.alwaysOnScopes || []) {
            if (saved.has(s)) consumed.add(s);
        }

        // Levels — walk from highest to lowest, pick the first level
        // whose full scope set is satisfied. Last-position level
        // wins ties (catalogue order = least to most permissive).
        if (svc.levels && svc.levels.length > 0) {
            // Default to first level (typically "none") so the row
            // has a sensible initial state even if no scope matches.
            svcSelection.level = svc.levels[0].value;
            for (let i = svc.levels.length - 1; i >= 0; i--) {
                const level = svc.levels[i];
                if (level.scopes.length === 0) continue;
                const allPresent = level.scopes.every(s => saved.has(s));
                if (allPresent) {
                    svcSelection.level = level.value;
                    for (const s of level.scopes) consumed.add(s);
                    break;
                }
            }
        }

        // Toggles — independent membership check per toggle.
        for (const toggle of svc.toggles || []) {
            const allPresent = toggle.scopes.every(s => saved.has(s));
            if (allPresent) {
                svcSelection.toggles.add(toggle.id);
                for (const s of toggle.scopes) consumed.add(s);
            }
        }

        selection.set(svc.id, svcSelection);
    }

    // Anything in `saved` that wasn't claimed by a level or toggle
    // becomes "other scopes" — legacy values, deprecated scopes,
    // custom additions. Preserved verbatim on resave.
    const otherScopes = new Set<string>();
    for (const s of saved) {
        if (!consumed.has(s)) otherScopes.add(s);
    }

    return { selection, otherScopes };
}

/** Count total scopes that would be requested by the current
 *  selection. Used for the footer summary ("approve these N scopes").
 *  Counts deduplicated — same scope referenced from multiple toggles
 *  counts once. */
export function countScopes(
    providerSlug: string,
    selection: ScopeSelection,
    otherScopes: Set<string> = new Set(),
): number {
    return selectionToScopeString(providerSlug, selection, otherScopes)
        .split(/\s+/)
        .filter(Boolean).length;
}
