const db = require('./database');
db.all("SELECT id, name, role FROM users", [], (err, rows) => {
  if (err) console.error(err);
  console.log("Utilisateurs dans la base:", JSON.stringify(rows, null, 2));
  process.exit(0);
});
