import test from "node:test";
import assert from "node:assert/strict";

import { mergeLiteratureSettings } from "../src/literatureSettings.js";

test("mergeLiteratureSettings persists seedUrlSelectedUnified toggles", () => {
  const existing = {
    seedUrlsUnified: ["https://www.nature.com", "https://science.org"],
    seedUrlTitlesUnified: ["Nature", "Science"],
    seedUrlSelectedUnified: [true, true],
  };

  const merged = mergeLiteratureSettings(existing, {
    seedUrlSelectedUnified: [false, true],
  });

  assert.deepEqual(merged.seedUrlsUnified, ["https://www.nature.com", "https://science.org"]);
  assert.deepEqual(merged.seedUrlSelectedUnified, [false, true]);
});

test("mergeLiteratureSettings defaults selection to true for new urls", () => {
  const existing = {
    seedUrlsUnified: ["https://science.org"],
    seedUrlTitlesUnified: [""],
    seedUrlSelectedUnified: [false],
  };

  const merged = mergeLiteratureSettings(existing, {
    seedUrlsUnified: ["https://science.org", "https://advanced.onlinelibrary.wiley.com/toc/15214095/0/0"],
    seedUrlTitlesUnified: ["", ""],
  });

  assert.deepEqual(merged.seedUrlsUnified, [
    "https://science.org",
    "https://advanced.onlinelibrary.wiley.com/toc/15214095/0/0",
  ]);
  assert.deepEqual(merged.seedUrlSelectedUnified, [false, true]);
});

test("mergeLiteratureSettings keeps selection aligned after filtering blanks", () => {
  const merged = mergeLiteratureSettings(
    {
      seedUrlsUnified: ["https://science.org", ""],
      seedUrlTitlesUnified: ["Science", "Ignored"],
      seedUrlSelectedUnified: [false, true],
    },
    {},
  );

  assert.deepEqual(merged.seedUrlsUnified, ["https://science.org"]);
  assert.deepEqual(merged.seedUrlTitlesUnified, ["Science"]);
  assert.deepEqual(merged.seedUrlSelectedUnified, [false]);
});

