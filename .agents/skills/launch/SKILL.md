---
name: launch
description: Build a complete launch packet for a product, feature, or release. Use when the user invokes /launch, asks for a launch engine, wants every feature to ship with marketing, or requests trailers, vertical video, thumbnails, X threads, tweets, press copy, screenshots, GIFs, or changelog assets for a release.
---

# /launch

`/launch` turns a feature or release into a complete marketing packet.

Every feature ships with marketing.

## Output Contract

Always produce or update this structure:

```text
launch/
├── trailer-30.mp4
├── trailer-60.mp4
├── vertical.mp4
├── thumbnail.png
├── x-thread.md
├── tweets.md
├── press.md
├── screenshots/
├── gifs/
└── changelog.md
```

Use `scripts/scaffold_launch_packet.py` at the start of the run to create the packet skeleton without overwriting existing work:

```bash
python .agents/skills/launch/scripts/scaffold_launch_packet.py --root .
```

Then pull live Radar state:

```bash
python .agents/skills/launch/scripts/fetch_radar_live_data.py --output-dir launch
```

## Required Context

1. Read `VIDEO_STYLE.md` if present.
2. Read `AGENTS.md` if present.
3. Inspect the repo to understand the shipped feature, using source files, README, routes, components, and tests.
4. If the launch is for a web product, inspect the live/local UI or source-backed UI surfaces before designing video scenes.
5. Pull live launch metrics from public `GET /v1/*` endpoints before writing video copy or data overlays.

## Launch Standard

Never feel like SaaS.

Always feel like discovering classified intelligence.

Prefer:

- Cinematic typography
- Terminal animations
- Dark interfaces
- Signal extraction
- Graph visualizations
- Receipt evidence
- Minimal text

Avoid:

- Long feature lists
- Generic UI pans
- Corporate transitions
- Cheesy music

Goal: make viewers feel like they discovered secret infrastructure.

## Live Data

Every Radar launch video should reflect the current state of Radar, not hand-edited numbers.

Use `scripts/fetch_radar_live_data.py` to write:

- `launch/live-data.json`
- `launch/live-data.md`

Default source:

```text
https://radar.infopunks.fun
```

The script pulls only public `GET /v1/*` endpoints and summarizes:

- Routes Observed
- Claims
- Receipts
- Signals
- Latest Narrative
- Graph Nodes
- Provider Count
- Loop Count

Use `launch/live-data.json` as the source of truth for video overlays, thumbnail stats, X thread proof points, press copy, and changelog proof sections. Do not manually invent or stale-copy these numbers.

If a live endpoint times out, keep the partial snapshot and show only metrics that were fetched successfully. Use `--strict` only when the launch must fail on stale or partial data.

## Motion Language

Think in metaphors before screens.

Do not default to:

```text
UI
zoom
fade
feature
fade
```

Default Radar launch story:

```text
Noise
Thousands of particles
One particle glows
Radar locks
Graph grows
Receipts connect
Memory expands
Terminal wakes
URL
```

Use UI only after the metaphor has created meaning. Product surfaces should feel like evidence revealed by the system, not screenshots in a slideshow.

## Workflow

1. Create `launch/` with the scaffold script.
2. Pull live Radar state into `launch/live-data.json`.
3. Determine the feature's core narrative: what changed, why it matters, what proof exists, and why someone should care now.
4. Design the motion metaphor: what transforms on screen, what locks, what grows, what connects, what wakes.
5. Write the copy assets first: `x-thread.md`, `tweets.md`, `press.md`, and `changelog.md`.
6. Capture or recreate the key visual surfaces in `launch/screenshots/`.
7. Produce short motion loops in `launch/gifs/` when the feature has an interaction, graph, terminal sequence, or state transition worth looping.
8. Produce:
   - `trailer-30.mp4`: tight launch trailer, one idea, minimal text.
   - `trailer-60.mp4`: fuller story, still cinematic and restrained.
   - `vertical.mp4`: 9:16 version for X/TikTok/Reels.
   - `thumbnail.png`: high-contrast still that reads at feed size.
9. Validate all generated media: file exists, duration/aspect ratio matches intent, text is readable, and no scene feels like a generic dashboard demo.

## Video Requirements

Use the `brag` and Hyperframes workflows when available for trailer generation. `/launch` owns the packet and narrative; the video workflow owns composition, rendering, and validation.

Minimum deliverable rules:

- `trailer-30.mp4`: 25-35 seconds, 16:9.
- `trailer-60.mp4`: 50-65 seconds, 16:9.
- `vertical.mp4`: 20-45 seconds, 9:16.
- `thumbnail.png`: 16:9 unless the user requests platform-specific variants.
- Every video must show actual product UI, source-backed UI reconstruction, screenshots, terminal output, graph/state visualization, or proof artifacts.
- Do not make a generic SaaS feature tour.
- Every trailer needs a remembered motion idea: particles collapsing, radar lock, graph growth, receipts connecting, memory expansion, terminal wake, or an equally strong product-specific metaphor.
- Every trailer should include at least one live Radar metric from `launch/live-data.json` when the endpoint fetch succeeded.

## Copy Requirements

Read `references/deliverables.md` when shaping the final markdown assets or checking whether each launch artifact has the right structure.

Keep copy sharp and specific.

- `x-thread.md`: launch thread with a hook, core thesis, product proof, feature beats, and final link.
- `tweets.md`: 5-10 standalone posts, each short enough to publish without editing.
- `press.md`: concise launch note with headline, one-sentence summary, what shipped, why now, proof points, and link.
- `changelog.md`: factual release notes: shipped, changed, proof/receipts, known limits, next.

## Completion Gate

Do not call the launch done until:

- The exact `launch/` tree exists.
- `launch/live-data.json` exists and records endpoint health.
- All requested media files exist or a blocker is clearly documented.
- Markdown files are written with postable copy.
- Screenshots/GIF directories contain launch assets or a note explaining why none were applicable.
- Validation commands and any render limitations are reported.
