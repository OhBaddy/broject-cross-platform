#!/usr/bin/env python3
"""Build a PNG-backed ICNS bundle from the Broject master icon."""

from io import BytesIO
from pathlib import Path
import struct
import sys

from PIL import Image


PNG_TYPES = (
    (16, b"icp4"),
    (32, b"icp5"),
    (64, b"icp6"),
    (128, b"ic07"),
    (256, b"ic08"),
    (512, b"ic09"),
)


def png_bytes(image: Image.Image, size: int) -> bytes:
    resized = image.resize((size, size), Image.Resampling.LANCZOS)
    output = BytesIO()
    resized.save(output, format="PNG", optimize=True)
    return output.getvalue()


def build(source: Path, destination: Path) -> None:
    image = Image.open(source).convert("RGBA")
    payloads = []
    for size, kind in PNG_TYPES:
        data = png_bytes(image, size)
        payloads.append(kind + struct.pack(">I", len(data) + 8) + data)

    total_length = 8 + sum(len(payload) for payload in payloads)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(b"icns" + struct.pack(">I", total_length) + b"".join(payloads))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: generate-icns.py SOURCE.png DESTINATION.icns")
    build(Path(sys.argv[1]), Path(sys.argv[2]))
