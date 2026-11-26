export type CitationOutcome = {
\tmentioned: boolean;
\tstatus?: "success" | "provider_error" | string;
\tresponse?: string;
};

export type CitationSummary = {
\ttotal: number;
\tsuccessful: number;
\tfailed: number;
\tmentioned: number;
\trate: number;
};

/** Accept only a bare HTTPS hostname or an HTTPS URL with no path/query/userinfo. */
export function normalizePublicDomain(input: string): string | null {
\tconst raw = (input || "").trim();
\tif (!raw || raw.length > 253 || /[\s\\]/.test(raw)) return null;

\tlet url: URL;
\ttry {
\t\turl = new URL(raw.includes("://") ? raw : \`https://\${raw}\`);
\t} catch {
\t\treturn null;
\t}

\tif (
\t\turl.protocol !== "https:" ||
\t\turl.username ||
\t\turl.password ||
\t\turl.port ||
\t\t(url.pathname !== "/" && url.pathname !== "") ||
\t\turl.search ||
\t\turl.hash
\t) return null;

\tconst host = url.hostname.toLowerCase().replace(/\.$/, "");
\tif (
\t\t!host.includes(".") ||
\t\thost === "localhost" ||
\t\thost.endsWith(".localhost") ||
\t\thost.endsWith(".local") ||
\t\thost.endsWith(".internal") ||
\t\thost.endsWith(".test") ||
\t\thost.includes(":") ||
\t\t/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
\t\t!host.split(".").every((label) =>
\t\t\tlabel.length > 0 &&
\t\t\tlabel.length <= 63 &&
\t\t\t/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
\t\t)
\t) return null;

\treturn host;
}

/** Exact host allowlist. Subdomains are not implicitly trusted. */
export function isApprovedDomain(input: string, allowlist: string | undefined): boolean {
\tconst domain = normalizePublicDomain(input);
\tif (!domain || !allowlist?.trim()) return false;
\tconst approved = allowlist.split(",")
\t\t.map((item) => normalizePublicDomain(item))
\t\t.filter((item): item is string => Boolean(item));
\treturn approved.includes(domain);
}

export function isAuthorizedAdmin(email: string | undefined, allowlist: string | undefined): boolean {
\tconst normalized = (email || "").trim().toLowerCase();
\tif (!normalized || !allowlist?.trim()) return false;
\tconst approved = allowlist.split(",")
\t\t.map((item) => item.trim().toLowerCase())
\t\t.filter(Boolean);
\treturn approved.includes(normalized);
}

function normalizeMentionText(value: string): string {
\treturn (value || "")
\t\t.toLowerCase()
\t\t.replace(/https?:\/\//g, " ")
\t\t.replace(/[^a-z0-9]+/g, " ")
\t\t.trim()
\t\t.replace(/\s+/g, " ");
}

export function isBrandMentioned(response: string, terms: string[]): boolean {
\tconst haystack = \` \${normalizeMentionText(response)} \`;
\treturn terms.some((term) => {
\t\tconst needle = normalizeMentionText(term);
\t\treturn needle.length > 1 && haystack.includes(\` \${needle} \`);
\t});
}

/** Legacy results without status remain successful unless their response is a known error. */
export function summarizeCitations(citations: CitationOutcome[]): CitationSummary {
\tconst successfulRows = citations.filter((item) =>
\t\titem.status === "success" ||
\t\t(!item.status && !/^(error:|unified billing credits required|provider request failed)/i.test(item.response || ""))
\t);
\tconst failed = citations.length - successfulRows.length;
\tconst mentioned = successfulRows.filter((item) => item.mentioned).length;
\treturn {
\t\ttotal: citations.length,
\t\tsuccessful: successfulRows.length,
\t\tfailed,
\t\tmentioned,
\t\trate: successfulRows.length ? mentioned / successfulRows.length : 0,
\t};
}
