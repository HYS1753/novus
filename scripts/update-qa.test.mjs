import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Buffer } from "node:buffer";
import { once } from "node:events";
import { createQaServer, validateNextQaTarget } from "./update-qa.mjs";

test("continued migration QA rejects production identity, missing builds and non-increasing versions", () => {
  const session = {
    identifier: "com.novus.hub.qa",
    origin: "http://127.0.0.1:19077",
    target: "0.2.9",
    installers: { target: { name: "novus-qa_0.2.9_x64-setup.exe" } },
  };
  assert.doesNotThrow(() => validateNextQaTarget(session, "0.2.10"));
  for (const version of [
    "0.2.8",
    "0.2.9",
    "0.02.10",
    "v0.3.0",
    "0.3.0-beta",
    "1.0.65536",
    "../0.3.0",
  ])
    assert.throws(() => validateNextQaTarget(session, version));
  assert.throws(() => validateNextQaTarget({ ...session, identifier: "com.novus.hub" }, "0.3.0"));
  assert.throws(() => validateNextQaTarget({ ...session, origin: "https://github.com" }, "0.3.0"));
  assert.throws(() => validateNextQaTarget({ ...session, installers: {} }, "0.3.0"));
});

async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "novus-qa-http-"));
  const name = "novus-qa_0.2.1_x64-setup.exe";
  const data = Buffer.alloc(128, 42);
  data.write("MZ");
  const modePath = join(directory, "server-mode.json");
  writeFileSync(join(directory, name), data);
  writeFileSync(join(directory, "latest.json"), '{"version":"0.2.1"}');
  writeFileSync(join(directory, "disposable.key"), "must never be served");
  const server = createQaServer(directory, { installers: { target: { name } } }, modePath);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    directory,
    name,
    data,
    get: (path, options) => globalThis.fetch(origin + path, options),
    mode: (mode) => writeFileSync(modePath, JSON.stringify({ mode })),
  };
}
test("QA HTTP fixture serves only manifest and target, never keys or arbitrary paths", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.get("/latest.json")).status, 200);
  assert.deepEqual(Buffer.from(await (await f.get(`/${f.name}`)).arrayBuffer()), f.data);
  for (const path of [
    "/disposable.key",
    "/session.json",
    "/latest.json?file=disposable.key",
    "/../disposable.key",
  ])
    assert.equal((await f.get(path)).status, 404);
  assert.equal((await f.get("/latest.json", { method: "POST" })).status, 404);
});
test("QA transport failures and tampering are reproducible without modifying installers", async (t) => {
  const f = await fixture(t);
  f.mode("unavailable");
  assert.equal((await f.get("/latest.json")).status, 503);
  f.mode("upToDate");
  assert.equal((await f.get("/latest.json")).status, 204);
  f.mode("tampered");
  const altered = Buffer.from(await (await f.get(`/${f.name}`)).arrayBuffer());
  assert.notDeepEqual(altered, f.data);
  assert.deepEqual(readFileSync(join(f.directory, f.name)), f.data);
  f.mode("normal");
  assert.deepEqual(Buffer.from(await (await f.get(`/${f.name}`)).arrayBuffer()), f.data);
  f.mode("typo");
  assert.equal((await f.get("/latest.json")).status, 503);
});
