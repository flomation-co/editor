import type { PluginDefinition } from "~/types";

// The Add Node menu used to open on the five node types and then a category
// tree. That reads the way the catalogue is stored rather than the way anyone
// describes what they want: people arrive wanting "something in Slack" or
// "something in HubSpot", not "a Processing node in the Messaging category".
//
// So the top level is now a shelf of everyday areas, and one level down is the
// service — the product a person would name out loud. Triggers, conditionals
// and outputs are the editor's own vocabulary rather than a third-party
// service, so they lead as Building blocks.

export const CLOUD_GROUP = "Cloud & data";

// Cloud comes last, and only last. Oracle, AWS, Azure and the data stores are
// 59% of the catalogue by count and irrelevant to most flows; left in
// alphabetical order they bury the fourteen actions someone actually wants.
export const GROUP_ORDER: string[] = [
    "Building blocks",
    "Messaging",
    "Documents",
    "Calendars",
    "Sales & CRM",
    "Advertising",
    "Work tracking",
    "Finance",
    "Developer tools",
    "AI & agents",
    "Media",
    "Forms",
    "Websites",
    "UK Government",
    "More",
    CLOUD_GROUP,
];

export const GROUP_ICON: Record<string, string> = {
    "Building blocks": "microchip",
    "Messaging": "comments",
    "Documents": "file-lines",
    "Calendars": "calendar",
    "Sales & CRM": "user-group",
    "Advertising": "bullhorn",
    "Work tracking": "list-check",
    "Finance": "cart-shopping",
    "Developer tools": "code",
    "AI & agents": "brain",
    "Media": "image",
    "Forms": "clipboard-list",
    "Websites": "globe",
    "UK Government": "landmark",
    "More": "cubes",
    [CLOUD_GROUP]: "cloud",
};

export const GROUP_BLURB: Record<string, string> = {
    "Building blocks": "Triggers, branching, variables and the flow's own plumbing",
    "Messaging": "Chat, email and the channels people talk on",
    "Documents": "Drives, documents, spreadsheets and mail",
    "Calendars": "Bookings, calendars and availability",
    "Sales & CRM": "Contacts, pipelines and campaigns",
    "Advertising": "Paid advertising — campaigns, budgets, keywords and reporting",
    "Work tracking": "Boards, tickets and issues",
    "Finance": "Payments, ledgers and storefronts",
    "Developer tools": "Repositories, pipelines and machines",
    "AI & agents": "Models, prompts and your agents' own memory",
    "Media": "Images, video and generated assets",
    "Forms": "Form providers and their responses",
    "Websites": "Sites, CMSes and the open web",
    "UK Government": "Public registers and government APIs",
    "More": "Everything without a shelf of its own yet",
    [CLOUD_GROUP]: "Infrastructure, databases and cloud providers",
};

// Category key → shelf. These are the API's keys, not the executor's directory
// names: the API remaps several (jira, trello, asana and monday all arrive as
// "project-management"; hubspot as "crm"; mailchimp as "marketing"; databricks
// as "data-warehouse"), and grouping on the directory names instead would drop
// every one of them into "More".
//
// A key absent here lands in "More", which is a prompt to place it rather than
// a bin: the shelf should be obvious for anything people reach for often.
const GROUP_OF_CATEGORY: Record<string, string> = {
    trigger: "Building blocks",
    common: "Building blocks",
    conditional: "Building blocks",
    output: "Building blocks",
    subflow: "Building blocks",
    journey: "Building blocks",
    string: "Building blocks",
    arithmetic: "Building blocks",
    makefile: "Building blocks",
    file: "Building blocks",
    filetransfer: "Building blocks",
    error: "Building blocks",
    humanintheloop: "Building blocks",
    plan: "Building blocks",

    slack: "Messaging",
    messaging: "Messaging",
    twilio: "Messaging",
    elevenlabs: "Messaging",
    social: "Messaging",
    marketing: "Messaging",

    microsoft: "Documents",
    google: "Documents",
    notion: "Documents",
    document: "Documents",

    scheduling: "Calendars",

    crm: "Sales & CRM",

    "project-management": "Work tracking",
    linear: "Work tracking",
    helpdesk: "Work tracking",

    stripe: "Finance",
    quickbooks: "Finance",
    xero: "Finance",
    ecommerce: "Finance",

    devops: "Developer tools",
    gitlab: "Developer tools",
    github: "Developer tools",
    git: "Developer tools",
    desktop: "Developer tools",
    script: "Developer tools",
    security: "Developer tools",
    ssh: "Developer tools",

    agent: "AI & agents",
    ai: "AI & agents",

    video: "Media",
    image: "Media",
    heygen: "Media",
    graphics: "Media",

    forms: "Forms",

    cms: "Websites",
    webflow: "Websites",
    airtable: "Websites",
    web: "Websites",

    ukgov: "UK Government",

    oracle: CLOUD_GROUP,
    aws: CLOUD_GROUP,
    azure: CLOUD_GROUP,
    infrastructure: CLOUD_GROUP,
    messagebrokers: CLOUD_GROUP,
    vectordatabase: CLOUD_GROUP,
    "data-warehouse": CLOUD_GROUP,
    sql: CLOUD_GROUP,
    nosql: CLOUD_GROUP,
};

