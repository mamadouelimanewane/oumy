const db = require('./database');

// 50 plats réparties dans plus de 10 catégories avec de belles images Unsplash et prix en CFA
const plats = [
  { rest: 1, name: "Le Classique", desc: "Steak haché pur bœuf, cheddar, salade, tomate", price: 3500, img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80", cat: "Fast Food" },
  { rest: 2, name: "Tiep Bou Dien Rouge", desc: "Le plat national sénégalais avec du poisson et riz rouge", price: 3000, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Sénégalais" },
  { rest: 1, name: "Pizza Margherita", desc: "Sauce tomate, mozzarella fraîche, basilic", price: 5000, img: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500&q=80", cat: "Pizza" },
  { rest: 2, name: "Jus de Bissap", desc: "Délicieux jus d'hibiscus rafraîchissant", price: 1000, img: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80", cat: "Jus Locaux" },
  { rest: 1, name: "Dibi Agneau", desc: "Agneau grillé au feu de bois avec oignons", price: 7000, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Grillades" },
  { rest: 2, name: "Sushi Maki Saumon", desc: "8 pièces de maki saumon frais", price: 6500, img: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&q=80", cat: "Asiatique" },
  { rest: 1, name: "Salade César", desc: "Laitue, poulet grillé, croûtons, parmesan", price: 4000, img: "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=500&q=80", cat: "Salades" },
  { rest: 2, name: "Thiéré (Couscous)", desc: "Couscous sénégalais au poulet", price: 4500, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Sénégalais" },
  { rest: 1, name: "Chawarma Poulet", desc: "Pain libanais, poulet mariné, toum", price: 2500, img: "https://images.unsplash.com/photo-1648823153744-8bc5e10e19cd?w=500&q=80", cat: "Chawarma" },
  { rest: 2, name: "Tiramisu", desc: "Dessert italien au café et mascarpone", price: 3000, img: "https://images.unsplash.com/photo-1571115177098-24de81b53e7f?w=500&q=80", cat: "Desserts" },
  { rest: 1, name: "Yassa Poulet", desc: "Poulet mariné au citron et oignons", price: 3500, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Sénégalais" },
  { rest: 2, name: "Double Cheese", desc: "Double steak bœuf, double cheddar tondant", price: 4500, img: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=500&q=80", cat: "Fast Food" },
  { rest: 1, name: "Smoothie Mangue", desc: "Jus mangue passion ananas", price: 2000, img: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=500&q=80", cat: "Jus Locaux" },
  { rest: 2, name: "Pizza 4 Fromages", desc: "Mozzarella, chèvre, emmental, gorgonzola", price: 6500, img: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80", cat: "Pizza" },
  { rest: 1, name: "Ramen Boeuf", desc: "Nouilles japonaises avec bouillon", price: 5000, img: "https://images.unsplash.com/photo-1552611052-33e04de081de?w=500&q=80", cat: "Asiatique" },
  { rest: 2, name: "Nems Poulet", desc: "4 Nems croustillants faits maison", price: 2500, img: "https://images.unsplash.com/photo-1543826173-1beeb97525d8?w=500&q=80", cat: "Asiatique" },
  { rest: 1, name: "Fondant Chocolat", desc: "Cœur coulant au chocolat noir", price: 2500, img: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=500&q=80", cat: "Desserts" },
  { rest: 2, name: "Jus de Bouye", desc: "Jus de pain de singe crémeux", price: 1000, img: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80", cat: "Jus Locaux" },
  { rest: 1, name: "Lakh", desc: "Dessert traditionnel sénégalais", price: 1500, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Desserts" },
  { rest: 2, name: "Brochettes Boeuf", desc: "3 belles brochettes avec frites", price: 4500, img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&q=80", cat: "Grillades" },
  { rest: 1, name: "Poulet Braisé", desc: "Demi poulet entier grillé, aloko", price: 6000, img: "https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?w=500&q=80", cat: "Grillades" },
  { rest: 2, name: "Salade Niçoise", desc: "Thon, olives, oeuf dur", price: 3500, img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80", cat: "Salades" },
  { rest: 1, name: "Thiof Braisé", desc: "Poisson entier braisé du port", price: 9000, img: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80", cat: "Grillades" },
  { rest: 2, name: "Crevettes sautées", desc: "Crevettes sautées à l'ail", price: 7000, img: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&q=80", cat: "Asiatique" },
  { rest: 1, name: "Tacos Viande Hachée", desc: "Tacos français XL, sauce fromagère", price: 3500, img: "https://images.unsplash.com/photo-1623653387945-2fd25214f8fc?w=500&q=80", cat: "Fast Food" },
  { rest: 2, name: "Frites Maison", desc: "Portion de frites dorées", price: 1000, img: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500&q=80", cat: "Fast Food" },
  { rest: 1, name: "Pizza Reine", desc: "Tomate, jambon, champignons", price: 5500, img: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500&q=80", cat: "Pizza" },
  { rest: 2, name: "Jus de Gingembre", desc: "Gingembre, citron, menthe", price: 1000, img: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80", cat: "Jus Locaux" },
  { rest: 1, name: "Glace Vanille", desc: "Coupe de 2 boules", price: 2000, img: "https://images.unsplash.com/photo-1563805042-7684c8e9e533?w=500&q=80", cat: "Desserts" },
  { rest: 2, name: "Yassa Poisson", desc: "Poisson mariné au citron", price: 3500, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Sénégalais" },
  { rest: 1, name: "Maffe Boeuf", desc: "Sauce à la pâte d'arachide", price: 3000, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Sénégalais" },
  { rest: 2, name: "Caldou", desc: "Plat du sud léger au poisson avec sauce gombo", price: 3500, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Sénégalais" },
  { rest: 1, name: "Soupe Kandia", desc: "Sauce gombo à l'huile de palme", price: 3000, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Sénégalais" },
  { rest: 2, name: "Burger Poulet", desc: "Filet de poulet croustillant", price: 3500, img: "https://images.unsplash.com/photo-1610440042657-612c34d95e9f?w=500&q=80", cat: "Fast Food" },
  { rest: 1, name: "Wrap Poulet", desc: "Galette de maïs, poulet, crudités", price: 3000, img: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=500&q=80", cat: "Fast Food" },
  { rest: 2, name: "Pizza Saumon", desc: "Crème fraîche, saumon fumé", price: 7000, img: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80", cat: "Pizza" },
  { rest: 1, name: "Riz Cantonais", desc: "Riz frit avec porc/poulet, petits pois", price: 4000, img: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&q=80", cat: "Asiatique" },
  { rest: 2, name: "Salade Quinoa", desc: "Quinoa, avocat, tomate, poulet", price: 4500, img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80", cat: "Salades" },
  { rest: 1, name: "Chawarma Boeuf", desc: "Viande de boeuf marinée à la broche", price: 2500, img: "https://images.unsplash.com/photo-1648823153744-8bc5e10e19cd?w=500&q=80", cat: "Chawarma" },
  { rest: 2, name: "Crêpe au Chocolat", desc: "Crêpe fondante", price: 1500, img: "https://images.unsplash.com/photo-1519676867240-f03562e64548?w=500&q=80", cat: "Desserts" },
  { rest: 1, name: "Dibi Poulet", desc: "Poulet grillé coupé au couteau", price: 5000, img: "https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?w=500&q=80", cat: "Grillades" },
  { rest: 2, name: "Jus de Ditakh", desc: "Jus du fruit sauvage sénégalais", price: 1000, img: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80", cat: "Jus Locaux" },
  { rest: 1, name: "Tiep Bou Dien Blanc", desc: "Riz blanc avec poisson et légumes", price: 3000, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Sénégalais" },
  { rest: 2, name: "Giga Burger", desc: "Burger à 3 étages", price: 6000, img: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=500&q=80", cat: "Fast Food" },
  { rest: 1, name: "Pizza Calzone", desc: "Pizza fermée en chausson", price: 6000, img: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500&q=80", cat: "Pizza" },
  { rest: 2, name: "Poulet DG", desc: "Spécialité avec bananes plantains", price: 5000, img: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=500&q=80", cat: "Sénégalais" },
  { rest: 1, name: "Pad Thaï", desc: "Nouilles avec crevettes et cacahuètes", price: 5500, img: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=500&q=80", cat: "Asiatique" },
  { rest: 2, name: "Salade Végé", desc: "Assortiment de légumes frais", price: 3000, img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80", cat: "Salades" },
  { rest: 1, name: "Beignets Douceurs", desc: "8 petits beignets au sucre", price: 1000, img: "https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", cat: "Desserts" },
  { rest: 2, name: "Jus de Tamarin", desc: "Daxaar acidulé et sucré", price: 1000, img: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80", cat: "Jus Locaux" }
];

setTimeout(() => {
  db.serialize(() => {
    console.log('🌱 Démarrage du Seeding (50 Plats)...');

    db.run("DELETE FROM users");
    db.run("DELETE FROM menu_items");
    db.run("DELETE FROM orders");

    const stmtUsers = db.prepare("INSERT INTO users (role, name, phone, password, address) VALUES (?, ?, ?, ?, ?)");
    stmtUsers.run(['restaurant', 'Chef Ousmane (Dark Kitchen)', '+221771234567', 'pass123', 'Plateau, Dakar']);
    stmtUsers.run(['restaurant', 'Sen Burger Dakar', '+221771234568', 'pass123', 'Mermoz, Dakar']);
    stmtUsers.run(['livreur', 'Modou Ndiaye', '+221773322111', 'pass123', 'Dakar']);
    stmtUsers.run(['client', 'Oumy D.', '+221779988776', 'pass123', 'Almadies, Dakar']);
    stmtUsers.finalize();

    const stmtMenu = db.prepare("INSERT INTO menu_items (restaurant_id, name, description, price, image_url, category) VALUES (?, ?, ?, ?, ?, ?)");
    plats.forEach(p => {
      stmtMenu.run([p.rest, p.name, p.desc, p.price, p.img, p.cat]);
    });
    stmtMenu.finalize();

    const stmtOrders = db.prepare("INSERT INTO orders (client_id, restaurant_id, status, total_amount, payment_method, payment_status, delivery_address) VALUES (?, ?, ?, ?, ?, ?, ?)");
    stmtOrders.run([4, 1, 'nouvelle', 8000, 'wave', 'paye', 'Almadies, Dakar']);
    stmtOrders.finalize();

    console.log('✅ 50 plats injectés avec succès dans la base de données !');
  });
}, 1000);
