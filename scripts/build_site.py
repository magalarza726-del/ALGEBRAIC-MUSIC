#!/usr/bin/env python3
"""Construye GitHub Pages con 60 muestras FLAC acústicas CC0 fijadas a un commit."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import Request, urlopen
import shutil
import time

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "dist"
PINNED = "2f26075ea93291535a869f5d356d2e3d934c7868"
BASE = f"https://raw.githubusercontent.com/0x4D44/ferrosintesis/{PINNED}/crates/ferrosintesis-samples-"
FAMILIES = {
    "kick": ("drumkit", [1, 2, 4]),
    "hho": ("drumkit", [1, 2, 4]),
    "hhc": ("drumkit", [1, 2, 4]),
    "snare": ("drumkit", [2, 4, 6]),
    "crash": ("drumkit2", [1, 2, 3]),
    "china": ("drumkit2", [1, 3, 5]),
    "tomhi": ("drumkit", [1, 2, 4]),
    "tomlo": ("drumkit", [1, 2, 4]),
    "ride": ("drumkit", [1, 2, 3]),
    "ridebell": ("drumkit", [1, 2, 3]),
}
def download(item):
    family, folder, layer, rr = item
    filename = f"{family}_vl{layer}_rr{rr}.flac"
    url = f"{BASE}{folder}/samples/{filename}"
    output = DEST / "assets" / "samples" / filename
    for attempt in range(4):
        try:
            with urlopen(Request(url, headers={"User-Agent": "ALGEBRAIC-MUSIC/1.0"}), timeout=35) as response:
                data = response.read()
            if not data.startswith(b"fLaC") or len(data) < 1000:
                raise ValueError(f"{filename}: FLAC inválido")
            output.write_bytes(data)
            return filename, len(data)
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1 + attempt * 2)
def main():
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir(parents=True)
    for filename in ["index.html", "styles.css", "app.js", "matrix.mjs", "favicon.svg"]:
        shutil.copy2(ROOT / filename, DEST / filename)
    (DEST / ".nojekyll").touch()
    (DEST / "assets" / "samples").mkdir(parents=True)
    jobs = [(family, folder, layer, rr) for family, (folder, layers) in FAMILIES.items()
            for layer in layers for rr in (1, 2)]
    sizes = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(download, item) for item in jobs]
        for fut in as_completed(futures):
            name, size = fut.result()
            print(f"{name}: {size} bytes")
            sizes += size
    print(f"Listo: {len(jobs)} grabaciones FLAC, {sizes/1048576:.2f} MiB")
if __name__ == "__main__":
    main()
