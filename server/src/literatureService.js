const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_LISTING_PAGES = 100;

const ALLOWED_SEED_HOSTS = new Set([
  "nature.com",
  "www.nature.com",
  "science.org",
  "www.science.org",
]);

const MONTHS = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function withTimeout(timeoutMs, fn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return Promise.resolve()
    .then(() => fn(controller.signal))
    .finally(() => clearTimeout(timer));
}

async function fetchText(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const res = await withTimeout(timeoutMs, (signal) =>
    fetch(url, {
      method: "GET",
      redirect: "follow",
      signal,
      headers: {
        "User-Agent":
          "AppointerLiterature/0.1 (+https://localhost; purpose=literature-research)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    }),
  );

  if (!res.ok) {
    const err = new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    err.status = res.status;
    throw err;
  }

  return res.text();
}

function normalizeUrlString(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.hash = "";
  return url.toString();
}

export function isAllowedSeedUrl(raw) {
  const normalized = normalizeUrlString(raw);
  if (!normalized) return false;
  try {
    const url = new URL(normalized);
    return ALLOWED_SEED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function normalizeSeedUrls(seedUrls) {
  const src = Array.isArray(seedUrls) ? seedUrls : [];
  const normalized = [];
  const seen = new Set();

  for (const raw of src) {
    const urlString = normalizeUrlString(raw);
    if (!urlString) continue;
    if (!isAllowedSeedUrl(urlString)) continue;
    if (seen.has(urlString)) continue;
    seen.add(urlString);
    normalized.push(urlString);
  }

  return normalized;
}

export function normalizeDateInput(dateString) {
  if (typeof dateString !== "string") return null;
  const trimmed = dateString.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const date = new Date(trimmed);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isDateInRange(dateString, startDate, endDate) {
  if (!dateString || !startDate || !endDate) return false;
  return dateString >= startDate && dateString <= endDate;
}

function decodeHtmlEntities(input) {
  if (typeof input !== "string" || !input) return "";

  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " ",
  };

  return input.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, raw) => {
    if (!raw) return match;
    if (raw[0] === "#") {
      const isHex = raw[1] === "x" || raw[1] === "X";
      const num = isHex
        ? parseInt(raw.slice(2), 16)
        : parseInt(raw.slice(1), 10);
      if (!Number.isFinite(num) || num <= 0) return match;
      try {
        return String.fromCodePoint(num);
      } catch {
        return match;
      }
    }

    const key = raw.toLowerCase();
    return Object.prototype.hasOwnProperty.call(named, key) ? named[key] : match;
  });
}

function stripTags(input) {
  if (typeof input !== "string") return "";
  return input.replace(/<[^>]*>/g, " ");
}

function normalizeText(input) {
  return decodeHtmlEntities(stripTags(String(input || "")))
    .replace(/\s+/g, " ")
    .trim();
}

function parseNatureCardDateText(text) {
  const raw = normalizeText(text);
  const match = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = MONTHS[match[2].toLowerCase()] || null;
  if (!month) return null;
  return `${match[3]}-${month}-${day}`;
}

function parseNatureListingCandidates(html, seedUrl) {
  const results = [];
  const seen = new Set();
  const hrefRe =
    /href="(https?:\/\/www\.nature\.com\/articles\/[^"#\s]+|\/articles\/[^"#\s]+)"/gi;

  let match;
  while ((match = hrefRe.exec(html))) {
    const rawLink = match[1];
    const windowStart = match.index;
    const window = html.slice(windowStart, windowStart + 3000);

    const titleMatch =
      window.match(/<h[12-6][^>]*>([\s\S]*?)<\/h[12-6]>/i) ||
      window.match(/name="dc\.title" content="([^"]+)"/i) ||
      window.match(/property="og:title" content="([^"]+)"/i);
    const title = titleMatch ? normalizeText(titleMatch[1]) : "";
    if (!title) continue;

    const absolute = new URL(rawLink, seedUrl);
    absolute.hash = "";
    absolute.search = "";
    const articleUrl = absolute.toString();
    if (seen.has(articleUrl)) continue;
    seen.add(articleUrl);

    const dateMatch =
      window.match(/datetime="(\d{4}-\d{2}-\d{2})"/i) ||
      window.match(/class="[^"]*c-card__date[^"]*"[^>]*>([^<]+)</i);
    const publishedDate = dateMatch
      ? dateMatch[0].includes("datetime=")
        ? normalizeDateInput(dateMatch[1])
        : parseNatureCardDateText(dateMatch[1])
      : null;

    results.push({ articleUrl, title, publishedDate });
  }

  return results;
}

function parseMetaContent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`name="${escaped}"\\s+content="([^"]*)"`, "i");
  const m = html.match(re);
  return m ? decodeHtmlEntities(m[1]) : null;
}

