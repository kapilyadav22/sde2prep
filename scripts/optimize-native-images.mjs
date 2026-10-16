#!/usr/bin/env node
/**
 * Losslessly optimize only images referenced by the supplied native snapshots.
 *
 * node scripts/optimize-native-images.mjs [--check] content/raw/redis-native.json ...
 *
 * --check is read-only. Conversion verifies decoded RGBA hashes before changing
 * snapshot references. Originals are removed only after all snapshots are saved,
 * and converted PNG originals are backed up under /private/tmp first.
 */
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = path.resolve(projectRoot, 'public');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const snapshotPaths = [...new Set(args.filter(argument => !argument.startsWith('--')).map(argument => path.resolve(argument)))];
if (args.includes('--help') || !snapshotPaths.length) {
  console.log('Usage: node scripts/optimize-native-images.mjs [--check] content/raw/redis-native.json [more-native.json ...]');
  process.exit(snapshotPaths.length || args.includes('--help') ? 0 : 1);
}
const unknownFlags = args.filter(argument => argument.startsWith('--') && !['--check', '--help'].includes(argument));
if (unknownFlags.length) throw new Error(`Unknown option: ${unknownFlags.join(', ')}`);

/** Return references to the mutable imageProperties objects, including nested tabs. */
function imageProperties(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (value.imageProperties && typeof value.imageProperties.localPath === 'string') found.push(value.imageProperties);
  for (const child of Object.values(value)) if (child && typeof child === 'object') imageProperties(child, found);
  return found;
}

