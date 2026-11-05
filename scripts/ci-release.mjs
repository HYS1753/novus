import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import console from "node:console";
import { sourceInfo } from "./release.mjs";
import { checkSigning, createManifest } from "./update-artifacts.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = "src-tauri/target/release-assets";
const context = "src-tauri/target/release-build-context.json";
const metadataName = "release-source.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function git(projectRoot, args) {
  return execFileSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function guard(projectRoot = root, env = process.env) {
  const release = checkSigning(projectRoot);
  const source = sourceInfo(projectRoot);
  requireValue(
    env.GITHUB_REPOSITORY === release.sourceRepository &&
      release.sourceRepository === release.releaseRepository,
    "CI repository does not match release policy",
  );
  requireValue(!source.dirty, "Release source must be clean");
  requireValue(source.commit === env.GITHUB_SHA, "Checked-out commit differs from workflow commit");
  requireValue(
    env.GITHUB_EVENT_NAME === "push" || env.GITHUB_EVENT_NAME === "workflow_dispatch",
    "Unsupported release event",
  );
  if (env.GITHUB_EVENT_NAME === "push") {
    requireValue(
      env.GITHUB_REF_TYPE === "tag" &&
        env.GITHUB_REF_NAME === release.expectedTag &&
        env.GITHUB_REF === `refs/tags/${release.expectedTag}`,
      "Push must be the exact release version tag",
    );
    requireValue(
      git(projectRoot, ["rev-parse", `${env.GITHUB_REF}^{commit}`]) === source.commit,
      "Tag moved or differs from checked-out commit",
    );
  } else {
    requireValue(env.GITHUB_REF === "refs/heads/main", "Validation dispatch must run on main");
  }
  // fetch-depth: 0 provides origin/main and annotated tag targets.
  git(projectRoot, ["merge-base", "--is-ancestor", source.commit, "refs/remotes/origin/main"]);
  requireValue(
    /^\d+$/.test(env.GITHUB_RUN_ID ?? "") && /^\d+$/.test(env.GITHUB_RUN_ATTEMPT ?? ""),
    "Missing workflow run identity",
  );
  return {
    schemaVersion: 1,
    version: release.version,
    tag: release.expectedTag,
    commit: source.commit,
    tree: git(projectRoot, ["rev-parse", "HEAD^{tree}"]),
    repository: release.sourceRepository,
    ref: env.GITHUB_REF,
    event: env.GITHUB_EVENT_NAME,
    runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT,
  };
}

export function prepare(projectRoot = root, env = process.env) {
  const before = json(join(projectRoot, context));
  const after = guard(projectRoot, env);
  requireValue(
    JSON.stringify(before) === JSON.stringify(after),
    "Source or workflow changed during build",
  );
  const release = checkSigning(projectRoot);
  const filename = `novus_${release.version}_x64-setup.exe`;
  const bundle = join(
    projectRoot,
    "src-tauri/target",
    release.windows.target,
    "release/bundle/nsis",
  );
  const bytes = readFileSync(join(bundle, filename));
  const signature = readFileSync(join(bundle, `${filename}.sig`), "utf8");
  const manifest = createManifest(bytes, signature, release.publicKey, release, filename);
  const mpv = json(join(projectRoot, "scripts/mpv-windows.json"));
  const mpvHash = sha256(readFileSync(join(projectRoot, "src-tauri/bin/mpv", mpv.binary)));
  requireValue(mpvHash === mpv.binarySha256, "Bundled MPV differs from pinned binary");
  const directory = join(projectRoot, output);
  // A fresh directory prevents stale files or secrets being uploaded by a glob.
  mkdirSync(directory);
  copyFileSync(join(bundle, filename), join(directory, filename));
  writeFileSync(join(directory, `${filename}.sig`), signature.trim() + "\n");
  save(join(directory, "latest.json"), manifest);
  writeFileSync(join(directory, "SHA256SUMS"), `${sha256(bytes)}  ${filename}\n`);
  const files = [filename, `${filename}.sig`, "latest.json", "SHA256SUMS"];
  save(join(directory, metadataName), {
    ...after,
    kind: "novus-release-build",
    builtAt: new Date().toISOString(),
    mpv: { version: mpv.version, sha256: mpvHash },
    publicKeySha256: sha256(release.publicKey),
    files: Object.fromEntries(
      files.map((file) => [file, sha256(readFileSync(join(directory, file)))]),
    ),
  });
  verifyAssets(projectRoot, directory, env);
  return directory;
}