// A few services sit on a different shelf from their parent category: Google
// and Microsoft are filed under documents, but their calendars belong with the
// other calendars, which is where someone looking for them will go first.
const GROUP_OF_SERVICE: Record<string, string> = {
    "google/calendar": "Calendars",
    "microsoft/outlook": "Calendars",
    "google/gmail": "Messaging",

    // The ad platforms live under the "marketing" category key alongside
    // SendGrid and Mailchimp, which puts them on the Messaging shelf — nobody
    // looks for their ad account under Messaging. Overriding by service rather
    // than remapping the category keeps the email tools where they belong.
    "marketing/meta_ads": "Advertising",
    "marketing/google_ads": "Advertising",
};

export type Service = {
    key: string;
    name: string;
    icon: string;
    description: string;
    actions: PluginDefinition[];
};

export type Group = {
    name: string;
    icon: string;
    blurb: string;
    services: Service[];
    count: number;
};

// A few categories are one product whose sub-categories are facets of it
// rather than services in their own right. HeyGen split into six — Account,
// Avatars, Templates, Translation, Videos, Voices — which reads as six
// products nobody has heard of instead of one they have. Collapse those to the
// category. AWS and Google are the opposite case: nobody asks for "an AWS
// action", they ask for S3.
const COLLAPSE_TO_CATEGORY = new Set<string>(["heygen"]);

// A service is the sub-category where the category has one (AWS ▸ S3, Google ▸
// Drive) and the category itself otherwise (Slack, Notion). That is the level
// people name, and it is why HeyGen's six fragments read as one service while
// AWS does not read as one.
const serviceOf = (plugin: PluginDefinition): Service => {
    const category = plugin.category;
    if (category?.sub_key && !COLLAPSE_TO_CATEGORY.has(category.key)) {
        return {
            key: `${category.key}/${category.sub_key}`,
            name: category.sub_name || category.sub_key,
            icon: category.sub_icon || category.icon,
            description: category.sub_description || "",
            actions: [],
        };
    }
    return {
        key: category?.key || "other",
        name: category?.name || "Other",
        icon: category?.icon || "cubes",
        description: category?.description || "",
        actions: [],
    };
};

const groupOf = (plugin: PluginDefinition, serviceKey: string): string =>
    GROUP_OF_SERVICE[serviceKey] || GROUP_OF_CATEGORY[plugin.category?.key || ""] || "More";

// buildGroups turns the flat plugin list into shelves of services. Empty
// shelves are dropped, so a deployment without (say) any UK Government actions
// simply does not show that shelf.
export const buildGroups = (plugins: PluginDefinition[]): Group[] => {
    const services = new Map<string, Service>();
    const groupOfService = new Map<string, string>();

    for (const plugin of plugins) {
        const service = serviceOf(plugin);
        const existing = services.get(service.key);
        if (existing) {
            existing.actions.push(plugin);
        } else {
            service.actions.push(plugin);
            services.set(service.key, service);
            groupOfService.set(service.key, groupOf(plugin, service.key));
        }
    }

    const byGroup = new Map<string, Service[]>();
    for (const service of services.values()) {
        const name = groupOfService.get(service.key) || "More";
        const list = byGroup.get(name) || [];
        list.push(service);
        byGroup.set(name, list);
    }

    const groups: Group[] = [];
    for (const name of GROUP_ORDER) {
        const list = byGroup.get(name);
        if (!list || list.length === 0) continue;
        // Services ordered by size: the shelf should open on the ones carrying
        // most of the work rather than on whatever starts with A.
        list.sort((a, b) => b.actions.length - a.actions.length || a.name.localeCompare(b.name));
        for (const service of list) {
            service.actions.sort((a, b) => a.name.localeCompare(b.name));
        }
        groups.push({
            name,
            icon: GROUP_ICON[name] || "cubes",
            blurb: GROUP_BLURB[name] || "",
            services: list,
            count: list.reduce((total, service) => total + service.actions.length, 0),
        });
    }
    return groups;
};

// The handful worth a shortcut on the way in. Ids rather than names, so a
// rename in the catalogue cannot silently repoint one of these at the wrong
// action; anything missing from the manifest is skipped.
export const POPULAR_ACTION_IDS: string[] = [
    "messaging/email/send",
    "slack/send_message",
    "web/request",
    "common/format_date",
    "common/set_variable",
    "script/javascript",
];
