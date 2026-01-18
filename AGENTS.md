# Appointer - Agent Pitfalls

## Mistakes We Hit (Avoid Next Time)

- PowerShell escaping: don’t use C-style `\"` / `\\` expecting it to work; use single quotes, or escape `"` with backtick (`` `" ``).
- `rg` defaults to regex: for exact snippets (e.g. JSX props), use `rg -n -F 'literal' file` to avoid parse errors (`\b`, `|`, “unclosed group”, etc).
- Search the real text: use `rg -n -F 'ctaPosition="journal-panel"' file` (not `ctaPosition=\"journal-panel\"`).
- Regex only when needed: prefer `rg -e 'pat1' -e 'pat2' file` over long alternations you might mistype.
- i18n / 中英翻译：UI 文案不要硬编码；用 `t('key')`；新增/修改文案时同步更新 `src/context/LanguageContext.jsx` 的 `en`/`zh`。
