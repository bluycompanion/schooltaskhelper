const { openDb, runMigrations } = require('./db');
const { createApp } = require('./app');

const db = openDb();
runMigrations(db);
const app = createApp(db);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
