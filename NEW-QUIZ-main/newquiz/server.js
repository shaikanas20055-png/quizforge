// ─────────────────────────────────────────────
//  QuizForge — Claude API Proxy Server
//  Usage:
//    1. Place this file next to index.html
//    2. Create a .env file with your API key
//    3. Run:  node server.js
//    4. Open: http://localhost:3000
// ─────────────────────────────────────────────

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

/** Wikipedia API (GET JSON) — must send a descriptive User-Agent per Wikimedia policy */
function wikiHttpsGet(apiUrl){
  return new Promise((resolve, reject) => {
    https.get(apiUrl, {
      headers: { 'User-Agent': 'QuizForge/1.0 (Educational quiz app; local/server use)' },
    }, (response) => {
      let chunks = '';
      response.setEncoding('utf8');
      response.on('data', d => { chunks += d; });
      response.on('end', () => { resolve(chunks); });
    }).on('error', reject);
  });
}

// ── Load .env (no external packages needed) ──
try {
  const envFile = fs.existsSync('.env') ? '.env' : '_env';
  const env = fs.readFileSync(envFile, 'utf8');
  env.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key) process.env[key] = val;
  });
} catch {
  // .env not found — key must be set in the environment directly
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const PORT              = process.env.PORT || 3000;
const DATA_FILE         = path.join(__dirname, 'resp.json');

// ── HTTP Server ──
const server = http.createServer((req, res) => {

  // CORS — allow all origins (safe for local dev)
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── GET / → serve index.html ──
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, 'utf8', (err, html) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('index.html not found — make sure it is in the same folder as server.js');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    return;
  }

  // ── GET /api/wikipedia?q=... → article extract (English Wikipedia)
  if (req.method === 'GET' && req.url.startsWith('/api/wikipedia')) {
    let q = '';
    try {
      q = (new URL(req.url, 'http://localhost').searchParams.get('q') || '').trim();
    } catch {
      q = '';
    }
    const sendJSON = (code, obj) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(obj));
    };
    if (!q) {
      sendJSON(400, { error: { message: 'Missing or empty query (q).' } });
      return;
    }
    (async () => {
      try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(q)}&srlimit=5&srnamespace=0`;
        const searchRaw = await wikiHttpsGet(searchUrl);
        const searchJson = JSON.parse(searchRaw);
        const hits = searchJson.query && searchJson.query.search ? searchJson.query.search : [];
        const hit = hits[0];
        if (!hit || !hit.title) {
          sendJSON(404, { error: { message: 'No Wikipedia article found for that search.' } });
          return;
        }
        const title = hit.title;
        const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(title)}&prop=extracts&explaintext=1&redirects=1&exchars=24000`;
        const exRaw = await wikiHttpsGet(extractUrl);
        const exJson = JSON.parse(exRaw);
        const pages = exJson.query && exJson.query.pages ? exJson.query.pages : {};
        const page = pages[Object.keys(pages)[0]];
        if (!page || page.missing || !page.extract || page.extract.trim().length < 50) {
          sendJSON(404, { error: { message: 'Could not read article text — try another title or spelling.' } });
          return;
        }
        sendJSON(200, {
          title: page.title || title,
          extract: page.extract.trim(),
          sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        });
      } catch (e) {
        sendJSON(502, { error: { message: 'Wikipedia request failed: ' + e.message } });
      }
    })();
    return;
  }

  // Mock generator for local testing
  if (req.method === 'POST' && req.url === '/api/mock') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const sample = [
        { question: 'What does HTML stand for?', options: { A: 'HyperText Markup Language', B: 'HighText Machine Language', C: 'Hyperlinks and Text Markup', D: 'None of the above' }, correct: 'A', explanation: 'Standard meaning of HTML', difficulty: 'Easy' },
        { question: 'Which tag creates a hyperlink?', options: { A: '<link>', B: '<a>', C: '<href>', D: '<url>' }, correct: 'B', explanation: 'Anchor tag is <a>', difficulty: 'Easy' }
      ];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sample));
    });
    return;
  }

  // ── POST /api/generate → Gemini API proxy ──
  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {

      if (!GEMINI_API_KEY) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: { message: 'GEMINI_API_KEY is not set. Add it to your .env file.' }
        }));
        return;
      }

      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Invalid JSON in request body.' } }));
        return;
      }

      const userMessage = payload.messages && payload.messages[0] ? payload.messages[0].content : '';

      const geminiBody = JSON.stringify({
        contents: [{
          parts: [{ text: userMessage }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        port:     443,
        path:     `/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
        method:   'POST',
        headers: {
          'Content-Type':      'application/json',
          'Content-Length':    Buffer.byteLength(geminiBody),
        },
      };

      const apiReq = https.request(options, apiRes => {
        let data = '';
        apiRes.on('data', chunk => { data += chunk; });
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (apiRes.statusCode !== 200) {
               res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
               return res.end(JSON.stringify({ error: { message: parsed.error?.message || 'Gemini API Error' } }));
            }
            const textResponse = parsed.candidates[0].content.parts[0].text;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              content: [{ text: textResponse }]
            }));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: 'Failed to parse Gemini response.' } }));
          }
        });
      });

      apiReq.on('error', err => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Failed to reach Gemini API: ' + err.message } }));
      });

      apiReq.write(geminiBody);
      apiReq.end();
    });
    return;
  }

    // ── Simple file-backed data endpoints ──
    // GET  /api/data  -> returns JSON stored in resp.json
    // POST /api/data  -> writes JSON body to resp.json
    if (req.url === '/api/data' && req.method === 'GET') {
      fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({}));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      });
      return;
    }
    if (req.url === '/api/data' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          fs.writeFile(DATA_FILE, JSON.stringify(parsed, null, 2), 'utf8', err => {
            if (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: 'Failed to write data' }));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          });
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

  // ── 404 ──
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// (end of file-backed endpoints)

server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║      🧩  QuizForge Server Ready       ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`\n   → App URL  : http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) {
    console.log('\n   ⚠️  WARNING: GEMINI_API_KEY is not set!');
    console.log('   → AI generation will use offline fallback.');
    console.log('   → Add your key to .env to enable Gemini AI.\n');
  } else {
    console.log('   → Gemini AI : ✅ Connected\n');
  }
  console.log('   Press Ctrl+C to stop.\n');
});