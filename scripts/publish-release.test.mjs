import test from "node:test";
import assert from "node:assert/strict";
import { validatePublication, validateForwardRelease } from "./publish-release.mjs";

const release = { version: "0.2.0", expectedTag: "v0.2.0", sourceRepository: "HYS1753/novus" };
function fixture() {
  return {
    metadata: {
      runId: "123",
      runAttempt: "1",
      commit: "commit",
      event: "push",
      ref: "refs/tags/v0.2.0",
    },
    run: {
      id: 123,
      run_attempt: 1,
      head_sha: "commit",
      event: "push",
      status: "completed",
      conclusion: "success",
      path: ".github/workflows/release-windows.yml",
      head_repository: { full_name: "HYS1753/novus" },
      workflow_id: 10,
    },
    draft: {
      draft: true,
      prerelease: false,
      tag_name: "v0.2.0",
      assets: [
        "novus_0.2.0_x64-setup.exe",
        "novus_0.2.0_x64-setup.exe.sig",
        "latest.json",
        "SHA256SUMS",
        "release-source.json",
      ].map((name) => ({ name, state: "uploaded", size: 100 })),
    },
  };
}
test("publication only accepts a complete stable draft from its successful tag build", () => {
  const f = fixture();
  const check = (value) =>
    validatePublication(release, value.metadata, value.run, value.draft, "commit", { id: 10 });
  check(f);
  for (const mutate of [
    (f) => (f.draft.draft = false),
    (f) => (f.draft.prerelease = true),
    (f) => f.draft.assets.push({ name: "unexpected.key", state: "uploaded", size: 10 }),
    (f) => (f.draft.assets[0].size = 129 * 1024 * 1024),
    (f) => (f.draft.assets[1].state = "starter"),
    (f) => (f.metadata.event = "workflow_dispatch"),
    (f) => (f.metadata.ref = "refs/heads/main"),
    (f) => (f.run.conclusion = "failure"),
    (f) => (f.run.status = "in_progress"),
    (f) => (f.run.head_sha = "different"),
    (f) => (f.run.run_attempt = 2),
    (f) => (f.run.head_repository.full_name = "someone/fork"),
    (f) => (f.run.path = ".github/workflows/other.yml"),
    (f) => (f.run.workflow_id = 99),
  ]) {
    const bad = fixture();
    mutate(bad);
    assert.throws(() => check(bad));
  }
});
test("publication refuses replacing or downgrading any existing stable release", () => {
  validateForwardRelease("0.2.0", []);
  validateForwardRelease("0.2.0", [{ tag_name: "v0.1.0", draft: false, prerelease: false }]);
  validateForwardRelease("0.2.0", [{ tag_name: "v0.3.0", draft: true, prerelease: false }]);
  for (const tag_name of ["v0.2.0", "v0.3.0", "unknown"])
    assert.throws(() =>
      validateForwardRelease("0.2.0", [{ tag_name, draft: false, prerelease: false }]),
    );
});
