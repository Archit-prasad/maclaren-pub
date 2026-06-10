// Single source of truth for bar menu — backend uses this for price validation
const DRINKS = [
  { id: 'swarley_coffee',    name: "Swarley's Coffee",                           category: 'coffee',   type: 'Lore', price: 10,  desc: 'Cheap caffeine fix',                              special: null },
  { id: 'tootsie_roll',      name: 'The Tootsie Roll',                           category: 'cocktail', type: 'Lore', price: 32,  desc: "Slutty Pumpkin's drink (Kahlua + Root Beer)",     special: null },
  { id: 'whalefail_ale',     name: 'Whalefail Ale',                              category: 'beer',     type: 'Lore', price: 25,  desc: "Barney's corporate fallback beer",                 special: null },
  { id: 'guinness_draft',    name: 'Guinness Draft Pint',                        category: 'beer',     type: 'Real', price: 145, desc: 'Classic Irish stout on tap',                       special: null },
  { id: 'bud_light',         name: 'Bud Light Bottle',                           category: 'beer',     type: 'Real', price: 272, desc: 'Standard domestic light beer',                     special: null },
  { id: 'stella_artois',     name: 'Stella Artois Lager',                        category: 'beer',     type: 'Real', price: 144, desc: 'Premium imported European lager',                  special: null },
  { id: 'craft_ipa',         name: 'Craft IPA',                                  category: 'beer',     type: 'Real', price: 318, desc: 'Local hoppy brew',                                 special: null },
  { id: 'mermaid_cocktail',  name: 'The Mermaid Cocktail',                       category: 'cocktail', type: 'Lore', price: 420, desc: 'Tropical drink that makes anyone look like a 10',  special: null },
  { id: 'gin_tonic',         name: 'Classic Gin & Tonic',                        category: 'cocktail', type: 'Real', price: 420, desc: 'Standard refreshing highball',                     special: null },
  { id: 'rum_coke',          name: 'Rum & Coke',                                 category: 'cocktail', type: 'Real', price: 320, desc: 'Well drink favorite',                              special: null },
  { id: 'tequila_shot',      name: 'Tequila Blanco Shot',                        category: 'cocktail', type: 'Real', price: 322, desc: 'House tequila with lime and salt',                 special: null },
  { id: 'minnesota_tidal',   name: 'Minnesota Tidal Wave / Robin Scherbatsky',   category: 'cocktail', type: 'Lore', price: 525, desc: "Robin's favorite sugary cocktail",                 special: 'minnesota' },
  { id: 'strawberry_daiq',   name: 'Strawberry Virgin Daiquiri',                 category: 'cocktail', type: 'Lore', price: 125, desc: "Marshall's secret non-alcoholic order",            special: null },
  { id: 'house_red',         name: 'House Red Wine',                             category: 'cocktail', type: 'Real', price: 65,  desc: 'Glass of cabernet sauvignon',                      special: null },
  { id: 'house_white',       name: 'House White Wine',                           category: 'cocktail', type: 'Real', price: 251, desc: 'Glass of chilled chardonnay',                      special: null },
  { id: 'moscow_mule',       name: 'Moscow Mule',                                category: 'cocktail', type: 'Real', price: 72,  desc: 'Vodka, ginger beer, lime in copper mug',           special: null },
  { id: 'margarita',         name: 'Classic Margarita',                          category: 'cocktail', type: 'Real', price: 100, desc: 'Tangy lime, tequila, triple sec, salted rim',      special: null },
  { id: 'old_fashioned',     name: 'Old Fashioned',                              category: 'cocktail', type: 'Real', price: 30,  desc: 'Premium muddled bourbon classic',                  special: null },
  { id: 'dirty_martini',     name: 'Dirty Martini',                              category: 'cocktail', type: 'Real', price: 32,  desc: 'Shaken gin or vodka with olive brine',             special: null },
  { id: 'glen_mckenna',      name: 'Glen McKenna 35-Yr Scotch',                  category: 'cocktail', type: 'Lore', price: 80,  desc: 'Ultra-premium top shelf luxury',                   special: 'glen_mckenna' },
  { id: 'woo_pitcher',       name: "The 'Woo!' Pitcher",                         category: 'cocktail', type: 'Lore', price: 150, desc: "Forces WOOOOOOOOO into table chat on purchase",    special: 'woo_pitcher' },
];

const FOOD = [
  { id: 'pub_fries',         name: 'Pub Fries',                                  category: 'food', type: 'Real', price: 122, desc: 'Basket of crispy salted fries',                     special: null },
  { id: 'sandwich_lore',     name: "A 'Sandwich'",                               category: 'food', type: 'Lore', price: 90,  desc: "Ted's euphemism — sets status to 🥪 for 10 min",   special: 'sandwich' },
  { id: 'onion_rings',       name: 'Onion Rings',                                category: 'food', type: 'Real', price: 35,  desc: 'Golden beer-battered rings',                        special: null },
  { id: 'mozz_sticks',       name: 'Mozzarella Sticks',                          category: 'food', type: 'Real', price: 118, desc: 'Served with warm marinara',                         special: null },
  { id: 'sumbitches',        name: "'Sumbitches' Cookies",                       category: 'food', type: 'Lore', price: 220, desc: "Lily's peanut butter chocolate treats",              special: null },
  { id: 'gouda_plate',       name: 'A Plate of Gouda',                           category: 'food', type: 'Lore', price: 225, desc: "Don't sleep on the Gouda",                          special: null },
  { id: 'club_sandwich',     name: 'Classic Club Sandwich',                      category: 'food', type: 'Real', price: 100, desc: 'Triple-decker turkey and bacon',                    special: null },
  { id: 'loaded_nachos',     name: 'Loaded Nachos',                              category: 'food', type: 'Real', price: 78,  desc: 'Layered cheese, jalapenos, salsa',                  special: null },
  { id: 'buffalo_wings',     name: 'Buffalo Chicken Wings',                      category: 'food', type: 'Real', price: 149, desc: 'Basket of hot wings with blue cheese',              special: null },
  { id: 'best_burger',       name: 'The Best Burger in NY',                      category: 'food', type: 'Lore', price: 500, desc: "Marshall's ultimate culinary quest",                special: 'best_burger' },
];

const ALL_ITEMS = [...DRINKS, ...FOOD];
const ITEM_MAP = new Map(ALL_ITEMS.map(i => [i.id, i]));

module.exports = { DRINKS, FOOD, ALL_ITEMS, ITEM_MAP };
