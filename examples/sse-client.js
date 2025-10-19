// Pablos Network - SSE (Server-Sent Events) Client Example
// Run with: node examples/sse-client.js <job-id>

const https = require('https');
const http = require('http');

const jobId = process.argv[2];

if (!jobId) {
  console.error('Usage: node sse-client.js <job-id>');
  console.error('');
  console.error('Example:');
  console.error('  1. Start a scan: curl -X POST http://localhost:4000/scan/passive -d \'{"domain":"example.com"}\'');
  console.error('  2. Copy a job ID from the response');
  console.error('  3. Run: node sse-client.js <job-id>');
  process.exit(1);
}

const url = `http://localhost:4000/progress/stream?jobId=${jobId}`;

console.log('📡 Connecting to SSE stream...');
console.log('   URL:', url);
console.log('   Job ID:', jobId);
console.log('');

const client = http.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error('❌ Failed to connect:', res.statusCode, res.statusMessage);
    process.exit(1);
  }

  console.log('✅ Connected to SSE stream');
  console.log('');
  console.log('📊 Progress updates:');
  console.log('');

  let buffer = '';

  res.on('data', (chunk) => {
    buffer += chunk.toString();

    // Process complete messages
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || ''; // Keep incomplete message in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.substring(6);
        try {
          const event = JSON.parse(data);

          if (event.type === 'connected') {
            console.log('🔗 Stream connected');
          } else if (event.type === 'progress') {
            const timestamp = new Date(event.timestamp).toLocaleTimeString();
            const progressBar = '█'.repeat(Math.floor(event.value / 5)) + '░'.repeat(20 - Math.floor(event.value / 5));
            console.log(`[${timestamp}] ${progressBar} ${event.value}%`);

            if (event.value >= 100) {
              console.log('');
              console.log('✅ Job completed!');
              console.log('');
              console.log('Next steps:');
              console.log(`  - View findings: curl http://localhost:4000/findings?jobId=${jobId}`);
              console.log('');
              process.exit(0);
            }
          }
        } catch (error) {
          console.error('Failed to parse event:', data);
        }
      }
    }
  });

  res.on('end', () => {
    console.log('');
    console.log('📡 Stream ended');
  });

  res.on('error', (error) => {
    console.error('❌ Stream error:', error.message);
  });
});

client.on('error', (error) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('');
  console.log('👋 Disconnecting...');
  client.destroy();
  process.exit(0);
});

console.log('Press Ctrl+C to exit');

