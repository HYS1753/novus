import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import process from "node:process";
import console from "node:console";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const keyPath = join(homedir(), ".tauri", "novus", "updater.key");
const publicPath = `${keyPath}.pub`;
const proofDirectory = join(root, "src-tauri", "target", "release-signing-proof");
const tauriCli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");

function signer(args) {
  const env = { ...process.env };
  delete env.CI;
  delete env.TAURI_SIGNING_PRIVATE_KEY;
  delete env.TAURI_SIGNING_PRIVATE_KEY_PATH;
  delete env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
  const result = spawnSync(process.execPath, [tauriCli, "signer", ...args], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0)
    throw new Error("Signing command failed; key files have not been overwritten.");
}

try {
  if (process.argv.length !== 2) throw new Error("Usage: pnpm release:keygen");
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new Error(
      "Run this command yourself in an interactive PC terminal. Do not send passwords to chat.",
    );
  }
  if (existsSync(keyPath) !== existsSync(publicPath)) {
    throw new Error(
      `Incomplete key pair at ${keyPath}. Restore the matching pair from backup; do not overwrite it.`,
    );
  }
  if (!existsSync(keyPath)) {
    if (existsSync(join(root, "signing", "updater.pub"))) {
      throw new Error(
        "A production public key already exists. Restore its private key from backup.",
      );
    }
    console.log("Enter a non-empty password in Tauri's prompt. Store it in your password manager.");
    mkdirSync(dirname(keyPath), { recursive: true, mode: 0o700 });
    signer(["generate", "--write-keys", keyPath]);
  }
  mkdirSync(join(root, "signing"), { recursive: true });
  // Only the PUBLIC key is copied into the repository.
  const repositoryPublicPath = join(root, "signing", "updater.pub");
  const publicKey = readFileSync(publicPath, "utf8");
  if (existsSync(repositoryPublicPath)) {
    if (readFileSync(repositoryPublicPath, "utf8").trim() !== publicKey.trim()) {
      throw new Error(
        "Local key does not match the production public key. Restore the correct key pair.",
      );
    }
  } else {
    writeFileSync(repositoryPublicPath, publicKey, { flag: "wx" });
  }
  mkdirSync(proofDirectory, { recursive: true });
  const proofPath = join(proofDirectory, "key-proof.txt");
  writeFileSync(proofPath, `Novus signing-key proof\n${randomBytes(32).toString("hex")}\n`);
  const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  console.log("Enter the same password again to sign a local verification file.");
  signer(["sign", "--private-key-path", keyPath, "--app-version", version, proofPath]);
  console.log(
    "Public key and local signing proof are ready. Back up the encrypted private key outside this PC.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
