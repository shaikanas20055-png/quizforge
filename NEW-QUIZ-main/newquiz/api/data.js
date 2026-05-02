let memoryStore = {};

export default function handler(req, res) {
  if (req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(memoryStore));
    return;
  }

  if (req.method === 'POST') {
    const payload = typeof req.body === 'object' && req.body ? req.body : {};
    memoryStore = payload;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, POST');
  res.end('Method Not Allowed');
}
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'resp.json');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(data);
    } catch (e) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({}));
    }
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        // NOTE: Vercel filesystem is read-only — writes may not persist between deployments.
        try {
          fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2), 'utf8');
        } catch (e) {
          // swallow write errors but return success to caller to keep UX similar to local server
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, POST');
  res.end('Method Not Allowed');
}
