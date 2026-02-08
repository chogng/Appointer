const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_LISTING_PAGES = 100;

const ALLOWED_SEED_ROOT_DOMAINS = [
  "nature.com",
  "science.org",
  "pubs.acs.org",
  "onlinelibrary.wiley.com",
];

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
    const err = new Error(
      `Fetch failed: ${res.status} ${res.statusText} (${String(url)})`,
    );
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
    const host = String(url.hostname || "").toLowerCase();
    return ALLOWED_SEED_ROOT_DOMAINS.some(
      (root) => host === root || host.endsWith(`.${root}`),
    );
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

function escapeRegExp(input) {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function extractHtmlTitle(html) {
  const match = typeof html === "string" ? html.match(/<title>([\s\S]*?)<\/title>/i) : null;
  return match ? normalizeText(match[1]) : null;
}

function parseNatureListingContextFromHtml(html) {
  const title = extractHtmlTitle(html);
  if (!title) return { journalTitle: null, sectionTitle: null };

  const parts = title
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return { sectionTitle: parts[0] || null, journalTitle: parts[1] || null };
  }

  return { sectionTitle: parts[0] || null, journalTitle: null };
}

function parseNatureSeedPath(seedUrl) {
  try {
    const url = new URL(seedUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    return {
      journalSlug: parts[0] || null,
      sectionSlug: parts[1] || null,
    };
  } catch {
    return { journalSlug: null, sectionSlug: null };
  }
}

function buildNatureSourceContext({
  journalTitle,
  sectionTitle,
  journalSlug,
  sectionSlug,
} = {}) {
  const journal = String(journalTitle || "").trim() || null;
  const section = String(sectionTitle || "").trim() || null;
  if (journal && section) return `${journal} · ${section}`;
  if (journal) return journal;
  if (section) return section;
  const slugParts = [journalSlug, sectionSlug].filter(Boolean);
  return slugParts.length ? slugParts.join(" / ") : null;
}

function deriveNatureDoiFromArticleUrl(articleUrl) {
  try {
    const url = new URL(articleUrl);
    const match = url.pathname.match(/\/articles\/([^/]+)$/i);
    if (!match) return null;
    const code = String(match[1] || "").trim();
    if (!code) return null;
    return `10.1038/${code}`;
  } catch {
    return null;
  }
}

function parseNatureListingCandidates(html, seedUrl) {
  const results = [];
  const seen = new Set();
  const hrefRe =
    /<a\b[^>]*href="(https?:\/\/(?:www\.)?nature\.com\/articles\/[^"#\s]+|\/articles\/[^"#\s]+)"[^>]*>/gi;

  let match;
  while ((match = hrefRe.exec(html))) {
    const rawLink = match[1];
    const windowStart = match.index;
    const cardEnd = html.indexOf("</article>", windowStart);
    const windowEnd =
      cardEnd >= 0 ? cardEnd + "</article>".length : windowStart + 8000;
    const window = html.slice(windowStart, windowEnd);

    // Many Nature listing pages render the article title as the anchor text inside
    // <a href="/articles/...">TITLE</a>, while the surrounding <h3> starts *before*
    // the href attribute. Prefer extracting the anchor text from this local window.
    const anchorTitleMatch = window.match(/>\s*([\s\S]*?)\s*<\/a>/i);
    const titleFromAnchor = anchorTitleMatch
      ? normalizeText(anchorTitleMatch[1])
      : "";

    const titleMatch =
      window.match(/<h[12-6][^>]*>([\s\S]*?)<\/h[12-6]>/i) ||
      window.match(/name="dc\.title" content="([^"]+)"/i) ||
      window.match(/property="og:title" content="([^"]+)"/i);
    const title = titleFromAnchor || (titleMatch ? normalizeText(titleMatch[1]) : "");
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

    const typeMatch =
      window.match(
        /data-test="article\.type"[\s\S]*?class="c-meta__type"[^>]*>([\s\S]*?)<\/span>/i,
      ) || window.match(/class="c-meta__type"[^>]*>([\s\S]*?)<\/span>/i);
    const articleType = typeMatch ? normalizeText(typeMatch[1]) : null;

    const summaryMatch =
      window.match(/data-test="article-description"[\s\S]*?>([\s\S]*?)<\/div>/i) ||
      window.match(/itemprop="description"[\s\S]*?>([\s\S]*?)<\/div>/i);
    const abstract = summaryMatch ? normalizeText(summaryMatch[1]) : null;

    results.push({ articleUrl, title, publishedDate, articleType, abstract });
  }

  return results;
}

