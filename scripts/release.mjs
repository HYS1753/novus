import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import console from "node:console";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const versionPaths = [
  "package.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
];

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function parseVersion(version) {
  requireValue(
    typeof version === "string" &&
      version === version.trim() &&
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version),
    `Expected a stable version MAJOR.MINOR.PATCH, received: ${version}`,
  );
  const parts = version.split(".").map(Number);
  requireValue(
    parts.every((part) => part <= 65535),
    "Windows version components must be <= 65535",
  );
  return parts;
}

function section(text, heading, repeated = false) {
  const sections = [...text.matchAll(/^\[.*\]\s*$/gm)];
  const matches = sections.filter((match) => match[0].trim() === heading);
  requireValue(matches.length === 1 || repeated, `Expected exactly one TOML section ${heading}`);
  return matches.map((match) => {
    const index = sections.indexOf(match);
    const end = sections[index + 1]?.index ?? text.length;
    return { start: match.index, end, text: text.slice(match.index, end) };
  });
}

function tomlString(text, key) {
  const matches = [...text.matchAll(new RegExp(`^${key}\\s*=\\s*"([^"]*)"\\s*(?:#.*)?$`, "gm"))];
  requireValue(matches.length === 1, `Expected exactly one TOML ${key} string`);
  return matches[0][1];
}

function rootLockSection(text, name) {
  const matches = section(text, "[[package]]", true).filter(
    (entry) =>
      new RegExp(`^name = "${name}"\\r?$`, "m").test(entry.text) &&
      !/^source\s*=/m.test(entry.text),
  );
  requireValue(matches.length === 1, `Expected one local Cargo.lock package named ${name}`);
  return matches[0];
}

function readProject(root) {
  const read = (path) => readFileSync(resolve(root, path), "utf8");
  const texts = versionPaths.map(read);
  const packageJson = JSON.parse(texts[0]);
  const tauri = JSON.parse(texts[1]);
  const cargo = section(texts[2], "[package]")[0];
  const name = tomlString(cargo.text, "name");
  // The binary name is also used in a regex to identify the local lock entry.
  requireValue(/^[a-zA-Z0-9_-]+$/.test(name), "Unsupported Cargo package name");
  const lock = rootLockSection(texts[3], name);
  return {
    texts,
    packageJson,
    tauri,
    cargo,
    lock,
    name,
    policy: JSON.parse(read("release.config.json")),
    windows: JSON.parse(read("src-tauri/tauri.windows.conf.json")),
  };
}

function validatePolicy(project) {
  const { policy, windows, tauri, name } = project;
  requireValue(
    policy.schemaVersion === 1 && policy.channel === "stable",
    "Unsupported release policy",
  );
  for (const key of ["sourceRepository", "releaseRepository"]) {
    requireValue(/^[\w.-]+\/[\w.-]+$/.test(policy[key]), `Invalid ${key}`);
  }
  const identity = policy.windows;
  requireValue(
    identity?.target === "x86_64-pc-windows-msvc",
    "Stage 1 supports Windows x64 releases only",
  );
  requireValue(
    identity.bundle === "nsis" && identity.installMode === "currentUser",
    "Windows releases must use per-user NSIS EXE installers",
  );
  requireValue(
    tauri.identifier === identity.identifier && identity.identifier === "com.novus.hub",
    "Application identifier changed; installer migration is required",
  );
  requireValue(
    tauri.productName === identity.productName && identity.productName === "novus",
    "Product name changed; installer migration is required",
  );
  requireValue(name === identity.binaryName && name === "novus", "Cargo/binary name changed");
  requireValue((tauri.mainBinaryName ?? name) === identity.binaryName, "Main binary name changed");
  requireValue(
    !windows.identifier && !windows.productName && !windows.mainBinaryName && !windows.version,
    "Windows override must not change application identity or version",
  );
  requireValue(
    JSON.stringify(windows.bundle?.targets) === '["nsis"]',
    "Windows bundle targets must be NSIS only",
  );
  requireValue(
    windows.bundle?.windows?.nsis?.installMode === identity.installMode,
    "NSIS install mode differs from release policy",
  );
}

