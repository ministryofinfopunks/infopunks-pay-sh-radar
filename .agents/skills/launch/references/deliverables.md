# Launch Packet Deliverables

## Media

- `trailer-30.mp4`: Short primary trailer. Hook in first 2 seconds. One message. End with URL.
- `trailer-60.mp4`: Expanded trailer. More proof and context, not more filler.
- `vertical.mp4`: Native vertical edit, not a blind crop if important text would be cut off.
- `thumbnail.png`: A feed-readable still. Big idea, dark terminal style, minimal words.
- `screenshots/`: Product screenshots or source-backed recreations of the launch surfaces.
- `gifs/`: Small loops for interaction moments, graph transitions, terminal checks, receipt generation, or before/after states.

## Motion Spine

Use a metaphor sequence viewers can remember.

Preferred Radar sequence:

1. Noise
2. Thousands of particles
3. One particle glows
4. Radar locks
5. Graph grows
6. Receipts connect
7. Memory expands
8. Terminal wakes
9. URL

Avoid a plain UI slideshow. Screens are supporting evidence, not the story.

## Live Data Overlays

Pull live data before authoring overlays.

Required source file:

```text
launch/live-data.json
```

Use live values for:

- Routes Observed
- Claims
- Receipts
- Signals
- Latest Narrative
- Graph Nodes
- Provider Count
- Loop Count

Good overlay patterns:

- "40 routes observed" as a terminal lock confirmation.
- "Receipts connect" with receipt count drawn from live data.
- "Graph nodes" as the graph-growth payoff.
- "Latest narrative" as one short line in the terminal, not a paragraph.

Do not manually edit numbers into the video unless the live snapshot is unavailable and the limitation is documented.

## Markdown

### `x-thread.md`

Recommended structure:

1. Hook
2. What changed
3. Why it matters now
4. Product proof
5. Key surfaces
6. How to use it
7. Final URL

### `tweets.md`

Write standalone posts. Avoid dependence on thread context.

### `press.md`

Use:

- Headline
- One-sentence summary
- What shipped
- Why now
- Proof points
- Link

### `changelog.md`

Use:

- Shipped
- Changed
- Proof / receipts
- Known limits
- Next
