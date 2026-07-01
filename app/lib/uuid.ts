// uuidv4 returns a random v4 UUID.
//
// crypto.randomUUID() is only defined in a *secure context* (HTTPS or
// http://localhost). When the editor is served over plain HTTP to a
// non-localhost origin (e.g. a LAN IP like http://192.168.1.169:8080),
// crypto.randomUUID is undefined and calling it throws
// "self.crypto.randomUUID is not a function", which previously broke node
// creation / group creation / flow duplication. crypto.getRandomValues() is
// available in insecure contexts, so we fall back to building the UUID from it.
export function uuidv4(): string {
	const c = globalThis.crypto as Crypto | undefined;
	if (c && typeof c.randomUUID === "function") {
		return c.randomUUID();
	}
	const b = new Uint8Array(16);
	if (c && typeof c.getRandomValues === "function") {
		c.getRandomValues(b);
	} else {
		for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
	}
	b[6] = (b[6] & 0x0f) | 0x40; // version 4
	b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
	const h: string[] = [];
	for (let i = 0; i < 16; i++) h.push(b[i].toString(16).padStart(2, "0"));
	return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
}
