// path: src/runtime/browser/write-browser-artifacts.cjs

'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

function serializeArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') {
    throw new Error('Artifact must be an object.');
  }

  if (artifact.kind === 'json') {
    return Buffer.from(`${JSON.stringify(artifact.payload ?? null, null, 2)}\n`, 'utf8');
  }

  if (artifact.kind === 'binary') {
    if (Buffer.isBuffer(artifact.payload)) {
      return artifact.payload;
    }

    if (artifact.payload instanceof Uint8Array) {
      return Buffer.from(artifact.payload);
    }

    throw new Error(`Binary artifact "${artifact.name}" must provide a Buffer payload.`);
  }

  throw new Error(`Unsupported artifact kind: ${artifact.kind}`);
}

async function writeBrowserArtifacts(normalizedResult, io = {}) {
  if (!normalizedResult || normalizedResult.kind !== 'browser-diagnostics') {
    return {
      status: 'failed',
      written: [],
      manifest: null,
      warnings: [],
      error: {
        code: 'invalid_result',
        message: 'writeBrowserArtifacts() requires a normalized browser-diagnostics result.',
      },
    };
  }

  const artifactsDir = typeof io.artifactsDir === 'string' && io.artifactsDir.trim()
    ? io.artifactsDir.trim()
    : '';

  if (!artifactsDir) {
    return {
      status: 'failed',
      written: [],
      manifest: null,
      warnings: [],
      error: {
        code: 'artifacts_dir_required',
        message: 'artifactsDir is required.',
      },
    };
  }

  const warnings = [];
  const artifacts = Array.isArray(normalizedResult.artifacts) ? normalizedResult.artifacts : [];
  const written = [];

  try {
    await fs.mkdir(artifactsDir, { recursive: true });

    for (const artifact of artifacts) {
      const artifactPath = path.join(artifactsDir, artifact.name);
      const payload = serializeArtifact(artifact);

      await fs.writeFile(artifactPath, payload);

      written.push({
        name: artifact.name,
        path: artifactPath,
      });
    }

    return {
      status: normalizedResult.status,
      written,
      manifest: {
        artifactCount: written.length,
        baseDir: artifactsDir,
      },
      warnings,
      error: null,
    };
  } catch (error) {
    return {
      status: 'failed',
      written,
      manifest: null,
      warnings,
      error: {
        code: 'artifact_write_failed',
        message: error instanceof Error ? error.message : 'Unknown artifact write error.',
      },
    };
  }
}

module.exports = {
  writeBrowserArtifacts,
};
