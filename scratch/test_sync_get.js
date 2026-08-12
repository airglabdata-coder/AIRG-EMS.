const http = require('http');

http.get('http://localhost:5000/api/sync', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('GET /api/sync SUCCESS!');
      console.log('Employees count:', json.state?.employees?.length);
      console.log('Trainer reports count:', json.state?.trainerReports?.length);
    } catch(e) {
      console.error('Parse error:', e.message, data.slice(0, 200));
    }
  });
}).on('error', (err) => {
  console.error('HTTP GET Error:', err.message);
});
