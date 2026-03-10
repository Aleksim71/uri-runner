const fs = require("fs-extra");
const path = require("path");
const unzipper = require("unzipper");
const archiver = require("archiver");

/**
 * Extract zip to directory (creates directory).
 */
async function unzipToDir(zipPath, outDir) {
  await fs.ensureDir(outDir);
  await new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: outDir }))
      .on("close", resolve)
      .on("error", reject);
  });
}

/**
 * Check whether zip contains a specific entry in the root of archive.
 */
async function zipHasEntry(zipPath, entryName) {
  const directory = await unzipper.Open.file(zipPath);
  return directory.files.some((file) => file.path === entryName);
}

/**
 * Create zip file from a mapping of { entryName: absoluteFilePath }.
 */
async function zipFiles(outZipPath, entries) {
  await fs.ensureDir(path.dirname(outZipPath));

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outZipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);

    for (const [entryName, absPath] of Object.entries(entries)) {
      archive.file(absPath, { name: entryName });
    }

    archive.finalize();
  });
}

module.exports = { unzipToDir, zipFiles, zipHasEntry };
