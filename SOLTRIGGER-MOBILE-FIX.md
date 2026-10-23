# Sol Trigger mobile patching fix

Backup branch: backup/before-soltrigger-mobile-2026-10-23 (f1e8eb47f9ce29973fdc0f3b7cf4e798f5e05158).

The former STPATCH1 route buffered the ~1.5 GB source and allocated a second full output, then hashed/copied it. Sol Trigger now uses incremental SHA-256, validated patch blocks and an independent OPFS output file with reads capped at 2 MiB. The original patch and source/target checksums remain unchanged. Output is downloadable only after matching its expected SHA-256. Concurrent attempts on the same panel are rejected while busy.

Validation: bounded-read fixtures, source growth, malformed/truncated/unordered blocks, decompression bounds, disk-write failure, wrong source hash, corrupted patch and low quota. The real 18-block patch produced 1,522,102,272 bytes on a synthetic zero source with the same SHA-256 as an independent zlib reference implementation. This does not establish the real ROM target hash: the original ISO was not supplied. Browser OPFS integration could not run at the internal HTTP preview origin because storage.getDirectory requires a secure context; production uses HTTPS. Android-device confirmation remains pending.

Run the core regression test using Node 24: node tests/soltrigger-mobile.test.mjs.

Temporary output is retained for download and patcher-owned files older than one day are removed on the next attempt. Keep about 4 GB free for temporary output plus the downloaded ISO. Open the page in normal browser mode and leave it open while processing.
