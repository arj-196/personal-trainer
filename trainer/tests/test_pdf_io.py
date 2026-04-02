from __future__ import annotations

from PIL import Image

from personal_trainer.pdf_io import write_plan_pdf


def test_write_plan_pdf_generates_pdf_with_embedded_images(tmp_path) -> None:
    destination = tmp_path / "plan.pdf"
    image_dir = tmp_path / "exercise_library" / "images"
    image_dir.mkdir(parents=True)
    Image.new("RGB", (8, 8), color="red").save(
        image_dir / "dumbbell-bench-press.png", format="PNG"
    )

    write_plan_pdf(
        """# Jordan's Training Plan

- Generated on: 2026-04-01

## Day 1: Upper Body
- **Dumbbell Bench Press**: 3 sets x 8 reps. Leave 2 reps in reserve.
<img src="exercise_library/images/dumbbell-bench-press.png" alt="Dumbbell Bench Press" />
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
