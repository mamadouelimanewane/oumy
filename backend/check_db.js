const db = require('./database');
db.all("SELECT COUNT(*) as count FROM menu_items", [], (err, rows) => {
  if (err) console.error(err);
  console.log("Nombre de plats dans menu_items:", rows[0].count);
  db.all("SELECT * FROM menu_items LIMIT 5", [], (err, rows) => {
    console.log("Exemple de plats:", JSON.stringify(rows, null, 2));
    process.exit(0);
  });
});
