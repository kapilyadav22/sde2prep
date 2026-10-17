import { fetchFolder } from '../../server/drive-library.mjs';

// Simple in-memory cache (lives for the duration of the warm lambda)
let cached = null;

async function list(force = false) {
  if (!force && cached && Date.now() - cached.time < 30_000) return cached.files;
  const files = await fetchFolder();
  cached = { files, time: Date.now() };
  return files;
}

const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Access-Control-Allow-Origin': 'https://sde2prep.vercel.app',
};

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  try {
    const force = req.query.refresh === '1';
    const files = await list(force);
    return res.status(200).json({ files, checkedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Unable to read the notes folder.' });
  }
}
