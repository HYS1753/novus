import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Buffer } from "node:buffer";
import process from "node:process";
import { guard, prepare, verifyAssets } from "./ci-release.mjs";

const hash = (data) => createHash("sha256").update(data).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const saveJson = (path, data) => writeFileSync(path, JSON.stringify(data));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "novus-ci-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  for (const directory of ["src-tauri/bin/mpv", "scripts", "signing"])
    mkdirSync(join(root, directory), { recursive: true });
  for (const file of [
    "package.json",
    "release.config.json",
    "src-tauri/tauri.conf.json",
    "src-tauri/tauri.windows.conf.json",
    "src-tauri/Cargo.toml",
    "src-tauri/Cargo.lock",
    "scripts/mpv-windows.json",
    ".gitignore",
  ])
    copyFileSync(resolve(file), join(root, file));
  const keyPath = join(root, "src-tauri/target/test.key");
  mkdirSync(join(root, "src-tauri/target"));
  const env = { ...process.env };
  for (const key of [
    "TAURI_SIGNING_PRIVATE_KEY",
    "TAURI_SIGNING_PRIVATE_KEY_PATH",
    "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
  ])
    delete env[key];
  const signer = (...args) => {
    const result = spawnSync(
      process.execPath,
      [resolve("node_modules/@tauri-apps/cli/tauri.js"), "signer", ...args],
      { env, stdio: "pipe" },
    );
    assert.equal(result.status, 0, "Disposable Tauri signer must succeed");
  };
  signer("generate", "--ci", "--password", "disposable-ci-test", "--write-keys", keyPath);
  const publicKey = readFileSync(`${keyPath}.pub`, "utf8").trim();
  writeFileSync(join(root, "signing/updater.pub"), publicKey);
  const configPath = join(root, "src-tauri/tauri.windows.conf.json");
  const config = readJson(configPath);
  config.plugins.updater.pubkey = publicKey;
  saveJson(configPath, config);
  const mpvPath = join(root, "scripts/mpv-windows.json");
  const mpv = readJson(mpvPath);
  const dll = Buffer.from("disposable MPV fixture");
  mpv.binarySha256 = hash(dll);
  saveJson(mpvPath, mpv);
  writeFileSync(join(root, "src-tauri/bin/mpv/libmpv-2.dll"), dll);
  git("init", "-b", "main");
  git("add", ".");
  git(
    "-c",
    "user.name=Novus tests",
    "-c",
    "user.email=tests@example.invalid",
    "commit",
    "-m",
    "fixture",
  );
  const sha = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/main", sha);
  const version = readJson(join(root, "package.json")).version;
  const tag = `v${version}`;
  git("tag", tag);
  const ci = {
    GITHUB_REPOSITORY: "HYS1753/novus",
    GITHUB_EVENT_NAME: "push",
    GITHUB_SHA: sha,
    GITHUB_REF: `refs/tags/${tag}`,
    GITHUB_REF_TYPE: "tag",
    GITHUB_REF_NAME: tag,
    GITHUB_RUN_ID: "12345",
    GITHUB_RUN_ATTEMPT: "1",
  };
  return { root, git, ci, signer, keyPath, version };
}

test("CI refuses foreign repositories, mismatched tags, dirty trees and commits outside main", (t) => {
  const { root, git, ci } = fixture(t);
  assert.equal(guard(root, ci).commit, ci.GITHUB_SHA);
  for (const change of [
    { GITHUB_REPOSITORY: "someone/fork" },
    { GITHUB_REF_NAME: "v9.9.9" },
    { GITHUB_SHA: "0".repeat(40) },
    { GITHUB_EVENT_NAME: "pull_request" },
    { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/feature" },
  ])
    assert.throws(() => guard(root, { ...ci, ...change }));
  assert.equal(
    guard(root, { ...ci, GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main" })
      .event,
    "workflow_dispatch",
  );
  writeFileSync(join(root, "dirty.txt"), "dirty");
  assert.throws(() => guard(root, ci), /clean/);
  git("add", "dirty.txt");
  git(
    "-c",
    "user.name=Novus tests",
    "-c",
    "user.email=tests@example.invalid",
    "commit",
    "-m",
    "outside main",
  );
  assert.throws(() =>
    guard(root, {
      ...ci,
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_REF: "refs/heads/main",
      GITHUB_SHA: git("rev-parse", "HEAD"),
    }),
  );
});

test("CI assembles genuine signed files and rejects tampered manifests, hashes, extra files and provenance", (t) => {
  const { root, ci, signer, keyPath, version } = fixture(t);
  saveJson(join(root, "src-tauri/target/release-build-context.json"), guard(root, ci));
  const bundle = join(root, "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis");
  mkdirSync(bundle, { recursive: true });
  const filename = `novus_${version}_x64-setup.exe`;
  const installer = join(bundle, filename);
  writeFileSync(installer, Buffer.concat([Buffer.from("MZ"), Buffer.alloc(128, 65)]));
  signer(
    "sign",
    "--private-key-path",
    keyPath,
    "--password",
    "disposable-ci-test",
    "--app-version",
    version,
    installer,
  );
  const directory = prepare(root, ci);
  assert.equal(verifyAssets(root, directory, ci).commit, ci.GITHUB_SHA);
  assert.throws(() => prepare(root, ci), /EEXIST/);
  const metadataPath = join(directory, "release-source.json");
  const metadataText = readFileSync(metadataPath, "utf8");
  const manifestPath = join(directory, "latest.json");
  const manifestText = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  manifest.platforms["windows-x86_64"].url = "https://example.com/forged.exe";
  saveJson(manifestPath, manifest);
  const metadata = JSON.parse(metadataText);
  metadata.files["latest.json"] = hash(readFileSync(manifestPath));
  saveJson(metadataPath, metadata);
  assert.throws(() => verifyAssets(root, directory, ci), /Manifest differs/);
  writeFileSync(manifestPath, manifestText);
  writeFileSync(metadataPath, metadataText);
  assert.throws(
    () => verifyAssets(root, directory, { ...ci, GITHUB_RUN_ATTEMPT: "2" }),
    /workflow identity/,
  );
  const data = readFileSync(join(directory, filename));
  data[50] ^= 1;
  writeFileSync(join(directory, filename), data);
  assert.throws(() => verifyAssets(root, directory, ci), /hash mismatch/);
  copyFileSync(installer, join(directory, filename));
  writeFileSync(join(directory, "unexpected.key"), "not a real key");
  assert.throws(() => verifyAssets(root, directory, ci), /Unexpected or missing/);
});
