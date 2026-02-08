import test from "node:test";
import assert from "node:assert/strict";

import {
  isAllowedSeedUrl,
  normalizeSeedUrls,
  searchLiterature,
} from "../src/literatureService.js";

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

test("Wiley subdomain seed fetches via RSS even if Crossref fails", async () => {
  const originalFetch = globalThis.fetch;
  const feedUrl =
    "https://onlinelibrary.wiley.com/action/showFeed?type=etoc&feed=rss&jc=15214095";
  const crossrefUrl =
    "https://api.crossref.org/works/10.1002%2Fexample.1";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <item>
      <title>First Article</title>
      <link>https://onlinelibrary.wiley.com/doi/10.1002/example.1</link>
      <dc:identifier>doi:10.1002/example.1</dc:identifier>
      <pubDate>2026-01-20</pubDate>
      <dc:source>Test Journal</dc:source>
    </item>
    <item>
      <title>Second Article No DOI</title>
      <link>https://onlinelibrary.wiley.com/action/download?some=1</link>
      <pubDate>2026-01-19</pubDate>
      <dc:source>Test Journal</dc:source>
    </item>
  </channel>
</rss>`;

  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href === feedUrl) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => xml,
      };
    }
    if (href === crossrefUrl) {
      return {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: async () => ({}),
      };
    }
    throw new Error(`Unexpected fetch: ${href}`);
  };

  try {
    const items = await searchLiterature({
      seedUrls: ["https://advanced.onlinelibrary.wiley.com/toc/15214095/0/0"],
      startDate: "2026-01-15",
      endDate: "2026-01-21",
      maxResults: 10,
    });

    assert.equal(items.length, 2);
    assert.equal(items[0]?.title, "First Article");
    assert.equal(items[0]?.doi, "10.1002/example.1");
    assert.equal(items[1]?.title, "Second Article No DOI");
    assert.equal(items[1]?.doi, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Wiley supplements missing items from HTML listing order", async () => {
  const originalFetch = globalThis.fetch;
  const seedUrl = "https://advanced.onlinelibrary.wiley.com/toc/15214095/0/0";
  const feedUrl =
    "https://onlinelibrary.wiley.com/action/showFeed?type=etoc&feed=rss&jc=15214095";
  const crossrefUrl1 = "https://api.crossref.org/works/10.1002%2Fexample.1";
  const crossrefUrl3 = "https://api.crossref.org/works/10.1002%2Fexample.3";

  const seedHtml = `<!doctype html>
<html>
  <head>
    <link rel="alternate" type="application/rss+xml" href="${feedUrl}" />
  </head>
  <body>
    <article>
      <a href="https://onlinelibrary.wiley.com/doi/10.1002/example.1">First Article Listing</a>
      <time datetime="2026-01-20">2026-01-20</time>
    </article>
    <article>
      <a href="https://onlinelibrary.wiley.com/doi/10.1002/example.3">Third Article Listing Only</a>
      <time datetime="2026-01-19">2026-01-19</time>
    </article>
  </body>
</html>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <item>
      <title>First Article RSS</title>
      <link>https://onlinelibrary.wiley.com/doi/10.1002/example.1</link>
      <dc:identifier>doi:10.1002/example.1</dc:identifier>
      <pubDate>2026-01-20</pubDate>
      <dc:source>Test Journal</dc:source>
    </item>
  </channel>
</rss>`;

  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href === seedUrl) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => seedHtml,
      };
    }
    if (href === feedUrl) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => xml,
      };
    }
    if (href === crossrefUrl1 || href === crossrefUrl3) {
      return {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: async () => ({}),
      };
    }
    throw new Error(`Unexpected fetch: ${href}`);
  };

  try {
    const items = await searchLiterature({
      seedUrls: [seedUrl],
      startDate: "2026-01-15",
      endDate: "2026-01-21",
      maxResults: 10,
    });

    assert.equal(items.length, 2);
    assert.equal(items[0]?.doi, "10.1002/example.1");
    assert.equal(items[0]?.title, "First Article Listing");
    assert.equal(items[1]?.doi, "10.1002/example.3");
    assert.equal(items[1]?.title, "Third Article Listing Only");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ACS falls back to discovering RSS from HTML", async () => {
  const originalFetch = globalThis.fetch;
  const seedUrl = "https://pubs.acs.org/seed/page";
  const feedUrl =
    "https://pubs.acs.org/action/showFeed?type=etoc&feed=rss&jc=JOURNAL";
  const crossrefUrl =
    "https://api.crossref.org/works/10.1021%2Fexample.2";

  const seedHtml = `<!doctype html>
<html>
  <head>
    <link rel="alternate" type="application/rss+xml" href="${feedUrl}" />
  </head>
  <body>seed</body>
</html>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <item>
      <title>ACS Item</title>
      <link>https://pubs.acs.org/doi/10.1021/example.2</link>
      <dc:identifier>doi:10.1021/example.2</dc:identifier>
      <pubDate>2026-01-20</pubDate>
      <dc:source>ACS Journal</dc:source>
    </item>
  </channel>
</rss>`;

  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href === seedUrl) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => seedHtml,
      };
    }
    if (href === feedUrl) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => xml,
      };
    }
    if (href === crossrefUrl) {
      return {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: async () => ({}),
      };
    }
    throw new Error(`Unexpected fetch: ${href}`);
  };

  try {
    const items = await searchLiterature({
      seedUrls: [seedUrl],
      startDate: "2026-01-15",
      endDate: "2026-01-21",
      maxResults: 10,
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]?.source, "acs");
    assert.equal(items[0]?.doi, "10.1021/example.2");
    assert.equal(items[0]?.title, "ACS Item");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
