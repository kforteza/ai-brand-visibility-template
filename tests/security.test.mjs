import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePublicDomain,
  isApprovedDomain,
  isAuthorizedAdmin,
  isBrandMentioned,
  summarizeCitations,
} from "../workers/security.ts";

test("normalizes approved HTTPS hostnames", () => {
  assert.equal(normalizePublicDomain("fortezarealty.com"), "fortezarealty.com");
  assert.equal(normalizePublicDomain("https://fortezarealty.com"), "fortezarealty.com");
});

test("rejects URL paths, credentials, ports and non-HTTPS URLs", () => {
  assert.equal(normalizePublicDomain("http://fortezarealty.com"), null);
  assert.equal(normalizePublicDomain("https://user:pass@fortezarealty.com"), null);
  assert.equal(normalizePublicDomain("https://fortezarealty.com:8443"), null);
  assert.equal(normalizePublicDomain("https://fortezarealty.com/private"), null);
});

test("rejects localhost, private literals and non-public suffixes", () => {
  for (const value of ["localhost", "127.0.0.1", "10.0.0.1", "service.local", "db.internal", "site.test"]) {
    assert.equal(normalizePublicDomain(value), null, value);
  }
});

test("allowlist is exact and fails closed when missing", () => {
  assert.equal(isApprovedDomain("fortezarealty.com", "fortezarealty.com,fortezacredit.com"), true);
  assert.equal(isApprovedDomain("sub.fortezarealty.com", "fortezarealty.com"), false);
  assert.equal(isApprovedDomain("fortezarealty.com", undefined), false);
});

test("admin allowlist is case-insensitive and fails closed", () => {
  assert.equal(isAuthorizedAdmin("Broker@FortezaRealty.com", "broker@fortezarealty.com"), true);
  assert.equal(isAuthorizedAdmin("other@fortezarealty.com", "broker@fortezarealty.com"), false);
  assert.equal(isAuthorizedAdmin("broker@fortezarealty.com", undefined), false);
});

test("brand matching recognizes approved name and domain aliases", () => {
  assert.equal(isBrandMentioned("Forteza Realty helps buyers in Florida.", ["Forteza Realty", "fortezarealty.com"]), true);
  assert.equal(isBrandMentioned("Visit https://fortezarealty.com for details.", ["fortezarealty.com"]), true);
});

test("brand matching rejects incidental substrings", () => {
  assert.equal(isBrandMentioned("The word fortezas appears in a sentence.", ["Forteza"]), false);
});

test("visibility denominator excludes provider errors", () => {
  const summary = summarizeCitations([
    { status: "success", mentioned: true, response: "Forteza Realty" },
    { status: "provider_error", mentioned: false, response: "Provider request failed" },
    { mentioned: false, response: "A valid legacy answer" },
  ]);
  assert.deepEqual(summary, { total: 3, successful: 2, failed: 1, mentioned: 1, rate: 0.5 });
});

test("billing errors in legacy records are excluded", () => {
  const summary = summarizeCitations([
    { mentioned: false, response: "Unified Billing credits required." },
    { status: "provider_error", mentioned: false, response: "Timeout" },
  ]);
  assert.deepEqual(summary, { total: 2, successful: 0, failed: 2, mentioned: 0, rate: 0 });
});
