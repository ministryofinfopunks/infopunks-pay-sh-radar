#!/usr/bin/env python3
"""Fetch live Radar launch metrics from public GET /v1 endpoints."""

from __future__ import annotations

import argparse
import json
import socket
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_ENDPOINTS = {
    "routes": "/v1/routes",
    "claims": "/v1/claims",
    "receipts": "/v1/receipts",
    "signals": "/v1/signal-hunt",
    "narratives": "/v1/narratives",
    "graph": "/v1/graph",
    "providers": "/v1/radar/providers",
    "loops": "/v1/loops",
    "evidence_ledger": "/v1/radar/evidence-ledger",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def join_url(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def fetch_json(url: str, timeout: float) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    started = time.monotonic()
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "infopunks-launch-engine/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read()
            duration_ms = round((time.monotonic() - started) * 1000)
            return json.loads(body.decode("utf-8")), {
                "ok": True,
                "status": response.status,
                "duration_ms": duration_ms,
                "bytes": len(body),
            }
    except (urllib.error.URLError, TimeoutError, socket.timeout, json.JSONDecodeError) as exc:
        duration_ms = round((time.monotonic() - started) * 1000)
        return None, {
            "ok": False,
            "status": getattr(getattr(exc, "fp", None), "status", None),
            "duration_ms": duration_ms,
            "error": str(exc),
        }


def unwrap(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]
    return payload


def find_list(value: Any, keys: tuple[str, ...]) -> list[Any]:
    value = unwrap(value)
    if isinstance(value, list):
        return value
    if not isinstance(value, dict):
        return []
    for key in keys:
        candidate = value.get(key)
        if isinstance(candidate, list):
            return candidate
    return []


def maybe_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return None


def count_payload(value: Any, keys: tuple[str, ...]) -> int:
    value = unwrap(value)
    if isinstance(value, list):
        return len(value)
    if isinstance(value, dict):
        for key in ("count", "total", "node_count", "loop_count", "receipt_count", "claim_count", "provider_count"):
            found = maybe_int(value.get(key))
            if found is not None:
                return found
        found_list = find_list(value, keys)
        if found_list:
            return len(found_list)
    return 0


def get_path(value: Any, *path: str) -> Any:
    current = unwrap(value)
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def pick_text(item: Any, fields: tuple[str, ...]) -> str | None:
    if not isinstance(item, dict):
        return None
    for field in fields:
        value = item.get(field)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def sort_key(item: Any) -> str:
    if not isinstance(item, dict):
        return ""
    for field in ("updated_at", "observed_at", "created_at", "submitted_at", "generated_at", "lastSeenAt", "last_seen_at"):
        value = item.get(field)
        if isinstance(value, str):
            return value
    return ""


def top_items(items: list[Any], fields: tuple[str, ...], limit: int = 5) -> list[dict[str, Any]]:
    sorted_items = sorted(items, key=sort_key, reverse=True)
    output: list[dict[str, Any]] = []
    for item in sorted_items[:limit]:
        if not isinstance(item, dict):
            continue
        label = pick_text(item, fields) or "unknown"
        summary = pick_text(item, ("summary", "thesis", "copy", "description", "why_it_matters", "claim_text", "pre_spend_recommendation"))
        output.append({
            "label": label,
            "summary": summary,
            "updated_at": sort_key(item) or None,
        })
    return output


def build_snapshot(base_url: str, raw: dict[str, Any], endpoint_meta: dict[str, Any]) -> dict[str, Any]:
    routes = find_list(raw.get("routes"), ("routes", "data"))
    claims = find_list(raw.get("claims"), ("claims", "data"))
    receipts = find_list(raw.get("receipts"), ("receipts", "data"))
    signals = find_list(raw.get("signals"), ("candidates", "signals", "data"))
    narratives = find_list(raw.get("narratives"), ("narratives", "data"))
    providers = find_list(raw.get("providers"), ("providers", "data"))
    loops = find_list(raw.get("loops"), ("loops", "data"))
    graph_nodes = find_list(raw.get("graph"), ("nodes", "data"))

    graph_stats = get_path(raw.get("graph"), "stats") or {}
    ledger_state = get_path(raw.get("evidence_ledger"), "ledger_state") or {}

    routes_observed = maybe_int(ledger_state.get("total_recorded_runs")) or len(routes)
    graph_node_count = maybe_int(graph_stats.get("node_count")) or len(graph_nodes)
    provider_count = count_payload(raw.get("providers"), ("providers",))
    latest_narrative_item = sorted(narratives, key=sort_key, reverse=True)[0] if narratives else None

    metrics = {
        "routes_observed": routes_observed,
        "claims": len(claims),
        "receipts": len(receipts),
        "signals": len(signals),
        "latest_narrative": pick_text(latest_narrative_item, ("title", "name", "label")) if latest_narrative_item else None,
        "graph_nodes": graph_node_count,
        "provider_count": provider_count,
        "loop_count": len(loops),
        "recorded_benchmarks": maybe_int(ledger_state.get("recorded_benchmarks")),
        "proven_routes": maybe_int(ledger_state.get("proven_routes")),
        "winner_claimed": ledger_state.get("winner_claimed") if isinstance(ledger_state, dict) else None,
    }

    return {
        "generated_at": utc_now(),
        "base_url": base_url.rstrip("/"),
        "source": "GET /v1/*",
        "metrics": metrics,
        "highlights": {
            "routes": top_items(routes, ("route_id", "id", "recommended_use_case", "endpoint")),
            "claims": top_items(claims, ("claim_id", "id", "claim_text", "title")),
            "receipts": top_items(receipts, ("receipt_id", "event_id", "id", "task_type")),
            "signals": top_items(signals, ("title", "id", "category")),
            "narratives": top_items(narratives, ("title", "name", "id")),
            "graph_nodes": top_items(graph_nodes, ("label", "id", "type")),
            "loops": top_items(loops, ("name", "loop_id", "id")),
        },
        "ledger_state": ledger_state,
        "endpoints": endpoint_meta,
    }


def write_markdown(path: Path, snapshot: dict[str, Any]) -> None:
    metrics = snapshot["metrics"]
    lines = [
        "# Radar Live Launch Data",
        "",
        f"Generated: `{snapshot['generated_at']}`",
        f"Source: `{snapshot['base_url']}`",
        "",
        "## Metrics",
        "",
    ]
    for key, value in metrics.items():
        label = key.replace("_", " ").title()
        lines.append(f"- {label}: {value if value is not None else 'n/a'}")
    lines.extend(["", "## Endpoint Health", ""])
    for name, meta in snapshot["endpoints"].items():
        status = "ok" if meta.get("ok") else "error"
        detail = meta.get("path") or ""
        if not meta.get("ok"):
            detail = f"{detail} - {meta.get('error')}"
        lines.append(f"- {name}: {status} ({meta.get('duration_ms')} ms) {detail}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch live Radar state for launch videos.")
    parser.add_argument("--base-url", default="https://radar.infopunks.fun", help="Radar API base URL.")
    parser.add_argument("--output-dir", default="launch", help="Directory for live-data outputs.")
    parser.add_argument("--timeout", type=float, default=20.0, help="Per-endpoint timeout in seconds.")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero if any endpoint fails.")
    args = parser.parse_args()

    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    raw: dict[str, Any] = {}
    endpoint_meta: dict[str, Any] = {}
    for name, path in DEFAULT_ENDPOINTS.items():
        url = join_url(args.base_url, path)
        payload, meta = fetch_json(url, args.timeout)
        meta["path"] = path
        endpoint_meta[name] = meta
        raw[name] = payload

    snapshot = build_snapshot(args.base_url, raw, endpoint_meta)
    (output_dir / "live-data.json").write_text(json.dumps(snapshot, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    write_markdown(output_dir / "live-data.md", snapshot)

    failed = [name for name, meta in endpoint_meta.items() if not meta.get("ok")]
    print(f"Wrote {output_dir / 'live-data.json'}")
    print(f"Wrote {output_dir / 'live-data.md'}")
    if failed:
        print(f"Endpoint failures: {', '.join(failed)}", file=sys.stderr)
        return 1 if args.strict else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
