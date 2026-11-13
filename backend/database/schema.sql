-- =====================================================================
-- Krishi Roth (কৃষি রথ) — MySQL database schema
-- ---------------------------------------------------------------------
-- Works on MySQL 8.0.16+ and MariaDB 10.4+ (XAMPP).
-- Run it with:  npm run db:setup   (from the backend folder)
--
-- Conventions used in this file
--   * Every table uses InnoDB + utf8mb4 so Bengali text is stored safely.
--   * Every table has created_at; tables that change also have updated_at.
--   * Money is stored as DECIMAL (never FLOAT) and is in BDT (Taka).
--   * Users are never hard-deleted by the app; admins block them instead.
--     That is why most foreign keys to users have no ON DELETE action.
--   * Child data that only makes sense with its parent (photos, rows of a
--     notebook, notifications, chat messages) uses ON DELETE CASCADE.
--   * Columns used in CHECK constraints never have ON DELETE/ON UPDATE
--     actions on their foreign keys (MySQL does not allow that).
-- =====================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 1. Roles
--    The 7 user roles. Admin can never be chosen during registration
--    (is_self_registrable = 0).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  code                VARCHAR(30)  NOT NULL,
  name_en             VARCHAR(60)  NOT NULL,
  name_bn             VARCHAR(60)  NOT NULL,
  is_self_registrable TINYINT(1)   NOT NULL DEFAULT 1,
  is_service_provider TINYINT(1)   NOT NULL DEFAULT 0,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. Locations: 8 divisions and 64 districts of Bangladesh.
