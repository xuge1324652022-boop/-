"""验证公开模板归档边界；可逐文件核对新版纯模板交付目录。"""
import argparse
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
from contextlib import contextmanager
import shutil
import stat
import subprocess
import uuid
import zipfile

SPEC = importlib.util.spec_from_file_location("release", Path(__file__).with_name("build-release.py"))
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)
PREFIX = "job-application-template/"
BINARY_SUFFIXES = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".ico", ".mp4", ".webm", ".mp3", ".ogg", ".woff", ".woff2", ".ttf", ".zip", ".tgz", ".bin"}


@contextmanager
def temporary_workspace():
    base = release.ROOT / "tmp"
    base.mkdir(exist_ok=True)
    target = base / f"release-regression-{uuid.uuid4().hex}"
    target.mkdir()
    try:
        yield target
    finally:
        assert target.resolve().parent == base.resolve() and target.name.startswith("release-regression-")
        assert not target.is_symlink() and not target.is_junction()

        def remove_readonly(function, name, error):
            if not isinstance(error, PermissionError):
                raise error
            os.chmod(name, stat.S_IWRITE)
            function(name)

        shutil.rmtree(target, onexc=remove_readonly)


def check_functions():
    with temporary_workspace() as root:
        source = root / "source"
        source.mkdir()
        (source / "app.ts").write_text("export const title = 'Fictional template'", encoding="utf-8")
        for directory in ("本机私有资料", "outputs", "作品", "参考资料"):
            (source / directory).mkdir()
            (source / directory / "fixture.txt").write_text("Never publish this fixture", encoding="utf-8")
        subprocess.run(["git", "init", "--quiet"], cwd=source, check=True, capture_output=True)
        subprocess.run(["git", "add", "app.ts"], cwd=source, check=True, capture_output=True)
        previous_root = release.ROOT
        release.ROOT = source
        try:
            paths = release.public_git_files()
            assert paths == ["app.ts"]
            target = root / "public.zip"
            report = release.write_zip(source, target, source_paths=paths)
            assert report["files"] == 1
            with zipfile.ZipFile(target) as archive:
                assert archive.namelist() == [PREFIX + "app.ts"]
                assert archive.testzip() is None
            try:
                release.write_zip(source, target, source_paths=paths)
                raise AssertionError("不能覆盖已有归档")
            except FileExistsError:
                pass
            try:
                release.checked_file(source, "../public.zip")
                raise AssertionError("不能读取根外路径")
            except RuntimeError:
                pass
            # 新交付格式的实际 ZIP 和审核清单；不是旧的原片选择模型。
            video = b"generated silent geometric fixture"
            resume = b"fictional blank template fixture"
            public = source / "public"
            (public / "color").mkdir(parents=True)
            (public / "color/sample.mp4").write_bytes(video)
            (public / "resume.pdf").write_bytes(resume)
            approvals = [{"path": "public/color/sample.mp4", "sha256": hashlib.sha256(video).hexdigest()},
                         {"path": "public/resume.pdf", "sha256": hashlib.sha256(resume).hexdigest()}]
            (public / "模板素材清单.json").write_text(json.dumps({"files": approvals}), encoding="utf-8")
            (source / "发布配置").mkdir()
            (source / "发布配置/公开第三方素材.json").write_text(json.dumps({"files": []}), encoding="utf-8")
            (source / "deploy").mkdir()
            media = {"/color/sample.mp4": {"hash": hashlib.sha256(base64.b64encode(video) + b"mp4").hexdigest()[:32], "size": len(video)}}
            (source / "deploy/media-manifest.json").write_text(json.dumps(media), encoding="utf-8")
            subprocess.run(["git", "add", "public", "发布配置", "deploy"], cwd=source, check=True, capture_output=True)
            delivery = root / "delivery"
            package = delivery / "服务器部署包"
            site = package / "site"
            (site / "color").mkdir(parents=True)
            (site / "color/sample.mp4").write_bytes(video)
            (site / "resume.pdf").write_bytes(resume)
            (site / "index.html").write_text("<title>Fictional template</title>", encoding="utf-8")
            files = [{"path": file.relative_to(site).as_posix(), "bytes": file.stat().st_size, "sha256": release.digest(file)}
                     for file in release.files_under(site)]
            (package / "文件清单.json").write_text(json.dumps({"files": files}), encoding="utf-8")
            deployment = release.write_zip(package, delivery / "site.zip")
            source_archive = release.write_zip(source, delivery / "source.zip", source_paths=release.public_git_files())
            (delivery / "交付清单.json").write_text(json.dumps({"deployment": deployment, "sourceArchive": source_archive,
                "privateFilesIncluded": False, "gitHistoryIncluded": False, "siteFiles": len(files)}), encoding="utf-8")
            verify_delivery(delivery)
            (site / "color/sample.mp4").write_bytes(b"unreviewed fixture")
            try:
                verify_delivery(delivery)
                raise RuntimeError("未审核的替换视频不能通过交付检查")
            except AssertionError:
                pass
            subprocess.run(["git", "add", "outputs/fixture.txt"], cwd=source, check=True, capture_output=True)
            try:
                release.public_git_files()
                raise AssertionError("不能归档被意外跟踪的私人目录")
            except RuntimeError:
                pass
        finally:
            release.ROOT = previous_root
    config = (release.ROOT / "deploy/nginx.conf").read_text(encoding="utf-8")
    assert "location = /color {" in config and "location = /color/ {" in config
    assert "location ^~ /color/ {" in config and "try_files $uri =404;" in config
    print("PASS: Git显式源码、私人目录隔离、相对ZIP/CRC/防覆盖、路径越界拒绝、/color路由规则")


