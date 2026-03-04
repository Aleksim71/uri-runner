const fs = require("fs-extra");
const path = require("path");
const archiver = require("archiver");

async function makeZip(zipPath, fileMap) {
  // fileMap: { "RUNBOOK.yaml": "path/to/file" }
  await fs.ensureDir(path.dirname(zipPath));
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    out.on("close", resolve);
    out.on("error", reject);
    archive.on("error", reject);
    archive.pipe(out);
    for (const [name, absPath] of Object.entries(fileMap)) {
      archive.file(absPath, { name });
    }
    archive.finalize();
  });
}

module.exports = { makeZip };
