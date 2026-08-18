// Regenerates favicon + PWA icons from the SVG sources.
//
// Depends on system tools:
//   rsvg-convert  (SVG -> PNG)  https://github.com/GNOME/librsvg
//   magick        (PNG -> ICO)  ImageMagick
//
// Usage: node scripts/gen-icons.mjs

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "src", "app");
const publicIcons = path.join(root, "public", "icons");
const tmp = path.join(root, "node_modules", ".cache", "icons");

const SIZES = [16, 32, 180, 192, 512];

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: "inherit" });
}

function rsvg(src, size, out) {
  run("rsvg-convert", [
    "-w",
    String(size),
    "-h",
    String(size),
    src,
    "-o",
    out,
  ]);
}

mkdirSync(publicIcons, { recursive: true });
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

const iconSvg = path.join(appDir, "icon.svg");
const maskableSvg = path.join(root, "scripts", "assets", "icon-maskable.svg");

for (const size of SIZES) {
  rsvg(iconSvg, size, path.join(tmp, `icon-${size}.png`));
}

run("magick", [
  path.join(tmp, "icon-16.png"),
  path.join(tmp, "icon-32.png"),
  path.join(appDir, "favicon.ico"),
]);

run("mv", [path.join(tmp, "icon-180.png"), path.join(appDir, "apple-icon.png")]);
run("mv", [path.join(tmp, "icon-192.png"), path.join(publicIcons, "icon-192.png")]);
run("mv", [path.join(tmp, "icon-512.png"), path.join(publicIcons, "icon-512.png")]);

rsvg(maskableSvg, 512, path.join(publicIcons, "icon-maskable-512.png"));

rmSync(tmp, { recursive: true, force: true });

console.log("Icons written:");
console.log(`  ${path.join(appDir, "icon.svg")}`);
console.log(`  ${path.join(appDir, "favicon.ico")}`);
console.log(`  ${path.join(appDir, "apple-icon.png")}`);
console.log(`  ${path.join(publicIcons, "icon-192.png")}`);
console.log(`  ${path.join(publicIcons, "icon-512.png")}`);
console.log(`  ${path.join(publicIcons, "icon-maskable-512.png")}`);
