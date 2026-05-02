const http = require('http');
const data = JSON.stringify({ messages:[{role:'user',content:'Hello test'}] });
const options = { hostname: 'localhost', port: 3000, path: '/api/mock', method: 'POST', headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)} };
const req = http.request(options, res => {
  console.log('STATUS', res.statusCode);
  let body='';
  res.on('data', chunk=>body+=chunk);
  res.on('end', ()=>{
    console.log('BODY:\n', body);
  });
});
req.on('error', e=>{ console.error('REQERR', e.message); });
req.write(data); req.end();