function parseMetaProperty(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`property="${escaped}"\\s+content="([^"]*)"`, "i");
  const m = html.match(re);
  return m ? decodeHtmlEntities(m[1]) : null;
}

function extractNatureAbstract(html) {
  if (typeof html !== "string" || !html) return null;

  const blockMatch =
    html.match(/id="Abs1-content"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(
      /data-title="Abstract"[\s\S]*?<div[^>]*class="c-article-section__content"[^>]*>([\s\S]*?)<\/div>/i,
    );

  if (blockMatch) {
    const text = normalizeText(blockMatch[1]);
    if (text) return text;
  }

  const meta =
    parseMetaContent(html, "dc.description") ||
    parseMetaContent(html, "description") ||
    parseMetaProperty(html, "og:description") ||
    "";

  const normalized = normalizeText(meta);
  return normalized || null;
}

function parseNatureNextPageUrl(html, currentUrl) {
  if (typeof html !== "string" || !html) return null;

  const patterns = [
    /data-test="page-next"[\s\S]*?<a[^>]*href="([^"]+)"/i,
    /<a[^>]*rel="next"[^>]*href="([^"]+)"/i,
    /<link[^>]*rel="next"[^>]*href="([^"]+)"/i,
    /<a[^>]*aria-label="next"[^>]*href="([^"]+)"/i,
    /data-track-action="next"[^>]*href="([^"]+)"/i,
  ];

  for (const re of patterns) {
    const match = html.match(re);
    if (!match) continue;
    const href = decodeHtmlEntities(match[1] || "").trim();
    if (!href) continue;
    try {
      const nextUrl = new URL(href, currentUrl);
      nextUrl.hash = "";
      return nextUrl.toString();
    } catch {
      // ignore invalid links
    }
  }

  return null;
}

async function fetchNatureArticleDetails(articleUrl) {
  const html = await fetchText(articleUrl);

  const title =
    parseMetaContent(html, "dc.title") ||
    parseMetaProperty(html, "og:title") ||
    "";
  const publishedDate = normalizeDateInput(
    parseMetaContent(html, "prism.publicationDate") ||
      parseMetaContent(html, "article:published_time") ||
      "",
  );

  const abstract = extractNatureAbstract(html);

  const pdfUrl = `${articleUrl}.pdf`;

  return { title: normalizeText(title), publishedDate, abstract, pdfUrl };
}

function scienceSeedToRssUrl(seedUrl) {
  try {
    const url = new URL(seedUrl);
    if (
      url.hostname === "science.org" ||
      url.hostname === "www.science.org"
    ) {
      if (url.pathname.startsWith("/action/showFeed")) return url.toString();

      const journalMatch = url.pathname.match(/^\/journal\/([a-z0-9-]+)\/?$/i);
      const jc = journalMatch ? journalMatch[1] : "science";
      return `https://www.science.org/action/showFeed?type=etoc&feed=rss&jc=${encodeURIComponent(jc)}`;
    }
  } catch {
    // ignore
  }
  return null;
}

