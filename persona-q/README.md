# Persona Q Thai v.1

Client-side QGDELTA1 patch for the decrypted USA .3ds source identified in manifest.json.
No game ROM is hosted. The browser reads the user's own ROM locally, validates SHA-256,
applies replacement chunks using Blob slices, and validates the output before enabling download.

Validation: the published JavaScript patcher reconstructed the 2 GiB target with matching
SHA-256 and rejected a wrong-size input. Translation coverage and a full-game playthrough
are not claimed. Some English text remains.

Luma compact package is NOT published: the loader test still displayed English.
Do not substitute the QGDELTA1 patch or an Azahar romfs_ext BPS patch for Luma files.

Patch source and output hashes: manifest.json. Public release label: v.1.
