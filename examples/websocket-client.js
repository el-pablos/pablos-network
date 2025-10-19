// Pablos Network - WebSocket Client Example
// Run with: node examples/websocket-client.js

const io = require('socket.io-client');

const GATEWAY_WS = 'http://localhost:4000/ws';

console.log('🔌 Connecting to Pablos Network WebSocket...');

const socket = io(GATEWAY_WS, {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket');
  console.log('   Socket ID:', socket.id);
  console.log('');
  console.log('📡 Listening for events...');
  console.log('');
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from WebSocket');
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

// Listen for job updates
socket.on('job:update', (job) => {
  console.log('📊 Job Update:');
  console.log('   Job ID:', job.jobId);
  console.log('   Status:', job.status);
  console.log('   Progress:', job.progress + '%');
  if (job.message) {
    console.log('   Message:', job.message);
  }
  console.log('');
});

// Listen for new findings
socket.on('finding:new', (finding) => {
  console.log('🔍 New Finding:');
  console.log('   Title:', finding.title);
  console.log('   Severity:', finding.severity);
  console.log('   Category:', finding.category);
  console.log('   Provider:', finding.provider);
  console.log('   Target:', finding.targetFqdn);
  console.log('');
});

// Listen for job logs
socket.on('job:log', ({ jobId, log, timestamp }) => {
  console.log(`📝 [${jobId}] ${log}`);
});

// Example: Subscribe to specific job
// Uncomment and replace with actual job ID
// const jobId = 'your-job-id-here';
// socket.emit('subscribe:job', { jobId });
// console.log(`📬 Subscribed to job: ${jobId}`);

// Example: Cancel a job
// socket.emit('job:cancel', { jobId: 'your-job-id', provider: 'dirsearch' });

// Keep process running
process.on('SIGINT', () => {
  console.log('');
  console.log('👋 Disconnecting...');
  socket.disconnect();
  process.exit(0);
});

console.log('💡 Tip: Start a scan in another terminal to see real-time updates');
console.log('   Example: curl -X POST http://localhost:4000/scan/passive -d \'{"domain":"example.com"}\'');
console.log('');
console.log('Press Ctrl+C to exit');

