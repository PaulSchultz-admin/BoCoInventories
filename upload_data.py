#!/usr/bin/env python3
"""Sync one backend/data/<dataset> folder onto the persistent disk on Render, over SSH."""

import argparse
import subprocess
import sys
from pathlib import Path

# From the "Connect" dropdown on the bocoinventories-backend service page.
SSH_TARGET = "srv-d986dm57vvec7392b3o0@ssh.oregon.render.com"
REMOTE_DATA_DIR = "/app/data"

BACKEND_DIR = Path(__file__).resolve().parent / "backend"
DATA_DIR = BACKEND_DIR / "data"

DATASETS = ["butterflies", "butterflies-us", "dragonflies", "wildflowers"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", choices=DATASETS)
    args = parser.parse_args()

    dataset_dir = DATA_DIR / args.dataset
    if not dataset_dir.is_dir():
        sys.exit(f"Data directory not found: {dataset_dir}")

    tar = subprocess.Popen(
        ["tar", "-czf", "-", "-C", str(BACKEND_DIR), f"data/{args.dataset}"],
        stdout=subprocess.PIPE,
    )
    ssh = subprocess.Popen(
        ["ssh", SSH_TARGET, f"tar xzf - -C {REMOTE_DATA_DIR} --strip-components=1"],
        stdin=tar.stdout,
    )
    tar.stdout.close()
    ssh.communicate()

    if tar.wait() != 0:
        sys.exit("tar failed")
    if ssh.returncode != 0:
        sys.exit("ssh/remote extraction failed")

    print(f"Upload of {args.dataset} complete.")


if __name__ == "__main__":
    main()
