import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import console from "node:console";
import { checkSigning } from "./update-artifacts.mjs";
import { verifyAssets } from "./ci-release.mjs";
import { parseVersion } from "./release.mjs";

const root = resolve(
  process.env.RELEASE_SOURCE_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."),
);
const requireValue = (value, message) => {
  if (!value) throw new Error(message);
};
function git(projectRoot, args) {
  return execFileSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
export function validateDraft(release, draft) {
  requireValue(
    draft.draft === true && draft.prerelease === false && draft.tag_name === release.expectedTag,
    "Expected an unpublished stable draft; published releases are never overwritten",
  );
  const expected = [
    `novus_${release.version}_x64-setup.exe`,
    `novus_${release.version}_x64-setup.exe.sig`,
    "latest.json",
    "SHA256SUMS",
    "release-source.json",
  ].sort();
  requireValue(
    JSON.stringify(draft.assets.map((asset) => asset.name).sort()) === JSON.stringify(expected) &&
      draft.assets.every(
        (asset) =>
          asset.state === "uploaded" &&
          asset.size > 0 &&
          asset.size <= (asset.name.endsWith(".exe") ? 128 * 1024 * 1024 : 64 * 1024),
      ),
    "Unexpected, incomplete or oversized draft assets",
  );
}
export function validatePublication(release, metadata, run, draft, commit, workflow) {
  validateDraft(release, draft);
  requireValue(
    run.id.toString() === metadata.runId &&
      run.run_attempt.toString() === metadata.runAttempt &&
      run.head_sha === commit &&
      run.event === "push" &&
      run.status === "completed" &&
      run.conclusion === "success" &&
      run.path === ".github/workflows/release-windows.yml" &&
      run.head_repository?.full_name === release.sourceRepository &&
      run.workflow_id === workflow.id,
    "Draft must come from the successful tag build in this repository",
  );
  requireValue(
    metadata.commit === commit &&
      metadata.event === "push" &&
      metadata.ref === `refs/tags/${release.expectedTag}`,
    "Manual-build artifacts cannot be published as a tagged release",
  );
}
export function validateForwardRelease(version, releases) {
  const parts = parseVersion(version);
  for (const item of releases.filter((item) => !item.draft && !item.prerelease)) {
    requireValue(
      /^v\d+\.\d+\.\d+$/.test(item.tag_name),
      "Cannot compare existing stable release version",
    );
    const previous = parseVersion(item.tag_name.slice(1));
    const index = parts.findIndex((part, i) => part !== previous[i]);
    requireValue(
      index >= 0 && parts[index] > previous[index],
      "Publication must be newer than every published stable release",
    );
  }
}
function gh(args) {
  return execFileSync("gh", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
function api(path) {
  return JSON.parse(gh(["api", path]));
}
function publish() {
  requireValue(
    process.env.GITHUB_EVENT_NAME === "workflow_dispatch" &&
      process.env.GITHUB_REF === "refs/heads/main",
    "Publication must be explicitly dispatched from main",
  );
  const release = checkSigning(root);
  requireValue(
    process.env.PUBLISH_VERSION === release.version &&
      process.env.GITHUB_REPOSITORY === release.sourceRepository,
    "Publication version/repository mismatch",
  );
  const commit = git(root, ["rev-parse", "HEAD"]);
  requireValue(git(root, ["status", "--porcelain"]) === "", "Publication checkout must be clean");
  requireValue(
    git(root, ["rev-parse", `${release.expectedTag}^{commit}`]) === commit,
    "Checkout differs from release tag",
  );
  git(root, ["merge-base", "--is-ancestor", commit, "refs/remotes/origin/main"]);
  const notes = join(root, "docs/releases", `${release.expectedTag}.md`);
  requireValue(existsSync(notes), "Missing reviewed release notes in tagged source");
  const drafts = JSON.parse(
    gh([
      "api",
      "--paginate",
      "--slurp",
      `repos/${release.releaseRepository}/releases?per_page=100`,
    ]),
  ).flat();
  validateForwardRelease(release.version, drafts);
  const matches = drafts.filter((draft) => draft.tag_name === release.expectedTag);
  requireValue(
    matches.length === 1 && matches[0].draft === true,
    "Expected exactly one existing draft; never replace a published release",
  );
  validateDraft(release, matches[0]);
  const directory = resolve(process.env.RELEASE_ASSETS_DIR ?? "src-tauri/target/publish-assets");
  mkdirSync(directory, { recursive: false });
  gh([
    "release",
    "download",
    release.expectedTag,
    "--repo",
    release.releaseRepository,
    "--dir",
    directory,
  ]);
  const metadata = JSON.parse(readFileSync(join(directory, "release-source.json"), "utf8"));
  requireValue(/^\d+$/.test(metadata.runId), "Invalid source build identity");
  const run = api(`repos/${release.sourceRepository}/actions/runs/${metadata.runId}`);
  const workflow = api(`repos/${release.sourceRepository}/actions/workflows/release-windows.yml`);
  validatePublication(release, metadata, run, matches[0], commit, workflow);
  verifyAssets(root, directory, {
    GITHUB_SHA: commit,
    GITHUB_RUN_ID: run.id.toString(),
    GITHUB_RUN_ATTEMPT: run.run_attempt.toString(),
    GITHUB_REF: `refs/tags/${release.expectedTag}`,
    GITHUB_EVENT_NAME: "push",
  });
  // Re-read mutable remote references immediately before the public state change.
  git(root, ["fetch", "--no-tags", "origin", `refs/tags/${release.expectedTag}`]);
  requireValue(
    git(root, ["rev-parse", "FETCH_HEAD^{commit}"]) === commit,
    "Remote tag moved; refusing publication",
  );
  const latestDraft = api(`repos/${release.releaseRepository}/releases/${matches[0].id}`);
  validatePublication(release, metadata, run, latestDraft, commit, workflow);
  requireValue(
    JSON.stringify(latestDraft.assets.map((a) => [a.id, a.name, a.size, a.updated_at]).sort()) ===
      JSON.stringify(matches[0].assets.map((a) => [a.id, a.name, a.size, a.updated_at]).sort()),
    "Draft assets changed during verification",
  );
  gh([
    "release",
    "edit",
    release.expectedTag,
    "--repo",
    release.releaseRepository,
    "--verify-tag",
    "--draft=false",
    "--latest",
    "--title",
    `Novus ${release.expectedTag}`,
    "--notes-file",
    notes,
  ]);
  const published = api(`repos/${release.releaseRepository}/releases/${latestDraft.id}`);
  requireValue(
    !published.draft && !published.prerelease && published.published_at,
    "Publication did not complete",
  );
  console.log(`Published ${published.html_url}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    publish();
  } catch (error) {
    console.error(`Publication failed: ${error.message}`);
    process.exitCode = 1;
  }
}
