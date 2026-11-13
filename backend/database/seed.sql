-- =====================================================================
-- Krishi Roth (কৃষি রথ) — reference seed data
-- ---------------------------------------------------------------------
-- Safe to run many times: every insert uses INSERT IGNORE, so rows that
-- already exist are left untouched.
-- This file contains NO user accounts and NO passwords.
--   * Admin account  -> npm run admin:create   (reads .env)
-- =====================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------
INSERT IGNORE INTO roles (code, name_en, name_bn, is_self_registrable, is_service_provider) VALUES
  ('farmer',          'Farmer',          'কৃষক',          1, 0),
  ('buyer',           'Buyer',           'ক্রেতা',         1, 0),
  ('labour',          'Labour',          'কৃষি শ্রমিক',     1, 1),
  ('harvester_owner', 'Harvester Owner', 'হারভেস্টার মালিক', 1, 1),
  ('tractor_owner',   'Tractor Owner',   'ট্রাক্টর মালিক',   1, 1),
  ('transport_owner', 'Transport Owner', 'পরিবহন মালিক',    1, 1),
  ('admin',           'Admin',           'অ্যাডমিন',        0, 0);

-- ---------------------------------------------------------------------
-- Divisions (8)
-- ---------------------------------------------------------------------
INSERT IGNORE INTO divisions (id, name_en, name_bn) VALUES
  (1, 'Barishal',   'বরিশাল'),
  (2, 'Chattogram', 'চট্টগ্রাম'),
  (3, 'Dhaka',      'ঢাকা'),
  (4, 'Khulna',     'খুলনা'),
  (5, 'Mymensingh', 'ময়মনসিংহ'),
  (6, 'Rajshahi',   'রাজশাহী'),
  (7, 'Rangpur',    'রংপুর'),
  (8, 'Sylhet',     'সিলেট');

