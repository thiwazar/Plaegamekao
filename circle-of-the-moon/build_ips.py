"""Build a redistribution-safe IPS from the exact AAMP source and Thai target."""

from hashlib import sha256
from pathlib import Path
import sys

OUTPUT = Path(__file__).with_name("CotM_Thai_v1.0_AAMP.ips")
SOURCE_SHA = "f2a7d5dca15d5a0f11cc4135517b5ddb4d76d522bac6f40b38b76439dafd2292"
TARGET_SHA = "4b514d8f7e2f1868c45def4c277b5b5cd91ba7930a5de514b59470936da06d73"


def digest(data):
    return sha256(data).hexdigest()


def build(source, target):
    patch = bytearray(b"PATCH")
    pos = 0
    while pos < len(source):
        if source[pos] == target[pos]:
            pos += 1
            continue
        start = pos
        if start == 0x454F46:  # The three-byte IPS EOF marker is reserved.
            start -= 1
        pos = start
        while pos < len(source) and pos - start < 0xFFFF:
            if source[pos] == target[pos]:
                lookahead = pos
                while lookahead < len(source) and lookahead - pos < 8 and source[lookahead] == target[lookahead]:
                    lookahead += 1
                if lookahead == len(source) or lookahead - pos == 8:
                    break
            pos += 1
        if pos == start:
            pos += 1
        chunk = target[start:pos]
        patch.extend(start.to_bytes(3, "big"))
        patch.extend(len(chunk).to_bytes(2, "big"))
        patch.extend(chunk)
    patch.extend(b"EOF")
    return bytes(patch)


def apply(source, patch):
    assert patch.startswith(b"PATCH")
    out = bytearray(source)
    pos = 5
    while patch[pos:pos + 3] != b"EOF":
        offset = int.from_bytes(patch[pos:pos + 3], "big")
        size = int.from_bytes(patch[pos + 3:pos + 5], "big")
        pos += 5
        assert size > 0 and offset + size <= len(out)
        out[offset:offset + size] = patch[pos:pos + size]
        pos += size
    assert pos + 3 == len(patch)
    return bytes(out)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python build_ips.py <clean_AAMP.gba> <Thai_v1.0.gba>")
    source, target = Path(sys.argv[1]).read_bytes(), Path(sys.argv[2]).read_bytes()
    assert len(source) == len(target) == 8 * 1024 * 1024
    assert source[0xAC:0xB0] == target[0xAC:0xB0] == b"AAMP"
    assert digest(source) == SOURCE_SHA and digest(target) == TARGET_SHA
    patch = build(source, target)
    assert digest(apply(source, patch)) == TARGET_SHA
    OUTPUT.write_bytes(patch)
    print(f"Verified {OUTPUT.name}: {len(patch):,} bytes; source and patched target SHA-256 match.")
