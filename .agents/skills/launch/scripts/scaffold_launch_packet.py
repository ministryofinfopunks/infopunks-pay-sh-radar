#!/usr/bin/env python3
"""Create the canonical Infopunks launch packet skeleton."""

from __future__ import annotations

import argparse
from pathlib import Path


MARKDOWN_DEFAULTS = {
    "x-thread.md": """# X Launch Thread

1. [Hook]
2. [What shipped]
3. [Why it matters now]
4. [Proof / receipts]
5. [Key surfaces]
6. [How to use it]
7. [Final URL]
""",
    "tweets.md": """# Teaser Tweets

1. [Short standalone post]
2. [Short standalone post]
3. [Short standalone post]
4. [Short standalone post]
5. [Short standalone post]
""",
    "press.md": """# Press Note

## Headline

[Launch headline]

## Summary

[One-sentence summary]

## What Shipped

- [Item]

## Why Now

[Context]

## Proof Points

- [Receipt / evidence]

## Link

[URL]
""",
    "changelog.md": """# Changelog

## Shipped

- [Feature]

## Changed

- [Change]

## Proof / Receipts

- [Evidence]

## Known Limits

- [Limit]

## Next

- [Next step]
""",
}


def write_once(path: Path, content: str) -> bool:
    if path.exists():
        return False
    path.write_text(content, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Create launch/ packet skeleton.")
    parser.add_argument("--root", default=".", help="Repo root or output root. Default: current directory.")
    parser.add_argument("--dir", default="launch", help="Launch packet directory name. Default: launch.")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    launch = root / args.dir
    launch.mkdir(parents=True, exist_ok=True)

    created: list[str] = []
    for subdir in ("screenshots", "gifs"):
        directory = launch / subdir
        directory.mkdir(parents=True, exist_ok=True)
        if write_once(directory / ".gitkeep", ""):
            created.append(str(directory / ".gitkeep"))

    for filename, content in MARKDOWN_DEFAULTS.items():
        path = launch / filename
        if write_once(path, content):
            created.append(str(path))

    print(f"Launch packet: {launch}")
    if created:
        print("Created:")
        for item in created:
            print(f"- {item}")
    else:
        print("No files created; existing packet left untouched.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