-- ---------------------------------------------------------------------
-- Districts (64)
-- ---------------------------------------------------------------------
INSERT IGNORE INTO districts (id, division_id, name_en, name_bn) VALUES
  -- Barishal
  ( 1, 1, 'Barguna',          'বরগুনা'),
  ( 2, 1, 'Barishal',         'বরিশাল'),
  ( 3, 1, 'Bhola',            'ভোলা'),
  ( 4, 1, 'Jhalokati',        'ঝালকাঠি'),
  ( 5, 1, 'Patuakhali',       'পটুয়াখালী'),
  ( 6, 1, 'Pirojpur',         'পিরোজপুর'),
  -- Chattogram
  ( 7, 2, 'Bandarban',        'বান্দরবান'),
  ( 8, 2, 'Brahmanbaria',     'ব্রাহ্মণবাড়িয়া'),
  ( 9, 2, 'Chandpur',         'চাঁদপুর'),
  (10, 2, 'Chattogram',       'চট্টগ্রাম'),
  (11, 2, 'Cox''s Bazar',     'কক্সবাজার'),
  (12, 2, 'Cumilla',          'কুমিল্লা'),
  (13, 2, 'Feni',             'ফেনী'),
  (14, 2, 'Khagrachhari',     'খাগড়াছড়ি'),
  (15, 2, 'Lakshmipur',       'লক্ষ্মীপুর'),
  (16, 2, 'Noakhali',         'নোয়াখালী'),
  (17, 2, 'Rangamati',        'রাঙ্গামাটি'),
  -- Dhaka
  (18, 3, 'Dhaka',            'ঢাকা'),
  (19, 3, 'Faridpur',         'ফরিদপুর'),
  (20, 3, 'Gazipur',          'গাজীপুর'),
  (21, 3, 'Gopalganj',        'গোপালগঞ্জ'),
  (22, 3, 'Kishoreganj',      'কিশোরগঞ্জ'),
  (23, 3, 'Madaripur',        'মাদারীপুর'),
  (24, 3, 'Manikganj',        'মানিকগঞ্জ'),
  (25, 3, 'Munshiganj',       'মুন্সীগঞ্জ'),
  (26, 3, 'Narayanganj',      'নারায়ণগঞ্জ'),
  (27, 3, 'Narsingdi',        'নরসিংদী'),
  (28, 3, 'Rajbari',          'রাজবাড়ী'),
  (29, 3, 'Shariatpur',       'শরীয়তপুর'),
  (30, 3, 'Tangail',          'টাঙ্গাইল'),
  -- Khulna
  (31, 4, 'Bagerhat',         'বাগেরহাট'),
  (32, 4, 'Chuadanga',        'চুয়াডাঙ্গা'),
  (33, 4, 'Jashore',          'যশোর'),
  (34, 4, 'Jhenaidah',        'ঝিনাইদহ'),
  (35, 4, 'Khulna',           'খুলনা'),
  (36, 4, 'Kushtia',          'কুষ্টিয়া'),
  (37, 4, 'Magura',           'মাগুরা'),
  (38, 4, 'Meherpur',         'মেহেরপুর'),
  (39, 4, 'Narail',           'নড়াইল'),
  (40, 4, 'Satkhira',         'সাতক্ষীরা'),
  -- Mymensingh
  (41, 5, 'Jamalpur',         'জামালপুর'),
  (42, 5, 'Mymensingh',       'ময়মনসিংহ'),
  (43, 5, 'Netrokona',        'নেত্রকোণা'),
  (44, 5, 'Sherpur',          'শেরপুর'),
  -- Rajshahi
  (45, 6, 'Bogura',           'বগুড়া'),
  (46, 6, 'Chapai Nawabganj', 'চাঁপাইনবাবগঞ্জ'),
  (47, 6, 'Joypurhat',        'জয়পুরহাট'),
  (48, 6, 'Naogaon',          'নওগাঁ'),
  (49, 6, 'Natore',           'নাটোর'),
  (50, 6, 'Pabna',            'পাবনা'),
  (51, 6, 'Rajshahi',         'রাজশাহী'),
  (52, 6, 'Sirajganj',        'সিরাজগঞ্জ'),
  -- Rangpur
  (53, 7, 'Dinajpur',         'দিনাজপুর'),
  (54, 7, 'Gaibandha',        'গাইবান্ধা'),
  (55, 7, 'Kurigram',         'কুড়িগ্রাম'),
  (56, 7, 'Lalmonirhat',      'লালমনিরহাট'),
  (57, 7, 'Nilphamari',       'নীলফামারী'),
  (58, 7, 'Panchagarh',       'পঞ্চগড়'),
  (59, 7, 'Rangpur',          'রংপুর'),
  (60, 7, 'Thakurgaon',       'ঠাকুরগাঁও'),
  -- Sylhet
  (61, 8, 'Habiganj',         'হবিগঞ্জ'),
  (62, 8, 'Moulvibazar',      'মৌলভীবাজার'),
  (63, 8, 'Sunamganj',        'সুনামগঞ্জ'),
  (64, 8, 'Sylhet',           'সিলেট');

-- ---------------------------------------------------------------------
-- Crop categories
-- ---------------------------------------------------------------------
INSERT IGNORE INTO crop_categories (id, slug, name_en, name_bn, sort_order) VALUES
  (1, 'cereals',    'Cereals',          'দানাশস্য',   1),
  (2, 'vegetables', 'Vegetables',       'সবজি',      2),
  (3, 'fruits',     'Fruits',           'ফল',        3),
  (4, 'pulses',     'Pulses',           'ডাল',       4),
  (5, 'oilseeds',   'Oilseeds',         'তেলবীজ',    5),
  (6, 'spices',     'Spices',           'মসলা',      6),
  (7, 'tubers',     'Tubers',           'কন্দাল ফসল', 7),
  (8, 'fibre',      'Fibre crops',      'আঁশ ফসল',   8),
  (9, 'other',      'Other',            'অন্যান্য',   9);

