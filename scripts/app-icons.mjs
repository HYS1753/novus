import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = join(root, "src-tauri/target/app-icons");
mkdirSync(scratch, { recursive: true });
const logo = readFileSync(join(root, "src/assets/novus-logo.png"));
// The official 779×260 lockup has its NV mark before the blank columns 398–401.
// Clip the wordmark rather than redrawing or stretching the brand artwork.
if (logo.readUInt32BE(16) !== 779 || logo.readUInt32BE(20) !== 260)
  throw new Error(
    "Novus logo dimensions changed; review the monogram crop before generating icons",
  );
const source = join(scratch, "app-icon.svg");
writeFileSync(
  source,
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="104" fill="#101114"/>
  <svg x="28" y="108" width="456" height="296" viewBox="0 0 400 260" overflow="hidden">
    <image width="779" height="260" href="data:image/png;base64,${logo.toString("base64")}"/>
  </svg>
</svg>\n`,
);
const generated = join(scratch, "generated");
const result = spawnSync(
  process.execPath,
  [join(root, "node_modules/@tauri-apps/cli/tauri.js"), "icon", source, "--output", generated],
  { cwd: root, stdio: "inherit" },
);
if (result.status !== 0) throw new Error("Tauri icon generation failed");
// Keep the desktop outputs only; mobile packaging is outside this project.
for (const name of [
  "32x32.png",
  "128x128.png",
  "128x128@2x.png",
  "icon.png",
  "icon.ico",
  "icon.icns",
  "Square30x30Logo.png",
  "Square44x44Logo.png",
  "Square71x71Logo.png",
  "Square89x89Logo.png",
  "Square107x107Logo.png",
  "Square142x142Logo.png",
  "Square150x150Logo.png",
  "Square284x284Logo.png",
  "Square310x310Logo.png",
  "StoreLogo.png",
])
  copyFileSync(join(generated, name), join(root, "src-tauri/icons", name));
copyFileSync(join(generated, "128x128.png"), join(root, "public/novus-icon.png"));
