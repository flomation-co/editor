// Checks for the Block Kit document model.
//
// Run with:  npm run check:blockkit
//
// This repository has no test harness, and adding one is a decision wider than
// this feature — so this is a standalone script rather than a suite wired into
// CI. It is here because the model carries one guarantee that is expensive to
// get wrong: a message pasted from Slack's own Block Kit Builder must survive
// being opened, edited and saved, including the blocks this editor cannot lay
// out. Silently dropping those would lose somebody's work with no error.

import {parseBlocks, serialiseBlocks, describeProblems, isEditable, newBlock, stripCodeFence} from "./model";

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
    if (cond) { pass++; console.log(`  PASS  ${name}`); }
    else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

// The real value from the screenshot's node: Block Kit Builder output.
const builderOutput = JSON.stringify({blocks: [
    {type: "header", text: {type: "plain_text", text: "🆕 New Critical Path Registration"}},
    {type: "section", fields: [{type: "mrkdwn", text: "*Name:*\n${full_name}"}]},
    {type: "divider"},
]});

console.log("\n-- accepted shapes (must match what the executor accepts) --");
check("bare array", parseBlocks('[{"type":"divider"}]').ok);
check('{"blocks":[...]} wrapper', parseBlocks(builderOutput).ok);
check("fenced JSON (as an AI emits)", parseBlocks('```json\n[{"type":"divider"}]\n```').ok);
check("empty is valid, not an error", parseBlocks("").ok);
check("garbage is rejected", !parseBlocks("{oh dear").ok);
check("object without blocks is rejected", !parseBlocks('{"text":"hi"}').ok);

console.log("\n-- the shape it arrived in is the shape it leaves in --");
const wrapped = parseBlocks(builderOutput);
if (wrapped.ok) {
    const out = serialiseBlocks(wrapped.doc);
    check("wrapper preserved", out.trimStart().startsWith('{'), out.slice(0, 20));
    check("wrapper round-trips to identical blocks",
        JSON.stringify(JSON.parse(out).blocks) === JSON.stringify(JSON.parse(builderOutput).blocks));
}
const bare = parseBlocks('[{"type":"divider"}]');
if (bare.ok) check("bare array stays bare", serialiseBlocks(bare.doc).trimStart().startsWith('['));

console.log("\n-- nothing is dropped: the guarantee --");
const exotic = JSON.stringify([
    {type: "header", text: {type: "plain_text", text: "Known"}},
    {type: "input", element: {type: "plain_text_input", action_id: "x"}, label: {type: "plain_text", text: "Unmodelled"}},
    {type: "video", title: {type: "plain_text", text: "v"}, video_url: "https://x/y", thumbnail_url: "t", alt_text: "a", author_name: "n"},
    {type: "rich_text", elements: [{type: "rich_text_section", elements: [{type: "text", text: "hi"}]}]},
]);
const ex = parseBlocks(exotic);
if (ex.ok) {
    check("unmodelled blocks survive a round trip",
        JSON.stringify(JSON.parse(serialiseBlocks(ex.doc))) === JSON.stringify(JSON.parse(exotic)));
    check("editor knows which it can lay out", isEditable(ex.doc.blocks[0]) && !isEditable(ex.doc.blocks[1]));
    check("3 of 4 are carried as raw", ex.doc.blocks.filter(b => !isEditable(b)).length === 3);
}

console.log("\n-- ${...} variables survive untouched --");
const withVars = '[{"type":"section","text":{"type":"mrkdwn","text":"Hello ${user.name} from ${secrets.X}"}}]';
const wv = parseBlocks(withVars);
if (wv.ok) check("variables preserved verbatim",
    serialiseBlocks(wv.doc).includes("${user.name}") && serialiseBlocks(wv.doc).includes("${secrets.X}"));

console.log("\n-- advisory validation --");
const probs = parseBlocks('[{"type":"image","image_url":"","alt_text":""},{"type":"header","text":{"type":"plain_text","text":""}}]');
if (probs.ok) {
    const p = describeProblems(probs.doc);
    check("flags a missing image URL", p.some(x => x.includes("image URL")));
    check("flags missing alt text", p.some(x => x.includes("alt text")));
    check("flags an empty heading", p.some(x => x.includes("heading")));
}
const many = parseBlocks(JSON.stringify(Array.from({length: 51}, () => ({type: "divider"}))));
if (many.ok) check("flags over Slack's 50-block limit", describeProblems(many.doc).some(x => x.includes("50 blocks")));
const clean = parseBlocks('[{"type":"divider"}]');
if (clean.ok) check("says nothing about a valid message", describeProblems(clean.doc).length === 0);

console.log("\n-- new blocks are valid to Slack --");
for (const t of ["header","section","divider","context","image","actions"] as const) {
    const b = newBlock(t);
    check(`new ${t} has a type`, b.type === t);
}
check("stripCodeFence leaves plain JSON alone", stripCodeFence('[{"a":1}]') === '[{"a":1}]');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
