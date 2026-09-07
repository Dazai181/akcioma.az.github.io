fetch('https://akcioma-az-github-io.onrender.com/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mobile: '+994515608025', password: 'admin1234' })
}).then(async r => {
  console.log(r.status);
  console.log(await r.text());
}).catch(console.error);
