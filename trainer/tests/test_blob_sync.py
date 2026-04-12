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
                SimpleNamespace(pathname="pt-test/workspaces/athlete/plan.json"),
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


def test_publish_workspace_to_blob_uploads_workspace_files(tmp_path, monkeypatch) -> None:
    workspace = tmp_path / "athlete"
    workspace.mkdir()
    (workspace / "profile.md").write_text("# Profile", encoding="utf-8")
    (workspace / "profile.json").write_text("{}", encoding="utf-8")
    (workspace / "plan.md").write_text("# Plan", encoding="utf-8")
    (workspace / "plan.json").write_text("{}", encoding="utf-8")
    (workspace / "coach_notes.md").write_text("# Notes", encoding="utf-8")
    client = FakeBlobClient()
    monkeypatch.setattr("personal_trainer.blob_sync._build_blob_client", lambda: client)

    result = publish_workspace_to_blob(
        workspace,
        prefix="pt-test",
        access="private",
    )

    assert result.workspace == "athlete"
    assert result.prefix == "pt-test"
    assert result.workspace_files_uploaded == 5
    assert result.remote_files_deleted == 2
    assert client.deleted == [
        "pt-test/workspaces/athlete/plan.md",
        "pt-test/workspaces/athlete/plan.json",
    ]
    uploaded_paths = [remote_path for _, remote_path, *_ in client.uploads]
    assert "pt-test/workspaces/athlete/plan.md" in uploaded_paths
    assert "pt-test/workspaces/athlete/plan.json" in uploaded_paths
    assert "pt-test/workspaces/athlete/profile.json" in uploaded_paths


def test_publish_workspace_to_blob_uploads_minimum_workspace_files(
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
    )

    assert result.workspace_files_uploaded == 1
    assert result.remote_files_deleted == 2
