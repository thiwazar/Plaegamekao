# Website release requirements

User requirement (23 October 2026): Whenever adding a game or changing a patch, update its date, status, and specific release notes on the website in the same release.

- Start from current origin/main and preserve concurrent work.
- Update only the affected game entry and its own assets. Do not change another game's metadata or patch behavior.
- Add/update the affected ID in PGK_RELEASES in index.html with the real timestamp, release type/status, and concrete changes. Keep the version, source requirements and known limitations accurate. Show these details on the affected game's detail page as well as its library card.
- Describe web patch/download verification separately from in-game testing. Never imply gameplay passed because file hashes match.
- Test the affected game through the live website: choose an authorized original file, apply the patch, click download, and verify the downloaded hash against the release. Preserve evidence and note any untested stages honestly.
- Inspect the final diff to confirm unrelated game entries and shared patch code are unchanged. If shared code must change, perform relevant regression checks.
- Publish patches and artwork only; never add original or patched game ROMs to this repository.
- After deployment, verify the affected live entry, cover, patch, date, status, and release notes.
