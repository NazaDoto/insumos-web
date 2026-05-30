-- =============================================================
-- Sistema de Gestion de Insumos - Esquema MySQL
-- Motor: InnoDB (transacciones) | Charset: utf8mb4
-- =============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------- USERS -----------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name      VARCHAR(80)  NOT NULL,
  last_name       VARCHAR(80)  NOT NULL,
  email           VARCHAR(160) NOT NULL,
  username        VARCHAR(80)  NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('sysadmin','admin','provider','employee') NOT NULL,
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  administrator_id INT NULL,
  provider_id      INT NULL,
  phone           VARCHAR(40) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_users_email (email),
  UNIQUE KEY ux_users_username (username),
  KEY ix_users_role (role),
  KEY ix_users_status (status),
  KEY ix_users_admin (administrator_id),
  CONSTRAINT fk_users_admin FOREIGN KEY (administrator_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_users_provider FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------- ITEM CATEGORIES -----------------------
CREATE TABLE IF NOT EXISTS item_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  administrator_id INT NULL,            -- NULL = categoria global
  name        VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_cat_admin (administrator_id),
  CONSTRAINT fk_cat_admin FOREIGN KEY (administrator_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------ BRANCHES ---------------------------
CREATE TABLE IF NOT EXISTS branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  administrator_id INT NOT NULL,
  name        VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  address     VARCHAR(255) NULL,
  responsible_user_id INT NULL,
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_branch_admin (administrator_id),
  CONSTRAINT fk_branch_admin FOREIGN KEY (administrator_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_branch_resp FOREIGN KEY (responsible_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------- EMPLOYEE <-> BRANCHES -------------------
CREATE TABLE IF NOT EXISTS employee_branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id   INT NOT NULL,
  branch_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ux_emp_branch (user_id, branch_id),
  CONSTRAINT fk_eb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_eb_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------- ITEMS -----------------------------
CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_type  ENUM('administrator','provider') NOT NULL,
  owner_id    INT NOT NULL,
  category_id INT NULL,
  name        VARCHAR(160) NOT NULL,
  description TEXT NULL,
  unit        VARCHAR(40)  NOT NULL DEFAULT 'unidad',
  minimum_stock DECIMAL(14,3) NOT NULL DEFAULT 0,
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  condition_state ENUM('available','in_use','repair','damaged','retired','reserved','lost') NOT NULL DEFAULT 'available',
  created_by  INT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_items_owner (owner_type, owner_id),
  KEY ix_items_category (category_id),
  KEY ix_items_status (status),
  KEY ix_items_name (name),
  CONSTRAINT fk_items_category FOREIGN KEY (category_id) REFERENCES item_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_items_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------- CUSTOM FIELDS -----------------------
CREATE TABLE IF NOT EXISTS custom_fields (
  id INT AUTO_INCREMENT PRIMARY KEY,
  administrator_id INT NULL,
  module      ENUM('items','usage','branches','orders','movements') NOT NULL,
  field_name  VARCHAR(80)  NOT NULL,
  field_label VARCHAR(120) NOT NULL,
  field_type  ENUM('text','textarea','number','date','boolean','select','file') NOT NULL DEFAULT 'text',
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_cf_admin_module (administrator_id, module),
  CONSTRAINT fk_cf_admin FOREIGN KEY (administrator_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS custom_field_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  field_id   INT NOT NULL,
  value      VARCHAR(160) NOT NULL,
  label      VARCHAR(160) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_cfo_field FOREIGN KEY (field_id) REFERENCES custom_fields(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Valores de atributos dinamicos (generico por modulo + registro)
CREATE TABLE IF NOT EXISTS custom_field_values (
  id INT AUTO_INCREMENT PRIMARY KEY,
  field_id  INT NOT NULL,
  record_id INT NOT NULL,        -- id del item / usage / etc.
  value     TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_cfv (field_id, record_id),
  CONSTRAINT fk_cfv_field FOREIGN KEY (field_id) REFERENCES custom_fields(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------- STOCK -----------------------------
CREATE TABLE IF NOT EXISTS stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id     INT NOT NULL,
  branch_id   INT NULL,          -- stock por oficina
  provider_id INT NULL,          -- stock por proveedor
  quantity    DECIMAL(14,3) NOT NULL DEFAULT 0,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_stock_branch (item_id, branch_id),
  UNIQUE KEY ux_stock_provider (item_id, provider_id),
  KEY ix_stock_item (item_id),
  CONSTRAINT fk_stock_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT fk_stock_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  CONSTRAINT fk_stock_provider FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------- STOCK MOVEMENTS -----------------------
CREATE TABLE IF NOT EXISTS stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  movement_type ENUM('income','outcome','transfer','usage','adjustment','order_received','order_sent','return','correction') NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  origin_branch_id      INT NULL,
  destination_branch_id INT NULL,
  provider_id INT NULL,
  order_id    INT NULL,
  usage_record_id INT NULL,
  reason   VARCHAR(255) NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_mov_item (item_id),
  KEY ix_mov_type (movement_type),
  KEY ix_mov_date (created_at),
  CONSTRAINT fk_mov_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT fk_mov_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------- ORDERS ----------------------------
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  administrator_id INT NOT NULL,
  provider_id      INT NOT NULL,
  status ENUM('pending','accepted','rejected','preparing','sent','delivered','cancelled','partial') NOT NULL DEFAULT 'pending',
  admin_observations    VARCHAR(500) NULL,
  provider_observations VARCHAR(500) NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_order_admin (administrator_id),
  KEY ix_order_provider (provider_id),
  KEY ix_order_status (status),
  CONSTRAINT fk_order_admin FOREIGN KEY (administrator_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_provider FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  item_id  INT NOT NULL,
  destination_branch_id INT NULL,
  requested_quantity DECIMAL(14,3) NOT NULL,
  approved_quantity  DECIMAL(14,3) NULL,
  delivered_quantity DECIMAL(14,3) NULL,
  observations VARCHAR(255) NULL,
  KEY ix_od_order (order_id),
  CONSTRAINT fk_od_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_od_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT fk_od_branch FOREIGN KEY (destination_branch_id) REFERENCES branches(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  status   VARCHAR(40) NOT NULL,
  observations VARCHAR(255) NULL,
  changed_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_osh_order (order_id),
  CONSTRAINT fk_osh_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_osh_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------- USAGE RECORDS ------------------------
CREATE TABLE IF NOT EXISTS usage_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id   INT NOT NULL,
  branch_id INT NOT NULL,
  employee_id INT NOT NULL,
  quantity  DECIMAL(14,3) NOT NULL,
  used_where VARCHAR(160) NULL,
  used_for   VARCHAR(255) NULL,
  recipient  VARCHAR(160) NULL,
  observations VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_usage_item (item_id),
  KEY ix_usage_emp (employee_id),
  KEY ix_usage_branch (branch_id),
  KEY ix_usage_date (created_at),
  CONSTRAINT fk_usage_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT fk_usage_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  CONSTRAINT fk_usage_emp FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------- NOTIFICATIONS -----------------------
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type    VARCHAR(60) NOT NULL,
  title   VARCHAR(160) NOT NULL,
  message VARCHAR(500) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_notif_user (user_id, is_read),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------- LOGS -----------------------------
CREATE TABLE IF NOT EXISTS logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id   INT NULL,
  user_role VARCHAR(40) NULL,
  action    VARCHAR(80) NOT NULL,
  module    VARCHAR(60) NOT NULL,
  record_id INT NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_logs_user (user_id),
  KEY ix_logs_module (module),
  KEY ix_logs_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
