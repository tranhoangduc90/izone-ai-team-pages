"""Build or verify the Mini K67 CBT student-only offline release."""

import argparse
import hashlib
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1] / "term-tests"
ROUTE = ROOT / "mini-test-lesson-5-computer-based"
BOOTSTRAP = ROOT / "term-test-2-computer-based"
PRIOR = "listening-first-frame-v1"
RELEASE = "student-shell-v2"


def digest(body):
    return hashlib.sha256(body).hexdigest()


def site_bytes(path):
    body = path.read_bytes()
    if path.suffix in {".css", ".mjs", ".js", ".html", ".svg"}:
        body = body.replace(b"\r\n", b"\n")
    return body


def replace(text, old, new, count=1):
    if text.count(old) != count:
        raise ValueError(f"Changed release input: {old}")
    return text.replace(old, new)


def build():
    old_manifest = (ROUTE / f"offline-assets-{PRIOR}.mjs").read_text(encoding="utf-8")
    order = json.loads(re.search(r"export const ASSETS=(\[.*?\]);", old_manifest, re.S).group(1))
    prior_hashes = json.loads(re.search(r"export const ASSET_HASHES=(\{.*?\});", old_manifest, re.S).group(1))
    teacher = {asset for asset in order if asset.startswith("../teacher/")}
    if teacher != {"../teacher/app.js", "../teacher/index.html", "../teacher/model.js",
                   "../teacher/reading-appearance.css", "../teacher/styles.css"}:
        raise ValueError("Changed teacher paths in the prior shell")
    for asset in order:
        if asset not in teacher and digest(site_bytes(ROUTE / asset)) != prior_hashes[asset]:
            raise ValueError(f"Student asset drift: {asset}")

    old_entry = f"index-{PRIOR}.html"
    new_entry = f"index-{RELEASE}.html"
    old_bootstrap = f"bootstrap-mini-k67-{PRIOR}.js"
    new_bootstrap = f"bootstrap-mini-k67-{RELEASE}.js"
    old_journey = f"journey-mini-k67-{PRIOR}.mjs"
    new_journey = f"journey-mini-k67-{RELEASE}.mjs"
    old_worker = f"offline-worker-{PRIOR}.js"
    new_worker = f"offline-worker-{RELEASE}.js"
    worker_core = f"shell-worker-{RELEASE}.mjs"
    worker_source = ROOT / f"term-test-1-k56-computer-based/worker-{PRIOR}.mjs"

    worker_impl = replace(site_bytes(worker_source).decode(), old_entry, new_entry)
    worker = replace(site_bytes(ROUTE / old_worker).decode(), f"offline-assets-{PRIOR}.mjs", f"offline-assets-{RELEASE}.mjs")
    worker = replace(worker, "../" + worker_source.relative_to(ROOT).as_posix(), f"./{worker_core}")
    journey = replace(site_bytes(ROUTE / old_journey).decode(), old_worker, new_worker)
    before_resume = "    }else if(pagesOnly&&navigator.onLine!==false&&!navigator.serviceWorker?.controller){"
    journey = replace(
        journey,
        before_resume,
        f"""    }}else if(slug===miniSlug&&navigator.onLine!==false
        &&!navigator.serviceWorker?.controller?.scriptURL.includes('/{new_worker}?')){{
      // Install the repaired shell in the background. A ready attempt can
      // continue immediately with its verified draft, audio and clock.
      void cacheShell(OfflineRuntime,slug).catch(()=>{{}});
""" + before_resume,
    )
    bootstrap = replace(site_bytes(BOOTSTRAP / old_bootstrap).decode(), old_journey, new_journey, 2)
    entry = replace(site_bytes(ROUTE / old_entry).decode(), old_bootstrap, new_bootstrap)

    files = {
        new_entry: entry,
        f"../term-test-2-computer-based/{new_bootstrap}": bootstrap,
        f"./{new_journey}": journey,
        new_worker: worker,
        f"./{worker_core}": worker_impl,
    }
    changed = {
        old_entry: new_entry,
        f"../term-test-2-computer-based/{old_bootstrap}": f"../term-test-2-computer-based/{new_bootstrap}",
        f"./{old_journey}": f"./{new_journey}",
        old_worker: new_worker,
        "../" + worker_source.relative_to(ROOT).as_posix(): f"./{worker_core}",
    }
    assets = [changed.get(asset, asset) for asset in order if asset not in teacher]
    hashes = {changed.get(asset, asset): prior_hashes[asset] for asset in order if asset not in teacher}
    hashes.update({asset: digest(text.encode()) for asset, text in files.items()})
    build_id = digest(json.dumps(hashes, sort_keys=True, separators=(",", ":")).encode())
    files[f"offline-assets-{RELEASE}.mjs"] = (
        "// Mini K67 CBT student shell. The teacher dashboard uses its own route and assets.\n"
        f"export const ASSETS={json.dumps(assets, indent=2)};\n"
        f"export const ASSET_HASHES={json.dumps(hashes, indent=2)};\n"
        f"export const ASSET_BUILD_ID={json.dumps(build_id)};\n"
    )
    files["index.html"] = entry
    return files, build_id, len(assets)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Regenerate the candidate files")
    args = parser.parse_args()
    files, build_id, asset_count = build()
    for name, text in files.items():
        file = ROUTE / name
        if args.write:
            file.write_text(text, encoding="utf-8", newline="\n")
        elif site_bytes(file) != text.encode():
            raise ValueError(f"Candidate release differs: {name}")
    print(json.dumps({"build": build_id, "assets": asset_count, "verified": not args.write}))


if __name__ == "__main__":
    main()
