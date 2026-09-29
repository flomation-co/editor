// The Block Kit document model.
//
// JSON is the source of truth. This module only ever parses it into a shape the
// UI can lay out, and serialises back — it never becomes the authority. That
// distinction is what makes it safe to paste a message built in Slack's own
// Block Kit Builder and edit one field of it here: anything this editor cannot
// model is carried through untouched rather than dropped.

export type BlockKitDoc = {
    blocks: any[];
    /** Whether the source was Slack's {"blocks":[…]} wrapper rather than a bare
     *  array. Remembered so a round-trip gives back the shape it was given. */
    wrapped: boolean;
};

/** Block types the visual editor can lay out. Everything else round-trips as a
 *  raw block: visible and reorderable, but edited as JSON. */
export const EDITABLE_TYPES = ["header", "section", "divider", "context", "image", "actions"] as const;
export type EditableType = (typeof EDITABLE_TYPES)[number];

export const isEditable = (block: any): boolean =>
    !!block && typeof block === "object" && (EDITABLE_TYPES as readonly string[]).includes(block.type);

/** stripCodeFence mirrors the executor's own tolerance — an AI-generated value
 *  often arrives wrapped in ```json … ```, and the flow would run, so the editor
 *  must read it too rather than calling a working value invalid. */
export function stripCodeFence(s: string): string {
    const t = s.trim();
    if (!t.startsWith("```")) return t;
    const firstNewline = t.indexOf("\n");
    if (firstNewline === -1) return t;
    const body = t.slice(firstNewline + 1);
    const closing = body.lastIndexOf("```");
    return (closing === -1 ? body : body.slice(0, closing)).trim();
}

export type ParseResult =
    | {ok: true; doc: BlockKitDoc}
    | {ok: false; error: string};

/**
 * parseBlocks accepts exactly what the executor accepts: a bare array, or the
 * Block Kit Builder's {"blocks":[…]} object, either optionally fenced.
 *
 * Keeping the two in step matters more than being strict. A value this editor
 * rejects but the executor would have sent is a message the author cannot edit
 * yet which works at runtime — the worst of both.
 */
export function parseBlocks(raw: string): ParseResult {
    const cleaned = stripCodeFence(raw ?? "");
    if (cleaned === "") return {ok: true, doc: {blocks: [], wrapped: false}};

    let parsed: any;
    try {
        parsed = JSON.parse(cleaned);
    } catch (e) {
        return {ok: false, error: e instanceof Error ? e.message : "not valid JSON"};
    }

    if (Array.isArray(parsed)) return {ok: true, doc: {blocks: parsed, wrapped: false}};

    if (parsed && typeof parsed === "object" && Array.isArray(parsed.blocks)) {
        return {ok: true, doc: {blocks: parsed.blocks, wrapped: true}};
    }

    return {ok: false, error: 'expected a JSON array of blocks, or an object with a "blocks" array'};
}

/** serialiseBlocks renders the document back to the shape it arrived in. */
export function serialiseBlocks(doc: BlockKitDoc): string {
    const body = doc.wrapped ? {blocks: doc.blocks} : doc.blocks;
    return JSON.stringify(body, null, 2);
}

/** A new block of the given type, with the minimum Slack requires. */
export function newBlock(type: EditableType): any {
    switch (type) {
        case "header":
            return {type: "header", text: {type: "plain_text", text: "Heading"}};
        case "section":
            return {type: "section", text: {type: "mrkdwn", text: "Some *text*"}};
        case "divider":
            return {type: "divider"};
        case "context":
            return {type: "context", elements: [{type: "mrkdwn", text: "Context"}]};
        case "image":
            return {type: "image", image_url: "", alt_text: ""};
        case "actions":
            return {
                type: "actions",
                elements: [{type: "button", text: {type: "plain_text", text: "Button"}, url: ""}],
            };
    }
}

export const BLOCK_LABELS: Record<string, string> = {
    header: "Heading",
    section: "Text",
    divider: "Divider",
    context: "Context",
    image: "Image",
    actions: "Buttons",
};

export const BLOCK_ICONS: Record<string, string> = {
    header: "bookmark",
    section: "align-left",
    divider: "minus",
    context: "circle-exclamation",
    image: "image",
    actions: "hand",
};

/**
 * describeProblems reports what Slack will reject, before Slack does.
 *
 * Advisory only — it never blocks saving. The author may be mid-edit, and a
 * value can be a ${...} that only resolves at run time, so the editor is in no
 * position to be certain. Slack's own errors name a block index and little else,
 * which is why this exists at all.
 */
export function describeProblems(doc: BlockKitDoc): string[] {
    const problems: string[] = [];
    if (doc.blocks.length > 50) {
        problems.push(`Slack allows 50 blocks per message; this has ${doc.blocks.length}.`);
    }
    doc.blocks.forEach((b, i) => {
        const at = `Block ${i + 1}`;
        if (!b || typeof b !== "object") {
            problems.push(`${at} is not an object.`);
            return;
        }
        if (!b.type) {
            problems.push(`${at} has no "type".`);
            return;
        }
        if (b.type === "header" && !b.text?.text?.trim()) {
            problems.push(`${at} (heading) has no text.`);
        }
        if (b.type === "section" && !b.text?.text?.trim() && !(b.fields?.length > 0)) {
            problems.push(`${at} (text) needs either text or fields.`);
        }
        if (b.type === "image" && !b.image_url?.trim()) {
            problems.push(`${at} (image) has no image URL.`);
        }
        if (b.type === "image" && !b.alt_text?.trim()) {
            problems.push(`${at} (image) has no alt text — Slack requires it.`);
        }
    });
    return problems;
}

/** blockKitBuilderURL hands the current message to Slack's own builder.
 *  We cannot embed it — it is their site — but we can open it pre-loaded. */
export function blockKitBuilderURL(doc: BlockKitDoc): string {
    const payload = encodeURIComponent(JSON.stringify({blocks: doc.blocks}));
    return `https://app.slack.com/block-kit-builder#${payload}`;
}
