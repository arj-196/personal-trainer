from __future__ import annotations

from personal_trainer.pdf_io import write_plan_pdf


def test_write_plan_pdf_generates_pdf_with_embedded_remote_images(
    tmp_path, monkeypatch
) -> None:
    destination = tmp_path / "plan.pdf"
    png_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDAT\x08\x99c\xf8\xcf"
        b"\xc0\x00\x00\x03\x01\x01\x00\xc9\xfe\x92\xef\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    class StubResponse:
        def __enter__(self):
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def read(self) -> bytes:
            return png_bytes

    monkeypatch.setattr(
        "personal_trainer.pdf_io.urllib.request.urlopen",
        lambda request, timeout=30: StubResponse(),
    )

    write_plan_pdf(
        """# Jordan's Training Plan

- Generated on: 2026-04-01

## Day 1: Upper Body
- **Dumbbell Bench Press**: 3 sets x 8 reps. Leave 2 reps in reserve.
<img src="https://wger.de/media/exercise-images/1879/dumbbell-bench-press.webp" alt="Dumbbell Bench Press" />
Reference: [Dumbbell Bench Press](exercise_library/dumbbell-bench-press.md)
""",
        destination,
    )

    pdf_bytes = destination.read_bytes()

    assert pdf_bytes.startswith(b"%PDF-1.")
    assert b"/Subtype /Image" in pdf_bytes
    assert b"Jordan's Training Plan" in pdf_bytes
    assert b"Reference:" in pdf_bytes
    assert b"Dumbbell Bench Press" in pdf_bytes
