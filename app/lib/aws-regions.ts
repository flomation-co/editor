// Shared AWS region list for the searchable region pickers — used both by the
// AWS Role credential wizard and by every AWS action's `aws_region` property.
// name carries the human location so users can search by either the code or the
// place ("Ohio", "london", "eu-west").
export const AWS_REGIONS: { name: string; value: string }[] = [
    { name: "us-east-1 — N. Virginia", value: "us-east-1" },
    { name: "us-east-2 — Ohio", value: "us-east-2" },
    { name: "us-west-1 — N. California", value: "us-west-1" },
    { name: "us-west-2 — Oregon", value: "us-west-2" },
    { name: "ca-central-1 — Canada (Central)", value: "ca-central-1" },
    { name: "eu-west-1 — Ireland", value: "eu-west-1" },
    { name: "eu-west-2 — London", value: "eu-west-2" },
    { name: "eu-west-3 — Paris", value: "eu-west-3" },
    { name: "eu-central-1 — Frankfurt", value: "eu-central-1" },
    { name: "eu-north-1 — Stockholm", value: "eu-north-1" },
    { name: "eu-south-1 — Milan", value: "eu-south-1" },
    { name: "ap-south-1 — Mumbai", value: "ap-south-1" },
    { name: "ap-northeast-1 — Tokyo", value: "ap-northeast-1" },
    { name: "ap-northeast-2 — Seoul", value: "ap-northeast-2" },
    { name: "ap-northeast-3 — Osaka", value: "ap-northeast-3" },
    { name: "ap-southeast-1 — Singapore", value: "ap-southeast-1" },
    { name: "ap-southeast-2 — Sydney", value: "ap-southeast-2" },
    { name: "ap-east-1 — Hong Kong", value: "ap-east-1" },
    { name: "af-south-1 — Cape Town", value: "af-south-1" },
    { name: "me-south-1 — Bahrain", value: "me-south-1" },
    { name: "sa-east-1 — São Paulo", value: "sa-east-1" },
];
