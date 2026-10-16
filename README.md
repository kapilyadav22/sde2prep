# sde2prep

A personal interview preparation workspace built with **Next.js App Router, React, and TypeScript**. Includes DSA, LLD, HLD, AWS, Redis, Java Multithreading, Spring Boot, Kafka, JUnit & Mockito, and Other collections, a searchable library, a focused note reader, bookmarks, completion tracking, and a Microsoft DSA practice checklist.

## Run locally

Requires Node.js 22.13+ (22.22+ recommended).

```sh
npm ci
npm run dev
```

For the production static export:

```sh
npm run build
npm start
```

Open http://localhost:3000. The built website is in `out/` and can be hosted on a static host, including Sites, S3 + CloudFront, Netlify, or Vercel.

## Your content

`content/library.json` is the published content snapshot. `content/sources.json` registers your four supplied sources. The published library includes 159 chapters across ten collections. Original AWS and HLD documents retain their source text, diagrams, tables, lists, headings, and formatting. Redis, Spring Boot, Kafka, and JUnit/Mockito combine related document tabs into ordered chapters; Java Multithreading preserves the Word source in ten contiguous chapters. LLD has a repository explorer with hierarchical folders and separately presented original source files. DSA has 142 canonical LeetCode problem links verified against the official catalog; three general algorithm topics retain honest source-sheet references. Existing AWS and HLD links remain usable.

The initial HLD content was read across all 36 Google Docs tabs through the connected Google Docs API. Its original paragraphs and table metadata are kept in `content/raw/hld-native.json`; `npm exec -- node scripts/rebuild-native.mjs` regenerates those chapters from that preserved snapshot. Signed provider image URLs and credentials are not persisted.

## Upload and replace notes in the website

1. Click **Import notes**.
2. Choose a collection and title, or select an existing source to replace.
3. Upload a `.docx`, text-based `.pdf`, `.md`, or `.txt` file.
4. Notes become searchable and readable immediately. Updating an existing source replaces all its prior chapters in this browser.

Uploads, bookmarks, reading history, and progress are saved in **this browser’s local storage**. They do not sync to other devices or change the deployed website. The Sources page lets you restore a published source after a browser replacement, remove an uploaded source, and export browser imports to JSON for backup or publication. Large files can exceed browser storage; use the command-line importer for them.

DOCX and PDF uploads extract text. They do not extract embedded images or preserve all document layout. Scanned PDFs require OCR before importing. Legacy `.doc` files should be exported as `.docx` first. The original AWS and HLD diagrams are bundled independently under `public/diagrams/`. Original documents are rendered directly from the native snapshots registered under `nativeSnapshot` in `content/sources.json`, preserving source order and inline styles instead of converting them to Markdown. New image assets are converted to smaller WebP files only when decoded RGBA pixels are exactly identical; otherwise the original image is retained.

## Publish an updated file

Reuse the existing source ID to replace the previous version:

```sh
npm run import -- /absolute/path/aws.docx aws aws-notes "AWS interview notes"
npm run import -- /absolute/path/hld.pdf hld hld-notes "High-level system design"
npm run import -- /absolute/path/new-topic.md other my-new-topic "My new topic"
npm run build
```

For a browser export:

```sh
npm run import -- /absolute/path/sde2prep-library.json other backup
npm run build
```

Deploy the new `out/` directory. The importer replaces source content atomically, removes stale chapters from that source, and preserves other sources. It rejects empty extractions instead of overwriting valid notes. IDs are stable by source and chapter order; a major source reorganization can change which text is associated with a chapter ID.

## Refresh linked sources

```sh
npm run sync
# Or refresh one source
npm run sync -- --source=ms-lld
npm run sync -- --source=aws-notes
npm run build
```

Sync reads configured Google Docs/Sheets sources and the public GitHub repository. Original Google documents use the native Google Docs API with `GOOGLE_ACCESS_TOKEN` and downloads its original images. Without that token, sync preserves existing original snapshots and reports that a native refresh is required; it never silently flattens the original notes into text. `npm run sync -- --local --source=aws-notes` rebuilds from the preserved original snapshot. A failed source retains its prior published content and returns a nonzero exit status; review errors before building. Large or restricted Google documents may need an exported file through the importer instead. Linked documents are **not polled automatically**. The HLD native snapshot retains tab boundaries and rich formatting. Manual text-only file replacement uses newly extracted text chapters instead. Native AWS refreshes retain source tab IDs so chapter links stay stable.

For private Google exports, supply `GOOGLE_ACCESS_TOKEN` in the environment with appropriate read access. An optional `GITHUB_TOKEN` increases GitHub API rate limits. Keep both server-side in your local shell or CI secret store; never prefix them with `NEXT_PUBLIC_`, put them in source files, or expose them in browser code. No credentials are required to read the already imported library.

The Microsoft practice list is derived from the seven primary topic groups in your sheet. Source status is preserved in notebook content; the checklist starts fresh and stores personal progress separately. Where the sheet lacks an exact LeetCode URL, **Find problem** opens a LeetCode search.

## SEO and deployment

- Statically generated HTML for every published chapter and collection.
- Individual titles, descriptions, canonical URLs, and article Open Graph metadata.
- `sitemap.xml`, `robots.txt`, a social preview, and JSON-LD learning resources.
- Semantic headings, keyboard controls, responsive layouts, reduced motion, and print styles.

Set `NEXT_PUBLIC_SITE_URL` before building when moving to a new domain. The default is the registered Sites origin. The Sites deployment starts private; search engines cannot index an owner-private site. SEO metadata becomes useful when you choose to host it publicly.

## Verification

```sh
npm run typecheck
npm test
npm run build
python3 scripts/verify-originals.py
```

The original-document verifier compares every generated original chapter with the source snapshot: complete source text, image order, table counts, image files, and existing URLs.

Importer tests check source replacement, text preservation, empty-document handling, and fenced code integrity. Browser checks cover navigation, search, saved notes, completion persistence, focus mode, Microsoft problem tracking, DOCX import and replacement, PDF extraction, and mobile/desktop layouts.

## Structure

- `app/`: Next.js routes and SEO metadata.
- `components/`: workspace, library, practice checklist, imports, and reader.
- `lib/`: typed models, collection definitions, and published content loader.
- `content/`: source registry, normalized content, and original source snapshots.
- `scripts/`: document import, source synchronization, native-content reconstruction, and production preview.
- `public/`: favicon, social preview, PDF worker, and source diagrams.

No backend, account system, database, or automatic cross-device synchronization is included. Content publication is explicit through import/sync, rebuild, and deployment.


## Refresh the original document library

`npm run rebuild:originals` rebuilds chapter metadata from all local native snapshots and reapplies verified LeetCode links. `npm run sync -- --local` refreshes from local snapshots without flattening rich documents. Google Docs native refresh requires local read credentials; the imported website does not require them. The Java Word file is preserved as `content/raw/java-original.docx`; rerun `scripts/import-java-docx.py` with Python and lxml after replacing that file, then rebuild originals. Chapter grouping is navigational: all original source sections retain their order and appear once.

`node scripts/link-leetcode.mjs --check` validates the practice mapping; pass `--catalog=/absolute/path/catalog.json` to compare it with a freshly downloaded official `https://leetcode.com/api/problems/all/` catalog. Premium problems are labeled. Broader topics do not pretend to be specific LeetCode problems.

LLD preserves all 161 original repository files. Its tree, separate file headers, expandable panels, line numbers, syntax highlighting, copy/download controls, and wrapping operate on the unchanged source strings.
