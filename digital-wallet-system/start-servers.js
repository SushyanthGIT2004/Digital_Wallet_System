const { exec } = require('child_process');
const path = require('path');

// Start API server (runs on port 3000)
const apiServer = exec('node api-server.js');
apiServer.stdout.pipe(process.stdout);
apiServer.stderr.pipe(process.stderr);

console.log('Starting API server on port 3000...');

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down API server...');
  apiServer.kill();
  process.exit(0);
}); 