function parseMetaContent(html, name) {
  if (typeof html !== "string" || !html) return null;
  const escaped = escapeRegExp(name);
  const tagRe = new RegExp(
    `<meta\\b[^>]*\\bname=("|')${escaped}\\1[^>]*>`,
    "i",
  );
  const m = html.match(tagRe);
  if (!m) return null;
  const tag = m[0] || "";
  const contentMatch = tag.match(/\bcontent=("|')([^"']*)\1/i);
  return contentMatch ? decodeHtmlEntities(contentMatch[2]) : null;
}

function parseMetaProperty(html, property) {
  if (typeof html !== "string" || !html) return null;
  const escaped = escapeRegExp(property);
  const tagRe = new RegExp(
    `<meta\\b[^>]*\\bproperty=("|')${escaped}\\1[^>]*>`,
    "i",
  );
  const m = html.match(tagRe);
  if (!m) return null;
  const tag = m[0] || "";
  const contentMatch = tag.match(/\bcontent=("|')([^"']*)\1/i);
  return contentMatch ? decodeHtmlEntities(contentMatch[2]) : null;
}

function parseJsonLdBlocks(html) {
  if (typeof html !== "string" || !html) return [];
  const blocks = [];
  const re =
    /<script\b[^>]*type=(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi;

  let match;
  while ((match = re.exec(html))) {
    const raw = String(match[1] || "").trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // ignore invalid json-ld blocks
    }
  }

  return blocks;
}

function findJsonLdStringField(node, field, depth = 0) {
  if (!node) return null;
  if (depth > 6) return null;

  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findJsonLdStringField(entry, field, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof node !== "object") return null;

  const direct = node[field];
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  if (direct && typeof direct === "object") {
    const found = findJsonLdStringField(direct, field, depth + 1);
    if (found) return found;
  }

  const main = node.mainEntity;
  if (main) {
    const found = findJsonLdStringField(main, field, depth + 1);
    if (found) return found;
  }

  const graph = node["@graph"];
  if (graph) {
    const found = findJsonLdStringField(graph, field, depth + 1);
    if (found) return found;
  }

  return null;
}

function extractNatureJsonLdDescription(html) {
  const blocks = parseJsonLdBlocks(html);
  for (const block of blocks) {
    const desc = findJsonLdStringField(block?.mainEntity ?? block, "description");
    if (typeof desc === "string" && desc.trim()) return desc;
  }
  return null;
}

function extractNatureJsonLdHeadline(html) {
  const blocks = parseJsonLdBlocks(html);
  for (const block of blocks) {
    const headline =
      findJsonLdStringField(block?.mainEntity ?? block, "headline") ||
      findJsonLdStringField(block?.mainEntity ?? block, "name");
    if (typeof headline === "string" && headline.trim()) return headline;
  }
  return null;
}

function extractNatureJsonLdDatePublished(html) {
  const blocks = parseJsonLdBlocks(html);
  for (const block of blocks) {
    const date = findJsonLdStringField(block?.mainEntity ?? block, "datePublished");
    if (typeof date === "string" && date.trim()) return date;
  }
  return null;
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

  const standfirstMatch =
    html.match(/data-test="standfirst"[^>]*>([\s\S]*?)<\/(?:p|div)>/i) ||
    html.match(/class="[^"]*c-article-teaser-text[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>/i) ||
    html.match(/class="[^"]*c-article__standfirst[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>/i);

  if (standfirstMatch) {
    const text = normalizeText(standfirstMatch[1]);
    if (text) return text;
  }

  const meta =
    parseMetaContent(html, "dc.description") ||
    parseMetaContent(html, "description") ||
    parseMetaProperty(html, "og:description") ||
    "";

  const normalized = normalizeText(meta);
  if (normalized) return normalized;

  const jsonLd = extractNatureJsonLdDescription(html);
  const normalizedJsonLd = normalizeText(jsonLd || "");
  return normalizedJsonLd || null;
}

function parseNatureDataLayerCategory(html) {
  if (typeof html !== "string" || !html) {
    return { contentType: null, contentSubGroup: null, contentGroup: null };
  }

  const match = html.match(/window\.dataLayer\s*=\s*(\[[\s\S]*?\])\s*;/i);
  if (!match) {
    return { contentType: null, contentSubGroup: null, contentGroup: null };
  }

  try {
    const dataLayer = JSON.parse(match[1]);
    const category = dataLayer?.[0]?.content?.category || {};
    const legacy = category?.legacy || {};

    const contentType =
      typeof category.contentType === "string" && category.contentType.trim()
        ? category.contentType.trim()
        : null;
    const contentSubGroup =
      typeof legacy.webtrendsContentSubGroup === "string" &&
      legacy.webtrendsContentSubGroup.trim()
        ? legacy.webtrendsContentSubGroup.trim()
        : null;
    const contentGroup =
      typeof legacy.webtrendsContentGroup === "string" &&
      legacy.webtrendsContentGroup.trim()
        ? legacy.webtrendsContentGroup.trim()
        : null;

    return { contentType, contentSubGroup, contentGroup };
  } catch {
    return { contentType: null, contentSubGroup: null, contentGroup: null };
  }
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
      if (!nextUrl.hostname.endsWith("nature.com")) return null;
      if (/^\/articles\/[^/]+$/i.test(nextUrl.pathname)) return null;
      nextUrl.hash = "";
      return nextUrl.toString();
    } catch {
      // ignore invalid links
    }
  }

  return null;
}

async function _fetchNatureArticleDetails(articleUrl) {
  const html = await fetchText(articleUrl);

  const jsonHeadline = extractNatureJsonLdHeadline(html);
  const htmlTitle = extractHtmlTitle(html);
  const title =
    parseMetaContent(html, "dc.title") ||
    parseMetaProperty(html, "og:title") ||
    jsonHeadline ||
    htmlTitle ||
    "";
  const publishedDate = normalizeDateInput(
    parseMetaContent(html, "prism.publicationDate") ||
      parseMetaProperty(html, "article:published_time") ||
      parseMetaContent(html, "article:published_time") ||
      extractNatureJsonLdDatePublished(html) ||
      "",
  );

  const abstract = extractNatureAbstract(html);
  const category = parseNatureDataLayerCategory(html);

  const pdfUrl = `${articleUrl}.pdf`;

  return {
    title: normalizeText(title),
    publishedDate,
    abstract,
    pdfUrl,
    contentType: category.contentType,
    contentSubGroup: category.contentSubGroup,
    contentGroup: category.contentGroup,
  };
}

function scienceSeedToRssConfig(seedUrl) {
  try {
    const url = new URL(seedUrl);
    if (
      url.hostname === "science.org" ||
      url.hostname === "www.science.org"
    ) {
      if (url.pathname.startsWith("/action/showFeed")) {
        return { rssUrl: url.toString(), mode: "etoc" };
      }

      const journalMatch = url.pathname.match(/^\/journal\/([a-z0-9-]+)\/?$/i);
      const jc = journalMatch ? journalMatch[1] : "science";
      if (url.pathname.startsWith("/commentary/")) {
        return {
          rssUrl: `https://www.science.org/action/showFeed?type=etoc&feed=rss&jc=${encodeURIComponent(jc)}`,
          mode: "commentary",
        };
      }
      return {
        rssUrl: `https://www.science.org/action/showFeed?type=etoc&feed=rss&jc=${encodeURIComponent(jc)}`,
        mode: "etoc",
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function acsSeedToRssUrl(seedUrl) {
  try {
    const url = new URL(seedUrl);
    if (url.hostname !== "pubs.acs.org" && url.hostname !== "www.pubs.acs.org") {
      return null;
    }

    if (url.pathname.startsWith("/action/showFeed")) return url.toString();

    const tocMatch = url.pathname.match(/^\/toc\/([^/]+)(?:\/|$)/i);
    const journalMatch = url.pathname.match(/^\/journal\/([^/]+)(?:\/|$)/i);
    const jc = (tocMatch ? tocMatch[1] : null) || (journalMatch ? journalMatch[1] : null);
    if (!jc) return null;

    return `https://pubs.acs.org/action/showFeed?type=etoc&feed=rss&jc=${encodeURIComponent(jc)}`;
  } catch {
    // ignore
  }
  return null;
}

function wileySeedToRssUrl(seedUrl) {
  try {
    const url = new URL(seedUrl);
    const host = String(url.hostname || "").toLowerCase();
    if (!host.endsWith("onlinelibrary.wiley.com")) return null;

    if (url.pathname.startsWith("/action/showFeed")) {
      // Canonicalize to the primary host (some Wiley subdomains are UI-only).
      url.hostname = "onlinelibrary.wiley.com";
      url.protocol = "https:";
      url.hash = "";
      return url.toString();
    }

    const tocMatch = url.pathname.match(/^\/toc\/([^/]+)(?:\/|$)/i);
    if (!tocMatch) return null;
    const jc = String(tocMatch[1] || "").trim();
    if (!jc) return null;

    // Canonicalize to the primary host (some Wiley subdomains are UI-only).
    return `https://onlinelibrary.wiley.com/action/showFeed?type=etoc&feed=rss&jc=${encodeURIComponent(jc)}`;
  } catch {
    // ignore
  }
  return null;
}

function canonicalizeWileyArticleUrl(rawUrl) {
  const normalized = normalizeUrlString(rawUrl);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    const host = String(url.hostname || "").toLowerCase();
    if (!host.endsWith("onlinelibrary.wiley.com")) return normalized;

    const doi = extractDoiFromUrlString(normalized);
    if (doi) return `https://onlinelibrary.wiley.com/doi/${doi}`;

    // Canonicalize to primary host and strip query/hash for stable keys.
    url.hostname = "onlinelibrary.wiley.com";
    url.protocol = "https:";
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return normalized;
  }
}

function isLikelyWileyListingTitle(title) {
  const raw = typeof title === "string" ? title.trim() : "";
  if (!raw) return false;
  const lower = raw.toLowerCase();
  const stop = new Set([
    "abstract",
    "full text",
    "html",
    "pdf",
    "epdf",
    "figures",
    "references",
    "permissions",
    "request permissions",
    "metrics",
    "get access",
    "sign in",
    "share",
    "export citation",
  ]);
  if (stop.has(lower)) return false;
  if (lower.startsWith("download")) return false;
  if (lower.startsWith("view")) return false;
  if (lower.startsWith("read")) return false;
  if (raw.length <= 2) return false;
  return true;
}

function parseWileyListingCandidates(html, seedUrl, { includeDoiTextFallback = true } = {}) {
  if (typeof html !== "string" || !html) return [];
  const results = [];
  const seen = new Set();
  const hrefRe = /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>/gi;

  let match;
  while ((match = hrefRe.exec(html))) {
    const rawHref = decodeHtmlEntities(match[1] || match[2] || "").trim();
    if (!rawHref) continue;

    const hrefLower = rawHref.toLowerCase();
    if (!hrefLower.includes("/doi/") && !hrefLower.includes("doi.org/10.")) continue;
    if (hrefLower.includes("action/download")) continue;

    let absolute;
    try {
      absolute = new URL(rawHref, seedUrl);
    } catch {
      continue;
    }
    absolute.hash = "";

    const host = String(absolute.hostname || "").toLowerCase();
    if (!host.endsWith("onlinelibrary.wiley.com") && host !== "doi.org" && !host.endsWith(".doi.org")) {
      continue;
    }

    const hrefUrl = absolute.toString();
    const doi = extractDoiFromUrlString(hrefUrl);
    const articleUrl = host.endsWith("onlinelibrary.wiley.com")
      ? canonicalizeWileyArticleUrl(hrefUrl)
      : normalizeUrlString(hrefUrl);
    if (!articleUrl) continue;
    const key = doi ? `doi:${doi}` : `url:${articleUrl}`;
    if (seen.has(key)) continue;

    const tag = match[0] || "";
    const titleAttrMatch =
      tag.match(/\btitle=("|')([^"']+)\1/i) || tag.match(/\baria-label=("|')([^"']+)\1/i);
    const titleFromAttr = titleAttrMatch ? normalizeText(titleAttrMatch[2]) : "";

    const windowStart = match.index;
    const windowEnd = Math.min(html.length, windowStart + 8000);
    const window = html.slice(windowStart, windowEnd);
    const anchorTitleMatch = window.match(/>\s*([\s\S]*?)\s*<\/a>/i);
    const titleFromAnchor = anchorTitleMatch ? normalizeText(anchorTitleMatch[1]) : "";

    const title = isLikelyWileyListingTitle(titleFromAnchor)
      ? titleFromAnchor
      : isLikelyWileyListingTitle(titleFromAttr)
        ? titleFromAttr
        : "";

    let publishedDate = null;
    const dateMatch =
      window.match(/datetime="(\d{4}-\d{2}-\d{2})"/i) ||
      window.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (dateMatch) {
      publishedDate = normalizeDateInput(dateMatch[1]);
    }

    if (!publishedDate) {
      const textDateMatch =
        window.match(/\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/) ||
        window.match(/\b([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\b/);
      if (textDateMatch) {
        publishedDate = normalizeDateInput(textDateMatch[1]);
      }
    }

    results.push({
      articleUrl,
      doi,
      title: title || articleUrl,
      publishedDate: publishedDate || null,
    });
    seen.add(key);
  }

  if (includeDoiTextFallback) {
    const pushDoiUrlCandidate = (raw) => {
      const href = decodeHtmlEntities(String(raw || "")).trim();
      if (!href) return;
      let absolute;
      try {
        absolute = new URL(href, seedUrl);
      } catch {
        return;
      }
      absolute.hash = "";
      const hrefUrl = absolute.toString();
      const doi = extractDoiFromUrlString(hrefUrl);
      const articleUrl = canonicalizeWileyArticleUrl(hrefUrl);
      if (!articleUrl) return;
      const key = doi ? `doi:${doi}` : `url:${articleUrl}`;
      if (seen.has(key)) return;
      seen.add(key);
      results.push({
        articleUrl,
        doi,
        title: articleUrl,
        publishedDate: null,
      });
    };

    const doiAbsoluteRe =
      /https?:\/\/[^"'\\s>]*onlinelibrary\.wiley\.com\/doi\/(?:abs\/|full\/|pdf\/|epdf\/)?10\.\d{4,9}\/[^\s"'<>]+/gi;
    let doiMatch;
    while ((doiMatch = doiAbsoluteRe.exec(html))) {
      pushDoiUrlCandidate(doiMatch[0]);
    }

    const doiRelativeRe =
      /\/doi\/(?:abs\/|full\/|pdf\/|epdf\/)?10\.\d{4,9}\/[^\s"'<>]+/gi;
    while ((doiMatch = doiRelativeRe.exec(html))) {
      pushDoiUrlCandidate(doiMatch[0]);
    }
  }

  return results;
}

function stripHtmlScriptsStyles(html) {
  if (typeof html !== "string" || !html) return "";
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
}

function extractMainContentHtml(html) {
  if (typeof html !== "string" || !html) return "";
  const start = html.search(/<main\b/i);
  if (start < 0) return html;
  const tail = html.slice(start);
  const end = tail.search(/<\/main>/i);
  if (end < 0) return tail;
  return tail.slice(0, end + "</main>".length);
}

function extractWileyJournalCodeFromSeedUrl(seedUrl) {
  try {
    const url = new URL(seedUrl);
    const tocMatch = url.pathname.match(/^\/toc\/([^/]+)(?:\/|$)/i);
    if (!tocMatch) return null;
    const code = String(tocMatch[1] || "").trim();
    return code || null;
  } catch {
    return null;
  }
}

function isWileyIssueLikeTocPath(pathname, journalCode) {
  const path = typeof pathname === "string" ? pathname : "";
  const jc = typeof journalCode === "string" ? journalCode.trim() : "";
  if (!path || !jc) return false;
  const prefix = `/toc/${jc}/`;
  if (!path.toLowerCase().startsWith(prefix.toLowerCase())) return false;
  const rest = path.slice(prefix.length);
  if (!rest) return false;
  const lower = rest.toLowerCase();
  if (lower.startsWith("current")) return true;
  if (lower.startsWith("earlyview")) return true;
  if (/^\d{4}\/\d+\/\d+(?:\/|$)/.test(rest)) return true;
  if (/^\d+\/\d+(?:\/|$)/.test(rest)) return true;
  return false;
}

function parseWileyIssueTocUrls(html, seedUrl) {
  if (typeof html !== "string" || !html) return [];
  const journalCode = extractWileyJournalCodeFromSeedUrl(seedUrl);
  if (!journalCode) return [];

  const results = [];
  const seen = new Set();

  const hrefRe = /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>/gi;
  let match;
  while ((match = hrefRe.exec(html))) {
    const rawHref = decodeHtmlEntities(match[1] || match[2] || "").trim();
    if (!rawHref) continue;
    if (!rawHref.toLowerCase().includes(`/toc/${journalCode.toLowerCase()}/`)) continue;

    let absolute;
    try {
      absolute = new URL(rawHref, seedUrl);
    } catch {
      continue;
    }
    absolute.hash = "";

    const host = String(absolute.hostname || "").toLowerCase();
    if (!host.endsWith("onlinelibrary.wiley.com")) continue;

    if (!isWileyIssueLikeTocPath(absolute.pathname, journalCode)) continue;

    const hrefUrl = absolute.toString();
    if (seen.has(hrefUrl)) continue;
    seen.add(hrefUrl);
    results.push(hrefUrl);

    if (results.length >= 100) break;
  }

  return results;
}

function parseWileyNextPageUrl(html, currentUrl) {
  if (typeof html !== "string" || !html) return null;
  const base = typeof currentUrl === "string" ? currentUrl : "";
  if (!base) return null;

  const extractHref = (tag) => {
    if (!tag) return null;
    const hrefMatch = tag.match(/\bhref=("|')([^"']+)\1/i);
    return hrefMatch ? decodeHtmlEntities(hrefMatch[2] || "").trim() : null;
  };

  const linkMatch = html.match(/<link\b[^>]*\brel=("|')next\1[^>]*>/i);
  if (linkMatch) {
    const href = extractHref(linkMatch[0]);
    if (href) {
      try {
        const u = new URL(href, base);
        u.hash = "";
        return u.toString();
      } catch {
        // ignore
      }
    }
  }

  const aRelNextMatch = html.match(/<a\b[^>]*\brel=("|')next\1[^>]*>/i);
  if (aRelNextMatch) {
    const href = extractHref(aRelNextMatch[0]);
    if (href) {
      try {
        const u = new URL(href, base);
        u.hash = "";
        return u.toString();
      } catch {
        // ignore
      }
    }
  }

  const aAriaNextMatch = html.match(
    /<a\b[^>]*(?:aria-label|title)=("|')[^"']*next[^"']*\1[^>]*>/i,
  );
  if (aAriaNextMatch) {
    const href = extractHref(aAriaNextMatch[0]);
    if (href) {
      try {
        const u = new URL(href, base);
        u.hash = "";
        return u.toString();
      } catch {
        // ignore
      }
    }
  }

  return null;
}

function discoverRssUrlFromHtmlText(baseUrl, html) {
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (href) => {
    const raw = typeof href === "string" ? href.trim() : "";
    if (!raw) return;
    if (seen.has(raw)) return;
    seen.add(raw);
    candidates.push(raw);
  };

  const linkTagRe = /<link\b[^>]*>/gi;
  let match;
  while ((match = linkTagRe.exec(html))) {
    const tag = match[0] || "";
    if (!/\brel=("|')alternate\1/i.test(tag)) continue;
    const typeMatch = tag.match(/\btype=("|')([^"']+)\1/i);
    const type = typeMatch ? String(typeMatch[2] || "").toLowerCase() : "";
    if (!type.includes("rss")) continue;
    const hrefMatch = tag.match(/\bhref=("|')([^"']+)\1/i);
    const href = hrefMatch ? decodeHtmlEntities(hrefMatch[2] || "").trim() : "";
    pushCandidate(href);
  }

  const showFeedRe = /https?:\/\/[^"'\\s>]+action\/showFeed[^"'\\s>]*/gi;
  while ((match = showFeedRe.exec(html))) {
    pushCandidate(decodeHtmlEntities(match[0] || ""));
  }

  const rssRe = /https?:\/\/[^"'\\s>]+\.rss[^"'\\s>]*/gi;
  while ((match = rssRe.exec(html))) {
    pushCandidate(decodeHtmlEntities(match[0] || ""));
  }

  for (const href of candidates) {
    try {
      const u = new URL(href, baseUrl);
      u.hash = "";
      return u.toString();
    } catch {
      // ignore invalid candidates
    }
  }

  return null;
}

async function discoverRssUrlFromHtml(seedUrl) {
  const baseUrl = typeof seedUrl === "string" ? seedUrl.trim() : "";
  if (!baseUrl) return null;

  let html = "";
  try {
    html = await fetchText(baseUrl);
  } catch {
    return null;
  }

  return discoverRssUrlFromHtmlText(baseUrl, html);
}

function normalizeDoiCandidate(raw) {
  const candidate = typeof raw === "string" ? raw.trim() : "";
  if (!candidate) return null;
  const cleaned = candidate
    .replace(/^doi:\s*/i, "")
    .replace(/[)\].,;]+$/, "")
    .trim();
  if (!cleaned) return null;
  return /^10\.\d{4,9}\/\S+$/i.test(cleaned) ? cleaned : null;
}

function extractDoiFromUrlString(rawUrl) {
  const urlString = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!urlString) return null;
  try {
    const url = new URL(urlString);
    const host = String(url.hostname || "").toLowerCase();
    if (host === "doi.org" || host.endsWith(".doi.org")) {
      return normalizeDoiCandidate(url.pathname.replace(/^\/+/, ""));
    }

    const path = String(url.pathname || "");
    const doiMatch = path.match(/\/doi\/(?:abs\/|full\/|pdf\/|epdf\/)?(10\.\d{4,9}\/[^?#]+)$/i);
    if (doiMatch) return normalizeDoiCandidate(doiMatch[1]);

    return null;
  } catch {
    return null;
  }
}

function extractFirstDoiFromText(text) {
  const src = typeof text === "string" ? text : "";
  if (!src) return null;
  const m = src.match(/10\.\d{4,9}\/[^\s"'<>()]+/i);
  return m ? normalizeDoiCandidate(m[0]) : null;
}

function parseRssItems(xml, { deriveCoverDateFromDescription = false } = {}) {
  const items = [];
  const itemRe =
    /<item\b([^>]*)>([\s\S]*?)<\/item>/gi;

  let match;
  while ((match = itemRe.exec(xml))) {
    const attr = match[1] || "";
    const body = match[2] || "";

    const aboutMatch = attr.match(/\brdf:about="([^"]+)"/i);
    const about = aboutMatch ? aboutMatch[1] : "";

    const titleMatch = body.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? normalizeText(titleMatch[1]) : "";

    const linkMatch = body.match(/<link>([\s\S]*?)<\/link>/i);
    const link = linkMatch ? decodeHtmlEntities(linkMatch[1]).trim() : about;

    const dateMatch =
      body.match(/<dc:date>([\s\S]*?)<\/dc:date>/i) ||
      body.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) ||
      body.match(/<prism:publicationDate>([\s\S]*?)<\/prism:publicationDate>/i);
    const publishedDate = normalizeDateInput(dateMatch ? dateMatch[1] : "");

    let coverDate = null;
    const prismCoverDateMatch = body.match(/<prism:coverDate>([\s\S]*?)<\/prism:coverDate>/i);
    if (prismCoverDateMatch) {
      coverDate = normalizeDateInput(prismCoverDateMatch[1]);
    }

    const descMatch = body.match(/<description>([\s\S]*?)<\/description>/i);
    const descText = descMatch ? normalizeText(descMatch[1]) : "";

    if (deriveCoverDateFromDescription) {
      const dateTextMatch = descText.match(/([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})/);
      if (dateTextMatch) {
        coverDate = normalizeDateInput(
          `${dateTextMatch[1]} ${dateTextMatch[2]}, ${dateTextMatch[3]}`,
        );
      }
    }

    const identifierMatch = body.match(/<dc:identifier>([\s\S]*?)<\/dc:identifier>/i);
    const prismDoiMatch = body.match(/<prism:doi>([\s\S]*?)<\/prism:doi>/i);
    const rawIdentifier = identifierMatch ? normalizeText(identifierMatch[1]) : "";
    const rawPrismDoi = prismDoiMatch ? normalizeText(prismDoiMatch[1]) : "";
    const doiFromIdentifier =
      normalizeDoiCandidate(rawIdentifier) || normalizeDoiCandidate(rawPrismDoi);

    const journalMatch = body.match(/<dc:source>([\s\S]*?)<\/dc:source>/i);
    const journalTitle = journalMatch ? normalizeText(journalMatch[1]) : "";

    const typeMatch = body.match(/<dc:type>([\s\S]*?)<\/dc:type>/i);
    const itemType = typeMatch ? normalizeText(typeMatch[1]) : "";

    const articleUrl = normalizeUrlString(link || about);
    if (!articleUrl) continue;

    const doiFromUrl = extractDoiFromUrlString(articleUrl);
    const doiFromDesc = extractFirstDoiFromText(descText);

    const doi = doiFromIdentifier || doiFromUrl || doiFromDesc || null;
    const id = doi ? `doi:${doi}` : `url:${articleUrl}`;

    items.push({
      id,
      doi,
      title: title || articleUrl,
      publishedDate,
      articleUrl,
      journalTitle: journalTitle || null,
      coverDate,
      itemType: itemType || null,
    });
  }

  return items;
}

function parseScienceRssItems(xml) {
  return parseRssItems(xml);
}

function stripAcsTrackingParams(articleUrl) {
  if (typeof articleUrl !== "string" || !articleUrl.trim()) return articleUrl;
  try {
    const url = new URL(articleUrl);
    if (!url.hostname.endsWith("pubs.acs.org")) return articleUrl;
    url.searchParams.delete("af");
    url.searchParams.delete("ref");
    url.searchParams.delete("utm_source");
    url.searchParams.delete("utm_medium");
    url.searchParams.delete("utm_campaign");
    url.hash = "";
    return url.toString();
  } catch {
    return articleUrl;
  }
}

function crossrefDateToDateStringByPriority(message, priorityKeys) {
  const keys = Array.isArray(priorityKeys) ? priorityKeys : [];
  const candidates = [];
  for (const key of keys) {
    if (!key) continue;
    candidates.push(message?.[key]);
  }
  candidates.push(message?.issued, message?.created);

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
  const publishedOnlineDate = crossrefDateToDateStringByPriority(message, [
    "published-online",
    "published-print",
  ]);
  const publishedPrintDate = crossrefDateToDateStringByPriority(message, [
    "published-print",
    "published-online",
  ]);
  const publishedDate = publishedOnlineDate;

  const links = Array.isArray(message.link) ? message.link : [];
  const pdfLink = links.find((l) => typeof l?.URL === "string" && l.URL);
  const pdfUrl = pdfLink?.URL ? String(pdfLink.URL) : null;

  return {
    title: normalizeText(title || ""),
    abstract: abstract ? normalizeText(abstract) : null,
    publishedDate: normalizeDateInput(publishedDate),
    publishedOnlineDate: normalizeDateInput(publishedOnlineDate),
    publishedPrintDate: normalizeDateInput(publishedPrintDate),
    pdfUrl,
  };
}

async function fetchCrossrefWorksByContainerTitle({
  containerTitle,
  startDate,
  endDate,
  prefix,
  rows = 200,
} = {}) {
  const title = typeof containerTitle === "string" ? containerTitle.trim() : "";
  if (!title) return [];
  if (!startDate || !endDate) return [];
  const safeRows = Math.max(1, Math.min(500, Math.trunc(Number(rows) || 200)));
  const doiPrefix = typeof prefix === "string" && prefix.trim() ? prefix.trim() : null;

  const filterParts = [
    `from-pub-date:${startDate}`,
    `until-pub-date:${endDate}`,
  ];
  if (doiPrefix) filterParts.push(`prefix:${doiPrefix}`);
  filterParts.push("type:journal-article");

  const url =
    `https://api.crossref.org/works?rows=${encodeURIComponent(String(safeRows))}` +
    `&filter=${encodeURIComponent(filterParts.join(","))}` +
    `&query.container-title=${encodeURIComponent(title)}` +
    `&select=${encodeURIComponent("DOI,title,URL,link,abstract,issued,created,published-online,published-print")}`;

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
  const list = Array.isArray(message.items) ? message.items : [];

  return list
    .map((item) => {
      const doi = typeof item?.DOI === "string" ? item.DOI.trim() : "";
      if (!doi) return null;
      const rawTitle = Array.isArray(item?.title) ? item.title[0] : item?.title;
      const metaTitle = normalizeText(rawTitle || "");
      const abstract = item?.abstract ? normalizeText(item.abstract) : null;

      const publishedOnlineDate = normalizeDateInput(
        crossrefDateToDateStringByPriority(item, ["published-online", "published-print"]),
      );
      const publishedPrintDate = normalizeDateInput(
        crossrefDateToDateStringByPriority(item, ["published-print", "published-online"]),
      );
      const issuedDate = normalizeDateInput(crossrefDateToDateStringByPriority(item, ["issued"]));
      const createdDate = normalizeDateInput(crossrefDateToDateStringByPriority(item, ["created"]));

      const links = Array.isArray(item?.link) ? item.link : [];
      const pdfLink = links.find((l) => typeof l?.URL === "string" && l.URL);
      const pdfUrl = pdfLink?.URL ? String(pdfLink.URL) : null;

      const articleUrl =
        (typeof item?.URL === "string" && item.URL.trim()) ? item.URL.trim() : `https://doi.org/${doi}`;

      return {
        doi,
        title: metaTitle || doi,
        abstract,
        publishedOnlineDate,
        publishedPrintDate,
        issuedDate,
        createdDate,
        pdfUrl,
        articleUrl,
      };
    })
    .filter(Boolean);
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
  maxResults = null,
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

  const capNumber = Number(maxResults);
  const cap = Number.isFinite(capNumber) ? Math.max(1, Math.trunc(capNumber)) : 100;
  const results = [];
  const seenIds = new Set();

  const natureDetailsCache = new Map();
  const fetchNatureDetailsCached = async (articleUrl) => {
    const normalized = (() => {
      try {
        const u = new URL(articleUrl);
        u.hash = "";
        u.search = "";
        return u.toString();
      } catch {
        return articleUrl;
      }
    })();

    if (natureDetailsCache.has(normalized)) {
      return natureDetailsCache.get(normalized);
    }

    const promise = _fetchNatureArticleDetails(normalized).catch((err) => {
      natureDetailsCache.delete(normalized);
      throw err;
    });
    natureDetailsCache.set(normalized, promise);
    return promise;
  };

  for (const seedUrl of normalizedSeeds) {
    if (results.length >= cap) break;
    const url = new URL(seedUrl);

    if (url.hostname.endsWith("nature.com")) {
      if (/^\/articles\/[^/]+$/i.test(url.pathname)) {
        const normalizedArticleUrl = (() => {
          try {
            const u = new URL(seedUrl);
            u.hash = "";
            u.search = "";
            return u.toString();
          } catch {
            return seedUrl;
          }
        })();

        const details = await fetchNatureDetailsCached(normalizedArticleUrl);
        const publishedDate = details?.publishedDate || null;
        if (publishedDate && !isDateInRange(publishedDate, start, end)) {
          continue;
        }

        const journalTitle = details?.contentGroup || null;
        const sectionTitle = details?.contentSubGroup || details?.contentType || null;
        const sourceContext = buildNatureSourceContext({ journalTitle, sectionTitle });

        const item = {
          id: normalizedArticleUrl,
          source: "nature",
          seedUrl,
          seedContext: sourceContext || details?.title || normalizedArticleUrl,
          sourceContext: sourceContext || null,
          journalTitle,
          sectionTitle,
          journalSlug: null,
          sectionSlug: null,
          articleType: null,
          contentType: details?.contentType || null,
          contentSubGroup: details?.contentSubGroup || null,
          contentGroup: details?.contentGroup || null,
          title: details?.title || normalizedArticleUrl,
          articleUrl: normalizedArticleUrl,
          publishedDate,
          abstract: details?.abstract || null,
          pdfUrl: details?.pdfUrl || `${normalizedArticleUrl}.pdf`,
          doi: deriveNatureDoiFromArticleUrl(normalizedArticleUrl),
        };

        if (!item.id || seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        results.push(item);
        continue;
      }

      const visitedPages = new Set();
      const perSeedSeenArticles = new Set();
      const seedPath = parseNatureSeedPath(seedUrl);
      let journalTitle = null;
      let sectionTitle = null;

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

        let html = "";
        try {
          html = await fetchText(pageUrl);
        } catch (err) {
          const status = Number(err?.status);
          const canTreatAsEnd =
            (status === 404 || status === 410) &&
            pageCount > 1 &&
            perSeedSeenArticles.size > 0;
          if (canTreatAsEnd) break;
          throw err;
        }
        if (!journalTitle || !sectionTitle) {
          const ctx = parseNatureListingContextFromHtml(html);
          if (!sectionTitle && ctx.sectionTitle) sectionTitle = ctx.sectionTitle;
          if (!journalTitle && ctx.journalTitle) journalTitle = ctx.journalTitle;
        }

        const seedContext = buildNatureSourceContext({
          journalTitle,
          sectionTitle,
          journalSlug: seedPath.journalSlug,
          sectionSlug: seedPath.sectionSlug,
        });
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
        const candidateCap = Math.min(300, Math.max(50, remaining * 6));
        const candidates = filteredCandidates.slice(0, candidateCap);

        for (const c of candidates) {
          if (!c?.articleUrl) continue;
          const publishedDate = c.publishedDate || null;
          if (publishedDate && !isDateInRange(publishedDate, start, end)) {
            continue;
          }

          const articleType = c.articleType || null;
          const sourceContext = buildNatureSourceContext({
            journalTitle,
            sectionTitle: articleType || sectionTitle,
            journalSlug: seedPath.journalSlug,
            sectionSlug: seedPath.sectionSlug,
          });

          const item = {
            id: c.articleUrl,
            source: "nature",
            seedUrl,
            seedContext,
            sourceContext,
            journalTitle,
            sectionTitle,
            journalSlug: seedPath.journalSlug,
            sectionSlug: seedPath.sectionSlug,
            articleType,
            contentType: null,
            contentSubGroup: articleType,
            contentGroup: journalTitle,
            title: c.title || c.articleUrl,
            articleUrl: c.articleUrl,
            publishedDate,
            abstract: c.abstract,
            pdfUrl: `${c.articleUrl}.pdf`,
            doi: deriveNatureDoiFromArticleUrl(c.articleUrl),
          };

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
      const rssConfig = scienceSeedToRssConfig(seedUrl);
      const rssMode = rssConfig?.mode || "etoc";
      const rssUrl = rssConfig?.rssUrl || (await discoverRssUrlFromHtml(seedUrl));
      if (!rssUrl) {
        const err = new Error(
          `Science feed not found for seed URL (${seedUrl}). Please provide a Science TOC/issue/section page that exposes an RSS feed, or paste a direct RSS feed URL.`,
        );
        err.status = 400;
        throw err;
      }

      const xml = await fetchText(rssUrl);
      const filteredItems = parseScienceRssItems(xml)
        .filter((i) => {
          const date = i.coverDate || i.publishedDate || null;
          return !date || isDateInRange(date, start, end);
        })
        .filter((i) => {
          if (rssMode !== "commentary") return true;
          const type = typeof i?.itemType === "string" ? i.itemType.trim() : "";
          if (!type) return true;
          if (type === "Research Article") return false;
          if (type === "Retraction") return false;
          return true;
        });

      const remaining = cap - results.length;
      const candidateCap = Math.min(2000, Math.max(200, remaining * 6));
      const feedItems = filteredItems.slice(0, candidateCap);

      const enriched = await mapWithConcurrency(feedItems, 4, async (i) => {
        let meta = null;
        if (i?.doi) {
          try {
            meta = await fetchCrossrefWork(i.doi);
          } catch {
            meta = null;
          }
        }
        const publishedDate = meta?.publishedDate || i.coverDate || i.publishedDate || null;
        if (publishedDate && !isDateInRange(publishedDate, start, end)) {
          return null;
        }

        const articleUrl = i.articleUrl || (i.doi ? `https://doi.org/${i.doi}` : null);
        if (!articleUrl) return null;
        const id = i.id || (i.doi ? `doi:${i.doi}` : `url:${articleUrl}`);

        return {
          id,
          source: "science",
          seedUrl,
          title: meta?.title || i.title || id,
          articleUrl,
          publishedDate,
          abstract: meta?.abstract ?? null,
          pdfUrl: meta?.pdfUrl ?? null,
          doi: i.doi || null,
          itemType: i.itemType || null,
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

    if (url.hostname.endsWith("pubs.acs.org")) {
      const rssUrl = acsSeedToRssUrl(seedUrl) || (await discoverRssUrlFromHtml(seedUrl));
      if (!rssUrl) {
        const err = new Error(
          `ACS feed not found for seed URL (${seedUrl}). Please provide a /toc/{journalCode} or /journal/{journalCode} page, or paste a direct RSS feed URL (action/showFeed or .rss).`,
        );
        err.status = 400;
        throw err;
      }

      const xml = await fetchText(rssUrl);
      const allFeedItems = parseRssItems(xml, { deriveCoverDateFromDescription: true });
      const seedJournalTitle =
        (Array.isArray(allFeedItems) && allFeedItems.length && allFeedItems[0]?.journalTitle) ||
        null;

      const filteredItems = allFeedItems
        .filter((i) => {
          const date = i.coverDate || i.publishedDate || null;
          return !date || isDateInRange(date, start, end);
        });

      const remaining = cap - results.length;
      const candidateCap = Math.min(2000, Math.max(200, remaining * 6));
      const feedItems = filteredItems.slice(0, candidateCap);

      const enriched = await mapWithConcurrency(feedItems, 4, async (i) => {
        let meta = null;
        if (i?.doi) {
          try {
            meta = await fetchCrossrefWork(i.doi);
          } catch {
            meta = null;
          }
        }
        const publishedDate =
          meta?.publishedPrintDate ||
          i.coverDate ||
          meta?.publishedDate ||
          i.publishedDate ||
          null;
        if (publishedDate && !isDateInRange(publishedDate, start, end)) {
          return null;
        }

        const rawArticleUrl = i.articleUrl || (i.doi ? `https://doi.org/${i.doi}` : null);
        if (!rawArticleUrl) return null;
        const articleUrl = stripAcsTrackingParams(rawArticleUrl);
        const id = i.id || (i.doi ? `doi:${i.doi}` : `url:${articleUrl}`);

        return {
          id,
          source: "acs",
          seedUrl,
          journalTitle: i.journalTitle || null,
          title: meta?.title || i.title || id,
          articleUrl,
          publishedDate,
          abstract: meta?.abstract ?? null,
          pdfUrl: meta?.pdfUrl ?? null,
          doi: i.doi || null,
        };
      });

      for (const item of enriched) {
        if (!item || typeof item !== "object") continue;
        if (!item.id || seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        results.push(item);
        if (results.length >= cap) break;
      }

      // Supplement ACS "ASAP/online" items via Crossref when date range has newer
      // content than the accessible eTOC RSS provides (TOC HTML is Cloudflare-protected).
      if (results.length < cap && seedJournalTitle) {
        const remaining = cap - results.length;
        const queryRows = Math.min(300, Math.max(50, remaining * 4));
        let crossrefItems = [];
        try {
          crossrefItems = await fetchCrossrefWorksByContainerTitle({
            containerTitle: seedJournalTitle,
            startDate: start,
            endDate: end,
            prefix: "10.1021",
            rows: queryRows,
          });
        } catch {
          crossrefItems = [];
        }

        for (const cr of crossrefItems) {
          if (!cr?.doi) continue;
          const id = `doi:${cr.doi}`;
          if (seenIds.has(id)) continue;

          const candidateDates = [
            cr.publishedOnlineDate,
            cr.issuedDate,
            cr.createdDate,
            cr.publishedPrintDate,
          ].filter(Boolean);
          const inRange = candidateDates.some((d) => isDateInRange(d, start, end));
          if (!inRange) continue;

          const publishedDate =
            cr.publishedOnlineDate ||
            cr.issuedDate ||
            cr.createdDate ||
            cr.publishedPrintDate ||
            null;

          seenIds.add(id);
          results.push({
            id,
            source: "acs",
            seedUrl,
            journalTitle: seedJournalTitle,
            title: cr.title || id,
            articleUrl: stripAcsTrackingParams(cr.articleUrl || `https://doi.org/${cr.doi}`),
            publishedDate,
            abstract: cr.abstract,
            pdfUrl: cr.pdfUrl,
            doi: cr.doi,
          });

          if (results.length >= cap) break;
        }
      }

      continue;
    }

    if (url.hostname.endsWith("onlinelibrary.wiley.com")) {
      const isDirectFeed =
        url.pathname.startsWith("/action/showFeed") ||
        url.pathname.startsWith("/feed/") ||
        url.pathname.endsWith(".rss") ||
        url.searchParams.get("rss") === "1";

      let seedHtml = null;
      let discoveredRssUrl = null;
      const listingCandidates = [];
      const listingByKey = new Map();

      if (!isDirectFeed) {
        try {
          seedHtml = await fetchText(seedUrl);
        } catch {
          seedHtml = null;
        }

        if (seedHtml) {
          discoveredRssUrl = discoverRssUrlFromHtmlText(seedUrl, seedHtml);

          const journalCode = extractWileyJournalCodeFromSeedUrl(seedUrl);
          const seedIsIssueLike =
            journalCode && isWileyIssueLikeTocPath(url.pathname, journalCode);
          const issueTocUrls = parseWileyIssueTocUrls(seedHtml, seedUrl);

          const tocUrls = issueTocUrls.length ? issueTocUrls : [seedUrl];
          if (seedIsIssueLike && !tocUrls.includes(seedUrl)) {
            tocUrls.unshift(seedUrl);
          }

          const seenTocPages = new Set();
          const maxTocPages = Math.min(30, tocUrls.length);

          const addCandidate = (candidate) => {
            if (!candidate || typeof candidate !== "object") return;
            const doi = candidate?.doi || null;
            const key = doi
              ? `doi:${doi}`
              : (() => {
                  const normalized = canonicalizeWileyArticleUrl(candidate?.articleUrl);
                  return normalized ? `url:${normalized}` : null;
                })();
            if (!key) return;

            const normalizedArticleUrl = canonicalizeWileyArticleUrl(candidate?.articleUrl);
            const normalizedCandidate = {
              ...candidate,
              articleUrl: normalizedArticleUrl || candidate?.articleUrl || null,
            };

            const idx = listingByKey.get(key);
            if (idx === undefined) {
              listingByKey.set(key, listingCandidates.length);
              listingCandidates.push(normalizedCandidate);
              return;
            }

            // Keep the earliest occurrence order, but patch in better metadata when available.
            const prev = listingCandidates[idx];
            const prevTitle = typeof prev?.title === "string" ? prev.title.trim() : "";
            const nextTitle = typeof normalizedCandidate?.title === "string"
              ? normalizedCandidate.title.trim()
              : "";
            const prevArticleUrl = typeof prev?.articleUrl === "string"
              ? prev.articleUrl.trim()
              : "";
            const nextArticleUrl = typeof normalizedCandidate?.articleUrl === "string"
              ? normalizedCandidate.articleUrl.trim()
              : "";
            const nextDate = normalizedCandidate?.publishedDate || null;

            if (prev && !prev?.doi && doi) prev.doi = doi;
            if (prev && !prev?.articleUrl && nextArticleUrl) prev.articleUrl = nextArticleUrl;

            const prevHasUsefulTitle =
              Boolean(prevTitle) && (!prevArticleUrl || prevTitle !== prevArticleUrl);
            const nextHasUsefulTitle =
              Boolean(nextTitle) && (!nextArticleUrl || nextTitle !== nextArticleUrl);
            if (prev && !prevHasUsefulTitle && nextHasUsefulTitle) prev.title = nextTitle;

            if (prev && !prev?.publishedDate && nextDate) prev.publishedDate = nextDate;
          };

          for (let tocIndex = 0; tocIndex < maxTocPages; tocIndex += 1) {
            const tocUrl = tocUrls[tocIndex];
            if (!tocUrl || seenTocPages.has(tocUrl)) continue;
            seenTocPages.add(tocUrl);

            let pageUrl = tocUrl;
            let pageHtml = tocUrl === seedUrl ? seedHtml : null;
            if (!pageHtml) {
              try {
                pageHtml = await fetchText(tocUrl);
              } catch {
                continue;
              }
            }

            let pageCount = 0;
            while (pageHtml && pageCount < 10) {
              const contentHtml = extractMainContentHtml(stripHtmlScriptsStyles(pageHtml)) || pageHtml;
              let pageCandidates = parseWileyListingCandidates(contentHtml, pageUrl, {
                includeDoiTextFallback: false,
              });
              if (pageCandidates.length === 0) {
                pageCandidates = parseWileyListingCandidates(contentHtml, pageUrl, {
                  includeDoiTextFallback: true,
                });
              }

              for (const c of pageCandidates) addCandidate(c);

              const nextUrl = parseWileyNextPageUrl(pageHtml, pageUrl);
              if (!nextUrl || seenTocPages.has(nextUrl)) break;
              seenTocPages.add(nextUrl);

              try {
                pageHtml = await fetchText(nextUrl);
                pageUrl = nextUrl;
                pageCount += 1;
              } catch {
                break;
              }
            }

            // Stop once we have enough items and issues are older than start date.
            if (listingCandidates.length >= Math.min(2000, cap * 8)) {
              const dated = listingCandidates
                .map((c) => c?.publishedDate || null)
                .filter(Boolean)
                .sort();
              const oldest = dated.length ? dated[0] : null;
              if (oldest && oldest < start) break;
            }
          }
        }
      }

      let rssUrl = null;
      if (isDirectFeed) {
        rssUrl = wileySeedToRssUrl(seedUrl) || url.toString();
      } else {
        rssUrl = discoveredRssUrl || wileySeedToRssUrl(seedUrl);
        if (!rssUrl && !seedHtml) {
          rssUrl = await discoverRssUrlFromHtml(seedUrl);
        }
      }

      if (!rssUrl && listingCandidates.length === 0) {
        const err = new Error(
          `Wiley feed not found for seed URL (${seedUrl}). Please provide a Wiley /toc/{journalCode} page, or paste a direct RSS feed URL (action/showFeed, /feed/, or .rss).`,
        );
        err.status = 400;
        throw err;
      }

      let feedItems = [];
      if (rssUrl) {
        try {
          const xml = await fetchText(rssUrl);
          feedItems = parseScienceRssItems(xml);
        } catch (err) {
          if (listingCandidates.length === 0) throw err;
          feedItems = [];
        }
      }

      const feedByKey = new Map();
      for (const item of feedItems) {
        if (!item || typeof item !== "object") continue;
        const doi = item?.doi || null;
        const key = doi
          ? `doi:${doi}`
          : (() => {
              const normalized = canonicalizeWileyArticleUrl(item?.articleUrl);
              return normalized ? `url:${normalized}` : null;
            })();
        if (!key || feedByKey.has(key)) continue;
        feedByKey.set(key, item);
      }

      const orderedCandidates = [];

      if (listingCandidates.length > 0) {
        for (const c of listingCandidates) {
          const doi = c?.doi || null;
          const key = doi
            ? `doi:${doi}`
            : (() => {
                 const normalized = canonicalizeWileyArticleUrl(c?.articleUrl);
                 return normalized ? `url:${normalized}` : null;
               })();
          if (!key) continue;

          const fromFeed = feedByKey.get(key);
          if (fromFeed) {
            const merged = { ...fromFeed };
            if (c?.articleUrl) merged.articleUrl = c.articleUrl;
            if (c?.doi) merged.doi = c.doi;
            if (c?.title && c.title !== c.articleUrl) merged.title = c.title;
             if (c?.publishedDate) merged.publishedDate = c.publishedDate;
            orderedCandidates.push(merged);
          } else {
            orderedCandidates.push(c);
          }
        }
      } else {
        orderedCandidates.push(...feedItems);
      }

      const remaining = cap - results.length;
      const candidateCap = Math.min(2000, Math.max(200, remaining * 6));
      const filteredCandidates = orderedCandidates.filter((i) => {
        const date = i?.coverDate || i?.publishedDate || null;
        return !date || isDateInRange(date, start, end);
      });
      const candidates = filteredCandidates.slice(0, candidateCap);

      const enriched = await mapWithConcurrency(candidates, 4, async (i) => {
        const doi = i?.doi || null;

        const listingDate = i?.coverDate || i?.publishedDate || null;
        if (listingDate && !isDateInRange(listingDate, start, end)) {
          return null;
        }

        const baseArticleUrl =
          typeof i?.articleUrl === "string" ? i.articleUrl.trim() : "";
        const baseTitle = typeof i?.title === "string" ? i.title.trim() : "";
        const titleIsPlaceholder = !baseTitle || (baseArticleUrl && baseTitle === baseArticleUrl);

        let meta = null;
        const shouldFetchMeta = Boolean(doi) && (titleIsPlaceholder || !listingDate);
        if (shouldFetchMeta) {
          try {
            meta = await fetchCrossrefWork(doi);
          } catch {
            meta = null;
          }
        }

        const rssDate = listingDate;

        const rawArticleUrl = i?.articleUrl || (doi ? `https://doi.org/${doi}` : null);
        if (!rawArticleUrl) return null;
        const articleUrl = canonicalizeWileyArticleUrl(rawArticleUrl) || rawArticleUrl;
        const id = doi ? `doi:${doi}` : `url:${articleUrl}`;

        const publishedDate =
          listingDate || meta?.publishedDate || meta?.publishedPrintDate || null;

        return {
          id,
          source: "wiley",
          seedUrl,
          journalTitle: i?.journalTitle || null,
          title: (titleIsPlaceholder ? (meta?.title || i?.title) : i?.title) || id,
          articleUrl,
          publishedDate,
          abstract: meta?.abstract ?? null,
          pdfUrl: meta?.pdfUrl ?? null,
          doi,
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

  const finalResults = results.slice(0, cap);

  const natureMissingAbstract = finalResults.filter(
    (item) =>
      item &&
      item.source === "nature" &&
      typeof item.articleUrl === "string" &&
      item.articleUrl &&
      !String(item.abstract || "").trim(),
  );

  if (natureMissingAbstract.length === 0) {
    return finalResults;
  }

  const enriched = await mapWithConcurrency(
    natureMissingAbstract,
    3,
    async (item) => {
      const details = await fetchNatureDetailsCached(item.articleUrl);
      return {
        ...item,
        title: details?.title || item.title,
        publishedDate: details?.publishedDate || item.publishedDate,
        abstract: details?.abstract || item.abstract,
        pdfUrl: details?.pdfUrl || item.pdfUrl,
        contentType: details?.contentType || item.contentType,
        contentSubGroup: details?.contentSubGroup || item.contentSubGroup,
        contentGroup: details?.contentGroup || item.contentGroup,
      };
    },
  );

  const byArticleUrl = new Map(
    enriched
      .filter((item) => item && typeof item.articleUrl === "string")
      .map((item) => [item.articleUrl, item]),
  );

  return finalResults.map((item) => {
    if (!item || item.source !== "nature") return item;
    const next = byArticleUrl.get(item.articleUrl);
    return next || item;
  });
}
