import os
import bcrypt
from .db import get_conn

def ensure_admin():
    username = os.getenv('ADMIN_USERNAME', 'admin')
    email = os.getenv('ADMIN_EMAIL')
    raw = os.getenv('ADMIN_PASSWORD', 'admin123')
    hashpw = bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('SELECT id, role FROM users WHERE username=%s', (username,))
        row = cur.fetchone()
        if row:
            cur.execute('UPDATE users SET password_hash=%s, role=%s WHERE id=%s', (hashpw, 'admin', row['id']))
        else:
            cur.execute('INSERT INTO users (username, email, password_hash, role) VALUES (%s,%s,%s,%s)', (username, email, hashpw, 'admin'))
    conn.close()