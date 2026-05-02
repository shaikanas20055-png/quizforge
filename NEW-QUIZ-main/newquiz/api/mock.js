export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.end('Method Not Allowed');
    return;
  }

  const sample = [
    { question: 'What does HTML stand for?', options: { A: 'HyperText Markup Language', B: 'HighText Machine Language', C: 'Hyperlinks and Text Markup', D: 'None of the above' }, correct: 'A', explanation: 'Standard meaning of HTML', difficulty: 'Easy' },
    { question: 'Which tag creates a hyperlink?', options: { A: '<link>', B: '<a>', C: '<href>', D: '<url>' }, correct: 'B', explanation: 'Anchor tag is <a>', difficulty: 'Easy' }
  ];

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(sample));
}
