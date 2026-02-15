#!/usr/bin/env python3
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path


PAGE_WIDTH = 612  # Letter, points
PAGE_HEIGHT = 792

MARGIN_LEFT = 54
MARGIN_RIGHT = 54
MARGIN_TOP = 54
MARGIN_BOTTOM = 54


def pdf_escape(text: str) -> str:
    # PDF literal strings use parentheses; escape those plus backslashes.
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def ascii_sanitize(text: str) -> str:
    # Keep output stable across PDFDocEncoding; replace non-ASCII defensively.
    return text.encode("ascii", errors="replace").decode("ascii")


def wrap_words(text: str, max_chars: int) -> list[str]:
    if max_chars <= 0:
        return [text]
    words = text.split(" ")
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
    if current:
        lines.append(current)
    return lines


def approx_max_chars(font_size: int, available_width_pts: int) -> int:
    # Helvetica average glyph width is ~0.52em; keep conservative to avoid overflow.
    avg_char_width = font_size * 0.52
    if avg_char_width <= 0:
        return 80
    return max(20, int(available_width_pts / avg_char_width))


@dataclass(frozen=True)
class TextLine:
    text: str
    font: str  # F1 (regular) or F2 (bold)
    size: int
    x: int
    y: int
    gray: float | None = None  # 0=black, 1=white


class OnePageLayout:
    def __init__(self) -> None:
        self._y = PAGE_HEIGHT - MARGIN_TOP
        self.lines: list[TextLine] = []
        self.draw_ops: list[str] = []

    @property
    def y(self) -> int:
        return self._y

    def _ensure_space(self, needed_pts: int) -> None:
        if self._y - needed_pts < MARGIN_BOTTOM:
            raise RuntimeError(
                "Layout overflow: content does not fit on one page. "
                "Reduce content or font sizes."
            )

    def spacer(self, pts: int) -> None:
        self._ensure_space(pts)
        self._y -= pts

    def rule(self, x1: int, x2: int, y: int, gray: float = 0.8, width: float = 1.0) -> None:
        # Draw a horizontal divider line.
        g = max(0.0, min(1.0, gray))
        self.draw_ops.append(f"{g:.2f} G")  # stroke gray
        self.draw_ops.append(f"{width:.2f} w")
        self.draw_ops.append(f"{x1} {y} m {x2} {y} l S")

    def add_line(
        self,
        text: str,
        *,
        font: str = "F1",
        size: int = 10,
        indent: int = 0,
        gray: float | None = None,
        leading: int | None = None,
        extra_after: int = 0,
    ) -> None:
        leading_pts = leading if leading is not None else int(round(size * 1.25))
        self._ensure_space(leading_pts + extra_after)
        x = MARGIN_LEFT + indent
        self.lines.append(
            TextLine(
                text=ascii_sanitize(text),
                font=font,
                size=size,
                x=x,
                y=self._y,
                gray=gray,
            )
        )
        self._y -= leading_pts
        if extra_after:
            self._y -= extra_after

    def add_wrapped(
        self,
        text: str,
        *,
        font: str = "F1",
        size: int = 9,
        indent: int = 0,
        gray: float | None = None,
        extra_after: int = 0,
    ) -> None:
        available_width = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT - indent
        max_chars = approx_max_chars(size, available_width)
        for i, line in enumerate(wrap_words(text, max_chars)):
            self.add_line(
                line,
                font=font,
                size=size,
                indent=indent,
                gray=gray,
                extra_after=(extra_after if i == 0 else 0),
            )

    def add_bullet(self, text: str, *, size: int = 9, indent: int = 0) -> None:
        bullet_prefix = "- "
        available_width_first = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT - indent
        max_first = approx_max_chars(size, available_width_first)
        first_wrapped = wrap_words(f"{bullet_prefix}{text}", max_first)
        if not first_wrapped:
            return
        # First line includes "- ".
        self.add_line(first_wrapped[0], size=size, indent=indent)
        # Subsequent lines get a hanging indent.
        hanging_indent = indent + 12
        available_width_next = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT - hanging_indent
        max_next = approx_max_chars(size, available_width_next)
        remainder = " ".join(first_wrapped[1:]).strip()
        if remainder:
            for line in wrap_words(remainder, max_next):
                self.add_line(line, size=size, indent=hanging_indent)


def build_content_stream(lines: list[TextLine], draw_ops: list[str]) -> bytes:
    ops: list[str] = []
    # Explicit white page background to avoid transparent renders (e.g., some PNG converters).
    ops.append("1 g")
    ops.append(f"0 0 {PAGE_WIDTH} {PAGE_HEIGHT} re f")
    ops.extend(draw_ops)
    ops.append("0 g")  # fill black default

    for line in lines:
        text = pdf_escape(line.text)
        ops.append("BT")
        if line.gray is not None:
            g = max(0.0, min(1.0, line.gray))
            ops.append(f"{g:.2f} g")
        else:
            ops.append("0 g")
        ops.append(f"/{line.font} {line.size} Tf")
        ops.append(f"1 0 0 1 {line.x} {line.y} Tm")
        ops.append(f"({text}) Tj")
        ops.append("ET")

    # Ensure newline at end of stream.
    return ("\n".join(ops) + "\n").encode("ascii")


