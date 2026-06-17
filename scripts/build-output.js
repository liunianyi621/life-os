const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "outputs", "life-rpg");

const files = [
  "index.html",
  "icon.svg",
  "manifest.webmanifest"
];

const directories = [
  "css",
  "js"
];

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(outputDir, file));
}

for (const directory of directories) {
  fs.cpSync(path.join(root, directory), path.join(outputDir, directory), {
    recursive: true
  });
}

console.log(`Built ${path.relative(root, outputDir)}`);
