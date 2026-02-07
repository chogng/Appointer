import test from "node:test";
import assert from "node:assert/strict";

import { isAllowedSeedUrl, normalizeSeedUrls } from "../src/literatureService.js";

test("literatureService allows ACS seed URLs (pubs.acs.org)", () => {
  assert.equal(isAllowedSeedUrl("https://pubs.acs.org/toc/nalefd/0/0"), true);
  assert.equal(
    isAllowedSeedUrl("https://pubs.acs.org/action/showFeed?type=etoc&feed=rss&jc=nalefd"),
    true,
  );
});

test("literatureService allows Wiley seed URLs (onlinelibrary.wiley.com)", () => {
  assert.equal(
    isAllowedSeedUrl("https://onlinelibrary.wiley.com/toc/15214095/current"),
    true,
  );
  assert.equal(
    isAllowedSeedUrl("https://onlinelibrary.wiley.com/feed/15214095/most-recent"),
    true,
  );
});

test("literatureService normalizeSeedUrls keeps only allowed hosts", () => {
  const normalized = normalizeSeedUrls([
    "https://www.nature.com/nature/research-articles",
    "https://www.science.org/journal/sciadv",
    "https://pubs.acs.org/toc/nalefd/0/0",
    "https://onlinelibrary.wiley.com/toc/15214095/current",
    "https://example.com/not-supported",
  ]);

  assert.deepEqual(normalized, [
    "https://www.nature.com/nature/research-articles",
    "https://www.science.org/journal/sciadv",
    "https://pubs.acs.org/toc/nalefd/0/0",
    "https://onlinelibrary.wiley.com/toc/15214095/current",
  ]);
});