def build_pdf(content_stream: bytes) -> bytes:
    # Minimal PDF with one page and standard Type1 fonts (Helvetica).
    objs: list[bytes] = []

    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")  # 1
    objs.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")  # 2
    objs.append(
        (
            b"<< /Type /Page /Parent 2 0 R "
            b"/MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> "
            b"/Contents 4 0 R >>"
        )
    )  # 3
    objs.append(
        b"<< /Length "
        + str(len(content_stream)).encode("ascii")
        + b" >>\nstream\n"
        + content_stream
        + b"endstream"
    )  # 4
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")  # 5
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")  # 6

    out = bytearray()
    out.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

    offsets: list[int] = [0]
    for obj_id, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out.extend(f"{obj_id} 0 obj\n".encode("ascii"))
        out.extend(body)
        if not body.endswith(b"\n"):
            out.extend(b"\n")
        out.extend(b"endobj\n")

    xref_start = len(out)
    out.extend(f"xref\n0 {len(objs) + 1}\n".encode("ascii"))
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode("ascii"))
    out.extend(b"trailer\n")
    out.extend(f"<< /Size {len(objs) + 1} /Root 1 0 R >>\n".encode("ascii"))
    out.extend(b"startxref\n")
    out.extend(f"{xref_start}\n".encode("ascii"))
    out.extend(b"%%EOF\n")
    return bytes(out)


def build_summary_layout() -> OnePageLayout:
    l = OnePageLayout()

    # Title
    l.add_line("AgentCache.ai - App Summary", font="F2", size=18, leading=24)
    l.add_line("Repo: agentcache-ai   Generated: 2026-02-05", size=9, gray=0.35, leading=12, extra_after=6)
    l.rule(MARGIN_LEFT, PAGE_WIDTH - MARGIN_RIGHT, l.y + 2, gray=0.85, width=1.0)
    l.spacer(10)

    # What it is
    l.add_line("WHAT IT IS", font="F2", size=11, leading=14)
    l.add_wrapped(
        "AgentCache is a Node/TypeScript platform that provides caching and long-term memory primitives for AI agents.",
        size=9,
    )
    l.add_wrapped(
        "This repo includes a web Studio UI, API endpoints, and an MCP (Model Context Protocol) server to expose tools to external agents.",
        size=9,
        extra_after=6,
    )

    # Who it's for
    l.add_line("WHO IT'S FOR", font="F2", size=11, leading=14)
    l.add_wrapped(
        "AI-agent developers and platform engineers building agent workflows that need shared cache/memory plus an operator-friendly UI.",
        size=9,
        extra_after=6,
    )

    # What it does
    l.add_line("WHAT IT DOES", font="F2", size=11, leading=14)
    l.add_bullet("Runs an MCP server (stdio) with tools like agentcache_get/set/check/stats and intent + memory utilities.", size=9)
    l.add_bullet("Provides multi-layer LLM response caching: L1 in-memory + L2 Upstash Redis (REST), with namespaces and TTL.", size=9)
    l.add_bullet("Caches tool results via dedicated endpoints for repeatable tool calls (tool-cache).", size=9)
    l.add_bullet("Exposes Brain Memory REST endpoints (store/recall/graph) via an AutoMem client.", size=9)
    l.add_bullet("Includes a Pipeline Studio (Vite + ReactFlow) with sector wizard templates that generate pipeline graphs.", size=9)
    l.add_bullet("Ships optional services: ffmpeg thumbnail microservice and a .NET/FAISS VectorService microservice.", size=9)
    l.spacer(6)

    # How it works
    l.add_line("HOW IT WORKS (REPO-BASED)", font="F2", size=11, leading=14)
    l.add_bullet("Web UI: Vite+React (port 3000) in src/; proxies /api to localhost:3001 in dev (vite.config.js).", size=9)
    l.add_bullet("Dev API: Hono server (src/server.ts -> src/index.ts) mounts /api routers; uses Redis and optional Neon Postgres (DATABASE_URL).", size=9)
    l.add_bullet("Prod/Docker: Express server.js serves public/ and wraps Vercel-style handlers in api/ (Dockerfile).", size=9)
    l.add_bullet("Cache layer: api/cache.js (L1 Map + Upstash Redis) and api/tool-cache.js; stats stored in Redis keys.", size=9)
    l.add_bullet("MCP: src/mcp/server.ts registers tools; api/mcp-bridge.js can spawn it per request.", size=9)
    l.add_bullet("Supporting services: docker-compose.yml includes Redis + services/thumbnail; optional services/VectorService for FAISS search.", size=9)
    l.add_wrapped(
        "Typical flow: UI or MCP client -> /api -> cache/DB/services -> JSON (or SSE for cached streaming responses).",
        size=9,
        indent=12,
        extra_after=6,
    )

    # How to run
    l.add_line("HOW TO RUN (MINIMAL)", font="F2", size=11, leading=14)
    l.add_bullet("Install: npm install", size=9)
    l.add_bullet("Start API (dev): npx tsx src/server.ts   (http://localhost:3001)", size=9)
    l.add_bullet("Start Studio: npm run dev   (http://localhost:3000, proxies /api -> :3001)", size=9)
    l.add_bullet("Optional MCP: npm run mcp:dev   (stdio MCP server)", size=9)
    l.add_bullet("Alt (Docker): docker compose up --build   (app + redis + thumbnail)", size=9)

    return l


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a one-page app summary PDF for this repo.")
    parser.add_argument(
        "--out",
        default="output/pdf/agentcache-ai_app-summary.pdf",
        help="Output PDF path (default: output/pdf/agentcache-ai_app-summary.pdf)",
    )
    args = parser.parse_args()

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    layout = build_summary_layout()
    stream = build_content_stream(layout.lines, layout.draw_ops)
    pdf_bytes = build_pdf(stream)
    out_path.write_bytes(pdf_bytes)
    print(str(out_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
