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

## Mandatory release checks (user instruction, 25 October 2026)

The GTA release previously omitted a comma between GAMES entries, causing a JavaScript SyntaxError that stopped the whole page. The user requires future uploads to avoid repeating this failure.

- Before updating main, extract every inline executable script from the exact candidate HTML and run a JavaScript syntax check. Check comma separators when adding an object to GAMES. A syntax failure blocks publication.
- Render the exact candidate in an isolated browser before publication. Check page errors, all existing game cards, search, platform filters, a previous game's detail/back buttons, the new card, its cover, date/status/release notes, and its direct link.
- Compare the candidate against the current main baseline. Existing game metadata, news, assets, hashes and patch engine must be unchanged unless the user specifically requested changes to them. Use expected_sha when publishing; never overwrite concurrent changes.
- For new or modified patches, use the browser patcher with the authorized original file, click Download, and verify the downloaded file's size and SHA-256 against the intended release. Delete temporary ROM downloads after verification.
- After publication, wait for the Pages workflow for that exact commit to finish successfully. Check the live HTML against the tested candidate, repeat the relevant live browser checks and patch/download verification. Do not call a release finished based only on a commit or a local decoder test.
- If an error appears, investigate the actual syntax/runtime/deployment evidence before attributing it to cache. Restore the known working version promptly if necessary, without reverting unrelated work.
- Record the baseline, published commit, tests, limitations and any rollback in the game project's release notes.
