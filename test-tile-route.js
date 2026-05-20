// Quick test script to verify the tile route works
import { spawn } from 'child_process';
import http from 'http';

const serverProcess = spawn('node', ['greenway-backend/src/index.js']);

let stdout = '';
let stderr = '';

serverProcess.stdout.on('data', (data) => {
  stdout += data.toString();
  console.log('[SERVER]', data.toString());
});

serverProcess.stderr.on('data', (data) => {
  stderr += data.toString();
  console.log('[SERVER ERROR]', data.toString());
});

// Wait for server to start, then test the route
setTimeout(() => {
  const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/tiles/gaode/8/1/1/1',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log('\n=== HTTP Response ===');
    console.log('Status:', res.statusCode);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('======================\n');
    
    // Consume the response data
    res.on('data', () => {});
    res.on('end', () => {
      serverProcess.kill();
      process.exit(0);
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error.message);
    serverProcess.kill();
    process.exit(1);
  });

  req.end();
}, 5000);

// Timeout after 15 seconds
setTimeout(() => {
  console.error('Test timeout');
  serverProcess.kill();
  process.exit(1);
}, 15000);
