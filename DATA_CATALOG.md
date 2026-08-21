# AgentCache Knowledge Layer — Governed Data Source Catalog

*Built Aug 17 2026. The concrete answer to "can we tap all sectors of publicly accessible data?" — no, and here's the version that's actually defensible and sellable.*

## The premise

"Publicly accessible" is not "safe to cache and re-serve." A page you can load is not a dataset you can redistribute. Terms of service, copyright, database rights, and privacy law all sit between "public" and "reusable." For a product whose value is *trust and measurement*, indiscriminate scraping is a liability that erases the brand. So the Knowledge layer is not a firehose — it's a **governed catalog** of sources we can stand behind, each one carrying its license, freshness, and PII risk, gated at ingest.

## What shipped

| File | Role |
|---|---|
| `data/sources.json` | The curated registry — 26 sources across 7 sectors, each with license, access method, rate limit, freshness, PII risk, and a `verifyBeforeIngest` flag. |
| `lib/ingest-guard.js` | The gate — pure, fail-closed: license check → PII scan → provenance stamp → cache / redact / skip. |
| `tests/ingest-guard.test.mjs` | 9 tests covering the gate's decisions. |
| `public/data-catalog.html` | Browsable catalog UI — filter by sector, license/PII/freshness badges. |

## Sectors covered

Government & Public Records · Financial & Economic · Scientific & Research · Geospatial · Legal & Regulatory · Web-scale & News · Company & Corporate.

11 sources are public-domain/CC0 (free re-serve), 4 CC0, 3 CC-BY (attribution), 1 ODbL (share-alike), and **7 are `restricted` — the gate blocks these from re-serve by default** (Common Crawl, GDELT, IMF, FRED, EUR-Lex, OpenCorporates, Companies House). They're catalogued because they're useful for *analysis*, not redistribution.

## The gate — every record passes through it

```
ingestRecord(source, { id, text })
  1. LICENSE CHECK   policyFor(license).redistribute === false  → action: 'skip'  (fail closed)
  2. PII GATE        detectPII(text) non-empty                  → action: 'redact-cache'
  3. PROVENANCE      always stamped: { sourceId, license, url, recordId, retrievedAt }
  4. CACHE           clean + permitted                          → action: 'cache'
```

Order matters: **license wins first.** A restricted source is skipped before the PII scanner even runs — you never spend compute redacting something you can't use anyway. Conversely, a permitted source with personal data in it is *redacted, not dropped* — you keep the usable signal and remove the liability.

Design decisions:

- **Fail closed.** Unknown or restricted license → skip. Over-caching gets you sued; under-caching costs a re-fetch. The asymmetry dictates the default.
- **Provenance is mandatory, not optional.** Every cached record knows where it came from, under what license, and when. In regulated sectors this is worth more than raw coverage — it's the difference between "the model said so" and "here's the citation."
- **`verifyBeforeIngest` is part of the gate, not a footnote.** 14 sources carry nuanced or per-record licenses (arXiv full-text, PMC article variants, GBIF dataset-level, court dockets). Their current terms must be re-checked at ingest — the flag routes them to that check.
- **Attribution flows through.** CC-BY/ODbL sources return `requireAttribution: true` / `shareAlike: true` so the serving layer can render the credit the license requires.

## Why this is the profitable shape

It ties straight into the two things already built: the **engine** caches and measures; **Guardrails** is the same PII machinery applied inline. A provenance-tracked, license-gated knowledge cache is a thing enterprises in finance, law, and healthcare will pay for precisely *because* it says no to the risky sources. Breadth is not the moat — defensible, cited, compliant breadth is.

## Not done / next

1. Per-source **adapters** (fetch + normalize) behind the gate — start with the public-domain sector (SEC EDGAR, Census, Federal Register) where the gate always says "cache."
2. Resolve `verifyBeforeIngest` sources to per-record license fields so the gate can decide automatically.
3. Wire the gate's `skip`/`redact` counts into the same savings/telemetry ledger — governance you can show, like savings you can show.
4. Add `cc-by-sa` sources (Wikipedia/DBpedia) once the attribution-rendering path exists.
