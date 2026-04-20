import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(repoRoot, "src", "data", "kean_locations.json");
const targetDir = path.join(repoRoot, "backend", "data");
const targetPath = path.join(targetDir, "kean_locations.json");

await stat(sourcePath);
await mkdir(targetDir, { recursive: true });
await copyFile(sourcePath, targetPath);

console.log(`Synced ${sourcePath} -> ${targetPath}`);