function assetFile(localPath) {
  if (!localPath.startsWith('/') || localPath.startsWith('//') || localPath.includes('\\') || /[?#]/.test(localPath)) throw new Error(`Expected an absolute public asset path: ${localPath}`);
  const file = path.resolve(publicRoot, `.${localPath}`);
  if (!file.startsWith(`${publicRoot}${path.sep}`)) throw new Error(`Asset is outside public/: ${localPath}`);
  return file;
}

async function exists(file) {
  try { await stat(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function pixelFingerprint(input) {
  const { data, info } = await sharp(input).toColourspace('srgb').ensureAlpha().raw({ depth: 'uchar' }).toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    channels: info.channels,
    sha256: createHash('sha256').update(data).digest('hex'),
  };
}

function samePixels(left, right) {
  return left.width === right.width && left.height === right.height && left.channels === right.channels && left.sha256 === right.sha256;
}

const documents = [];
const jobs = new Map();
for (const filename of snapshotPaths) {
  const snapshot = JSON.parse(await readFile(filename, 'utf8'));
  const refs = imageProperties(snapshot);
  documents.push({ filename, snapshot, refs });
  for (const properties of refs) {
    const source = properties.localPath;
    const existing = jobs.get(source);
    if (existing) existing.refs.push(properties);
    else jobs.set(source, { localPath: source, filename: assetFile(source), refs: [properties] });
  }
}

// Preflight every source before creating output or changing any document.
const missing = [];
const candidates = [];
let referencedBytes = 0;
let alreadyWebp = 0;
let unsupported = 0;
const targets = new Map();
const realPublicRoot = await realpath(publicRoot);
for (const job of jobs.values()) {
  if (!await exists(job.filename)) { missing.push(job.localPath); continue; }
  const sourceStat = await lstat(job.filename);
  const resolved = await realpath(job.filename);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || !resolved.startsWith(`${realPublicRoot}${path.sep}`)) throw new Error(`Expected a regular image file inside public/: ${job.localPath}`);
  job.bytesBefore = sourceStat.size;
  referencedBytes += sourceStat.size;
  if (/\.webp$/i.test(job.localPath)) { alreadyWebp++; continue; }
  if (!/\.(png|jpe?g)$/i.test(job.localPath)) { unsupported++; continue; }
  job.targetLocalPath = job.localPath.replace(/\.(png|jpe?g)$/i, '.webp');
  job.targetFilename = assetFile(job.targetLocalPath);
  const conflict = targets.get(job.targetFilename);
  if (conflict && conflict !== job.filename) throw new Error(`PNG/JPEG filenames collide at target ${job.targetLocalPath}; rename one source before converting.`);
  targets.set(job.targetFilename, job.filename);
  candidates.push(job);
}

const preflight = {
  mode: checkOnly ? 'check' : 'convert',
  snapshots: documents.length,
  imageReferences: documents.reduce((count, document) => count + document.refs.length, 0),
  uniqueAssets: jobs.size,
  referencedBytes,
  candidateAssets: candidates.length,
  candidateBytes: candidates.reduce((bytes, job) => bytes + job.bytesBefore, 0),
  alreadyWebp,
  unsupported,
  missing,
};
console.log(JSON.stringify(preflight, null, 2));
if (missing.length) throw new Error(`${missing.length} referenced images are missing. No image or snapshot has been changed; finish downloading them first.`);
if (checkOnly) process.exit(0);

// Do not remove a source asset referenced by an unselected native snapshot.
const selectedSnapshots = new Set(snapshotPaths);
const externalReferences = new Set();
for (const name of await readdir(path.join(projectRoot, 'content/raw'))) {
  if (!/-native\.json$/i.test(name)) continue;
  const filename = path.join(projectRoot, 'content/raw', name);
  if (selectedSnapshots.has(filename)) continue;
  const snapshot = JSON.parse(await readFile(filename, 'utf8'));
  for (const properties of imageProperties(snapshot)) externalReferences.add(properties.localPath);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.join('/private/tmp', `sde2prep-native-originals-${timestamp}`);
const audit = [];
const converted = [];
sharp.concurrency(2);

for (let index = 0; index < candidates.length; index++) {
  const job = candidates[index];
  const metadata = await sharp(job.filename).metadata();
  if ((metadata.pages || 1) > 1 || (metadata.bitsPerSample || 8) > 8 || (metadata.depth && metadata.depth !== 'uchar') || metadata.width > 16383 || metadata.height > 16383) {
    audit.push({ source: job.localPath, status: 'kept-original', reason: 'Animated, higher-bit-depth, or oversized image; preserving its original format.' });
    continue;
  }
  const originalPixels = await pixelFingerprint(job.filename);
  let buffer;
  let targetExists = await exists(job.targetFilename);
  if (targetExists) {
    if ((await lstat(job.targetFilename)).isSymbolicLink()) throw new Error(`Target must not be a symlink: ${job.targetLocalPath}`);
    buffer = await readFile(job.targetFilename);
  } else {
    // exact:true also retains otherwise invisible RGB values under transparency.
    let pipeline = sharp(job.filename).toColourspace('srgb');
    if (metadata.orientation) pipeline = pipeline.keepExif();
    buffer = await pipeline.webp({ lossless: true, effort: 2, exact: true }).toBuffer();
  }
  const optimizedPixels = await pixelFingerprint(buffer);
  if (!samePixels(originalPixels, optimizedPixels)) throw new Error(`RGBA pixel verification failed for ${job.localPath}. Original asset and snapshots are unchanged.`);
  if (buffer.length >= job.bytesBefore) {
    audit.push({ source: job.localPath, status: 'kept-original', reason: 'Lossless WebP is not smaller.', originalBytes: job.bytesBefore, webpBytes: buffer.length, pixels: originalPixels });
    continue;
  }
  if (!targetExists) {
    const temporary = `${job.targetFilename}.sde2prep-${process.pid}.tmp`;
    await writeFile(temporary, buffer, { flag: 'wx' });
    await rename(temporary, job.targetFilename);
  }
  job.bytesAfter = buffer.length;
  job.pixels = originalPixels;
  converted.push(job);
  audit.push({ source: job.localPath, target: job.targetLocalPath, status: 'verified-lossless', originalBytes: job.bytesBefore, optimizedBytes: buffer.length, pixels: originalPixels });
  if ((index + 1) % 50 === 0 || index + 1 === candidates.length) console.log(`Verified ${index + 1}/${candidates.length} candidates; ${converted.length} smaller lossless images prepared.`);
}

// All image conversions have passed verification. Save every updated reference
// before removing any original file, so interrupted runs remain recoverable.
for (const job of converted) for (const reference of job.refs) reference.localPath = job.targetLocalPath;
for (const document of documents) {
  const temporary = `${document.filename}.sde2prep-${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(document.snapshot, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, document.filename);
}

let originalsRemoved = 0;
let retainedSharedOriginals = 0;
let retainedJpegOriginals = 0;
let removedBytes = 0;
for (const job of converted) {
  if (externalReferences.has(job.localPath)) { retainedSharedOriginals++; continue; }
  // Limit cleanup to the converted PNG assets owned by these supplied snapshots.
  if (!/\.png$/i.test(job.localPath)) { retainedJpegOriginals++; continue; }
  const backupFilename = path.join(backupRoot, job.localPath.slice(1));
  await mkdir(path.dirname(backupFilename), { recursive: true });
  await copyFile(job.filename, backupFilename);
  const backupPixels = await pixelFingerprint(backupFilename);
  if (!samePixels(backupPixels, job.pixels)) throw new Error(`Backup verification failed for ${job.localPath}; the public original was kept.`);
  await unlink(job.filename);
  originalsRemoved++;
  removedBytes += job.bytesBefore;
}

const webpBytes = converted.reduce((bytes, job) => bytes + job.bytesAfter, 0);
const reportFilename = path.join('/private/tmp', `sde2prep-native-image-optimization-${timestamp}.json`);
const summary = {
  snapshotsUpdated: documents.length,
  convertedAssets: converted.length,
  unchangedAssets: candidates.length - converted.length,
  pixelsVerifiedIdentical: converted.length,
  originalPngsBackedUpAndRemoved: originalsRemoved,
  retainedSharedOriginals,
  retainedJpegOriginals,
  originalReferencedBytes: referencedBytes,
  convertedWebpBytes: webpBytes,
  staticAssetBytesSaved: removedBytes - webpBytes,
  originalBackupDirectory: originalsRemoved ? backupRoot : null,
  auditReport: reportFilename,
};
await writeFile(reportFilename, `${JSON.stringify({ summary, assets: audit }, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
