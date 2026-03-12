const db = require('./database');

// Attendre que la DB soit connectée avant de lancer le seed
setTimeout(() => {
  db.serialize(() => {
    console.log('🌱 Démarrage du Seeding de la Base de Données...');

    // 1. Vider les tables
    db.run("DELETE FROM users");
    db.run("DELETE FROM menu_items");
    db.run("DELETE FROM orders");

    // 2. Insérer des utilisateurs (Restaurants, Livreurs, Clients)
    const stmtUsers = db.prepare("INSERT INTO users (role, name, phone, password, address) VALUES (?, ?, ?, ?, ?)");
    
    // Restaurants
    stmtUsers.run(['restaurant', 'Chef Ousmane (Dark Kitchen)', '+221771234567', 'pass123', 'Plateau, Dakar']);
    stmtUsers.run(['restaurant', 'Sen Burger Dakar', '+221771234568', 'pass123', 'Mermoz, Dakar']);
    
    // Livreurs
    stmtUsers.run(['livreur', 'Modou Ndiaye', '+221773322111', 'pass123', 'Dakar']);
    stmtUsers.run(['livreur', 'Cheikh Fall', '+221773322112', 'pass123', 'Dakar']);

    // Clients
    stmtUsers.run(['client', 'Oumy D.', '+221779988776', 'pass123', 'Almadies, Dakar']);
    stmtUsers.run(['client', 'Client Test', '+221770000000', 'pass123', 'Ouakam, Dakar']);

    stmtUsers.finalize();

    // 3. Insérer des plats pour le Chef Ousmane (restaurant_id 1 supposé)
    const stmtMenu = db.prepare("INSERT INTO menu_items (restaurant_id, name, description, price, category) VALUES (?, ?, ?, ?, ?)");
    stmtMenu.run([1, 'Burger Classique', 'Délicieux burger avec frites', 4500, 'Fast Food']);
    stmtMenu.run([1, 'Tiep Bou Dien', 'Plat de résistance', 3500, 'Plats Locaux']);
    stmtMenu.run([2, 'Pizza Margherita', 'Pizza authentique', 6000, 'Pizza']);
    stmtMenu.finalize();

    // 4. Insérer quelques commandes simulées
    const stmtOrders = db.prepare("INSERT INTO orders (client_id, restaurant_id, status, total_amount, payment_method, payment_status, delivery_address) VALUES (?, ?, ?, ?, ?, ?, ?)");
    // Commande nouvelle
    stmtOrders.run([5, 1, 'nouvelle', 8000, 'wave', 'paye', 'Almadies, Dakar']);
    // Commande en préparation
    stmtOrders.run([6, 2, 'preparation', 6000, 'orange_money', 'paye', 'Ouakam, Dakar']);

    stmtOrders.finalize();

    console.log('✅ Seeding terminé avec succès. Les fausses données sont injectées !');
  });
}, 1000);
