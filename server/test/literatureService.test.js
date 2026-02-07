import test from "node:test";
import assert from "node:assert/strict";

import { isAllowedSeedUrl, normalizeSeedUrls } from "../src/literatureService.js";

test("allows Wiley subdomains as seed URLs", () => {
  assert.equal(
    isAllowedSeedUrl("https://advanced.onlinelibrary.wiley.com/toc/15214095/0/0"),
    true,
  );
});

test("rejects lookalike domains for seed URLs", () => {
  assert.equal(
    isAllowedSeedUrl("https://onlinelibrary.wiley.com.evil.com/toc/15214095/0/0"),
    false,
  );
});

test("normalizeSeedUrls keeps only allowed, unique urls", () => {
  const normalized = normalizeSeedUrls([
    " https://advanced.onlinelibrary.wiley.com/toc/15214095/0/0 ",
    "https://advanced.onlinelibrary.wiley.com/toc/15214095/0/0#hash",
    "https://example.com",
  ]);

  assert.deepEqual(normalized, [
    "https://advanced.onlinelibrary.wiley.com/toc/15214095/0/0",
  ]);
});