function parseScienceRssItems(xml) {
  const items = [];
  const itemRe =
    /<item\b[^>]*rdf:about="([^"]+)"[^>]*>([\s\S]*?)<\/item>/gi;

  let match;
  while ((match = itemRe.exec(xml))) {
    const about = match[1] || "";
    const body = match[2] || "";

    const titleMatch = body.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? normalizeText(titleMatch[1]) : "";

    const linkMatch = body.match(/<link>([\s\S]*?)<\/link>/i);
    const link = linkMatch ? decodeHtmlEntities(linkMatch[1]).trim() : about;

    const dateMatch = body.match(/<dc:date>([\s\S]*?)<\/dc:date>/i);
    const publishedDate = normalizeDateInput(dateMatch ? dateMatch[1] : "");

    const doiMatch = body.match(/<dc:identifier>\s*doi:([^<\s]+)\s*<\/dc:identifier>/i);
    const doi = doiMatch ? doiMatch[1].trim() : null;

    if (!doi || !title) continue;
    items.push({ doi, title, publishedDate, articleUrl: link || about });
  }

  return items;
}

function crossrefDateToDateString(message) {
  const candidates = [
    message?.["published-online"],
    message?.["published-print"],
    message?.issued,
    message?.created,
  ];

  for (const candidate of candidates) {
    const parts = candidate?.["date-parts"];
    const first = Array.isArray(parts) ? parts[0] : null;
    if (!Array.isArray(first) || first.length === 0) continue;

    const year = Number(first[0]);
    if (!Number.isInteger(year) || year < 1000) continue;
    const month = Number(first[1] ?? 1);
    const day = Number(first[2] ?? 1);
    const mm = String(Math.min(12, Math.max(1, month))).padStart(2, "0");
    const dd = String(Math.min(31, Math.max(1, day))).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }

  return null;
}

