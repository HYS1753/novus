import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import process from "node:process";
import { checkSigning, createManifest, verifyUpdate } from "./update-artifacts.mjs";

test("production signing policy rejects disabled signatures, key drift and insecure or different endpoints", (t) => {
  checkSigning();
  const directory = mkdtempSync(join(tmpdir(), "novus-signing-policy-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "src-tauri"));
  mkdirSync(join(directory, "signing"));
  for (const file of [
    "package.json",
    "release.config.json",
    "src-tauri/tauri.conf.json",
    "src-tauri/tauri.windows.conf.json",
    "src-tauri/Cargo.toml",
    "src-tauri/Cargo.lock",
    "signing/updater.pub",
  ]) {
    copyFileSync(resolve(file), join(directory, file));
  }
  const path = join(directory, "src-tauri/tauri.windows.conf.json");
  const original = readFileSync(path, "utf8");
  for (const mutate of [
    (config) => {
      config.plugins.updater.dangerousAcceptInvalidCerts = true;
    },
    (config) => {
      config.plugins.updater.dangerousAcceptInvalidHostnames = true;
    },
    (config) => {
      config.plugins.updater.requireSignedVersion = false;
    },
    (config) => {
      config.plugins.updater.allowDowngrades = true;
    },
    (config) => {
      config.bundle.createUpdaterArtifacts = false;
    },
    (config) => {
      config.plugins.updater.pubkey = "invalid";
    },
    (config) => {
      config.plugins.updater.endpoints[0] =
        "http://github.com/HYS1753/novus/releases/latest/download/latest.json";
    },
    (config) => {
      config.plugins.updater.endpoints[0] = "https://example.com/latest.json";
    },
    (config) => {
      config.plugins.updater.windows.installMode = "quiet";
    },
    (config) => {
      config.plugins.updater.dangerousInsecureTransportProtocol = true;
    },
  ]) {
    const config = JSON.parse(original);
    mutate(config);
    writeFileSync(path, JSON.stringify(config));
    assert.throws(() => checkSigning(directory));
  }
});

test("Tauri CLI signatures verify; corrupt artifacts, keys, comments and versions are rejected", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "novus-signing-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const keyPath = join(directory, "test.key");
  const version = "0.2.0";
  const filename = `novus_${version}_x64-setup.exe`;
  const artifactPath = join(directory, filename);
  const data = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(128, 42)]);
  writeFileSync(artifactPath, data);
  const env = { ...process.env };
  delete env.TAURI_SIGNING_PRIVATE_KEY;
  delete env.TAURI_SIGNING_PRIVATE_KEY_PATH;
  delete env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
  const signer = (args) => {
    const result = spawnSync(
      process.execPath,
      [resolve("node_modules/@tauri-apps/cli/tauri.js"), "signer", ...args],
      { env, encoding: "utf8" },
    );
    // Never include signer output or private key material in assertion logs.
    assert.equal(result.status, 0, "Tauri test signer must succeed");
  };
  signer(["generate", "--ci", "--password", "disposable-test-password", "--write-keys", keyPath]);
  signer([
    "sign",
    "--private-key-path",
    keyPath,
    "--password",
    "disposable-test-password",
    "--app-version",
    version,
    artifactPath,
  ]);
  const publicKey = readFileSync(`${keyPath}.pub`, "utf8");
  const signature = readFileSync(`${artifactPath}.sig`, "utf8");
  assert.equal(verifyUpdate(data, signature, publicKey, version, filename).version, version);
  const damaged = Buffer.from(data);
  damaged[40] ^= 1;
  assert.throws(() => verifyUpdate(damaged, signature, publicKey, version), /Artifact signature/);
  assert.throws(() => verifyUpdate(data, signature, publicKey, "0.2.1"), /Signed version/);
  assert.throws(
    () => verifyUpdate(data, signature, publicKey, version, "renamed.exe"),
    /Signed filename/,
  );
  const lines = Buffer.from(signature.trim(), "base64").toString().trimEnd().split("\n");
  lines[2] = lines[2].replace("version:0.2.0", "version:0.2.1");
  const forged = Buffer.from(lines.join("\n") + "\n").toString("base64");
  assert.throws(() => verifyUpdate(data, forged, publicKey, "0.2.1"), /Trusted comment signature/);
  assert.throws(() => verifyUpdate(data, "not base64!", publicKey, version), /Invalid base64/);
  const keyLines = Buffer.from(publicKey.trim(), "base64").toString().trimEnd().split("\n");
  const keyBytes = Buffer.from(keyLines[1], "base64");
  keyBytes[20] ^= 1;
  keyLines[1] = keyBytes.toString("base64");
  const wrongKey = Buffer.from(keyLines.join("\n") + "\n").toString("base64");
  assert.throws(() => verifyUpdate(data, signature, wrongKey, version), /Artifact signature/);

  const release = { version, expectedTag: `v${version}`, releaseRepository: "HYS1753/novus" };
  const manifest = createManifest(data, signature, publicKey, release, filename);
  const platform = manifest.platforms["windows-x86_64"];
  assert.equal(platform.signature, signature.trim());
  assert.equal(
    platform.url,
    `https://github.com/HYS1753/novus/releases/download/v${version}/${filename}`,
  );
  assert.throws(
    () => createManifest(data, signature, publicKey, release, "novus_0.1.0_x64-setup.exe"),
    /installer name/,
  );
  assert.throws(
    () => createManifest(damaged, signature, publicKey, release, filename),
    /Artifact signature/,
  );
});