def checked_archive(folder: Path, item: dict, *, source=False) -> Path:
    filename = item["file"]
    assert filename == Path(filename).name and "/" not in filename and "\\" not in filename
    file = release.checked_file(folder, filename)
    assert file.stat().st_size == item["bytes"] and release.digest(file) == item["sha256"]
    with zipfile.ZipFile(file) as archive:
        assert archive.testzip() is None and len(archive.infolist()) == item["files"]
        for entry in archive.infolist():
            name = entry.filename
            assert "\\" not in name and not name.startswith("/")
            parts = PurePosixPath(name).parts
            assert parts and not any(part in {"", ".", ".."} for part in parts)
            assert not stat.S_ISLNK(entry.external_attr >> 16)
            if source:
                assert name.startswith(PREFIX)
                relative = name[len(PREFIX):]
                assert relative and relative.split("/")[0].casefold() not in {name.casefold() for name in release.PRIVATE_ROOTS}
                assert not relative.casefold().startswith("docs/历史说明/")
    return file


def verify_delivery(folder: Path):
    report = json.loads((folder / "交付清单.json").read_text(encoding="utf-8"))
    assert report.get("privateFilesIncluded") is False and report.get("gitHistoryIncluded") is False
    assert "sourceArchive" in report and "projectArchive" not in report
    checked_archive(folder, report["deployment"])
    source_archive = checked_archive(folder, report["sourceArchive"], source=True)
    with zipfile.ZipFile(source_archive) as archive:
        generated = json.loads(archive.read(PREFIX + "public/模板素材清单.json"))
        rows = generated if isinstance(generated, list) else generated["files"]
        rows += json.loads(archive.read(PREFIX + "发布配置/公开第三方素材.json"))["files"]
        approved = {row["path"]: row["sha256"] for row in rows}
        approved_hashes = set(approved.values())
        media = json.loads(archive.read(PREFIX + "deploy/media-manifest.json"))
        assert media
    package = folder / "服务器部署包"
    manifest = json.loads((package / "文件清单.json").read_text(encoding="utf-8"))
    expected_paths = set()
    for item in manifest["files"]:
        relative = item["path"]
        assert relative not in expected_paths
        expected_paths.add(relative)
        file = release.checked_file(package / "site", relative)
        digest = release.digest(file)
        assert file.stat().st_size == item["bytes"] and digest == item["sha256"]
        data = file.read_bytes()
        try:
            data.decode("utf-8")
            binary = b"\0" in data
        except UnicodeDecodeError:
            binary = True
        if binary or file.suffix.lower() in BINARY_SUFFIXES:
            assert digest in approved_hashes, "部署包包含未审核二进制"
        if "public/" + relative in approved:
            assert digest == approved["public/" + relative], "公开路径与审核素材不一致"
    actual_paths = {file.relative_to(package / "site").as_posix() for file in release.files_under(package / "site")}
    assert expected_paths == actual_paths and report["siteFiles"] == len(actual_paths)
    for url, expected in media.items():
        assert url.startswith("/color/") and url.endswith(".mp4")
        relative = url.removeprefix("/")
        file = release.checked_file(package / "site", relative)
        data = file.read_bytes()
        cloudflare_hash = hashlib.sha256(base64.b64encode(data) + b"mp4").hexdigest()[:32]
        assert relative in actual_paths and len(data) == expected["size"] and cloudflare_hash == expected["hash"]
        assert release.digest(file) == approved["public/" + relative]
    print(f"PASS: {len(actual_paths)}份纯模板文件、动态媒体清单、两份ZIP的SHA256/CRC及私人目录隔离")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--delivery", type=Path)
    args = parser.parse_args()
    check_functions()
    if args.delivery:
        verify_delivery(args.delivery)
