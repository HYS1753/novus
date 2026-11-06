import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import {
  createReadStream,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import console from "node:console";
import { setVersion, checkRelease } from "./release.mjs";
import { checkSigning, verifyUpdate } from "./update-artifacts.mjs";

// These files are never release inputs. Production source/configuration is not patched.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const qa = join(root, "src-tauri/target/update-qa");
const cli = join(root, "node_modules/@tauri-apps/cli/tauri.js");
const origin = "http://127.0.0.1:19077";
const identifier = "com.novus.hub.qa";
const password = "disposable-local-qa-only";
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
function requireValue(value, message) {
  if (!value) throw new Error(message);
}
function environment() {
  const env = { ...process.env };
  for (const name of Object.keys(env))
    if (name.toUpperCase().startsWith("TAURI_SIGNING_") || name.toUpperCase() === "TAURI_CONFIG")
      delete env[name];
  env.CARGO_TARGET_DIR = join(root, "src-tauri/target");
  return env;
}
function signer(args) {
  const result = spawnSync(process.execPath, [cli, "signer", ...args], {
    env: environment(),
    encoding: "utf8",
  });
  // Disposable key material and signer output are deliberately not logged.
  requireValue(result.status === 0, "Disposable QA signing failed");
}
export function replaceOnce(text, before, after) {
  requireValue(
    text.split(before).length === 2,
    "QA patch no longer matches exactly once; review source changes",
  );
  return text.replace(before, after);
}
function copySource(destination) {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  for (const file of files) {
    if (!(
      file.startsWith("src-tauri/") ||
      file.startsWith("signing/") ||
      ["package.json", "release.config.json"].includes(file)
    ))
      continue;
    const target = join(destination, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, file), target);
  }
  const expected = json(join(root, "scripts/mpv-windows.json"));
  const mpv = `src-tauri/bin/mpv/${expected.binary}`;
  requireValue(existsSync(join(root, mpv)), "Run pnpm setup:mpv before preparing QA installers");
  // Existing pinned DLL is reused, never fetched from a different source.
  requireValue(digest(join(root, mpv)) === expected.binarySha256, "Pinned MPV DLL hash mismatch");
  mkdirSync(dirname(join(destination, mpv)), { recursive: true });
  copyFileSync(join(root, mpv), join(destination, mpv));
}
function configureCopy(destination, version, publicKey) {
  setVersion(destination, version);
  const tauriPath = join(destination, "src-tauri/tauri.conf.json");
  const config = json(tauriPath);
  config.productName = "novus-qa";
  config.identifier = identifier;
  config.app.windows[0].title = `Novus QA ${version} — local update validation`;
  config.build.beforeBuildCommand = "";
  config.build.frontendDist = "../dist";
  save(tauriPath, config);
  for (const file of ["src-tauri/Cargo.toml", "src-tauri/Cargo.lock"]) {
    const path = join(destination, file);
    writeFileSync(
      path,
      replaceOnce(readFileSync(path, "utf8"), 'name = "novus"', 'name = "novus-qa"'),
    );
  }
  const windowsPath = join(destination, "src-tauri/tauri.windows.conf.json");
  const windows = json(windowsPath);
  windows.bundle.useLocalToolsDir = true;
  windows.plugins.updater.pubkey = publicKey.trim();
  windows.plugins.updater.endpoints = [`${origin}/latest.json`];
  windows.plugins.updater.dangerousInsecureTransportProtocol = true;
  save(windowsPath, windows);
  writeFileSync(join(destination, "signing/updater.pub"), publicKey);
  const path = join(destination, "src-tauri/src/updater/windows.rs");
  let text = readFileSync(path, "utf8");
  text = replaceOnce(
    text,
    "https://github.com/HYS1753/novus/releases/latest/download/latest.json",
    `${origin}/latest.json`,
  );
  text = replaceOnce(
    text,
    "https://github.com/HYS1753/novus/releases/download/v{version}/novus_{version}_x64-setup.exe",
    `${origin}/novus-qa_{version}_x64-setup.exe`,
  );
  text = replaceOnce(
    text,
    'attempt.url().scheme() != "https"',
    `attempt.url().scheme() != "http" || attempt.url().host_str() != Some("127.0.0.1") || attempt.url().port() != Some(19077)`,
  );
  text = replaceOnce(
    text,
    "|| config.dangerous_insecure_transport_protocol",
    "|| !config.dangerous_insecure_transport_protocol",
  );
  text = replaceOnce(
    text,
    "if config.pubkey.trim() != KEY.trim()",
    `if app.config().identifier != "${identifier}" || config.pubkey.trim() != KEY.trim()`,
  );
  writeFileSync(path, text);
}
function prepare() {
  checkSigning(root);
  requireValue(existsSync(join(root, "dist/index.html")), "Run pnpm build first");
  requireValue(
    !existsSync(join(qa, "session.json")),
    "QA session already exists; use its existing installers",
  );
  mkdirSync(qa, { recursive: true });
  const key = join(qa, "disposable.key");
  requireValue(!existsSync(key), "Disposable key already exists; do not overwrite it");
  signer(["generate", "--ci", "--password", password, "--write-keys", key]);
  const publicKey = readFileSync(`${key}.pub`, "utf8");
  const baseline = checkRelease(root).version;
  const parts = baseline.split(".").map(Number);
  parts[2]++;
  const target = parts.join(".");
  const session = {
    schemaVersion: 1,
    identifier,
    origin,
    baseline,
    target,
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    installers: {},
  };
  for (const version of [baseline, target]) {
    const destination = join(qa, version);
    copySource(destination);
    configureCopy(destination, version, publicKey);
  }
  save(join(qa, "session.json"), session);
  console.log(
    `QA copies ready: ${baseline} → ${target}; identifier ${identifier}. No production files, keys or releases changed.`,
  );
}
function build(which) {
  const session = json(join(qa, "session.json"));
  requireValue(["baseline", "target"].includes(which), "Choose baseline or target");
  const version = session[which];
  const destination = join(qa, version);
  requireValue(
    json(join(destination, "src-tauri/tauri.conf.json")).identifier === identifier,
    "Not an isolated QA build",
  );
  // Windows drive paths deserialize as URLs in Tauri's FrontendDist. Embed a
  // snapshot through a relative path, never navigate to a file:// directory.
  const frontend = mkdtempSync(join(qa, "frontend-"));
  cpSync(join(root, "dist"), frontend, { recursive: true });
  const configPath = join(destination, "src-tauri/tauri.conf.json");
  const config = json(configPath);
  config.build.frontendDist = relative(join(destination, "src-tauri"), frontend).replaceAll(
    "\\",
    "/",
  );
  requireValue(
    config.build.frontendDist.startsWith("../") && existsSync(join(frontend, "index.html")),
    "QA frontend must be embedded from a relative path",
  );
  save(configPath, config);
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "build",
      "--config",
      join(destination, "src-tauri/tauri.windows.conf.json"),
      "--target",
      "x86_64-pc-windows-msvc",
      "--bundles",
      "nsis",
      "--no-sign",
      "--",
      "--locked",
    ],
    { cwd: destination, env: environment(), stdio: "inherit" },
  );
  requireValue(result.status === 0, "QA installer build failed");
  const name = `novus-qa_${version}_x64-setup.exe`;
  const source = join(root, "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis", name);
  const assets = join(qa, "assets");
  mkdirSync(assets, { recursive: true });
  const artifact = join(assets, name);
  copyFileSync(source, artifact);
  signer([
    "sign",
    "--private-key-path",
    join(qa, "disposable.key"),
    "--password",
    password,
    "--app-version",
    version,
    artifact,
  ]);
  const signature = readFileSync(`${artifact}.sig`, "utf8");
  verifyUpdate(
    readFileSync(artifact),
    signature,
    readFileSync(join(qa, "disposable.key.pub"), "utf8"),
    version,
    name,
  );
  session.installers[which] = { name, sha256: digest(artifact), size: statSync(artifact).size };
  save(join(qa, "session.json"), session);
  if (which === "target")
    save(join(assets, "latest.json"), {
      version,
      notes: "Local QA update. No public release.",
      platforms: { "windows-x86_64": { signature, url: `${origin}/${name}` } },
    });
  console.log(`Verified QA installer: ${artifact}`);
}
export function createQaServer(assets, session, modePath) {
  requireValue(
    /^novus-qa_\d+\.\d+\.\d+_x64-setup\.exe$/.test(session.installers.target.name),
    "Not a QA installer filename",
  );
  const allowed = new Map([
    ["/latest.json", join(assets, "latest.json")],
    [`/${session.installers.target.name}`, join(assets, session.installers.target.name)],
  ]);
  const server = createServer(async (req, res) => {
    const path = allowed.get(req.url);
    if (req.method !== "GET" || !path) {
      res.writeHead(404);
      res.end();
      return;
    }
    let mode;
    try {
      mode = existsSync(modePath) ? json(modePath).mode : "normal";
      requireValue(
        ["normal", "slow", "unavailable", "upToDate", "tampered"].includes(mode),
        "Unknown QA mode",
      );
    } catch {
      res.writeHead(503);
      res.end();
      return;
    }
    if (mode === "unavailable") {
      res.writeHead(503);
      res.end();
      return;
    }
    if (req.url === "/latest.json" && mode === "upToDate") {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Length": statSync(path).size,
      "Content-Type": req.url === "/latest.json" ? "application/json" : "application/octet-stream",
      "Cache-Control": "no-store",
    });
    const file = createReadStream(path, { highWaterMark: 256 * 1024 });
    file.on("error", () => res.destroy());
    res.on("close", () => file.destroy());
    console.log(`${req.method} ${req.url}`);
    try {
      let first = true;
      for await (const chunk of file) {
        if (res.destroyed) break;
        // Alter EXE bytes only in the disposable QA fixture, retaining its original signature.
        if (mode === "tampered" && req.url !== "/latest.json" && first) chunk[64] ^= 1;
        first = false;
        if (!res.write(chunk))
          await new Promise((resolve) => {
            const done = () => {
              res.off("drain", done);
              res.off("close", done);
              resolve();
            };
            res.once("drain", done);
            res.once("close", done);
          });
        if (mode === "slow" && req.url !== "/latest.json") await delay(100);
      }
      res.end();
    } catch {
      res.destroy();
    }
  });
  return server;
}
function serve() {
  const session = json(join(qa, "session.json"));
  const assets = join(qa, "assets");
  requireValue(session.installers.target && session.origin === origin, "Build the QA target first");
  for (const item of Object.values(session.installers))
    requireValue(digest(join(assets, item.name)) === item.sha256, "QA installer hash changed");
  const server = createQaServer(assets, session, join(qa, "server-mode.json"));
  server.listen(19077, "127.0.0.1", () =>
    console.log(`QA update server ${origin}; loopback only; Ctrl+C stops it.`),
  );
  server.on("error", () => {
    console.error("QA server could not start; no fallback address is used");
    process.exitCode = 1;
  });
}
if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    const action = process.argv[2];
    if (action === "prepare") prepare();
    else if (action === "build") build(process.argv[3]);
    else if (action === "serve") serve();
    else
      throw new Error(
        "Usage: node scripts/update-qa.mjs prepare | build baseline | build target | serve",
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
