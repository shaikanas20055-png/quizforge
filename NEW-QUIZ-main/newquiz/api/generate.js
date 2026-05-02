export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.end('Method Not Allowed');
    return;
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
  if (!GEMINI_API_KEY) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: { message: 'GEMINI_API_KEY is not set. Add it in Vercel project environment variables.' }
    }));
    return;
  }

  const payload = typeof req.body === 'object' && req.body ? req.body : {};
  const userMessage = payload.messages && payload.messages[0] ? payload.messages[0].content : '';

  const geminiBody = JSON.stringify({
    contents: [{ parts: [{ text: userMessage }] }],
    generationConfig: { responseMimeType: 'application/json' }
  });

  try {
    const fetchRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody
      }
    );

    const text = await fetchRes.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'Failed to parse Gemini response.' } }));
      return;
    }

    if (!fetchRes.ok) {
      res.statusCode = fetchRes.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: parsed.error?.message || 'Gemini API Error' } }));
      return;
    }

    const textResponse = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ content: [{ text: textResponse }] }));
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: { message: 'Failed to reach Gemini API: ' + err.message } }));
  }
}
