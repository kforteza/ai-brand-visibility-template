export type CitationOutcome = {
  mentioned: boolean;
  status?: "success" | "provider_error" | string;
  response?: string;
};

export type CitationSummary = {
  total: number;
  successful: number;
  failed: number;
  mentioned: number;
  rate: number;
};

/** Accept only a bare HTTPS hostname or an HTTPS URL with no path/query/userinfo. */
export function normalizePublicDomain(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw || raw.length > 253 || /[\s\\]/.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : "https://" + raw);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) return null;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".test") ||
    host.includes(":") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
    !host.split(".").every((label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    )
  ) return null;

  return host;
}

/** Exact host allowlist. Subdomains are not implicitly trusted. */
export function isApprovedDomain(input: string, allowlist: string | undefined): boolean {
  const domain = normalizePublicDomain(input);
  if (!domain || !allowlist?.trim()) return false;
  const approved = allowlist.split(",")
    .map((item) => normalizePublicDomain(item))
    .filter((item): item is string => Boolean(item));
  return approved.includes(domain);
}

export function isAuthorizedAdmin(email: string | undefined, allowlist: string | undefined): boolean {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized || !allowlist?.trim()) return false;
  const approved = allowlist.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return approved.includes(normalized);
}

function normalizeMentionText(value: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/https?:\/\//g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function isBrandMentioned(response: string, terms: string[]): boolean {
  const haystack = " " + normalizeMentionText(response) + " ";
  return terms.some((term) => {
    const needle = normalizeMentionText(term);
    return needle.length > 1 && haystack.includes(" " + needle + " ");
  });
}

/** Legacy results without status remain successful unless their response is a known error. */
export function summarizeCitations(citations: CitationOutcome[]): CitationSummary {
  const successfulRows = citations.filter((item) =>
    item.status === "success" ||
    (!item.status && !/^(error:|unified billing credits required|provider request failed)/i.test(item.response || ""))
  );
  const failed = citations.length - successfulRows.length;
  const mentioned = successfulRows.filter((item) => item.mentioned).length;
  return {
    total: citations.length,
    successful: successfulRows.length,
    failed,
    mentioned,
    rate: successfulRows.length ? mentioned / successfulRows.length : 0,
  };
}