--    Upazila is stored as free text on each record.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS divisions (
  id       TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name_en  VARCHAR(50)      NOT NULL,
  name_bn  VARCHAR(50)      NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_divisions_name_en (name_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS districts (
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  division_id  TINYINT UNSIGNED  NOT NULL,
  name_en      VARCHAR(50)       NOT NULL,
  name_bn      VARCHAR(50)       NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_districts_name_en (name_en),
  KEY idx_districts_division (division_id),
  CONSTRAINT fk_districts_division FOREIGN KEY (division_id) REFERENCES divisions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. Users
--    A user must have an email OR a phone number (many farmers have
--    only a phone). Passwords are stored only as bcrypt hashes.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                   INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  name                 VARCHAR(100)      NOT NULL,
  email                VARCHAR(150)      NULL,
  phone                VARCHAR(20)       NULL,
  password_hash        VARCHAR(255)      NOT NULL,
  role                 VARCHAR(30)       NOT NULL,
  profile_photo        VARCHAR(255)      NULL,
  district_id          SMALLINT UNSIGNED NULL,
  upazila              VARCHAR(80)       NULL,
  address              VARCHAR(255)      NULL,
  bio                  VARCHAR(500)      NULL,
  preferred_language   ENUM('bn','en')   NOT NULL DEFAULT 'bn',
  verification_status  ENUM('unverified','pending','verified','rejected') NOT NULL DEFAULT 'unverified',
  is_blocked           TINYINT(1)        NOT NULL DEFAULT 0,
  blocked_reason       VARCHAR(255)      NULL,
  blocked_at           DATETIME          NULL,
  last_login_at        DATETIME          NULL,
  password_changed_at  DATETIME          NULL,
  created_at           DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_phone (phone),
  KEY idx_users_role (role),
  KEY idx_users_district (district_id),
  KEY idx_users_verification (verification_status),
  KEY idx_users_created (created_at),
  CONSTRAINT fk_users_role     FOREIGN KEY (role)        REFERENCES roles (code),
  CONSTRAINT fk_users_district FOREIGN KEY (district_id) REFERENCES districts (id),
  CONSTRAINT chk_users_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3b. Login sessions
--     Every login and every registration creates a NEW, unique JWT.
--     Each token carries a random id (jti) that is stored here, so the
--     server can really end a session: logout, password change and
--     account blocking revoke tokens immediately.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sessions (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  jti         CHAR(36)     NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  expires_at  DATETIME     NOT NULL,
  revoked_at  DATETIME     NULL,
  ip_address  VARCHAR(45)  NULL,
  user_agent  VARCHAR(255) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_jti (jti),
  KEY idx_sessions_user (user_id, revoked_at),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. Verification requests
--    The document itself is stored inside the database (document_data),
--    never in a public folder, and is only sent to admins. Only the last
--    4 digits of a document number are kept.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_verifications (
  id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id                INT UNSIGNED NOT NULL,
  document_type          ENUM('nid','birth_certificate','trade_license','driving_license','vehicle_registration','other') NOT NULL,
  document_number_last4  CHAR(4)      NULL,
  document_name          VARCHAR(150) NOT NULL,
  document_mime          VARCHAR(60)  NOT NULL,
  document_size          INT UNSIGNED NOT NULL,
  document_data          MEDIUMBLOB   NOT NULL,
  note                   VARCHAR(500) NULL,
  status                 ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_note             VARCHAR(500) NULL,
  reviewed_by            INT UNSIGNED NULL,
  reviewed_at            DATETIME     NULL,
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_verifications_user (user_id, status),
  KEY idx_verifications_status (status, created_at),
  CONSTRAINT fk_verifications_user     FOREIGN KEY (user_id)     REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_verifications_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. Crop catalogue
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crop_categories (
  id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug        VARCHAR(50)       NOT NULL,
  name_en     VARCHAR(80)       NOT NULL,
  name_bn     VARCHAR(80)       NOT NULL,
  sort_order  SMALLINT          NOT NULL DEFAULT 0,
  created_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_crop_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crops (
  id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  category_id   SMALLINT UNSIGNED NOT NULL,
  slug          VARCHAR(60)       NOT NULL,
  name_en       VARCHAR(80)       NOT NULL,
  name_bn       VARCHAR(80)       NOT NULL,
  default_unit  ENUM('kg','maund','ton','piece','dozen','hali','bundle','crate') NOT NULL DEFAULT 'kg',
  is_active     TINYINT(1)        NOT NULL DEFAULT 1,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_crops_slug (slug),
  KEY idx_crops_category (category_id),
  KEY idx_crops_name_bn (name_bn),
  CONSTRAINT fk_crops_category FOREIGN KEY (category_id) REFERENCES crop_categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. Marketplace: crop listings and their photos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crop_listings (
  id                  INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  farmer_id           INT UNSIGNED      NOT NULL,
  crop_id             INT UNSIGNED      NOT NULL,
  variety             VARCHAR(100)      NULL,
  quantity            DECIMAL(12,2)     NOT NULL,
  quantity_available  DECIMAL(12,2)     NOT NULL,
  unit                ENUM('kg','maund','ton','piece','dozen','hali','bundle','crate') NOT NULL,
  price_per_unit      DECIMAL(12,2)     NOT NULL,
  min_order_quantity  DECIMAL(12,2)     NULL,
  is_negotiable       TINYINT(1)        NOT NULL DEFAULT 1,
  district_id         SMALLINT UNSIGNED NOT NULL,
  upazila             VARCHAR(80)       NULL,
  harvest_date        DATE              NULL,
  description         TEXT              NULL,
  status              ENUM('active','reserved','sold','expired','removed') NOT NULL DEFAULT 'active',
  admin_note          VARCHAR(255)      NULL,
  created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_listings_status_created (status, created_at),
  KEY idx_listings_farmer (farmer_id, status),
  KEY idx_listings_crop (crop_id, status),
  KEY idx_listings_district (district_id, status),
  KEY idx_listings_price (price_per_unit),
  CONSTRAINT fk_listings_farmer   FOREIGN KEY (farmer_id)   REFERENCES users (id),
  CONSTRAINT fk_listings_crop     FOREIGN KEY (crop_id)     REFERENCES crops (id),
  CONSTRAINT fk_listings_district FOREIGN KEY (district_id) REFERENCES districts (id),
  CONSTRAINT chk_listings_quantity  CHECK (quantity > 0),
  CONSTRAINT chk_listings_available CHECK (quantity_available >= 0 AND quantity_available <= quantity),
  CONSTRAINT chk_listings_price     CHECK (price_per_unit > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crop_listing_images (
  id          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  listing_id  INT UNSIGNED     NOT NULL,
  image_path  VARCHAR(255)     NOT NULL,
  sort_order  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_listing_images_listing (listing_id, sort_order),
  CONSTRAINT fk_listing_images_listing FOREIGN KEY (listing_id) REFERENCES crop_listings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7. Market prices
--    source = 'admin'    -> entered by an administrator
--    source = 'sample'   -> demonstration data, NOT real prices
--    source = 'external' -> reserved for a future configured data feed
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_prices (
  id           INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  crop_id      INT UNSIGNED      NOT NULL,
  market_name  VARCHAR(120)      NOT NULL,
  district_id  SMALLINT UNSIGNED NOT NULL,
  unit         ENUM('kg','maund','ton','piece','dozen','hali','bundle','crate') NOT NULL DEFAULT 'kg',
  min_price    DECIMAL(10,2)     NOT NULL,
  max_price    DECIMAL(10,2)     NOT NULL,
  price_date   DATE              NOT NULL,
  source       ENUM('admin','sample','external') NOT NULL DEFAULT 'admin',
  source_note  VARCHAR(255)      NULL,
  created_by   INT UNSIGNED      NULL,
  updated_by   INT UNSIGNED      NULL,
  created_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_market_prices_entry (crop_id, market_name, district_id, price_date, unit),
  KEY idx_market_prices_date (price_date),
  KEY idx_market_prices_district (district_id, price_date),
  CONSTRAINT fk_market_prices_crop     FOREIGN KEY (crop_id)     REFERENCES crops (id),
  CONSTRAINT fk_market_prices_district FOREIGN KEY (district_id) REFERENCES districts (id),
  CONSTRAINT fk_market_prices_creator  FOREIGN KEY (created_by)  REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_market_prices_updater  FOREIGN KEY (updated_by)  REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_market_prices_range CHECK (min_price >= 0 AND max_price >= min_price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 8. Harvest management
--    land_unit 'decimal' = শতাংশ (the most common unit in Bangladesh).
--    reminder_sent_at stops the same harvest reminder being sent twice.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS harvests (
  id                     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  farmer_id              INT UNSIGNED  NOT NULL,
  crop_id                INT UNSIGNED  NOT NULL,
  variety                VARCHAR(100)  NULL,
  field_name             VARCHAR(100)  NULL,
  land_size              DECIMAL(10,2) NOT NULL,
  land_unit              ENUM('decimal','katha','bigha','acre','hectare') NOT NULL DEFAULT 'decimal',
  expected_quantity      DECIMAL(12,2) NULL,
  actual_quantity        DECIMAL(12,2) NULL,
  quantity_unit          ENUM('kg','maund','ton','piece','dozen','hali','bundle','crate') NOT NULL DEFAULT 'maund',
  planting_date          DATE          NULL,
  expected_harvest_date  DATE          NULL,
  actual_harvest_date    DATE          NULL,
  status                 ENUM('planned','growing','ready','harvesting','completed') NOT NULL DEFAULT 'planned',
  notes                  TEXT          NULL,
  reminder_sent_at       DATETIME      NULL,
  created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_harvests_farmer (farmer_id, status),
  KEY idx_harvests_expected (expected_harvest_date, status),
  CONSTRAINT fk_harvests_farmer FOREIGN KEY (farmer_id) REFERENCES users (id),
  CONSTRAINT fk_harvests_crop   FOREIGN KEY (crop_id)   REFERENCES crops (id),
  CONSTRAINT chk_harvests_land     CHECK (land_size > 0),
  CONSTRAINT chk_harvests_expected CHECK (expected_quantity IS NULL OR expected_quantity >= 0),
  CONSTRAINT chk_harvests_actual   CHECK (actual_quantity IS NULL OR actual_quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 9. Digital expense notebook (খরচের খাতা)
--    total_cost is a generated column, so the database itself guarantees
--    total_cost = quantity x unit_price for every row.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_categories (
  id          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(40)      NOT NULL,
  name_en     VARCHAR(80)      NOT NULL,
  name_bn     VARCHAR(80)      NOT NULL,
  sort_order  SMALLINT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_expense_categories_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expense_notebooks (
  id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  farmer_id   INT UNSIGNED      NOT NULL,
  harvest_id  INT UNSIGNED      NULL,
  crop_id     INT UNSIGNED      NULL,
  title       VARCHAR(150)      NOT NULL,
  season      ENUM('rabi','kharif_1','kharif_2','boro','aus','aman','year_round') NULL,
  year        SMALLINT UNSIGNED NULL,
  notes       TEXT              NULL,
  created_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notebooks_farmer (farmer_id, created_at),
  KEY idx_notebooks_harvest (harvest_id),
  CONSTRAINT fk_notebooks_farmer  FOREIGN KEY (farmer_id)  REFERENCES users (id),
  CONSTRAINT fk_notebooks_harvest FOREIGN KEY (harvest_id) REFERENCES harvests (id) ON DELETE SET NULL,
  CONSTRAINT fk_notebooks_crop    FOREIGN KEY (crop_id)    REFERENCES crops (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  notebook_id   INT UNSIGNED      NOT NULL,
  line_no       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  item_name     VARCHAR(150)      NOT NULL,
  category_id   TINYINT UNSIGNED  NOT NULL,
  quantity      DECIMAL(12,2)     NOT NULL DEFAULT 1,
  unit          VARCHAR(20)       NULL,
  unit_price    DECIMAL(12,2)     NOT NULL DEFAULT 0,
  total_cost    DECIMAL(14,2)     GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED,
  expense_date  DATE              NOT NULL,
  notes         VARCHAR(255)      NULL,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenses_notebook_line (notebook_id, line_no),
  KEY idx_expenses_notebook_date (notebook_id, expense_date),
  KEY idx_expenses_category (category_id),
  CONSTRAINT fk_expenses_notebook FOREIGN KEY (notebook_id) REFERENCES expense_notebooks (id) ON DELETE CASCADE,
  CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES expense_categories (id),
  CONSTRAINT chk_expenses_quantity CHECK (quantity >= 0),
  CONSTRAINT chk_expenses_price    CHECK (unit_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 10. Labour profiles (one per labour user)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS labour_profiles (
  user_id             INT UNSIGNED      NOT NULL,
  skills              VARCHAR(255)      NULL,
  experience_years    TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  experience_details  TEXT              NULL,
  daily_wage          DECIMAL(10,2)     NOT NULL,
  district_id         SMALLINT UNSIGNED NOT NULL,
  upazila             VARCHAR(80)       NULL,
  is_available        TINYINT(1)        NOT NULL DEFAULT 1,
  available_from      DATE              NULL,
  created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_labour_district (district_id, is_available),
  KEY idx_labour_wage (daily_wage),
  CONSTRAINT fk_labour_user     FOREIGN KEY (user_id)     REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_labour_district FOREIGN KEY (district_id) REFERENCES districts (id),
  CONSTRAINT chk_labour_wage CHECK (daily_wage >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 11. Extra service areas for labour, machinery and transport owners
--     (in addition to their home district)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provider_service_areas (
  id           INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED      NOT NULL,
  district_id  SMALLINT UNSIGNED NOT NULL,
  upazila      VARCHAR(80)       NOT NULL DEFAULT '',
  created_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_area (user_id, district_id, upazila),
  KEY idx_service_area_district (district_id),
  CONSTRAINT fk_service_area_user     FOREIGN KEY (user_id)     REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_service_area_district FOREIGN KEY (district_id) REFERENCES districts (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 12. Machinery (harvesters and tractors share one table)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS machinery (
  id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  owner_id      INT UNSIGNED      NOT NULL,
  machine_type  ENUM('harvester','tractor') NOT NULL,
  name          VARCHAR(120)      NOT NULL,
  brand         VARCHAR(80)       NULL,
  model         VARCHAR(80)       NULL,
  model_year    SMALLINT UNSIGNED NULL,
  horsepower    SMALLINT UNSIGNED NULL,
  description   TEXT              NULL,
  rental_price  DECIMAL(10,2)     NOT NULL,
  price_unit    ENUM('per_hour','per_day','per_acre','per_bigha','per_decimal') NOT NULL,
  district_id   SMALLINT UNSIGNED NOT NULL,
  upazila       VARCHAR(80)       NULL,
  is_available  TINYINT(1)        NOT NULL DEFAULT 1,
  status        ENUM('active','inactive','removed') NOT NULL DEFAULT 'active',
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_machinery_search (machine_type, status, is_available),
  KEY idx_machinery_owner (owner_id),
  KEY idx_machinery_district (district_id),
  CONSTRAINT fk_machinery_owner    FOREIGN KEY (owner_id)    REFERENCES users (id),
  CONSTRAINT fk_machinery_district FOREIGN KEY (district_id) REFERENCES districts (id),
  CONSTRAINT chk_machinery_price CHECK (rental_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS machinery_images (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  machinery_id  INT UNSIGNED     NOT NULL,
  image_path    VARCHAR(255)     NOT NULL,
  sort_order    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_machinery_images (machinery_id, sort_order),
  CONSTRAINT fk_machinery_images FOREIGN KEY (machinery_id) REFERENCES machinery (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 13. Transport vehicles
--     registration_number is private (shown only to the owner and admins).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transport_vehicles (
  id                   INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  owner_id             INT UNSIGNED      NOT NULL,
  vehicle_type         ENUM('truck','mini_truck','pickup','covered_van','van','trolley','nosimon','boat','other') NOT NULL,
  name                 VARCHAR(120)      NOT NULL,
  registration_number  VARCHAR(40)       NULL,
  capacity             DECIMAL(10,2)     NOT NULL,
  capacity_unit        ENUM('kg','maund','ton') NOT NULL DEFAULT 'ton',
  price                DECIMAL(10,2)     NOT NULL,
  price_unit           ENUM('per_km','per_trip','per_day','per_ton') NOT NULL,
  district_id          SMALLINT UNSIGNED NOT NULL,
  upazila              VARCHAR(80)       NULL,
  description          TEXT              NULL,
  is_available         TINYINT(1)        NOT NULL DEFAULT 1,
  status               ENUM('active','inactive','removed') NOT NULL DEFAULT 'active',
  created_at           DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_transport_search (vehicle_type, status, is_available),
  KEY idx_transport_owner (owner_id),
  KEY idx_transport_district (district_id),
  CONSTRAINT fk_transport_owner    FOREIGN KEY (owner_id)    REFERENCES users (id),
  CONSTRAINT fk_transport_district FOREIGN KEY (district_id) REFERENCES districts (id),
  CONSTRAINT chk_transport_capacity CHECK (capacity > 0),
  CONSTRAINT chk_transport_price    CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transport_vehicle_images (
  id          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  vehicle_id  INT UNSIGNED     NOT NULL,
  image_path  VARCHAR(255)     NOT NULL,
  sort_order  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vehicle_images (vehicle_id, sort_order),
  CONSTRAINT fk_vehicle_images FOREIGN KEY (vehicle_id) REFERENCES transport_vehicles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 14. Bookings — one table for all four service types.
--     labour     -> provider_id is the labour user; no machine/vehicle
--     harvester  -> machinery_id required
--     tractor    -> machinery_id required
--     transport  -> transport_vehicle_id required
--     quoted_price / price_unit are a snapshot of the price at booking
--     time, so later price changes do not alter old bookings.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id                    INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  booking_type          ENUM('labour','harvester','tractor','transport') NOT NULL,
  requester_id          INT UNSIGNED      NOT NULL,
  provider_id           INT UNSIGNED      NOT NULL,
  machinery_id          INT UNSIGNED      NULL,
  transport_vehicle_id  INT UNSIGNED      NULL,
  start_date            DATE              NOT NULL,
  end_date              DATE              NOT NULL,
  work_district_id      SMALLINT UNSIGNED NULL,
  work_upazila          VARCHAR(80)       NULL,
  work_address          VARCHAR(255)      NULL,
  destination           VARCHAR(255)      NULL,
  work_size             DECIMAL(10,2)     NULL,
  work_size_unit        VARCHAR(20)       NULL,
  quoted_price          DECIMAL(10,2)     NULL,
  price_unit            VARCHAR(20)       NULL,
  estimated_total       DECIMAL(12,2)     NULL,
  requester_note        TEXT              NULL,
  provider_note         VARCHAR(500)      NULL,
  status                ENUM('pending','accepted','rejected','cancelled','in_progress','completed') NOT NULL DEFAULT 'pending',
  responded_at          DATETIME          NULL,
  completed_at          DATETIME          NULL,
  cancelled_at          DATETIME          NULL,
  cancelled_by          INT UNSIGNED      NULL,
  created_at            DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bookings_requester (requester_id, status),
  KEY idx_bookings_provider (provider_id, status),
  KEY idx_bookings_type (booking_type, status),
  KEY idx_bookings_machinery (machinery_id),
  KEY idx_bookings_vehicle (transport_vehicle_id),
  KEY idx_bookings_start (start_date),
  CONSTRAINT fk_bookings_requester FOREIGN KEY (requester_id)         REFERENCES users (id),
  CONSTRAINT fk_bookings_provider  FOREIGN KEY (provider_id)          REFERENCES users (id),
  CONSTRAINT fk_bookings_machinery FOREIGN KEY (machinery_id)         REFERENCES machinery (id),
  CONSTRAINT fk_bookings_vehicle   FOREIGN KEY (transport_vehicle_id) REFERENCES transport_vehicles (id),
  CONSTRAINT fk_bookings_district  FOREIGN KEY (work_district_id)     REFERENCES districts (id),
  CONSTRAINT fk_bookings_cancelled FOREIGN KEY (cancelled_by)         REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_bookings_dates CHECK (end_date >= start_date),
  CONSTRAINT chk_bookings_people CHECK (requester_id <> provider_id),
  CONSTRAINT chk_bookings_target CHECK (
    (booking_type = 'labour'                  AND machinery_id IS NULL     AND transport_vehicle_id IS NULL)
 OR (booking_type IN ('harvester','tractor')  AND machinery_id IS NOT NULL AND transport_vehicle_id IS NULL)
 OR (booking_type = 'transport'               AND machinery_id IS NULL     AND transport_vehicle_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 15. Safe trade workflow
--     purchase_offers : Pending -> Accepted / Rejected (or Withdrawn)
--     trade_records   : created when an offer is accepted, then
--                       Payment Pending -> Payment Confirmed ->
--                       Delivery Pending -> Completed
--                       (or Cancelled / Disputed)
--     NOTE: no real money is handled. Payment fields only record what
--     the buyer and farmer report (e.g. a bKash transaction ID).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_offers (
  id                      INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  listing_id              INT UNSIGNED  NOT NULL,
  buyer_id                INT UNSIGNED  NOT NULL,
  farmer_id               INT UNSIGNED  NOT NULL,
  quantity                DECIMAL(12,2) NOT NULL,
  unit                    ENUM('kg','maund','ton','piece','dozen','hali','bundle','crate') NOT NULL,
  offered_price_per_unit  DECIMAL(12,2) NOT NULL,
  total_amount            DECIMAL(14,2) GENERATED ALWAYS AS (ROUND(quantity * offered_price_per_unit, 2)) STORED,
  message                 VARCHAR(1000) NULL,
  status                  ENUM('pending','accepted','rejected','withdrawn','expired') NOT NULL DEFAULT 'pending',
  farmer_note             VARCHAR(500)  NULL,
  responded_at            DATETIME      NULL,
  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_offers_listing (listing_id, status),
  KEY idx_offers_buyer (buyer_id, status),
  KEY idx_offers_farmer (farmer_id, status),
  CONSTRAINT fk_offers_listing FOREIGN KEY (listing_id) REFERENCES crop_listings (id),
  CONSTRAINT fk_offers_buyer   FOREIGN KEY (buyer_id)   REFERENCES users (id),
  CONSTRAINT fk_offers_farmer  FOREIGN KEY (farmer_id)  REFERENCES users (id),
  CONSTRAINT chk_offers_quantity CHECK (quantity > 0),
  CONSTRAINT chk_offers_price    CHECK (offered_price_per_unit > 0),
  CONSTRAINT chk_offers_people   CHECK (buyer_id <> farmer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trade_records (
  id                      INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  offer_id                INT UNSIGNED  NOT NULL,
  listing_id              INT UNSIGNED  NOT NULL,
  buyer_id                INT UNSIGNED  NOT NULL,
  farmer_id               INT UNSIGNED  NOT NULL,
  quantity                DECIMAL(12,2) NOT NULL,
  unit                    ENUM('kg','maund','ton','piece','dozen','hali','bundle','crate') NOT NULL,
  price_per_unit          DECIMAL(12,2) NOT NULL,
  total_amount            DECIMAL(14,2) NOT NULL,
  status                  ENUM('payment_pending','payment_confirmed','delivery_pending','completed','cancelled','disputed') NOT NULL DEFAULT 'payment_pending',
  payment_method          ENUM('cash','bkash','nagad','rocket','bank_transfer','other') NULL,
  payment_reference       VARCHAR(100)  NULL,
  payment_marked_at       DATETIME      NULL,
  payment_confirmed_at    DATETIME      NULL,
  delivery_method         ENUM('buyer_pickup','farmer_delivery','transport_service') NULL,
  delivery_address        VARCHAR(255)  NULL,
  expected_delivery_date  DATE          NULL,
  delivered_at            DATETIME      NULL,
  buyer_confirmed_at      DATETIME      NULL,
  completed_at            DATETIME      NULL,
  cancelled_at            DATETIME      NULL,
  cancelled_by            INT UNSIGNED  NULL,
  cancel_reason           VARCHAR(500)  NULL,
  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_trades_offer (offer_id),
  KEY idx_trades_buyer (buyer_id, status),
  KEY idx_trades_farmer (farmer_id, status),
  KEY idx_trades_status (status, created_at),
  KEY idx_trades_listing (listing_id),
  CONSTRAINT fk_trades_offer     FOREIGN KEY (offer_id)     REFERENCES purchase_offers (id),
  CONSTRAINT fk_trades_listing   FOREIGN KEY (listing_id)   REFERENCES crop_listings (id),
  CONSTRAINT fk_trades_buyer     FOREIGN KEY (buyer_id)     REFERENCES users (id),
  CONSTRAINT fk_trades_farmer    FOREIGN KEY (farmer_id)    REFERENCES users (id),
  CONSTRAINT fk_trades_cancelled FOREIGN KEY (cancelled_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_trades_people CHECK (buyer_id <> farmer_id),
  CONSTRAINT chk_trades_amount CHECK (quantity > 0 AND price_per_unit > 0 AND total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every status change of a trade is recorded here (audit trail).
CREATE TABLE IF NOT EXISTS trade_status_history (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  trade_id     INT UNSIGNED NOT NULL,
  from_status  VARCHAR(30)  NULL,
  to_status    VARCHAR(30)  NOT NULL,
  changed_by   INT UNSIGNED NULL,
  note         VARCHAR(500) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_trade_history (trade_id, created_at),
  CONSTRAINT fk_trade_history_trade FOREIGN KEY (trade_id)   REFERENCES trade_records (id) ON DELETE CASCADE,
  CONSTRAINT fk_trade_history_user  FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 16. Buyer <-> farmer messaging (contact the seller)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id       INT UNSIGNED NULL,
  farmer_id        INT UNSIGNED NOT NULL,
  buyer_id         INT UNSIGNED NOT NULL,
  last_message_at  DATETIME     NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conversations (listing_id, farmer_id, buyer_id),
  KEY idx_conversations_farmer (farmer_id, last_message_at),
  KEY idx_conversations_buyer (buyer_id, last_message_at),
  CONSTRAINT fk_conversations_listing FOREIGN KEY (listing_id) REFERENCES crop_listings (id) ON DELETE SET NULL,
  CONSTRAINT fk_conversations_farmer  FOREIGN KEY (farmer_id)  REFERENCES users (id),
  CONSTRAINT fk_conversations_buyer   FOREIGN KEY (buyer_id)   REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id  INT UNSIGNED NOT NULL,
  sender_id        INT UNSIGNED NOT NULL,
  body             TEXT         NOT NULL,
  read_at          DATETIME     NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_conversation (conversation_id, created_at),
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender       FOREIGN KEY (sender_id)       REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 17. Ratings and reviews
--     A review belongs to exactly one completed trade OR booking.
--     The unique keys stop the same person reviewing the same trade or
--     booking twice.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  reviewer_id    INT UNSIGNED     NOT NULL,
  reviewee_id    INT UNSIGNED     NOT NULL,
  trade_id       INT UNSIGNED     NULL,
  booking_id     INT UNSIGNED     NULL,
  rating         TINYINT UNSIGNED NOT NULL,
  comment        VARCHAR(1000)    NULL,
  is_hidden      TINYINT(1)       NOT NULL DEFAULT 0,
  hidden_reason  VARCHAR(255)     NULL,
  hidden_by      INT UNSIGNED     NULL,
  created_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reviews_trade (reviewer_id, trade_id),
  UNIQUE KEY uq_reviews_booking (reviewer_id, booking_id),
  KEY idx_reviews_reviewee (reviewee_id, is_hidden, created_at),
  KEY idx_reviews_trade (trade_id),
  KEY idx_reviews_booking (booking_id),
  CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id),
  CONSTRAINT fk_reviews_reviewee FOREIGN KEY (reviewee_id) REFERENCES users (id),
  CONSTRAINT fk_reviews_trade    FOREIGN KEY (trade_id)    REFERENCES trade_records (id),
  CONSTRAINT fk_reviews_booking  FOREIGN KEY (booking_id)  REFERENCES bookings (id),
  CONSTRAINT fk_reviews_hidden   FOREIGN KEY (hidden_by)   REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT chk_reviews_people CHECK (reviewer_id <> reviewee_id),
  CONSTRAINT chk_reviews_source CHECK (
    (trade_id IS NOT NULL AND booking_id IS NULL)
 OR (trade_id IS NULL     AND booking_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 18. Announcements and notifications
--     notification types: offer_new, offer_accepted, offer_rejected,
--     booking_new, booking_status, harvest_reminder, market_price,
--     trade_update, announcement, verification, message, review
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(200) NOT NULL,
  body         TEXT         NOT NULL,
  target_role  VARCHAR(30)  NULL,
  created_by   INT UNSIGNED NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_announcements_created (created_at),
  CONSTRAINT fk_announcements_role    FOREIGN KEY (target_role) REFERENCES roles (code),
  CONSTRAINT fk_announcements_creator FOREIGN KEY (created_by)  REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id          INT UNSIGNED  NOT NULL,
  type             VARCHAR(50)   NOT NULL,
  title            VARCHAR(200)  NOT NULL,
  body             VARCHAR(1000) NULL,
  link             VARCHAR(255)  NULL,
  entity_type      VARCHAR(30)   NULL,
  entity_id        INT UNSIGNED  NULL,
  announcement_id  INT UNSIGNED  NULL,
  is_read          TINYINT(1)    NOT NULL DEFAULT 0,
  read_at          DATETIME      NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user (user_id, is_read, created_at),
  KEY idx_notifications_announcement (announcement_id),
  CONSTRAINT fk_notifications_user         FOREIGN KEY (user_id)         REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 19. Complaints
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS complaints (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  complainant_id   INT UNSIGNED NOT NULL,
  against_user_id  INT UNSIGNED NULL,
  trade_id         INT UNSIGNED NULL,
  booking_id       INT UNSIGNED NULL,
  category         ENUM('fraud','payment','delivery','quality','behaviour','service','technical','other') NOT NULL DEFAULT 'other',
  subject          VARCHAR(200) NOT NULL,
  description      TEXT         NOT NULL,
  status           ENUM('open','in_review','resolved','dismissed') NOT NULL DEFAULT 'open',
  admin_note       TEXT         NULL,
  handled_by       INT UNSIGNED NULL,
  resolved_at      DATETIME     NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_complaints_status (status, created_at),
  KEY idx_complaints_complainant (complainant_id),
  KEY idx_complaints_against (against_user_id),
  CONSTRAINT fk_complaints_complainant FOREIGN KEY (complainant_id)  REFERENCES users (id),
  CONSTRAINT fk_complaints_against     FOREIGN KEY (against_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_complaints_trade       FOREIGN KEY (trade_id)        REFERENCES trade_records (id) ON DELETE SET NULL,
  CONSTRAINT fk_complaints_booking     FOREIGN KEY (booking_id)      REFERENCES bookings (id) ON DELETE SET NULL,
  CONSTRAINT fk_complaints_handler     FOREIGN KEY (handled_by)      REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 20. AI chatbot history
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED    NOT NULL,
  title       VARCHAR(200)    NOT NULL,
  language    ENUM('bn','en') NOT NULL DEFAULT 'bn',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chatbot_conversations_user (user_id, updated_at),
  CONSTRAINT fk_chatbot_conversations_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chatbot_messages (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id  INT UNSIGNED NOT NULL,
  role             ENUM('user','assistant') NOT NULL,
  content          MEDIUMTEXT   NOT NULL,
  provider         VARCHAR(40)  NULL,
  model            VARCHAR(80)  NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chatbot_messages_conversation (conversation_id, created_at),
  CONSTRAINT fk_chatbot_messages_conversation FOREIGN KEY (conversation_id) REFERENCES chatbot_conversations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 21. Activity log (feeds "Recent activities" on the admin dashboard)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id     INT UNSIGNED    NULL,
  action       VARCHAR(60)     NOT NULL,
  entity_type  VARCHAR(40)     NULL,
  entity_id    INT UNSIGNED    NULL,
  details      VARCHAR(1000)   NULL,
  ip_address   VARCHAR(45)     NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_created (created_at),
  KEY idx_activity_actor (actor_id),
  KEY idx_activity_entity (entity_type, entity_id),
  CONSTRAINT fk_activity_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 22. View: average rating per user (hidden reviews are excluded)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW user_rating_summary AS
SELECT
  reviewee_id               AS user_id,
  COUNT(*)                  AS review_count,
  ROUND(AVG(rating), 2)     AS average_rating
FROM reviews
WHERE is_hidden = 0
GROUP BY reviewee_id;
