/**
 * 🌱 NOOR EAT Seed - Compatible PostgreSQL et SQLite
 * Usage: node seed.js
 */

const bcrypt = require('bcrypt');
const { pool, initDatabase } = require('./config/database');

function requireSeedPassword(envVar) {
  const val = process.env[envVar];
  if (!val) {
    throw new Error(`${envVar} n'est pas defini — requis pour seeder les comptes de demo avec un vrai mot de passe (voir .env.example)`);
  }
  return val;
}

const SEED_PASSWORDS = {
  restaurant: requireSeedPassword('SEED_RESTAURANT_PASSWORD'),
  livreur: requireSeedPassword('SEED_LIVREUR_PASSWORD'),
  client: requireSeedPassword('SEED_CLIENT_PASSWORD'),
  admin: requireSeedPassword('SEED_ADMIN_PASSWORD'),
};

// Catalogue complet (12 restaurants Dakar, 81 plats) — porte depuis le catalogue
// client-pwa developpe sur la racine du repo (commits du 11-12/07) qui n'existait
// jusqu'ici que comme fallback statique cote client, jamais comme vraies donnees DB.
const plats = [
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Tiep Bou Dien Rouge', desc: 'Le plat national sénégalais avec du poisson et riz rouge', price: 3000, img: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80', cat: 'Senegalais' },
  { restaurant: 'Sen Burger Dakar', name: 'Pizza Margherita', desc: 'Sauce tomate, mozzarella fraîche, basilic', price: 5000, img: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500&q=80', cat: 'Pizza' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Jus de Bissap', desc: "Délicieux jus d'hibiscus rafraîchissant", price: 1000, img: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80', cat: 'Jus Locaux' },
  { restaurant: 'Sen Burger Dakar', name: 'Dibi Agneau', desc: 'Agneau grillé au feu de bois avec oignons', price: 7000, img: 'https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80', cat: 'Grillades' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Yassa Poulet', desc: 'Poulet mariné à la moutarde et aux oignons caramélisés', price: 3500, img: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c8?w=500&q=80', cat: 'Senegalais' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Thiébou Yapp', desc: 'Riz au bœuf à la sénégalaise avec légumes', price: 3200, img: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=500&q=80', cat: 'Senegalais' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Mafé', desc: "Ragoût de bœuf à la sauce d'arachide", price: 3000, img: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=500&q=80', cat: 'Senegalais' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Domoda', desc: 'Plat traditionnel à la courge et pâte d\'arachide', price: 2800, img: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&q=80', cat: 'Senegalais' },
  { restaurant: 'Sen Burger Dakar', name: 'Chawarma Poulet', desc: 'Poulet grillé, légumes, sauce tahini dans une galette', price: 3500, img: 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=500&q=80', cat: 'Chawarma' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Pastels au Thon', desc: 'Beignets croustillants farcis au thon et légumes', price: 1500, img: 'https://images.unsplash.com/photo-1600803907087-f56d462fd26b?w=500&q=80', cat: 'Senegalais' },
  { restaurant: 'Sen Burger Dakar', name: 'Riz Sauté au Poulet', desc: 'Wok de riz sauté aux légumes et poulet tendre', price: 4000, img: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&q=80', cat: 'Asiatique' },
  { restaurant: 'Sen Burger Dakar', name: 'Nems au Porc', desc: 'Rouleaux de printemps frits, sauce nuoc-mam', price: 3500, img: 'https://images.unsplash.com/photo-1564671165093-20688ff1fffa?w=500&q=80', cat: 'Asiatique' },
  { restaurant: 'Sen Burger Dakar', name: 'Salade César', desc: 'Salade romaine, parmesan, croûtons, sauce César', price: 3200, img: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=500&q=80', cat: 'Salades' },
  { restaurant: 'Sen Burger Dakar', name: 'Pizza Royale', desc: 'Jambon, champignons, mozzarella, sauce tomate', price: 6500, img: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&q=80', cat: 'Pizza' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Jus de Gingembre', desc: 'Jus de gingembre frais, tonique et revigorant', price: 1200, img: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500&q=80', cat: 'Jus Locaux' },
  { restaurant: 'Sen Burger Dakar', name: 'Brochettes de Bœuf', desc: 'Brochettes marinées aux épices et herbes fraîches', price: 5500, img: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=500&q=80', cat: 'Grillades' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Thiakry', desc: 'Couscous de mil au lait caillé et sucre', price: 1500, img: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&q=80', cat: 'Desserts' },
  { restaurant: 'Sen Burger Dakar', name: 'Double Cheese Burger', desc: 'Double steak, double cheddar, bacon croustillant', price: 5500, img: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=500&q=80', cat: 'Fast Food' },
  { restaurant: 'Sen Burger Dakar', name: 'Tacos Sénégalais', desc: 'Galette garnie de poulet braisé, frites et sauce blanche', price: 3500, img: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=500&q=80', cat: 'Fast Food' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Ndambé', desc: 'Haricots rouges mijotés aux épices sénégalaises', price: 1500, img: 'https://images.unsplash.com/photo-1602253057119-44d745d9b860?w=500&q=80', cat: 'Senegalais' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Poulet DG', desc: 'Poulet aux légumes façon camerounaise', price: 5000, img: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=500&q=80', cat: 'Grillades' },
  { restaurant: 'Sen Burger Dakar', name: 'Pizza 4 Fromages', desc: 'Mozzarella, gorgonzola, emmental, chèvre', price: 7000, img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80', cat: 'Pizza' },
  { restaurant: 'Sen Burger Dakar', name: 'Salade Avocat Crevettes', desc: 'Salade fraîche, avocat tranché, crevettes roses', price: 4500, img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80', cat: 'Salades' },
  { restaurant: 'Sen Burger Dakar', name: 'Sushis Mixtes (8 pcs)', desc: 'Assortiment de sushis salmon, thon, crevette', price: 8000, img: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&q=80', cat: 'Asiatique' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Jus de Ditakh', desc: 'Jus de ditakhali, subtil et parfumé', price: 1500, img: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=500&q=80', cat: 'Jus Locaux' },
  { restaurant: 'Sen Burger Dakar', name: 'Chawarma Bœuf', desc: 'Fines tranches de bœuf, houmous, légumes marinés', price: 4000, img: 'https://images.unsplash.com/photo-1561043433-aaf687c4cf04?w=500&q=80', cat: 'Chawarma' },
  { restaurant: 'Sen Burger Dakar', name: 'Churros au Nutella', desc: 'Churros dorés, sauce Nutella pour tremper', price: 2500, img: 'https://images.unsplash.com/photo-1541592553160-82008b127ccb?w=500&q=80', cat: 'Desserts' },
  { restaurant: 'Sen Burger Dakar', name: 'Chicken Wings BBQ', desc: 'Ailes de poulet marinées, sauce BBQ fumée', price: 4500, img: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=500&q=80', cat: 'Fast Food' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Poulet Rôti', desc: 'Poulet fermier rôti, herbes aromatiques, pommes de terre', price: 8000, img: 'https://images.unsplash.com/photo-1528575235951-5eb05e3df20c?w=500&q=80', cat: 'Grillades' },
  { restaurant: 'Sen Burger Dakar', name: 'Pad Thaï', desc: 'Nouilles de riz sautées, crevettes, cacahuètes, citron', price: 5500, img: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=500&q=80', cat: 'Asiatique' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Tiep Bou Dien Blanc', desc: 'Riz blanc au poisson et légumes variés', price: 2800, img: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80', cat: 'Senegalais' },
  { restaurant: 'Sen Burger Dakar', name: 'Falafel Wrap', desc: 'Boulettes de pois chiches, salade, tzatziki', price: 3000, img: 'https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?w=500&q=80', cat: 'Chawarma' },
  { restaurant: 'Sen Burger Dakar', name: 'Pizza Pepperoni', desc: 'Pepperoni généreux, sauce tomate piquante', price: 6000, img: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500&q=80', cat: 'Pizza' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Jus de Baobab', desc: 'Au fruit du baobab, riche en vitamines C', price: 1500, img: 'https://images.unsplash.com/photo-1622597467836-f3e6707f4b0d?w=500&q=80', cat: 'Jus Locaux' },
  { restaurant: 'Sen Burger Dakar', name: 'Glace Artisanale 3 Boules', desc: 'Vanille, caramel, chocolat - fabrication locale', price: 2500, img: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=500&q=80', cat: 'Desserts' },
  { restaurant: 'Sen Burger Dakar', name: 'Ketchikan (Burger Poisson)', desc: 'Filet de poisson croustillant, sauce tartare', price: 4000, img: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=500&q=80', cat: 'Fast Food' },
  { restaurant: 'Sen Burger Dakar', name: 'Ramen Poulet', desc: 'Soupe japonaise, nouilles, œuf mollet, nori', price: 5500, img: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=500&q=80', cat: 'Asiatique' },
  { restaurant: 'Sen Burger Dakar', name: 'Salade Niçoise', desc: 'Thon, haricots verts, œufs, olives, anchois', price: 4000, img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80', cat: 'Salades' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Thiou Boulettes', desc: 'Boulettes de poisson à la sauce tomate sénégalaise', price: 2500, img: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=500&q=80', cat: 'Senegalais' },
  { restaurant: 'Sen Burger Dakar', name: 'Grillades Mixtes', desc: 'Assortiment de viandes grillées pour 2 personnes', price: 12000, img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&q=80', cat: 'Grillades' },
  { restaurant: 'Sen Burger Dakar', name: 'Crêpe Nutella Banane', desc: 'Crêpe fine, Nutella généreux, tranches de banane', price: 2000, img: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=500&q=80', cat: 'Desserts' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Jus de Tamarin', desc: 'Jus de tamarin gingembre, acidulé et rafraîchissant', price: 1200, img: 'https://images.unsplash.com/photo-1568909344668-6f14a07b56a0?w=500&q=80', cat: 'Jus Locaux' },
  { restaurant: 'Sen Burger Dakar', name: 'Chawarma Mixte', desc: 'Poulet et agneau, sauce yaourt et épices orientales', price: 4500, img: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=500&q=80', cat: 'Chawarma' },
  { restaurant: 'Sen Burger Dakar', name: 'Spaghetti Bolognaise', desc: 'Pâtes al dente, sauce bolognaise maison', price: 4000, img: 'https://images.unsplash.com/photo-1551183053-bf91798d792b?w=500&q=80', cat: 'Asiatique' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Poulet Basquaise', desc: 'Poulet mijoté aux poivrons et tomates, style basque', price: 5500, img: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c8?w=500&q=80', cat: 'Grillades' },
  { restaurant: 'Sen Burger Dakar', name: 'Salade de Fruits Tropicaux', desc: 'Mangue, ananas, papaye, pastèque, jus de citron', price: 2500, img: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=500&q=80', cat: 'Desserts' },
  { restaurant: 'Sen Burger Dakar', name: 'Pizza Végétarienne', desc: 'Légumes rôtis, roquette, copeaux de parmesan', price: 5500, img: 'https://images.unsplash.com/photo-1571066811602-716837d681de?w=500&q=80', cat: 'Pizza' },
  { restaurant: 'Sen Burger Dakar', name: 'Salade Grecque', desc: 'Concombre, feta, olives noires, tomates, origan', price: 3500, img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80', cat: 'Salades' },
  { restaurant: 'Chef Ousmane (Dark Kitchen)', name: 'Lakh', desc: 'Semoule au lait caillé sucré, dessert traditionnel sénégalais', price: 1500, img: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&q=80', cat: 'Desserts' },
  { restaurant: 'Sen Burger Dakar', name: 'Le Classique', desc: 'Steak haché pur bœuf, cheddar, salade, tomate', price: 3500, img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80', cat: 'Fast Food' },
  { restaurant: 'Le Lagon 1', name: 'Thiof Braisé', desc: 'Mérou blanc braisé aux épices douces, frites de patate douce', price: 12000, img: 'https://images.unsplash.com/photo-1544979144-411a76d4dfba?w=500&q=80', cat: 'Grillades' },
  { restaurant: 'Terrou-Bi', name: 'Filet de Bœuf Rossini', desc: 'Filet mignon, foie gras, sauce aux truffes', price: 25000, img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&q=80', cat: 'Gastronomie' },
  { restaurant: 'KFC Sea Plaza', name: 'Bucket 10 Pièces', desc: '10 pièces de poulet frit croustillant, frites familiales', price: 15000, img: 'https://images.unsplash.com/photo-1513639776629-7b61b0ac49cb?w=500&q=80', cat: 'Fast Food' },
  { restaurant: 'Burger King', name: 'Whopper', desc: 'Le légendaire burger au bœuf grillé à la flamme', price: 4500, img: 'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=500&q=80', cat: 'Fast Food' },
  { restaurant: 'Chez Loutcha', name: 'Catchupa', desc: 'Ragoût cap-verdien riche au maïs, haricots, viandes', price: 4000, img: 'https://images.unsplash.com/photo-1602253057119-44d745d9b860?w=500&q=80', cat: 'Africain' },
  { restaurant: 'La Fourchette', name: 'Sushi Boat', desc: 'Assortiment premium de 24 sushis, makis et sashimis', price: 22000, img: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&q=80', cat: 'Asiatique' },
  { restaurant: 'Radisson Blu', name: 'Brunch Royal', desc: 'Viennoiseries, saumon fumé, œufs bénédictine, jus frais', price: 18000, img: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=500&q=80', cat: 'Brunch' },
  { restaurant: 'Alkimia', name: 'Ceviche de Daurade', desc: 'Daurade fraîche marinée au citron vert et fruit de la passion', price: 11000, img: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&q=80', cat: 'Gastronomie' },
  { restaurant: 'Le Djoloff', name: 'Crevettes à la Plancha', desc: "Grandes crevettes grillées, riz safrané, sauce à l'ail", price: 8000, img: 'https://images.unsplash.com/photo-1559742811-822873691fc8?w=500&q=80', cat: 'Grillades' },
  { restaurant: 'Noflaye Beach', name: 'Crêpe Complète', desc: 'Jambon, œuf, fromage, champignons sur galette sarrasin', price: 4500, img: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=500&q=80', cat: 'Crêpes' },
  { restaurant: 'Alkimia', name: 'Carpaccio de Saumon', desc: "Saumon d'Écosse, huile d'olive vierge, citron et câpres", price: 9000, img: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80', cat: 'Gastronomie' },
  { restaurant: 'Alkimia', name: 'Langouste Grillée', desc: "Demi-langouste rôtie au beurre d'ail, pommes grenailles", price: 18000, img: 'https://images.unsplash.com/photo-1559742811-822873691fc8?w=500&q=80', cat: 'Gastronomie' },
  { restaurant: 'Alkimia', name: 'Fondant au Chocolat', desc: 'Cœur coulant chocolat noir, glace vanille de Madagascar', price: 5000, img: 'https://images.unsplash.com/photo-1511381939415-e440c9c3e981?w=500&q=80', cat: 'Desserts' },
  { restaurant: 'Le Lagon 1', name: 'Plateau de Fruits de Mer', desc: 'Huîtres, crevettes, bulots et langoustines sur glace', price: 22000, img: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&q=80', cat: 'Gastronomie' },
  { restaurant: 'Le Lagon 1', name: 'Sole Meunière', desc: 'Sole fraîche au beurre noisette, persil et citron', price: 14000, img: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80', cat: 'Gastronomie' },
  { restaurant: 'Radisson Blu', name: 'Club Sandwich Premium', desc: 'Poulet rôti, bacon, œuf, crudités, frites maison', price: 8500, img: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&q=80', cat: 'Fast Food' },
  { restaurant: 'Radisson Blu', name: 'Entrecôte Angus (300g)', desc: "Viande d'exception, sauce béarnaise et pommes sautées", price: 19500, img: 'https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80', cat: 'Grillades' },
  { restaurant: 'Terrou-Bi', name: 'Magret de Canard au Miel', desc: 'Magret du sud-ouest, sauce miel et purée de patates douces', price: 16000, img: 'https://images.unsplash.com/photo-1514326640560-7d063ef2aed5?w=500&q=80', cat: 'Gastronomie' },
  { restaurant: 'Terrou-Bi', name: 'Tiramisu au Café Touba', desc: 'Le classique italien revisité avec du café sénégalais parfumé', price: 4500, img: 'https://images.unsplash.com/photo-1571115177098-24de63ef3e18?w=500&q=80', cat: 'Desserts' },
  { restaurant: 'KFC Sea Plaza', name: 'Menu Zinger Burger', desc: 'Burger poulet épicé, frites moyennes, boisson', price: 4500, img: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=500&q=80', cat: 'Fast Food' },
  { restaurant: 'KFC Sea Plaza', name: 'Tenders (5 pièces)', desc: 'Vrais filets de poulet panés et croustillants', price: 3500, img: 'https://images.unsplash.com/photo-1562967914-01efa7e87832?w=500&q=80', cat: 'Fast Food' },
  { restaurant: 'Burger King', name: 'Menu Long Chicken', desc: 'Long sandwich au poulet pané, frites, boisson', price: 4200, img: 'https://images.unsplash.com/photo-1610440042657-612c34d95e9f?w=500&q=80', cat: 'Fast Food' },
  { restaurant: 'Burger King', name: 'Onion Rings', desc: "Rondelles d'oignons frites et croustillantes", price: 1500, img: 'https://images.unsplash.com/photo-1639024471210-20512809187f?w=500&q=80', cat: 'Fast Food' },
  { restaurant: 'Chez Loutcha', name: 'Thiou aux Crevettes', desc: 'Sauce tomate riche aux grosses crevettes et riz blanc', price: 5500, img: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=500&q=80', cat: 'Senegalais' },
  { restaurant: 'Chez Loutcha', name: 'Poulet Braisé', desc: 'Poulet entier mariné et grillé, sauce oignon, alloco', price: 7000, img: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=500&q=80', cat: 'Africain' },
  { restaurant: 'La Fourchette', name: 'Pad Thaï aux Crevettes', desc: 'Pâtes de riz sautées, tofu, crevettes, cacahuètes', price: 6500, img: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=500&q=80', cat: 'Asiatique' },
  { restaurant: 'La Fourchette', name: 'Ceviche Péruvien', desc: 'Poisson frais mariné au lait de tigre, patate douce', price: 7500, img: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&q=80', cat: 'Gastronomie' },
  { restaurant: 'Le Djoloff', name: 'Burger Djoloff', desc: "Pain brioché, steak haché maison, confit d'oignons", price: 6000, img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80', cat: 'Fast Food' },
  { restaurant: 'Le Djoloff', name: 'Brochettes de Lotte', desc: 'Lotte marinée aux épices douces, grillée au feu de bois', price: 8500, img: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=500&q=80', cat: 'Grillades' },
  { restaurant: 'Noflaye Beach', name: 'Gaufre au Nutella', desc: 'Gaufre tiède croustillante nappée de chocolat noisette', price: 2500, img: 'https://images.unsplash.com/photo-1562376552-0d160a2f9fc6?w=500&q=80', cat: 'Desserts' },
  { restaurant: 'Noflaye Beach', name: 'Smoothie Mangue-Passion', desc: "Fruits frais mixés, rafraîchissant pour l'été", price: 2000, img: 'https://images.unsplash.com/photo-1622597467836-f3e6707f4b0d?w=500&q=80', cat: 'Jus Locaux' },
];

const users = [
  { role: 'restaurant', name: 'Chef Ousmane (Dark Kitchen)', phone: '+221771234567', password: SEED_PASSWORDS.restaurant, address: 'Plateau, Dakar', lat: 14.71, lng: -17.46 },
  { role: 'restaurant', name: 'Sen Burger Dakar', phone: '+221771234568', password: SEED_PASSWORDS.restaurant, address: 'Mermoz, Dakar', lat: 14.692, lng: -17.465 },
  { role: 'restaurant', name: 'Le Lagon 1', phone: '+221771234569', password: SEED_PASSWORDS.restaurant, address: 'Plateau, Dakar', lat: 14.667, lng: -17.433 },
  { role: 'restaurant', name: 'Terrou-Bi', phone: '+221771234570', password: SEED_PASSWORDS.restaurant, address: 'Corniche Ouest, Dakar', lat: 14.685, lng: -17.465 },
  { role: 'restaurant', name: 'KFC Sea Plaza', phone: '+221771234571', password: SEED_PASSWORDS.restaurant, address: 'Sea Plaza, Dakar', lat: 14.693, lng: -17.473 },
  { role: 'restaurant', name: 'Burger King', phone: '+221771234572', password: SEED_PASSWORDS.restaurant, address: 'Sea Plaza, Dakar', lat: 14.693, lng: -17.473 },
  { role: 'restaurant', name: 'Chez Loutcha', phone: '+221771234573', password: SEED_PASSWORDS.restaurant, address: 'Plateau, Dakar', lat: 14.668, lng: -17.435 },
  { role: 'restaurant', name: 'La Fourchette', phone: '+221771234574', password: SEED_PASSWORDS.restaurant, address: 'Plateau, Dakar', lat: 14.666, lng: -17.432 },
  { role: 'restaurant', name: 'Radisson Blu', phone: '+221771234575', password: SEED_PASSWORDS.restaurant, address: 'Sea Plaza, Dakar', lat: 14.693, lng: -17.473 },
  { role: 'restaurant', name: 'Alkimia', phone: '+221771234576', password: SEED_PASSWORDS.restaurant, address: 'Almadies, Dakar', lat: 14.743, lng: -17.513 },
  { role: 'restaurant', name: 'Le Djoloff', phone: '+221771234577', password: SEED_PASSWORDS.restaurant, address: 'Fann Hock, Dakar', lat: 14.685, lng: -17.471 },
  { role: 'restaurant', name: 'Noflaye Beach', phone: '+221771234578', password: SEED_PASSWORDS.restaurant, address: 'Almadies, Dakar', lat: 14.75, lng: -17.52 },
  { role: 'livreur', name: 'Modou Ndiaye', phone: '+221773322111', password: SEED_PASSWORDS.livreur, address: 'Dakar', lat: 14.7167, lng: -17.4677 },
  { role: 'client', name: 'Oumy D.', phone: '+221779988776', password: SEED_PASSWORDS.client, address: 'Almadies, Dakar', lat: 14.7445, lng: -17.5134 },
  { role: 'admin', name: 'Admin NOOR EAT', phone: '+221770000001', password: SEED_PASSWORDS.admin, address: 'Dakar, Senegal', lat: 14.6937, lng: -17.4441 },
];

async function seed() {
  console.log('🌱 NOOR EAT Seed');
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
    console.log(`\n🍽️  Insertion de ${plats.length} plats...`);
    for (const p of plats) {
      const actualRestId = restaurantIds[p.restaurant];
      if (!actualRestId) {
        console.warn(`   ⚠️  Restaurant inconnu pour le plat "${p.name}": ${p.restaurant}`);
        continue;
      }

      const prepTime = Math.floor(Math.random() * 20) + 10;
      await pool.query(
        `INSERT INTO menu_items (restaurant_id, name, description, price, image_url, category, is_available, prep_time_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [actualRestId, p.name, p.desc, p.price, p.img, p.cat, true, prepTime]
      );
    }
    console.log(`   ✅ ${plats.length} plats inseres avec succès`);

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
      ['NOOREAT500', '500 FCFA de reduction', 'fixed', 500, 3000, 50, true]
    );
    console.log('   ✅ BIENVENUE (-15%) et NOOREAT500 (-500 FCFA)');

    console.log('\n=====================================');
    console.log('🎉 Seed termine avec succes !');
    console.log('=====================================\n');
    console.log('📌 COMPTES CREES :');
    for (const u of users) {
      console.log(`   ${u.role.padEnd(10)} | ${u.name.padEnd(30)} | ${u.phone}`);
    }
    console.log('   (mots de passe definis via les variables d\'environnement SEED_* — voir .env.example)');
    console.log('\n📌 CODES PROMO : BIENVENUE (-15%) | NOOREAT500 (-500 FCFA)\n');

  } catch (err) {
    console.error('\n❌ Erreur seed:', err.message);
    console.error(err);
  } finally {
    try { await pool.end(); } catch(e) {}
    process.exit(0);
  }
}

seed();