-- ---------------------------------------------------------------------
-- Crops
-- ---------------------------------------------------------------------
INSERT IGNORE INTO crops (category_id, slug, name_en, name_bn, default_unit) VALUES
  -- Cereals
  (1, 'paddy',        'Paddy',          'ধান',          'maund'),
  (1, 'rice',         'Rice',           'চাল',          'kg'),
  (1, 'wheat',        'Wheat',          'গম',           'maund'),
  (1, 'maize',        'Maize',          'ভুট্টা',        'maund'),
  -- Vegetables
  (2, 'brinjal',      'Brinjal',        'বেগুন',        'kg'),
  (2, 'tomato',       'Tomato',         'টমেটো',        'kg'),
  (2, 'cauliflower',  'Cauliflower',    'ফুলকপি',       'piece'),
  (2, 'cabbage',      'Cabbage',        'বাঁধাকপি',      'piece'),
  (2, 'bitter-gourd', 'Bitter gourd',   'করলা',         'kg'),
  (2, 'pumpkin',      'Pumpkin',        'মিষ্টি কুমড়া',   'kg'),
  (2, 'bottle-gourd', 'Bottle gourd',   'লাউ',          'piece'),
  (2, 'okra',         'Okra',           'ঢেঁড়স',         'kg'),
  (2, 'green-chili',  'Green chili',    'কাঁচা মরিচ',     'kg'),
  (2, 'cucumber',     'Cucumber',       'শসা',          'kg'),
  (2, 'spinach',      'Spinach',        'পালং শাক',      'bundle'),
  (2, 'red-amaranth', 'Red amaranth',   'লাল শাক',      'bundle'),
  -- Fruits
  (3, 'mango',        'Mango',          'আম',           'kg'),
  (3, 'jackfruit',    'Jackfruit',      'কাঁঠাল',        'piece'),
  (3, 'banana',       'Banana',         'কলা',          'dozen'),
  (3, 'litchi',       'Litchi',         'লিচু',          'kg'),
  (3, 'guava',        'Guava',          'পেয়ারা',        'kg'),
  (3, 'papaya',       'Papaya',         'পেঁপে',         'kg'),
  (3, 'pineapple',    'Pineapple',      'আনারস',        'piece'),
  -- Pulses
  (4, 'lentil',       'Lentil',         'মসুর ডাল',      'kg'),
  (4, 'mung-bean',    'Mung bean',      'মুগ ডাল',       'kg'),
  (4, 'grass-pea',    'Grass pea',      'খেসারি ডাল',    'kg'),
  -- Oilseeds
  (5, 'mustard',      'Mustard',        'সরিষা',         'maund'),
  (5, 'sesame',       'Sesame',         'তিল',          'kg'),
  (5, 'groundnut',    'Groundnut',      'চীনাবাদাম',     'kg'),
  -- Spices
  (6, 'onion',        'Onion',          'পেঁয়াজ',        'kg'),
  (6, 'garlic',       'Garlic',         'রসুন',         'kg'),
  (6, 'ginger',       'Ginger',         'আদা',          'kg'),
  (6, 'turmeric',     'Turmeric',       'হলুদ',          'kg'),
  (6, 'dry-chili',    'Dry chili',      'শুকনা মরিচ',    'kg'),
  -- Tubers
  (7, 'potato',       'Potato',         'আলু',          'kg'),
  (7, 'sweet-potato', 'Sweet potato',   'মিষ্টি আলু',     'kg'),
  -- Fibre
  (8, 'jute',         'Jute',           'পাট',          'maund');

-- ---------------------------------------------------------------------
-- Expense categories for the digital expense notebook
-- ---------------------------------------------------------------------
INSERT IGNORE INTO expense_categories (id, code, name_en, name_bn, sort_order) VALUES
  ( 1, 'seed',             'Seeds / seedlings',   'বীজ / চারা',        1),
  ( 2, 'fertilizer',       'Fertilizer',          'সার',             2),
  ( 3, 'pesticide',        'Pesticide',           'কীটনাশক / বালাইনাশক', 3),
  ( 4, 'labour',           'Labour wages',        'শ্রমিক মজুরি',      4),
  ( 5, 'land_preparation', 'Land preparation',    'জমি চাষ ও প্রস্তুতি',  5),
  ( 6, 'irrigation',       'Irrigation',          'সেচ',             6),
  ( 7, 'machinery_rent',   'Machinery rent',      'যন্ত্র ভাড়া',        7),
  ( 8, 'transport',        'Transport',           'পরিবহন',          8),
  ( 9, 'land_lease',       'Land lease',          'জমি বর্গা / লিজ',    9),
  (10, 'storage',          'Storage',             'সংরক্ষণ',          10),
  (11, 'other',            'Other',               'অন্যান্য',          11);

-- Market prices are NOT seeded. Admins enter real prices from the admin
-- panel (stored with source = 'admin').
