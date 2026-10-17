import { fetchFolder, fileEndpoint, validRange } from '../../../server/drive-library.mjs';
import { Buffer } from 'node:buffer';

// Simple in-memory cache shared across invocations of the same warm lambda
let cached = null;

async function list(force = false) {
  if (!force && cached && Date.now() - cached.time < 30_000) return cached.files;
  const files = await fetchFolder();
  cached = { files, time: Date.now() };
  return files;
}

async function boundedBody(response, max = 25 * 1024 * 1024) {
  const contentLength = Number(response.headers.get('content-length'));
  if (contentLength > max) throw new Error('This article exceeds the 25 MB document limit.');
  const chunks = [];
  let length = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > max) { await reader.cancel(); throw new Error('This article exceeds the 25 MB document limit.'); }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

const corsHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  for (const [k, v] of Object.entries(corsHeaders)) res.setHeader(k, v);

  const { id, action } = req.query;

  if (!id || !action || !/^[\w-]+$/.test(id) || !['file', 'article', 'preview'].includes(action)) {
    return res.status(404).json({ error: 'Not found.' });
  }

  try {
    const files = await list();
    const file = files.find(f => f.id === id);
    if (!file) return res.status(404).json({ error: 'This file is no longer in the shared notes folder. Refresh the collection.' });

    // Preview — thumbnail image for PDFs
    if (action === 'preview') {
      if (file.kind !== 'pdf') return res.status(400).json({ error: 'Preview is available for PDFs.' });
      const preview = await fetch(`https://drive.google.com/thumbnail?id=${file.id}&sz=w1200`, { redirect: 'follow' });
      if (!preview.ok || !preview.headers.get('content-type')?.startsWith('image/')) {
        return res.status(404).json({ error: 'Preview not available.' });
      }
      res.setHeader('Content-Type', preview.headers.get('content-type'));
      const buf = Buffer.from(await preview.arrayBuffer());
      return res.status(200).send(buf);
    }

    // Validate byte range header
    const range = req.headers['range'];
    if (!validRange(range)) return res.status(416).json({ error: 'Invalid byte range.' });

    const fetchHeaders = range && action === 'file' ? { Range: range } : {};
    const upstream = await fetch(fileEndpoint(file), { method: req.method, redirect: 'follow', headers: fetchHeaders });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(502).json({ error: 'This document is not currently available. Check its sharing in the notes folder.' });
    }

    const mime = upstream.headers.get('content-type') || '';
    if (mime.includes('text/html') && file.kind !== 'gdoc') {
      return res.status(502).json({ error: 'Google Drive has not made this file available for reading yet. Retry once the upload has finished.' });
    }

    // Article — return parsed content
    if (action === 'article') {
      if (file.kind === 'pdf') return res.status(400).json({ error: 'Use the PDF reader for this file.' });
      const body = await boundedBody(upstream);

      if (file.kind === 'doc') {
        const { default: WordExtractor } = await import('word-extractor');
        const document = await new WordExtractor().extract(Buffer.from(body));
        return res.status(200).json({ format: 'text', content: document.getBody(), file });
      }
      if (file.kind === 'docx') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        return res.status(200).send(Buffer.from(body));
      }
      return res.status(200).json({
        format: file.kind === 'gdoc' ? 'html' : file.kind === 'markdown' ? 'markdown' : 'text',
        content: new TextDecoder().decode(body),
        file,
      });
    }

    // File — stream raw bytes (PDF, etc.)
    res.setHeader('Content-Type', file.kind === 'pdf' ? 'application/pdf' : 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    for (const name of ['Content-Length', 'Content-Range', 'Accept-Ranges', 'Last-Modified', 'ETag']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.status(upstream.status);
    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.send(buf);

  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Unable to read the notes folder.' });
  }
}
