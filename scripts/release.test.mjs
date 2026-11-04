import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkRelease, parseVersion, setVersion } from "./release.mjs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "package.json",
  "release.config.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/tauri.windows.conf.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
];

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "novus-release-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "src-tauri"));
  for (const file of files) copyFileSync(join(root, file), join(directory, file));
  return directory;
}

function editJson(directory, file, change) {
  const path = join(directory, file);
  const data = JSON.parse(readFileSync(path, "utf8"));
  change(data);
  writeFileSync(path, JSON.stringify(data));
}

test("current release policy and all four version files agree", () => {
  const release = checkRelease(root);
  assert.equal(release.expectedTag, `v${release.version}`);
  assert.equal(release.windows.bundle, "nsis");
});

test("version command updates only the local package, leaving dependency versions intact", (t) => {
  const directory = fixture(t);
  const before = readFileSync(join(directory, "src-tauri/Cargo.lock"), "utf8");
  const nextVersion = `${parseVersion(checkRelease(root).version)[0] + 1}.3.17`;
  const release = setVersion(directory, nextVersion);
  assert.equal(release.version, nextVersion);
  checkRelease(directory, `v${nextVersion}`);
  const after = readFileSync(join(directory, "src-tauri/Cargo.lock"), "utf8");
  assert.equal(
    after.replace(
      /(name = "novus"\r?\nversion = ")[^"]*(")/,
      (_, prefix, suffix) => prefix + checkRelease(root).version + suffix,
    ),
    before,
  );
});

test("mismatching native version fails before a release can be built", (t) => {
  const directory = fixture(t);
  editJson(directory, "src-tauri/tauri.conf.json", (config) => {
    config.version = "0.0.0";
  });
  assert.throws(() => checkRelease(directory), /differs from package.json/);
});

test("tag prefix and version must both match the built application", () => {
  const { version } = checkRelease(root);
  assert.throws(() => checkRelease(root, version), /Release tag must be/);
  assert.throws(() => checkRelease(root, `v${version}.1`), /Release tag must be/);
});

test("CI's actual tag cannot be overridden by a matching command-line tag", () => {
  const result = spawnSync(
    process.execPath,
    [join(root, "scripts/release.mjs"), "check", "--tag", checkRelease(root).expectedTag],
    {
      cwd: root,
      env: {
        ...process.env,
        GITHUB_REF_TYPE: "tag",
        GITHUB_REF_NAME: `v${checkRelease(root).version}.1`,
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Release tag must be/);
});

test("downgrade is rejected without changing any source files", (t) => {
  const directory = fixture(t);
  const before = files.map((file) => readFileSync(join(directory, file), "utf8"));
  assert.throws(() => setVersion(directory, "0.0.1"), /decreases/);
  assert.deepEqual(
    files.map((file) => readFileSync(join(directory, file), "utf8")),
    before,
  );
});

test("using the current version repairs accidental version drift", (t) => {
  const directory = fixture(t);
  editJson(directory, "src-tauri/tauri.conf.json", (config) => {
    config.version = "0.0.1";
  });
  const { version } = checkRelease(root);
  assert.equal(setVersion(directory, version).version, version);
});

test("changing an upgrade identity or installation scope is rejected", (t) => {
  const mutations = [
    [
      "src-tauri/tauri.conf.json",
      (config) => {
        config.identifier = "com.other.app";
      },
    ],
    [
      "src-tauri/tauri.conf.json",
      (config) => {
        config.productName = "Novus Renamed";
      },
    ],
    [
      "src-tauri/tauri.windows.conf.json",
      (config) => {
        config.bundle.windows.nsis.installMode = "perMachine";
      },
    ],
    [
      "src-tauri/tauri.windows.conf.json",
      (config) => {
        config.bundle.targets = ["msi"];
      },
    ],
    [
      "src-tauri/tauri.windows.conf.json",
      (config) => {
        config.version = "9.9.9";
      },
    ],
  ];
  for (const [file, mutation] of mutations) {
    const directory = fixture(t);
    editJson(directory, file, mutation);
    assert.throws(() => checkRelease(directory));
  }
});

test("stable Windows release version syntax rejects unsafe or unsupported values", () => {
  for (const value of [
    "v0.2.0",
    "01.2.0",
    "0.2.0-rc.1",
    "0.2.0+build",
    "0.2",
    "65536.0.0",
    "0.2.0\n",
    "../0.2.0",
  ]) {
    assert.throws(() => parseVersion(value));
  }
});
