import os
import psycopg2
from psycopg2.extras import RealDictCursor

pool = None

class PostgresCursor(RealDictCursor):
    def execute(self, query, vars=None):
        # Handle INSERT to return id for lastrowid simulation
        if query.strip().upper().startswith('INSERT') and 'RETURNING' not in query.upper():
             query = query + " RETURNING id"
        
        try:
            super().execute(query, vars)
        except Exception as e:
            raise e
            
    @property
    def lastrowid(self):
        try:
            if self.rowcount > 0:
                if self.pgresult_ptr is not None:
                     res = self.fetchone()
                     if res and 'id' in res:
                         return res['id']
                     return 0
        except Exception:
             return 0
        return 0

def init_pool():
    global pool
    if pool:
        return
    
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise RuntimeError('DATABASE_URL environment variable not set')
        
    pool = db_url

def get_conn():
    if not pool:
        raise RuntimeError('DB pool not initialized')
    
    conn = psycopg2.connect(pool, cursor_factory=PostgresCursor)
    conn.autocommit = True
    return conn

def init_schema():
    conn = get_conn()
    with conn.cursor() as cur:
        # Postgres Schema
        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(64) NOT NULL UNIQUE,
            email VARCHAR(255) UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user','photographer','admin','super_admin')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        cur.execute("""
        CREATE TABLE IF NOT EXISTS photos (
            id SERIAL PRIMARY KEY,
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos (user_id)")

        cur.execute("""
        CREATE TABLE IF NOT EXISTS tags (
            id SERIAL PRIMARY KEY,
            name VARCHAR(64) NOT NULL UNIQUE
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS photo_tags (
            photo_id INT NOT NULL,
            tag_id INT NOT NULL,
            PRIMARY KEY (photo_id, tag_id)
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS likes (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            photo_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, photo_id)
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            photo_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, photo_id)
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            photo_id INT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS home_carousel (
            id SERIAL PRIMARY KEY,
            image_url VARCHAR(1024) NOT NULL,
            thumb_url VARCHAR(1024),
            photo_id INT,
            sort_order INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS home_videos (
            id SERIAL PRIMARY KEY,
            video_url VARCHAR(1024) NOT NULL,
            title VARCHAR(255),
            user_id INT,
            sort_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS photo_edits (
            id SERIAL PRIMARY KEY,
            photo_id INT NOT NULL,
            user_id INT NOT NULL,
            changes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_photo_edits_photo_id ON photo_edits (photo_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_photo_edits_user_id ON photo_edits (user_id)")
    conn.close()
