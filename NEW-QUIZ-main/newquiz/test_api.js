const http = require('http');

const prompt = `You are an expert quiz question generator. Using your internal knowledge base, generate EXACTLY 2 multiple-choice questions about the subject "Quantum Mechanics". You MUST return exactly 2 items in the JSON array — no more, no fewer.\n\nRequirements:\n- Difficulty: Easy\n- Each question has exactly 4 options (A, B, C, D)\n- Only ONE correct answer; distractors must be plausible but clearly wrong\n- Return ONLY a raw JSON array, nothing else — no markdown, no code fences, no explanation\n\nRequired output format (array of exactly 2 objects):\n[{"question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correct":"A","explanation":"Brief reason why this is correct","difficulty":"Easy"}]`;

const data = JSON.stringify({ messages: [{ role: 'user', content: prompt }] });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, res => {
  let responseData = '';
  res.on('data', chunk => { responseData += chunk; });
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', responseData);
  });
});

req.on('error', e => {
  console.error('Request Error:', e.message);
});

req.write(data);
req.end();
