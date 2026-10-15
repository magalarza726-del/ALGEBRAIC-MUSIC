#!/usr/bin/env python3
"""Compila una página estática y empaqueta samples CC0 con fuentes inmovilizadas."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import Request, urlopen
import json
import shutil
import time

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "dist"
CATALOG = json.loads((ROOT / "sound-bank.json").read_text(encoding="utf-8"))

def sample_jobs():
    for family, bank in CATALOG["banks"].items():
        if bank["type"] == "acoustic":
            for level in bank["levels"]:
                for rr in range(1, bank["rr"] + 1):
                    filename = f"{family}_vl{level}_rr{rr}.flac"
                    url = CATALOG["sources"]["acoustic"] + bank["folder"] + "/samples/" + filename
                    yield filename, url, "fLaC"
        else:
            for velocity, sample in enumerate(bank["files"], 1):
                filename = f"{family}_v{velocity}.wav"
                url = CATALOG["sources"]["electronic"] + sample
                yield filename, url, "RIFF"

def download(item):
    filename, url, expected = item
    output = DEST / "assets" / "samples" / filename
    for attempt in range(4):
        try:
            with urlopen(Request(url, headers={"User-Agent": "ALGEBRAIC-MUSIC/2.0"}), timeout=45) as res:
                data = res.read()
            if len(data) < 500 or data[:4] != expected.encode("ascii"):
                raise ValueError("El archivo no tiene una cabecera de audio válida: " + filename)
            if filename.endswith(".wav") and data[8:12] != b"WAVE":
                raise ValueError("Encabezado WAVE inválido: " + filename)
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
    for filename in ["index.html", "styles.css", "app.js", "matrix.mjs", "favicon.svg", "sound-bank.json"]:
        shutil.copy2(ROOT / filename, DEST / filename)
    (DEST / ".nojekyll").touch()
    (DEST / "assets" / "samples").mkdir(parents=True)
    jobs = list(sample_jobs())
    assert len(jobs) == len({name for name, _, _ in jobs}), "Nombres de muestras duplicados"
    total_bytes = 0
    with ThreadPoolExecutor(max_workers=10) as pool:
        for future in as_completed([pool.submit(download, job) for job in jobs]):
            filename, size = future.result()
            print(f"{filename}: {size} bytes")
            total_bytes += size
    print(f"Listo: {len(jobs)} archivos de audio, {total_bytes/1048576:.2f} MiB")
if __name__ == "__main__":
    main()
