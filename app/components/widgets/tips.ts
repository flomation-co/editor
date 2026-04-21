export type Tip = {
    title: string;
    body: string;
    icon: string;
    link?: string;
    linkLabel?: string;
};

const tips: Tip[] = [
    {
        title: "Use Variables Everywhere",
        body: "Reference secrets, environment properties and upstream outputs with ${...} syntax in any input field — even numbers and booleans.",
        icon: "code",
    },
    {
        title: "Keyboard Shortcuts",
        body: "Press Ctrl+C / Ctrl+V to copy and paste nodes in the editor. Right-click a node for more options like duplicate and delete.",
        icon: "terminal",
    },
    {
        title: "Environment Secrets",
        body: "Store API keys and passwords in Environment Secrets. They're encrypted at rest and automatically injected into your flows at runtime.",
        icon: "lock",
    },
    {
        title: "Switch Nodes",
        body: "Use Switch nodes for multi-way branching. Define cases with equals, contains, starts_with, ends_with, or regex operators.",
        icon: "code-branch",
    },
    {
        title: "Error Handling",
        body: "Add an On Error node to catch failures gracefully. Wire it to a Slack or Email action to get notified when things go wrong.",
        icon: "triangle-exclamation",
    },
    {
        title: "AI-Powered Actions",
        body: "Connect AI nodes to tool nodes via the Tools handle. The AI will automatically call your tools and use the results in its response.",
        icon: "robot",
    },
    {
        title: "Sub-Flows",
        body: "Break complex workflows into reusable sub-flows. Use Begin/End nodes to define them and Invoke to call them from other flows.",
        icon: "arrows-split-up-and-left",
    },
    {
        title: "Schedule Triggers",
        body: "Set up flows to run on a schedule — every N minutes, daily at a specific time, or weekly on chosen days. All timezone-aware.",
        icon: "clock",
    },
    {
        title: "Execution Inspector",
        body: "Click any node during or after execution to inspect its inputs, outputs and duration. Audio and images render inline.",
        icon: "magnifying-glass",
    },
    {
        title: "Flow Notifications",
        body: "Enable email notifications on flow success or failure from the bell icon in the editor toolbar. Great for long-running workflows.",
        icon: "bell",
    },
    {
        title: "Favourite Flows",
        body: "Star your most-used flows to pin them to the top of the flows list. Click the star icon on any flow card.",
        icon: "star",
    },
    {
        title: "Git-Triggered Flows",
        body: "Use a Git Poll trigger to automatically run flows when new commits are pushed to a branch. Supports SSH authentication.",
        icon: "code-branch",
    },
    {
        title: "Conditional Logic",
        body: "Conditional nodes evaluate an expression and route to True or False branches. Chain them for complex decision trees.",
        icon: "code-branch",
    },
    {
        title: "Loop Nodes",
        body: "Loop nodes iterate over arrays or repeat a fixed number of times. The current item and index are available to child nodes.",
        icon: "rotate",
    },
    {
        title: "Webhook Triggers",
        body: "Expose a unique URL that triggers your flow when called. Perfect for integrating with external services and CI/CD pipelines.",
        icon: "globe",
    },
    {
        title: "Multi-Factor Authentication",
        body: "Protect your account with TOTP-based MFA. Set it up from the Security tab in your profile settings.",
        icon: "shield-halved",
        link: "/profile",
        linkLabel: "Go to Settings",
    },
    {
        title: "Form Triggers",
        body: "Build custom forms with multiple pages and question types. Share the form URL and trigger flows on submission.",
        icon: "clipboard-list",
    },
    {
        title: "QR Code Triggers",
        body: "Generate a QR code that triggers your flow when scanned. Great for check-ins, asset tracking, and physical-to-digital workflows.",
        icon: "qrcode",
    },
    {
        title: "String Manipulation",
        body: "Use string actions to transform data — split, join, replace, regex extract, base64 encode/decode, and more.",
        icon: "align-left",
    },
    {
        title: "SQL Queries",
        body: "Connect directly to PostgreSQL, MySQL, or MSSQL databases. Run SELECT queries or DML statements from within your flows.",
        icon: "database",
    },
    {
        title: "ElevenLabs Integration",
        body: "Convert text to lifelike speech with ElevenLabs TTS, or transcribe audio with speech-to-text. List available voices dynamically.",
        icon: "elevenlabs",
    },
    {
        title: "S3 Triggers",
        body: "Monitor an S3 bucket for new, changed, or deleted objects. The trigger fires automatically when changes are detected.",
        icon: "cloud",
    },
    {
        title: "Agents",
        body: "Create AI agents that respond to messages across Slack, Telegram, and email. They can use tools, remember context, and run scheduled tasks.",
        icon: "robot",
        link: "/agents",
        linkLabel: "View Agents",
    },
    {
        title: "Environments",
        body: "Create multiple environments (dev, staging, production) with different secrets and properties. Switch between them in the editor toolbar.",
        icon: "layer-group",
        link: "/environments",
        linkLabel: "Manage Environments",
    },
    {
        title: "Teams & Permissions",
        body: "Organise users into teams and control who can view, edit, or execute flows with role-based access control.",
        icon: "user-group",
    },
    {
        title: "Import & Export",
        body: "Export flows as JSON to back them up or share with colleagues. Import them into any Flomation instance.",
        icon: "file-export",
    },
    {
        title: "Auto-Wiring",
        body: "When you connect nodes, outputs from parent nodes are automatically mapped to matching input names on child nodes.",
        icon: "plug",
    },
    {
        title: "HTTP Requests",
        body: "The HTTP Request action supports GET, POST, PUT, PATCH, DELETE with custom headers, body, and authentication. Parse JSON responses automatically.",
        icon: "globe",
    },
    {
        title: "Linear Integration",
        body: "Create, update, search and manage Linear issues directly from your flows. Supports labels, estimates, parent issues, and more.",
        icon: "linear",
    },
];

export function getRandomTip(): Tip {
    return tips[Math.floor(Math.random() * tips.length)];
}

export default tips;
