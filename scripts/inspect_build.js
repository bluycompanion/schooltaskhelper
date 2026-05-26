const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '..', 'dist', 'web', 'assets', 'index-CM0xaIII.js');
if (!fs.existsSync(jsPath)) {
  console.log('File not found:', jsPath);
  process.exit(1);
}

const content = fs.readFileSync(jsPath, 'utf8');

// Find all matches for things looking like baseUrls or vite env
console.log('File size:', content.length);

// Search for patterns
const regexes = [
  /baseUrl/gi,
  /VITE_/gi,
  /apiBaseUrl/gi,
  /tasks/gi,
  /children/gi
];

for (const regex of regexes) {
  const matches = content.match(regex);
  console.log(`Pattern ${regex}: ${matches ? matches.length : 0} matches`);
}

// Find a snippet around "VITE_API_BASE_URL" or config
const idx = content.indexOf('VITE_');
if (idx !== -1) {
  console.log('Found VITE_ at index', idx);
  console.log('Snippet:', content.substring(idx - 100, idx + 100));
} else {
  console.log('VITE_ not found in file');
}

// Let's find tasks
const idxTasks = content.indexOf('/tasks');
if (idxTasks !== -1) {
  console.log('Found /tasks at index', idxTasks);
  console.log('Snippet:', content.substring(idxTasks - 50, idxTasks + 50));
}

// Let's search for fetch
const idxFetch = content.indexOf('fetch');
if (idxFetch !== -1) {
  console.log('Found fetch at index', idxFetch);
  console.log('Snippet:', content.substring(idxFetch - 50, idxFetch + 50));
}
