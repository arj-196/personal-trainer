from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from personal_trainer.blob_sync import publish_workspace_to_blob


class FakeBlobClient:
    def __init__(self) -> None:
        self.deleted: list[str] = []
        self.uploads: list[tuple[Path, str, str, str, int]] = []

    def __enter__(self) -> "FakeBlobClient":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def iter_objects(self, *, prefix: str):
        fixtures = {
            "pt-test/workspaces/athlete/": [
                SimpleNamespace(pathname="pt-test/workspaces/athlete/plan.md"),
                SimpleNamespace(pathname="pt-test/workspaces/athlete/exercise_library/index.md"),
            ],
            "pt-test/exercise-library/": [
                SimpleNamespace(pathname="pt-test/exercise-library/catalog.json"),
            ],
        }
        return iter(fixtures.get(prefix, []))

    def delete(self, paths: list[str]) -> None:
        self.deleted.extend(paths)

    def upload_file(
        self,
        local_path: Path,
        remote_path: str,
        *,
        access: str,
        content_type: str,
        overwrite: bool,
        add_random_suffix: bool,
        cache_control_max_age: int,
    ) -> None:
        assert overwrite is True
        assert add_random_suffix is False
        self.uploads.append(
            (local_path, remote_path, access, content_type, cache_control_max_age)
        )


def test_publish_workspace_to_blob_uploads_workspace_and_library(
    tmp_path, monkeypatch
) -> None:
    workspace = tmp_path / "athlete"
    workspace.mkdir()
    (workspace / "profile.md").write_text("# Profile", encoding="utf-8")
    (workspace / "profile.json").write_text("{}", encoding="utf-8")
    (workspace / "plan.md").write_text("# Plan", encoding="utf-8")
    (workspace / "plan.pdf").write_bytes(b"%PDF-1.4\n")
    (workspace / "plan.json").write_text("{}", encoding="utf-8")
    (workspace / "coach_notes.md").write_text("# Notes", encoding="utf-8")
    (workspace / "exercise_library").mkdir(parents=True)
    (workspace / "exercise_library" / "goblet-squat.md").write_text(
        "# Goblet Squat", encoding="utf-8"
    )

    library_root = tmp_path / "library"
    library_root.mkdir(parents=True)
    (library_root / "catalog.json").write_text("[]", encoding="utf-8")

    client = FakeBlobClient()
    monkeypatch.setattr("personal_trainer.blob_sync._build_blob_client", lambda: client)
    monkeypatch.setattr("personal_trainer.blob_sync.LIBRARY_ASSETS_ROOT", library_root)

    result = publish_workspace_to_blob(
        workspace,
        prefix="pt-test",
        access="private",
        include_library=True,
    )

    assert result.workspace == "athlete"
    assert result.prefix == "pt-test"
    assert result.workspace_files_uploaded == 7
    assert result.library_files_uploaded == 1
    assert result.remote_files_deleted == 3
    assert client.deleted == [
        "pt-test/workspaces/athlete/plan.md",
        "pt-test/workspaces/athlete/exercise_library/index.md",
        "pt-test/exercise-library/catalog.json",
    ]
    uploaded_paths = [remote_path for _, remote_path, *_ in client.uploads]
    assert "pt-test/workspaces/athlete/plan.md" in uploaded_paths
    assert "pt-test/workspaces/athlete/plan.pdf" in uploaded_paths
    assert "pt-test/workspaces/athlete/plan.json" in uploaded_paths
    assert "pt-test/workspaces/athlete/profile.json" in uploaded_paths
    assert "pt-test/workspaces/athlete/exercise_library/goblet-squat.md" in uploaded_paths
    assert "pt-test/exercise-library/catalog.json" in uploaded_paths


def test_publish_workspace_to_blob_can_skip_shared_library(
    tmp_path, monkeypatch
) -> None:
    workspace = tmp_path / "athlete"
    workspace.mkdir()
    (workspace / "profile.md").write_text("# Profile", encoding="utf-8")

    client = FakeBlobClient()
    monkeypatch.setattr("personal_trainer.blob_sync._build_blob_client", lambda: client)

    result = publish_workspace_to_blob(
        workspace,
        prefix="pt-test",
        access="public",
        include_library=False,
    )

    assert result.workspace_files_uploaded == 1
    assert result.library_files_uploaded == 0
    assert result.remote_files_deleted == 2
    assert all("exercise-library/" not in path for path in client.deleted)
