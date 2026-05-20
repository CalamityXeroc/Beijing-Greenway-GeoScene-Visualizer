import http from 'http';

// Make a simple HTTP request to test if the tile endpoint works
const makeRequest = () => {
  const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/tiles/gaode/8/1/1/1',
    method: 'GET',
    timeout: 5000
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      resolve({
        status: res.statusCode,
        contentType: res.headers['content-type']
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
};

makeRequest()
  .then(result => {
    console.log('HTTP Status:', result.status);
    console.log('Content-Type:', result.contentType);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
