const fs = require('fs');
const path = require('path');
const { openDb, runMigrations } = require('./db');
const { createApp } = require('./app');

const db = openDb();
runMigrations(db);
const app = createApp(db);
const distWebDir = path.join(__dirname, '..', 'dist', 'web');
const hasFrontendBuild = fs.existsSync(path.join(distWebDir, 'index.html'));

app.get('/health', (_req, res) => {
  res.json({ ok: true, frontend: hasFrontendBuild, timestamp: new Date().toISOString() });
});

if (hasFrontendBuild) {
  app.use(expressStaticMiddleware(distWebDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (!req.accepts('html')) return next();
    if (req.path === '/health' || req.path.startsWith('/tasks') || req.path.startsWith('/children') || req.path.startsWith('/agent')) return next();
    return res.sendFile(path.join(distWebDir, 'index.html'));
  });
}

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API listening on ${port}`);
  if (hasFrontendBuild) {
    console.log(`Serving frontend build from ${distWebDir}`);
  }
});

function expressStaticMiddleware(rootDir) {
  const express = require('express');
  return express.static(rootDir, { index: false });
}
