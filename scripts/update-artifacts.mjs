import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import process from "node:process";
import console from "node:console";
import { checkRelease } from "./release.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function decode(text) {
  requireValue(typeof text === "string", "Expected base64 text");
  const value = text.trim();
  const bytes = Buffer.from(value, "base64");
  requireValue(bytes.length > 0 && bytes.toString("base64") === value, "Invalid base64 encoding");
  return bytes;
}

export function publicKeyBytes(publicKey) {
  const lines = decode(publicKey).toString("utf8").trimEnd().split(/\r?\n/);
  requireValue(
    lines.length === 2 && lines[0].startsWith("untrusted comment: "),
    "Invalid public key box",
  );
  const bytes = decode(lines[1]);
  requireValue(
    bytes.length === 42 && bytes.subarray(0, 2).toString() === "Ed",
    "Invalid public key",
  );
  return bytes;
}

// Tauri uses minisign: Ed25519 over BLAKE2b-512, plus a second signature
// authenticating the first signature and the trusted comment. Both are required.
// Format: https://github.com/jedisct1/rust-minisign/blob/master/src/lib.rs
export function verifyUpdate(data, signature, publicKey, version, filename) {
  const keyBytes = publicKeyBytes(publicKey);
  const lines = decode(signature).toString("utf8").trimEnd().split(/\r?\n/);
  requireValue(
    lines.length === 4 && lines[0].startsWith("untrusted comment: "),
    "Invalid signature box",
  );
  const packet = decode(lines[1]);
  requireValue(
    packet.length === 74 && packet.subarray(0, 2).toString() === "ED",
    "Expected prehashed minisign signature",
  );
  requireValue(
    packet.subarray(2, 10).equals(keyBytes.subarray(2, 10)),
    "Signing key does not match",
  );
  const key = createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), keyBytes.subarray(10)]),
    format: "der",
    type: "spki",
  });
  const contentSignature = packet.subarray(10);
  requireValue(
    verify(null, createHash("blake2b512").update(data).digest(), key, contentSignature),
    "Artifact signature verification failed",
  );
  requireValue(lines[2].startsWith("trusted comment: "), "Missing trusted comment");
  const comment = lines[2].slice("trusted comment: ".length);
  const globalSignature = decode(lines[3]);
  requireValue(
    globalSignature.length === 64 &&
      verify(null, Buffer.concat([contentSignature, Buffer.from(comment)]), key, globalSignature),
    "Trusted comment signature verification failed",
  );
  const fields = comment.split("\t");
  requireValue(
    fields.filter((field) => field.startsWith("version:")).length === 1 &&
      fields.includes(`version:${version}`),
    "Signed version does not match release version",
  );
  if (filename !== undefined)
    requireValue(
      fields.filter((field) => field.startsWith("file:")).length === 1 &&
        fields.includes(`file:${filename}`),
      "Signed filename does not match artifact",
    );
  return { keyId: keyBytes.subarray(2, 10).toString("hex"), version };
}

export function checkSigning(projectRoot = root) {
  const release = checkRelease(projectRoot);
  const config = JSON.parse(
    readFileSync(join(projectRoot, "src-tauri/tauri.windows.conf.json"), "utf8"),
  );
  const publicKey = readFileSync(join(projectRoot, "signing/updater.pub"), "utf8").trim();
  publicKeyBytes(publicKey);
  requireValue(config.bundle.createUpdaterArtifacts === true, "Updater artifacts must be enabled");
  const updater = config.plugins?.updater;
  requireValue(
    updater?.pubkey === publicKey,
    "Configured public key differs from signing/updater.pub",
  );
  const endpoint = `https://github.com/${release.releaseRepository}/releases/latest/download/latest.json`;
  requireValue(
    JSON.stringify(updater.endpoints) === JSON.stringify([endpoint]),
    "Unexpected update endpoint",
  );
  requireValue(updater.windows?.installMode === "passive", "Updater install mode must be passive");
  requireValue(
    !updater.dangerousInsecureTransportProtocol,
    "Insecure updater transport is forbidden",
  );
  return { ...release, publicKey };
}

export function createManifest(data, signature, publicKey, release, filename) {
  requireValue(
    filename === `novus_${release.version}_x64-setup.exe`,
    "Unexpected installer name or version",
  );
  requireValue(
    data.length > 64 && data.subarray(0, 2).toString() === "MZ",
    "Expected a Windows EXE installer",
  );
  verifyUpdate(data, signature, publicKey, release.version, filename);
  return {
    version: release.version,
    platforms: {
      "windows-x86_64": {
        signature: signature.trim(),
        url: `https://github.com/${release.releaseRepository}/releases/download/${release.expectedTag}/${encodeURIComponent(filename)}`,
      },
    },
  };
}

function run(args) {
  const [command, artifact] = args;
  const release = checkSigning();
  if (command === "check" && args.length === 1) {
    console.log(`Signing configuration valid: ${release.expectedTag}`);
    return;
  }
  requireValue(
    (command === "verify" || command === "manifest") && args.length === 2,
    "Usage: pnpm release:signing check | verify <file> | manifest <installer.exe>",
  );
  const path = resolve(artifact);
  const data = readFileSync(path);
  const signature = readFileSync(`${path}.sig`, "utf8");
  verifyUpdate(data, signature, release.publicKey, release.version, basename(path));
  if (command === "manifest") {
    const manifest = createManifest(data, signature, release.publicKey, release, basename(path));
    writeFileSync(join(dirname(path), "latest.json"), JSON.stringify(manifest, null, 2) + "\n");
    writeFileSync(
      join(dirname(path), "SHA256SUMS"),
      `${createHash("sha256").update(data).digest("hex")}  ${basename(path)}\n`,
    );
  }
  console.log(`Signature verified: ${basename(path)} (${release.version})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    console.error(`Signing check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
