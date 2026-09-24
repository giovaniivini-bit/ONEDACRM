# Image delivery fix — 2026-09-24

## Cause and implementation

The deployed CRM returned local-only URLs for Drive-only records. It also lacked
the static images and image map used by Studeoneda. The local corrections from
the prior session had not been published to production.

The CRM now loads its local image index immediately, scans the sibling
Studeoneda/images folder, and retains a saved index between starts. Known
product photos were copied from the existing Studeoneda assets and locally
synchronized product folders into images/. Two Santa Marca photos were obtained
from their already indexed Drive file IDs to supersede smaller JPEG variants.

Drive-only photos use /api/proxy-image, with a disk cache, concurrent-request
deduplication, validated image responses, bounded redirects/downloads, ETags,
failure backoff and stale-photo fallback when Drive is unavailable.

Local originals take precedence over old data/images_cache copies. RAM entries
are checked against source file size, timestamp and path. Photo rendering no
longer uses content-visibility:auto or forced 3D transforms; CQ defaults to cards
and still offers the existing table/both options.

## Verification

- Node syntax checks: server.js, app.js and drive-image-cache.js passed.
- Two automated tests passed: concurrency, restart/disk cache, ETag, invalid
  input/size, failures, bounded retry and stale fallback.
- Independent read-only review: no blocking findings. Both minor cache findings
  were addressed before publication.
- VPS HTTP audit: 502 indexed local images, 502 successful image responses,
  zero failures. Server-local p95 response time: 13 ms (not internet latency).
- Drive proxy: 58,497-byte JPEG returned HTTP 200; first request 612 ms, next
  request 3 ms on the VPS.
- Browser, production: all five Setor 13 photos from the reported screenshot
  loaded with nonzero naturalWidth; original Santa Marca images are 1102px wide.
- Browser, production: CQ scrolling plus Processo and Estampa inspected without
  broken loaded images. Native lazy loading postpones offscreen images.

## Deployment

Published server.js, app.js, style.css, drive-image-cache.js, image_map.json and
images/ to /home/ubuntu/apps/ONEDACRM. Restarted only PM2 oneda-crm-app.
Previous app.js/server.js were compared to the inspected production hashes.
Code backup: /home/ubuntu/crm-image-backup-DyHIAC5J.
No spreadsheet data files or PM2 settings were replaced. No GitHub push made.

New files exclusively in cloud still depend on the existing Drive indexing
mechanism. Records with no matching source image retain the no-photo placeholder.
The static snapshot is not a replacement for a future authenticated Drive sync.

## Follow-up — 2026-09-24

Production diagnostics proved that the public-folder HTML scan returned 551
indexed photos, not the full Drive collection. Repeating the refresh could not
discover `01.18.36.0570.jpg`, even though that file existed in the locally
synchronized Drive folder. The reliable Studeoneda model is a deployed static
snapshot, not a complete server-side Drive scan.

The 170 files present in the synchronized source folder but absent from the CRM
snapshot were copied into `images/` for publication, including
`01.18.36.0570.jpg`. A complete automatic cloud sync remains dependent on a
future authenticated Google Drive API integration.