async function fetchCrossrefWork(doi) {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  const res = await withTimeout(DEFAULT_TIMEOUT_MS, (signal) =>
    fetch(url, {
      method: "GET",
      redirect: "follow",
      signal,
      headers: {
        "User-Agent":
          "AppointerLiterature/0.1 (+https://localhost; contact=unknown)",
        Accept: "application/json",
      },
    }),
  );

  if (!res.ok) {
    const err = new Error(`Crossref failed: ${res.status} ${res.statusText}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const message = data?.message || {};
  const title = Array.isArray(message.title) ? message.title[0] : message.title;
  const abstract = message.abstract || null;
  const publishedDate = crossrefDateToDateString(message);

  const links = Array.isArray(message.link) ? message.link : [];
  const pdfLink = links.find((l) => typeof l?.URL === "string" && l.URL);
  const pdfUrl = pdfLink?.URL ? String(pdfLink.URL) : null;

  return {
    title: normalizeText(title || ""),
    abstract: abstract ? normalizeText(abstract) : null,
    publishedDate: normalizeDateInput(publishedDate),
    pdfUrl,
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Math.min(10, Number(concurrency) || 4));
  const results = new Array(list.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(limit, list.length) }, () =>
    (async () => {
      while (true) {
        const currentIndex = index;
        index += 1;
        if (currentIndex >= list.length) return;
        try {
          results[currentIndex] = await mapper(list[currentIndex], currentIndex);
        } catch (err) {
          results[currentIndex] = { error: err?.message || String(err) };
        }
      }
    })(),
  );

  await Promise.all(workers);
  return results;
}

export async function searchLiterature({
  seedUrls,
  startDate,
  endDate,
  maxResults = 100,
} = {}) {
  const start = normalizeDateInput(startDate);
  const end = normalizeDateInput(endDate);
  if (!start || !end) {
    throw new Error("Invalid startDate/endDate; expected YYYY-MM-DD");
  }
  if (start > end) {
    throw new Error("startDate must be <= endDate");
  }

  const normalizedSeeds = normalizeSeedUrls(seedUrls);
  if (normalizedSeeds.length === 0) {
    throw new Error("seedUrls must include at least one valid URL");
  }

  const cap = Math.max(1, Math.min(100, Math.trunc(Number(maxResults) || 100)));
  const results = [];
  const seenIds = new Set();

  for (const seedUrl of normalizedSeeds) {
    if (results.length >= cap) break;
    const url = new URL(seedUrl);

    if (url.hostname.endsWith("nature.com")) {
      const visitedPages = new Set();
      const perSeedSeenArticles = new Set();

      let pageUrl = seedUrl;
      let pageCount = 0;

      while (
        pageUrl &&
        pageCount < MAX_LISTING_PAGES &&
        results.length < cap
      ) {
        if (visitedPages.has(pageUrl)) break;
        visitedPages.add(pageUrl);
        pageCount += 1;

        const html = await fetchText(pageUrl);
        const pageCandidates = parseNatureListingCandidates(html, pageUrl);

        const pageDates = pageCandidates
          .map((c) => c?.publishedDate)
          .filter(Boolean);
        const hasUnknownDate = pageCandidates.some((c) => !c?.publishedDate);
        const oldestDate = pageDates.length
          ? pageDates.reduce((min, current) => (current < min ? current : min))
          : null;

        const filteredCandidates = [];
        for (const c of pageCandidates) {
          if (!c?.articleUrl) continue;
          if (perSeedSeenArticles.has(c.articleUrl)) continue;
          perSeedSeenArticles.add(c.articleUrl);

          if (
            c.publishedDate &&
            !isDateInRange(c.publishedDate, start, end)
          ) {
            continue;
          }

          filteredCandidates.push(c);
        }

        const remaining = cap - results.length;
        const candidateCap = Math.min(200, Math.max(20, remaining * 5));
        const candidates = filteredCandidates.slice(0, candidateCap);

        const details = await mapWithConcurrency(candidates, 4, async (c) => {
          const d = await fetchNatureArticleDetails(c.articleUrl);
          const publishedDate = d.publishedDate || c.publishedDate || null;
          if (publishedDate && !isDateInRange(publishedDate, start, end)) {
            return null;
          }

          return {
            id: c.articleUrl,
            source: "nature",
            seedUrl,
            title: d.title || c.title || c.articleUrl,
            articleUrl: c.articleUrl,
            publishedDate,
            abstract: d.abstract,
            pdfUrl: d.pdfUrl,
            doi: null,
          };
        });

        for (const item of details) {
          if (!item || typeof item !== "object") continue;
          if (!item.id || seenIds.has(item.id)) continue;
          seenIds.add(item.id);
          results.push(item);
          if (results.length >= cap) break;
        }

        pageUrl = parseNatureNextPageUrl(html, pageUrl);

        if (oldestDate && !hasUnknownDate && oldestDate < start) {
          break;
        }
      }
      continue;
    }

    if (url.hostname.endsWith("science.org")) {
      const rssUrl = scienceSeedToRssUrl(seedUrl);
      if (!rssUrl) continue;

      const xml = await fetchText(rssUrl);
      const feedItems = parseScienceRssItems(xml)
        .filter((i) => !i.publishedDate || isDateInRange(i.publishedDate, start, end))
        .slice(0, 300);

      const enriched = await mapWithConcurrency(feedItems, 4, async (i) => {
        const meta = await fetchCrossrefWork(i.doi);
        const publishedDate = meta.publishedDate || i.publishedDate || null;
        if (publishedDate && !isDateInRange(publishedDate, start, end)) {
          return null;
        }

        const articleUrl = i.articleUrl || `https://doi.org/${i.doi}`;
        const id = `doi:${i.doi}`;

        return {
          id,
          source: "science",
          seedUrl,
          title: meta.title || i.title || id,
          articleUrl,
          publishedDate,
          abstract: meta.abstract,
          pdfUrl: meta.pdfUrl,
          doi: i.doi,
        };
      });

      for (const item of enriched) {
        if (!item || typeof item !== "object") continue;
        if (!item.id || seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        results.push(item);
        if (results.length >= cap) break;
      }
      continue;
    }
  }

  return results.slice(0, cap);
}
