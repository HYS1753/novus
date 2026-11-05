"""Build dependency integrity checks; no network or production DLL changes."""
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import setup_mpv


class WindowsMpvIntegrityTests(unittest.TestCase):
    def test_bad_archive_preserves_existing_binary(self):
        with tempfile.TemporaryDirectory(prefix="novus-mpv-test-") as directory:
            destination = Path(directory) / "staging"
            destination.mkdir()
            target = destination / "libmpv-2.dll"
            target.write_bytes(b"existing binary")
            config = {"version": "test", "binary": target.name, "url": "https://example.invalid/test.7z",
                      "archiveSha256": hashlib.sha256(b"expected archive").hexdigest(), "binarySha256": "0" * 64}
            def download(_url, path):
                Path(path).write_bytes(b"corrupt archive")
            with (patch.object(setup_mpv, "MPV_DESTINATION", destination),
                  patch.dict(setup_mpv.CONFIG, {"windows": config}),
                  patch.object(setup_mpv.urllib.request, "urlretrieve", side_effect=download),
                  patch.object(setup_mpv.subprocess, "run") as extract):
                self.assertFalse(setup_mpv.setup_windows(force=True))
                extract.assert_not_called()
                self.assertEqual(target.read_bytes(), b"existing binary")

    def test_good_archive_with_bad_binary_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix="novus-mpv-test-") as directory:
            destination = Path(directory) / "staging"
            destination.mkdir()
            target = destination / "libmpv-2.dll"
            target.write_bytes(b"existing binary")
            config = {"version": "test", "binary": target.name, "url": "https://example.invalid/test.7z",
                      "archiveSha256": hashlib.sha256(b"archive").hexdigest(), "binarySha256": "0" * 64}
            def download(_url, path):
                Path(path).write_bytes(b"archive")
            def extract(args, **_kwargs):
                Path(args[2], target.name).write_bytes(b"wrong DLL")
                return type("Result", (), {"returncode": 0})()
            with (patch.object(setup_mpv, "MPV_DESTINATION", destination),
                  patch.dict(setup_mpv.CONFIG, {"windows": config}),
                  patch.object(setup_mpv.urllib.request, "urlretrieve", side_effect=download),
                  patch.object(setup_mpv.shutil, "which", return_value=None),
                  patch.object(setup_mpv.subprocess, "run", side_effect=extract)):
                self.assertFalse(setup_mpv.setup_windows(force=True))
                self.assertEqual(target.read_bytes(), b"existing binary")


if __name__ == "__main__":
    unittest.main()