export function verifyAssets(projectRoot, directory, env = process.env) {
  const release = checkSigning(projectRoot);
  const metadata = json(join(directory, metadataName));
  const filename = `novus_${release.version}_x64-setup.exe`;
  const files = [filename, `${filename}.sig`, "latest.json", "SHA256SUMS"];
  requireValue(
    JSON.stringify(readdirSync(directory).sort()) ===
      JSON.stringify([...files, metadataName].sort()),
    "Unexpected or missing release files",
  );
  requireValue(
    metadata.kind === "novus-release-build" &&
      metadata.schemaVersion === 1 &&
      metadata.version === release.version &&
      metadata.tag === release.expectedTag &&
      metadata.repository === release.sourceRepository,
    "Artifact provenance differs from release policy",
  );
  requireValue(
    metadata.commit === git(projectRoot, ["rev-parse", "HEAD"]) &&
      metadata.commit === env.GITHUB_SHA &&
      metadata.tree === git(projectRoot, ["rev-parse", "HEAD^{tree}"]),
    "Artifact source commit/tree mismatch",
  );
  requireValue(
    metadata.runId === env.GITHUB_RUN_ID &&
      metadata.runAttempt === env.GITHUB_RUN_ATTEMPT &&
      metadata.ref === env.GITHUB_REF &&
      metadata.event === env.GITHUB_EVENT_NAME,
    "Artifact workflow identity mismatch",
  );
  requireValue(
    metadata.publicKeySha256 === sha256(release.publicKey),
    "Artifact public key mismatch",
  );
  const mpv = json(join(projectRoot, "scripts/mpv-windows.json"));
  requireValue(
    metadata.mpv?.version === mpv.version && metadata.mpv?.sha256 === mpv.binarySha256,
    "Artifact MPV mismatch",
  );
  requireValue(
    JSON.stringify(Object.keys(metadata.files ?? {}).sort()) === JSON.stringify(files.sort()),
    "Unexpected checksum entries",
  );
  for (const file of files)
    requireValue(
      metadata.files[file] === sha256(readFileSync(join(directory, file))),
      `Artifact hash mismatch: ${file}`,
    );
  const data = readFileSync(join(directory, filename));
  const signature = readFileSync(join(directory, `${filename}.sig`), "utf8");
  const expected = createManifest(data, signature, release.publicKey, release, filename);
  requireValue(
    JSON.stringify(json(join(directory, "latest.json"))) === JSON.stringify(expected),
    "Manifest differs from verified installer",
  );
  requireValue(
    readFileSync(join(directory, "SHA256SUMS"), "utf8") === `${sha256(data)}  ${filename}\n`,
    "Installer checksum file mismatch",
  );
  return metadata;
}

function run(args) {
  const [command, directory] = args;
  requireValue(
    command === "guard" || command === "prepare"
      ? args.length === 1
      : command === "verify" && args.length === 2,
    "Usage: pnpm release:ci guard | prepare | verify <artifact directory>",
  );
  if (command === "guard") {
    const metadata = guard();
    mkdirSync(join(root, "src-tauri/target"), { recursive: true });
    save(join(root, context), metadata);
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `tag=${metadata.tag}\n`);
  } else if (command === "prepare") prepare();
  else verifyAssets(root, resolve(directory));
  console.log(`Release CI ${command} passed`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    console.error(`Release CI failed: ${error.message}`);
    process.exitCode = 1;
  }
}
