# Theme update — 2026-10-22

Backup: branch `backup/before-theme-2026-10-22`, commit `8f91b130b6deb30f6052a0817d53494a32406664`.

Scope: catalog search/sort and verified release notes, shared cream/gold/forest theme and original mascot across 19 dedicated game pages. Existing covers, screenshots, disc images, links, game definitions, file controls, patch scripts, hashes and binaries retained.

Release ordering: edit `PGK_RELEASES` in index.html only for a verified game release or actual patch/system fix; never bump dates for a theme or cover change. Missing historical dates stay undated rather than invented. All games remain available through platform tabs and original-order mode.

Validation: all original source/href references and control IDs retained; game definitions and index patch engine byte-identical; dedicated-page scripts byte-identical; inline JavaScript syntax checked. Browser smoke test covered catalog rendering, search and opening Lunar Knights. This is not a full-ROM regression test or proof every pre-existing patch works.

Global success counter: not enabled. No fabricated counts or browser-local counts presented as global totals. Requires a shared persistent backend and per-engine verified-success events before release.

Rollback: restore files changed by this theme commit from the backup branch using a new commit; do not force-reset main if later game updates have landed.
