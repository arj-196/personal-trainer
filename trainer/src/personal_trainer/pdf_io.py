from __future__ import annotations

import logging
import re
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer

LOGGER = logging.getLogger(__name__)

_IMAGE_TAG_PATTERN = re.compile(
    r'<img\b[^>]*src="(?P<src>[^"]+)"[^>]*alt="(?P<alt>[^"]*)"[^>]*>',
    re.IGNORECASE,
)
_MARKDOWN_LINK_PATTERN = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_BOLD_PATTERN = re.compile(r"\*\*([^*]+)\*\*")
_ITALIC_PATTERN = re.compile(r"\*([^*]+)\*")

_PAGE_MARGIN = 54
_IMAGE_MAX_WIDTH = 240
_IMAGE_SPACING = 8
_PARAGRAPH_SPACING = 8


def write_plan_pdf(markdown_text: str, destination: Path) -> None:
    LOGGER.info("Writing PDF plan to %s", destination)
    destination.parent.mkdir(parents=True, exist_ok=True)

    document = SimpleDocTemplate(
        str(destination),
        pagesize=letter,
        leftMargin=_PAGE_MARGIN,
        rightMargin=_PAGE_MARGIN,
        topMargin=_PAGE_MARGIN,
        bottomMargin=_PAGE_MARGIN,
        title=destination.stem,
        pageCompression=0,
    )
    story = _build_story(markdown_text, destination.parent)
    document.build(story)


def _build_story(markdown_text: str, asset_root: Path) -> list[object]:
    styles = _styles()
    story: list[object] = []
    paragraph_lines: list[str] = []

    def flush_paragraph() -> None:
        if not paragraph_lines:
            return
        text = " ".join(line.strip() for line in paragraph_lines if line.strip())
        if text:
            story.append(Paragraph(_to_reportlab_markup(text), styles["body"]))
        paragraph_lines.clear()

    for raw_line in markdown_text.splitlines():
        stripped = raw_line.strip()
        if not stripped:
            flush_paragraph()
            continue

        image_match = _IMAGE_TAG_PATTERN.search(stripped)
        if image_match is not None:
            flush_paragraph()
            story.extend(
                _build_image_flowables(
                    asset_root / image_match.group("src"),
                    image_match.group("alt"),
                    styles,
                )
            )
            continue

        if stripped.startswith("# "):
            flush_paragraph()
            story.append(Paragraph(_to_reportlab_markup(stripped[2:]), styles["h1"]))
            continue

        if stripped.startswith("## "):
            flush_paragraph()
            story.append(Paragraph(_to_reportlab_markup(stripped[3:]), styles["h2"]))
            continue

        if stripped.startswith("- "):
            flush_paragraph()
            story.append(
                Paragraph(
                    _to_reportlab_markup(stripped[2:]),
                    styles["bullet"],
                    bulletText="•",
                )
            )
            continue

        paragraph_lines.append(stripped)

    flush_paragraph()
    if not story:
        story.append(Paragraph("Training plan unavailable.", styles["body"]))
    return story


def _build_image_flowables(
    image_path: Path, alt_text: str, styles: dict[str, ParagraphStyle]
) -> list[object]:
    if not image_path.exists():
        LOGGER.warning("Skipping missing PDF image asset: %s", image_path)
        return [Paragraph(f"[Missing image: {escape(alt_text)}]", styles["caption"])]

    image_width, image_height = ImageReader(str(image_path)).getSize()
    rendered_width = min(float(image_width), float(_IMAGE_MAX_WIDTH))
    rendered_height = rendered_width * (float(image_height) / float(image_width))

    flowable = Image(
        str(image_path),
        width=rendered_width,
        height=rendered_height,
        hAlign="LEFT",
    )
    return [flowable, Spacer(1, _IMAGE_SPACING)]


def _styles() -> dict[str, ParagraphStyle]:
    stylesheet = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle(
            "PlanHeading1",
            parent=stylesheet["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=HexColor("#111827"),
            spaceAfter=14,
        ),
        "h2": ParagraphStyle(
            "PlanHeading2",
            parent=stylesheet["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=HexColor("#111827"),
            spaceBefore=10,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "PlanBody",
            parent=stylesheet["BodyText"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            textColor=HexColor("#111827"),
            spaceAfter=_PARAGRAPH_SPACING,
        ),
        "bullet": ParagraphStyle(
            "PlanBullet",
            parent=stylesheet["BodyText"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            textColor=HexColor("#111827"),
            leftIndent=14,
            firstLineIndent=0,
            bulletIndent=0,
            spaceAfter=4,
        ),
        "caption": ParagraphStyle(
            "PlanCaption",
            parent=stylesheet["Italic"],
            fontName="Helvetica-Oblique",
            fontSize=10,
            leading=12,
            textColor=HexColor("#6B7280"),
            spaceAfter=_PARAGRAPH_SPACING,
        ),
    }


def _to_reportlab_markup(text: str) -> str:
    markup = escape(text)
    markup = _MARKDOWN_LINK_PATTERN.sub(
        lambda match: (
            f'<link href="{escape(match.group(2))}" color="blue">'
            f"{escape(match.group(1))}</link>"
        ),
        markup,
    )
    markup = _BOLD_PATTERN.sub(r"<b>\1</b>", markup)
    markup = _ITALIC_PATTERN.sub(r"<i>\1</i>", markup)
    return markup