export function checkRelease(root = projectRoot, tag) {
  const project = readProject(root);
  validatePolicy(project);
  const version = project.packageJson.version;
  parseVersion(version);
  const versions = [
    version,
    project.tauri.version,
    tomlString(project.cargo.text, "version"),
    tomlString(project.lock.text, "version"),
  ];
  versions.forEach((value, index) =>
    requireValue(
      value === version,
      `${versionPaths[index]} version ${value} differs from package.json ${version}`,
    ),
  );
  if (tag !== undefined)
    requireValue(tag === `v${version}`, `Release tag must be v${version}, received: ${tag}`);
  return { version, expectedTag: `v${version}`, ...project.policy };
}

function replaceSectionVersion(text, entry, version) {
  const updated = entry.text.replace(
    /^(version\s*=\s*")[^"]*(")/m,
    (_, prefix, suffix) => prefix + version + suffix,
  );
  return text.slice(0, entry.start) + updated + text.slice(entry.end);
}

export function setVersion(root, version) {
  const parts = parseVersion(version);
  const project = readProject(root);
  validatePolicy(project);
  const previous = parseVersion(project.packageJson.version);
  const changedPart = parts.findIndex((part, index) => part !== previous[index]);
  requireValue(
    changedPart < 0 || parts[changedPart] > previous[changedPart],
    "Version decreases are not allowed",
  );
  project.packageJson.version = version;
  project.tauri.version = version;
  const updated = [
    JSON.stringify(project.packageJson, null, 2) + "\n",
    JSON.stringify(project.tauri, null, 2) + "\n",
    replaceSectionVersion(project.texts[2], project.cargo, version),
    replaceSectionVersion(project.texts[3], project.lock, version),
  ];
  // Prepare all changes first; restore originals if any write or validation fails.
  let written = 0;
  try {
    for (let index = 0; index < versionPaths.length; index++) {
      written = index + 1;
      writeFileSync(resolve(root, versionPaths[index]), updated[index]);
    }
    return checkRelease(root);
  } catch (error) {
    for (let index = 0; index < written; index++)
      writeFileSync(resolve(root, versionPaths[index]), project.texts[index]);
    throw error;
  }
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

export function sourceInfo(root = projectRoot, tag) {
  return {
    kind: "release-source-info",
    ...checkRelease(root, tag),
    commit: git(root, ["rev-parse", "HEAD"]),
    dirty: git(root, ["status", "--porcelain"]) !== "",
  };
}

function run(args) {
  const [command = "check", ...rest] = args;
  if (command === "set") {
    requireValue(rest.length === 1, "Usage: pnpm release:version MAJOR.MINOR.PATCH");
    console.log(`Synchronized version ${setVersion(projectRoot, rest[0]).version}`);
    return;
  }
  requireValue(command === "check" || command === "info", "Use check, info, or set");
  requireValue(
    rest.length === 0 || (rest.length === 2 && rest[0] === "--tag"),
    "Usage: pnpm release:check [--tag vMAJOR.MINOR.PATCH]",
  );
  const tag =
    rest[1] ?? (process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined);
  if (process.env.GITHUB_REF_TYPE === "tag")
    requireValue(!!process.env.GITHUB_REF_NAME, "GitHub tag name is missing");
  // A hard-coded CLI argument must never hide the actual triggering CI tag.
  if (process.env.GITHUB_REF_TYPE === "tag") checkRelease(projectRoot, process.env.GITHUB_REF_NAME);
  if (command === "info") console.log(JSON.stringify(sourceInfo(projectRoot, tag), null, 2));
  else console.log(`Release checks passed: ${checkRelease(projectRoot, tag).expectedTag}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    console.error(`Release check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
