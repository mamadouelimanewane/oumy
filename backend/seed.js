/**
 * 🌱 SenFood Seed - Compatible PostgreSQL et SQLite
 * Usage: node seed.js
 */

const bcrypt = require('bcrypt');
const { pool, initDatabase } = require('./config/database');

const plats = [
  { rest: 1, name: "Le Classique", desc: "Steak hache pur boeuf, cheddar, salade, tomate", price: 3500, img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80", cat: "Fast Food" },
  { rest: 2, name: "Tiep Bou Dien Rouge", desc: "Le plat national senegalais avec du poisson et riz rouge", price: 3000, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Senegalais" },
  { rest: 1, name: "Pizza Margherita", desc: "Sauce tomate, mozzarella fraiche, basilic", price: 5000, img: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500&q=80", cat: "Pizza" },
  { rest: 2, name: "Jus de Bissap", desc: "Delicieux jus d'hibiscus rafraichissant", price: 1000, img: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80", cat: "Jus Locaux" },
  { rest: 1, name: "Dibi Agneau", desc: "Agneau grille au feu de bois avec oignons", price: 7000, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Grillades" },
  { rest: 2, name: "Sushi Maki Saumon", desc: "8 pieces de maki saumon frais", price: 6500, img: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&q=80", cat: "Asiatique" },
  { rest: 1, name: "Salade Cesar", desc: "Laitue, poulet grille, croutons, parmesan", price: 4000, img: "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=500&q=80", cat: "Salades" },
  { rest: 2, name: "Thiere (Couscous)", desc: "Couscous senegalais au poulet", price: 4500, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Senegalais" },
  { rest: 1, name: "Chawarma Poulet", desc: "Pain libanais, poulet marine, toum", price: 2500, img: "https://images.unsplash.com/photo-1648823153744-8bc5e10e19cd?w=500&q=80", cat: "Chawarma" },
  { rest: 2, name: "Tiramisu", desc: "Dessert italien au cafe et mascarpone", price: 3000, img: "https://images.unsplash.com/photo-1571115177098-24de81b53e7f?w=500&q=80", cat: "Desserts" },
  { rest: 1, name: "Yassa Poulet", desc: "Poulet marine au citron et oignons", price: 3500, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Senegalais" },
  { rest: 2, name: "Double Cheese", desc: "Double steak boeuf, double cheddar fondant", price: 4500, img: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=500&q=80", cat: "Fast Food" },
  { rest: 1, name: "Smoothie Mangue", desc: "Jus mangue passion ananas", price: 2000, img: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=500&q=80", cat: "Jus Locaux" },
  { rest: 2, name: "Pizza 4 Fromages", desc: "Mozzarella, chevre, emmental, gorgonzola", price: 6500, img: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80", cat: "Pizza" },
  { rest: 1, name: "Ramen Boeuf", desc: "Nouilles japonaises avec bouillon", price: 5000, img: "https://images.unsplash.com/photo-1552611052-33e04de081de?w=500&q=80", cat: "Asiatique" },
  { rest: 2, name: "Nems Poulet", desc: "4 Nems croustillants faits maison", price: 2500, img: "https://images.unsplash.com/photo-1543826173-1beeb97525d8?w=500&q=80", cat: "Asiatique" },
  { rest: 1, name: "Fondant Chocolat", desc: "Coeur coulant au chocolat noir", price: 2500, img: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=500&q=80", cat: "Desserts" },
  { rest: 2, name: "Jus de Bouye", desc: "Jus de pain de singe cremeux", price: 1000, img: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80", cat: "Jus Locaux" },
  { rest: 1, name: "Lakh", desc: "Dessert traditionnel senegalais", price: 1500, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Desserts" },
  { rest: 2, name: "Brochettes Boeuf", desc: "3 belles brochettes avec frites", price: 4500, img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&q=80", cat: "Grillades" },
  { rest: 1, name: "Poulet Braise", desc: "Demi poulet entier grille, aloko", price: 6000, img: "https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?w=500&q=80", cat: "Grillades" },
  { rest: 2, name: "Salade Nicoise", desc: "Thon, olives, oeuf dur", price: 3500, img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80", cat: "Salades" },
  { rest: 1, name: "Thiof Braise", desc: "Poisson entier braise du port", price: 9000, img: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80", cat: "Grillades" },
  { rest: 2, name: "Crevettes sautees", desc: "Crevettes sautees a l'ail", price: 7000, img: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&q=80", cat: "Asiatique" },
  { rest: 1, name: "Tacos Viande Hachee", desc: "Tacos francais XL, sauce fromagere", price: 3500, img: "https://images.unsplash.com/photo-1623653387945-2fd25214f8fc?w=500&q=80", cat: "Fast Food" },
  { rest: 2, name: "Frites Maison", desc: "Portion de frites dorees", price: 1000, img: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500&q=80", cat: "Fast Food" },
  { rest: 1, name: "Pizza Reine", desc: "Tomate, jambon, champignons", price: 5500, img: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500&q=80", cat: "Pizza" },
  { rest: 2, name: "Jus de Gingembre", desc: "Gingembre, citron, menthe", price: 1000, img: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80", cat: "Jus Locaux" },
  { rest: 1, name: "Glace Vanille", desc: "Coupe de 2 boules", price: 2000, img: "https://images.unsplash.com/photo-1563805042-7684c8e9e533?w=500&q=80", cat: "Desserts" },
  { rest: 2, name: "Yassa Poisson", desc: "Poisson marine au citron", price: 3500, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Senegalais" },
  { rest: 1, name: "Maffe Boeuf", desc: "Sauce a la pate d'arachide", price: 3000, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Senegalais" },
  { rest: 2, name: "Caldou", desc: "Plat du sud leger au poisson avec sauce gombo", price: 3500, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Senegalais" },
  { rest: 1, name: "Soupe Kandia", desc: "Sauce gombo a l'huile de palme", price: 3000, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Senegalais" },
  { rest: 2, name: "Burger Poulet", desc: "Filet de poulet croustillant", price: 3500, img: "https://images.unsplash.com/photo-1610440042657-612c34d95e9f?w=500&q=80", cat: "Fast Food" },
  { rest: 1, name: "Wrap Poulet", desc: "Galette de mais, poulet, crudites", price: 3000, img: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=500&q=80", cat: "Fast Food" },
  { rest: 2, name: "Pizza Saumon", desc: "Creme fraiche, saumon fume", price: 7000, img: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80", cat: "Pizza" },
  { rest: 1, name: "Riz Cantonais", desc: "Riz frit avec porc/poulet, petits pois", price: 4000, img: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&q=80", cat: "Asiatique" },
  { rest: 2, name: "Salade Quinoa", desc: "Quinoa, avocat, tomate, poulet", price: 4500, img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80", cat: "Salades" },
  { rest: 1, name: "Chawarma Boeuf", desc: "Viande de boeuf marinee a la broche", price: 2500, img: "https://images.unsplash.com/photo-1648823153744-8bc5e10e19cd?w=500&q=80", cat: "Chawarma" },
  { rest: 2, name: "Crepe au Chocolat", desc: "Crepe fondante", price: 1500, img: "https://images.unsplash.com/photo-1519676867240-f03562e64548?w=500&q=80", cat: "Desserts" },
  { rest: 1, name: "Dibi Poulet", desc: "Poulet grille coupe au couteau", price: 5000, img: "https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?w=500&q=80", cat: "Grillades" },
  { rest: 2, name: "Jus de Ditakh", desc: "Jus du fruit sauvage senegalais", price: 1000, img: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80", cat: "Jus Locaux" },
  { rest: 1, name: "Tiep Bou Dien Blanc", desc: "Riz blanc avec poisson et legumes", price: 3000, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Senegalais" },
  { rest: 2, name: "Giga Burger", desc: "Burger a 3 etages", price: 6000, img: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=500&q=80", cat: "Fast Food" },
  { rest: 1, name: "Pizza Calzone", desc: "Pizza fermee en chausson", price: 6000, img: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500&q=80", cat: "Pizza" },
  { rest: 2, name: "Poulet DG", desc: "Specialite avec bananes plantains", price: 5000, img: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=500&q=80", cat: "Senegalais" },
  { rest: 1, name: "Pad Thai", desc: "Nouilles avec crevettes et cacahuetes", price: 5500, img: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=500&q=80", cat: "Asiatique" },
  { rest: 2, name: "Salade Vege", desc: "Assortiment de legumes frais", price: 3000, img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80", cat: "Salades" },
  { rest: 1, name: "Beignets Douceurs", desc: "8 petits beignets au sucre", price: 1000, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Desserts" },
  { rest: 2, name: "Jus de Tamarin", desc: "Daxaar acidule et sucre", price: 1000, img: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80", cat: "Jus Locaux" }
];

const users = [
  { role: 'restaurant', name: 'Chef Ousmane (Dark Kitchen)', phone: '+221771234567', password: 'pass123', address: 'Plateau, Dakar', lat: 14.6937, lng: -17.4441 },
  { role: 'restaurant', name: 'Sen Burger Dakar', phone: '+221771234568', password: 'pass123', address: 'Mermoz, Dakar', lat: 14.6928, lng: -17.4660 },
  { role: 'livreur', name: 'Modou Ndiaye', phone: '+221773322111', password: 'pass123', address: 'Dakar', lat: 14.7167, lng: -17.4677 },
  { role: 'client', name: 'Oumy D.', phone: '+221779988776', password: 'pass123', address: 'Almadies, Dakar', lat: 14.7445, lng: -17.5134 },
  { role: 'admin', name: 'Admin SenFood', phone: '+221770000001', password: 'admin123', address: 'Dakar, Senegal', lat: 14.6937, lng: -17.4441 },
];

async function seed() {
  console.log('🌱 SenFood Seed');
  console.log('=====================================\n');

  try {
    console.log('📦 Initialisation des tables...');
    await initDatabase();

    // Petit delai pour s'assurer que SQLite est pret
    await new Promise(r => setTimeout(r, 500));

    // Nettoyer les tables
    console.log('🧹 Nettoyage...');
    const tables = ['chat_messages', 'loyalty_points', 'referrals', 'user_addresses', 'ratings', 'favorites', 'notifications', 'order_items', 'courier_locations', 'orders', 'menu_items', 'restaurant_hours', 'promotions', 'users'];
    for (const t of tables) {
      try { await pool.query(`DELETE FROM ${t}`); } catch(e) { /* table might not exist yet */ }
    }

    // Creer les utilisateurs et stocker les IDs des restaurants
    console.log('👤 Creation des utilisateurs...');
    const restaurantIds = {}; // Map: Nom resto -> ID réel en DB
    
    for (const u of users) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      const result = await pool.query(
        `INSERT INTO users (role, name, phone, password, address, latitude, longitude, is_active) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id`,
        [u.role, u.name, u.phone, hashedPassword, u.address, u.lat, u.lng, true]
      );
      
      const newId = result.rows[0].id;
      if (u.role === 'restaurant') {
        restaurantIds[u.name] = newId;
      }
      console.log(`   ✅ ${u.role.padEnd(10)} | ${u.name.padEnd(30)} | ID: ${newId}`);
    }
    
    // Inserer les plats en utilisant les bons IDs de resto
    console.log('\n🍽️  Insertion de 50 plats...');
    for (const p of plats) {
      // Determiner le nom du resto (1: Ousmane, 2: Sen Burger)
      const restName = p.rest === 1 ? 'Chef Ousmane (Dark Kitchen)' : 'Sen Burger Dakar';
      const actualRestId = restaurantIds[restName];
      
      const prepTime = Math.floor(Math.random() * 20) + 10;
      await pool.query(
        `INSERT INTO menu_items (restaurant_id, name, description, price, image_url, category, is_available, prep_time_minutes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [actualRestId, p.name, p.desc, p.price, p.img, p.cat, true, prepTime]
      );
    }
    console.log('   ✅ 50 plats inseres avec succès');

    // Horaires
    console.log('\n🕐 Horaires...');
    for (const restName in restaurantIds) {
      const actualRestId = restaurantIds[restName];
      for (let day = 0; day <= 6; day++) {
        await pool.query(
          `INSERT INTO restaurant_hours (restaurant_id, day_of_week, open_time, close_time) VALUES ($1, $2, $3, $4)`,
          [actualRestId, day, '08:00', '23:00']
        );
      }
    }
    console.log('   ✅ Horaires configures (8h-23h, 7j/7)');

    // Recuperer ID client (Oumy D.)
    const clientResult = await pool.query("SELECT id FROM users WHERE role = 'client' LIMIT 1");
    const clientId = clientResult.rows[0].id;
    const restIdForOrder = Object.values(restaurantIds)[0];

    // Commande de test
    console.log('\n📋 Commande de test...');
    const orderResult = await pool.query(
      `INSERT INTO orders (client_id, restaurant_id, status, total_amount, payment_method, payment_status, delivery_address, latitude, longitude) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id`,
      [clientId, restIdForOrder, 'nouvelle', 8000, 'wave', 'paye', 'Almadies, Dakar', 14.7445, -17.5134]
    );
    const orderId = orderResult.rows[0].id;
    
    // Recuperer 2 plats du restIdForOrder
    const itemsResult = await pool.query("SELECT id, price FROM menu_items WHERE restaurant_id = $1 LIMIT 2", [restIdForOrder]);
    for (const item of itemsResult.rows) {
      await pool.query(`INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)`, 
        [orderId, item.id, 1, item.price]);
    }
    console.log('   ✅ Commande #' + orderId + ' creee avec ses articles');

    // Promos
    console.log('\n🎟️  Codes promo...');
    await pool.query(
      `INSERT INTO promotions (code, description, discount_type, discount_value, min_order_amount, max_uses, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['BIENVENUE', 'Premiere commande -15%', 'percentage', 15, 2000, 100, true]
    );
    await pool.query(
      `INSERT INTO promotions (code, description, discount_type, discount_value, min_order_amount, max_uses, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['SENFOOD500', '500 FCFA de reduction', 'fixed', 500, 3000, 50, true]
    );
    console.log('   ✅ BIENVENUE (-15%) et SENFOOD500 (-500 FCFA)');

    console.log('\n=====================================');
    console.log('🎉 Seed termine avec succes !');
    console.log('=====================================\n');
    console.log('📌 IDENTIFIANTS DE CONNEXION :');
    console.log('┌────────────┬──────────────────────────────┬─────────────────┬────────────┐');
    console.log('│ Role       │ Nom                          │ Telephone       │ Mot de passe│');
    console.log('├────────────┼──────────────────────────────┼─────────────────┼────────────┤');
    console.log('│ restaurant │ Chef Ousmane (Dark Kitchen)   │ +221771234567   │ pass123    │');
    console.log('│ restaurant │ Sen Burger Dakar              │ +221771234568   │ pass123    │');
    console.log('│ livreur    │ Modou Ndiaye                  │ +221773322111   │ pass123    │');
    console.log('│ client     │ Oumy D.                       │ +221779988776   │ pass123    │');
    console.log('│ admin      │ Admin SenFood                 │ +221770000001   │ admin123   │');
    console.log('└────────────┴──────────────────────────────┴─────────────────┴────────────┘');
    console.log('\n📌 CODES PROMO : BIENVENUE (-15%) | SENFOOD500 (-500 FCFA)\n');

  } catch (err) {
    console.error('\n❌ Erreur seed:', err.message);
    console.error(err);
  } finally {
    try { await pool.end(); } catch(e) {}
    process.exit(0);
  }
}

seed();
