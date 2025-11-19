import os
import pymysql

pool = None

def init_pool():
    global pool
    if pool:
        return
    host = os.getenv('MYSQL_HOST', '127.0.0.1')
    port = int(os.getenv('MYSQL_PORT', '3306'))
    user = os.getenv('MYSQL_USER', 'root')
    password = os.getenv('MYSQL_PASSWORD', '')
    db = os.getenv('MYSQL_DB', 'person_photo')
    conn = pymysql.connect(host=host, port=port, user=user, password=password, autocommit=True)
    with conn.cursor() as cur:
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{db}`")
    conn.close()
    pool = dict(host=host, port=port, user=user, password=password, database=db, autocommit=True, cursorclass=pymysql.cursors.DictCursor)

def get_conn():
    if not pool:
        raise RuntimeError('DB pool not initialized')
    return pymysql.connect(**pool)

def init_schema():
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(64) NOT NULL UNIQUE,
          email VARCHAR(255) UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          role ENUM('user','photographer','admin') NOT NULL DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
        """)
        try:
            cur.execute("ALTER TABLE users MODIFY COLUMN role ENUM('user','photographer','admin','super_admin') NOT NULL DEFAULT 'user'")
        except Exception:
            pass
        cur.execute("""
        CREATE TABLE IF NOT EXISTS photos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          camera VARCHAR(128),
          settings VARCHAR(255),
          category VARCHAR(64),
          original_url VARCHAR(1024),
          image_url VARCHAR(1024) NOT NULL,
          thumb_url VARCHAR(1024),
          size_bytes BIGINT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX (user_id)
        ) ENGINE=InnoDB
        """)
        # 兼容旧表结构，补充必要列
        try:
            cur.execute("SHOW COLUMNS FROM photos LIKE 'original_url'")
            if not cur.fetchall():
                cur.execute("ALTER TABLE photos ADD COLUMN original_url VARCHAR(1024)")
        except Exception:
            pass
        try:
            cur.execute("SHOW COLUMNS FROM photos LIKE 'size_bytes'")
            if not cur.fetchall():
                cur.execute("ALTER TABLE photos ADD COLUMN size_bytes BIGINT DEFAULT 0")
        except Exception:
            pass
        cur.execute("""
        CREATE TABLE IF NOT EXISTS tags (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(64) NOT NULL UNIQUE
        ) ENGINE=InnoDB
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS photo_tags (
          photo_id INT NOT NULL,
          tag_id INT NOT NULL,
          PRIMARY KEY (photo_id, tag_id)
        ) ENGINE=InnoDB
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS likes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          photo_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_like (user_id, photo_id)
        ) ENGINE=InnoDB
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          photo_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_fav (user_id, photo_id)
        ) ENGINE=InnoDB
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS comments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          photo_id INT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS home_carousel (
          id INT AUTO_INCREMENT PRIMARY KEY,
          image_url VARCHAR(1024) NOT NULL,
          thumb_url VARCHAR(1024),
          photo_id INT,
          sort_order INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
        """)
        try:
            cur.execute("SHOW COLUMNS FROM home_carousel LIKE 'photo_id'")
            if not cur.fetchall():
                cur.execute("ALTER TABLE home_carousel ADD COLUMN photo_id INT")
        except Exception:
            pass
        cur.execute("""
        CREATE TABLE IF NOT EXISTS home_videos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          video_url VARCHAR(1024) NOT NULL,
          title VARCHAR(255),
          user_id INT,
          sort_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
        """)
        try:
            cur.execute("SHOW COLUMNS FROM home_videos LIKE 'user_id'")
            if not cur.fetchall():
                cur.execute("ALTER TABLE home_videos ADD COLUMN user_id INT")
        except Exception:
            pass
        cur.execute("""
        CREATE TABLE IF NOT EXISTS photo_edits (
          id INT AUTO_INCREMENT PRIMARY KEY,
          photo_id INT NOT NULL,
          user_id INT NOT NULL,
          changes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX (photo_id), INDEX (user_id)
        ) ENGINE=InnoDB
        """)
    conn.close()