import os
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import hashlib
import jwt
import bcrypt
from .db import init_pool, init_schema, get_conn
from .seed import ensure_admin
from typing import List, Dict
from PIL import Image
import io
from minio import Minio
from minio.error import S3Error
import urllib3
from urllib3.util import Timeout, Retry
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

def asset_url(path: str):
    base = os.getenv('ASSET_BASE_URL')
    if base:
        return f"{base.rstrip('/')}/{path.lstrip('/')}"
    host = f"localhost:{os.getenv('PORT', '4002')}"
    proto = 'http'
    return f"{proto}://{host}/{path.lstrip('/')}"

def normalize_asset(url: str):
    try:
        if not url or '/uploads/' not in url:
            return url
        i = url.find('/uploads/')
        path = url[i+1:]
        return asset_url(path)
    except Exception:
        return url

def normalize_row_urls(row: Dict):
    if not isinstance(row, dict):
        return row
    if 'image_url' in row and isinstance(row['image_url'], str):
        row['image_url'] = normalize_asset(row['image_url'])
    if 'thumb_url' in row and isinstance(row['thumb_url'], str):
        row['thumb_url'] = normalize_asset(row['thumb_url'])
    return row

def _minio_client():
    endpoint = os.getenv('MINIO_ENDPOINT')
    access_key = os.getenv('MINIO_ACCESS_KEY')
    secret_key = os.getenv('MINIO_SECRET_KEY')
    secure = os.getenv('MINIO_SECURE', 'false').lower() in ('1','true','yes')
    bucket = os.getenv('MINIO_BUCKET', 'photos')
    if not (endpoint and access_key and secret_key):
        return None, None
    try:
        connect_timeout = float(os.getenv('MINIO_CONNECT_TIMEOUT', '2'))
        read_timeout = float(os.getenv('MINIO_READ_TIMEOUT', '10'))
        total_retries = int(os.getenv('MINIO_RETRY', '1'))
        http_client = urllib3.PoolManager(
            timeout=Timeout(connect=connect_timeout, read=read_timeout),
            retries=Retry(total=total_retries, backoff_factor=0.2, status_forcelist=[500,502,503,504])
        )
        client = Minio(
            endpoint.replace('http://','').replace('https://',''),
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
            http_client=http_client,
        )
        found = client.bucket_exists(bucket)
        if not found:
            client.make_bucket(bucket)
        return client, bucket
    except Exception:
        return None, None

def _minio_public_base():
    base = os.getenv('MINIO_PUBLIC_BASE')
    if base:
        return base.rstrip('/')
    endpoint = os.getenv('MINIO_ENDPOINT')
    if not endpoint:
        return None
    secure = os.getenv('MINIO_SECURE', 'false').lower() in ('1','true','yes')
    proto = 'https' if secure else 'http'
    host = endpoint.replace('http://','').replace('https://','')
    return f"{proto}://{host}"

def _minio_url(object_name: str):
    client, bucket = _minio_client()
    if not client:
        return None
    base = _minio_public_base()
    if base:
        return f"{base}/{bucket}/{object_name.lstrip('/')}"
    try:
        return client.presigned_get_object(bucket, object_name, expires=timedelta(days=7))
    except Exception:
        return None

def _minio_put_bytes(object_name: str, data: bytes, content_type: str = 'application/octet-stream'):
    client, bucket = _minio_client()
    if not client:
        return False
    try:
        bio = io.BytesIO(data)
        client.put_object(bucket, object_name, bio, length=len(data), content_type=content_type)
        return True
    except Exception:
        return False

def _minio_remove(object_name: str):
    client, bucket = _minio_client()
    if not client:
        return False
    try:
        client.remove_object(bucket, object_name)
        return True
    except Exception:
        return False

def _minio_key_from_url(url: str):
    try:
        base = _minio_public_base()
        bucket = os.getenv('MINIO_BUCKET', 'photos')
        if base and url and url.startswith(f"{base}/{bucket}/"):
            return url.split(f"{base}/{bucket}/", 1)[1]
        return None
    except Exception:
        return None

def _minio_get_bytes(object_name: str):
    client, bucket = _minio_client()
    if not client:
        return None
    try:
        resp = client.get_object(bucket, object_name)
        try:
            data = resp.read()
            return data
        finally:
            resp.close()
            resp.release_conn()
    except Exception:
        return None

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_pool()
    init_schema()
    ensure_admin()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE role='admin' ORDER BY id ASC LIMIT 1")
        r = cur.fetchone()
        admin_id = r['id'] if r else None
        if admin_id:
            cur.execute("SELECT id, image_url, thumb_url FROM home_carousel WHERE photo_id IS NULL")
            rows = cur.fetchall()
            for row in rows:
                title = '首页轮播图'
                cur.execute("INSERT INTO photos (user_id, title, description, camera, settings, category, original_url, image_url, thumb_url, size_bytes) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", (admin_id, title, None, None, None, 'carousel', None, row['image_url'], row['thumb_url'], 0))
                pid = cur.lastrowid
                cur.execute("UPDATE home_carousel SET photo_id=%s WHERE id=%s", (pid, row['id']))
    conn.close()
    uploads_dir = os.path.join(os.path.dirname(__file__), '..', 'uploads')
    for d in ['originals', 'processed', 'thumbs', 'carousel', 'carousel_thumbs']:
        p = os.path.join(uploads_dir, d)
        os.makedirs(p, exist_ok=True)
    app.mount('/uploads', StaticFiles(directory=os.path.abspath(uploads_dir)), name='uploads')
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

class UploadsSecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path
        if path.startswith('/uploads/'):
            ref = request.headers.get('referer', '')
            allowed = [
                'http://localhost:5173',
                f"http://localhost:{os.getenv('PORT','4002')}",
            ]
            extra = os.getenv('ALLOWED_REFERRERS')
            if extra:
                allowed.extend([s.strip() for s in extra.split(',') if s.strip()])
            ok = (ref == '') or any(ref.startswith(a) for a in allowed)
            if not ok:
                return JSONResponse({'error':'hotlink forbidden'}, status_code=403)
            resp = await call_next(request)
            resp.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
            return resp
        return await call_next(request)

app.add_middleware(UploadsSecurityMiddleware)

JWT_SECRET = os.getenv('JWT_SECRET', 'dev_secret')

def csrf_for(uid: int):
    return hashlib.sha256(f"{uid}:{JWT_SECRET}".encode()).hexdigest()

def require_csrf(request: Request, payload: dict):
    token = request.headers.get('x-csrf-token')
    if token != csrf_for(payload['id']):
        raise HTTPException(status_code=403, detail='CSRF校验失败')

def auth_required(authorization: str = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='未认证')
    try:
        payload = jwt.decode(authorization[7:], JWT_SECRET, algorithms=['HS256'])
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail='令牌无效')

def role_required(payload, *roles):
    role = payload.get('role') if payload else None
    if role == 'super_admin':
        return
    if role not in roles:
        raise HTTPException(status_code=403, detail='无权限')

@app.get('/api/health')
def health():
    return {'ok': True}

@app.post('/api/auth/register')
def register(username: str = Form(...), email: str = Form(None), password: str = Form(...), role: str = Form('user')):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM users WHERE username=%s OR email=%s', (username, email))
        rows = cur.fetchall()
        if rows:
            raise HTTPException(status_code=409, detail='用户名或邮箱已存在')
        hashpw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        cur.execute('INSERT INTO users (username, email, password_hash, role) VALUES (%s,%s,%s,%s)', (username, email, hashpw, role))
    conn.close()
    return {'ok': True}

@app.post('/api/auth/login')
async def login(request: Request):
    username = None
    password = None
    try:
        form = await request.form()
        u = form.get('username')
        p = form.get('password')
        if isinstance(u, str):
            username = u
        if isinstance(p, str):
            password = p
    except Exception:
        pass
    if not username or not password:
        try:
            data = await request.json()
            if isinstance(data, dict):
                username = data.get('username')
                password = data.get('password')
        except Exception:
            pass
    if not isinstance(username, str) or not isinstance(password, str):
        raise HTTPException(status_code=400, detail='用户名和密码必填')
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('SELECT id, username, role, password_hash FROM users WHERE username=%s', (username,))
        row = cur.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail='用户不存在')
        if not bcrypt.checkpw(password.encode(), row['password_hash'].encode()):
            conn.close()
            raise HTTPException(status_code=401, detail='密码不正确')
    conn.close()
    payload = {'id': row['id'], 'username': row['username'], 'role': row['role'], 'exp': int((datetime.utcnow() + timedelta(hours=12)).timestamp())}
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    return {'token': token}

@app.get('/api/csrf')
def get_csrf(payload: dict = Depends(auth_required)):
    return {'token': csrf_for(payload['id'])}

@app.post('/api/auth/change-password')
async def change_password(request: Request, payload: dict = Depends(auth_required)):
    require_csrf(request, payload)
    old_password = None
    new_password = None
    try:
        form = await request.form()
        v1 = form.get('old_password')
        v2 = form.get('new_password')
        if isinstance(v1, str):
            old_password = v1
        if isinstance(v2, str):
            new_password = v2
    except Exception:
        pass
    if not new_password:
        try:
            data = await request.json()
            if isinstance(data, dict):
                old_password = data.get('old_password')
                new_password = data.get('new_password')
        except Exception:
            pass
    if not isinstance(new_password, str) or len(new_password) < 6:
        raise HTTPException(status_code=400, detail='新密码长度至少为6位')
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('SELECT id, password_hash FROM users WHERE id=%s', (payload['id'],))
        user = cur.fetchone()
        if not user:
            conn.close()
            raise HTTPException(status_code=404, detail='用户不存在')
        if old_password:
            ok = bcrypt.checkpw(old_password.encode(), user['password_hash'].encode())
            if not ok:
                conn.close()
                raise HTTPException(status_code=401, detail='原密码不正确')
        hashpw = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        cur.execute('UPDATE users SET password_hash=%s WHERE id=%s', (hashpw, payload['id']))
    conn.close()
    return {'ok': True}

@app.get('/api/users/me')
def me(payload: dict = Depends(auth_required)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('SELECT id, username, role, created_at FROM users WHERE id=%s', (payload['id'],))
        user = cur.fetchone()
    conn.close()
    return user

@app.get('/api/users/me/photos')
def my_photos(payload: dict = Depends(auth_required)):
    conn = get_conn()
    with conn.cursor() as cur:
        if payload.get('role') in ('admin','super_admin'):
            cur.execute('SELECT id, title, COALESCE(thumb_url, image_url, original_url) AS thumb_url, COALESCE(image_url, original_url) AS image_url, created_at FROM photos ORDER BY id DESC')
        else:
            cur.execute('SELECT id, title, COALESCE(thumb_url, image_url, original_url) AS thumb_url, COALESCE(image_url, original_url) AS image_url, created_at FROM photos WHERE user_id=%s ORDER BY id DESC', (payload['id'],))
        rows = cur.fetchall()
    conn.close()
    return [normalize_row_urls(r) for r in rows]

@app.get('/api/users/me/stats')
def my_stats(payload: dict = Depends(auth_required)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) as count FROM photos WHERE user_id=%s', (payload['id'],))
        photos = cur.fetchone()['count']
        cur.execute('SELECT COUNT(*) as count FROM likes WHERE user_id=%s', (payload['id'],))
        likes = cur.fetchone()['count']
        cur.execute('SELECT COUNT(*) as count FROM favorites WHERE user_id=%s', (payload['id'],))
        favorites = cur.fetchone()['count']
    conn.close()
    return {'photos': photos, 'likes': likes, 'favorites': favorites}

@app.post('/api/users/change-username')
async def change_username(request: Request, payload: dict = Depends(auth_required)):
    require_csrf(request, payload)
    if payload.get('role') not in ('admin','super_admin'):
        raise HTTPException(status_code=403, detail='无权限')
    name = None
    try:
        form = await request.form()
        v = form.get('new_username')
        if isinstance(v, str):
            name = v
    except Exception:
        pass
    if not name:
        try:
            data = await request.json()
            if isinstance(data, dict):
                name = data.get('new_username')
        except Exception:
            pass
    if not isinstance(name, str):
        raise HTTPException(status_code=400, detail='新用户名必填')
    name = name.strip()
    if len(name) < 3 or len(name) > 64:
        raise HTTPException(status_code=400, detail='用户名长度需在3-64之间')
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM users WHERE username=%s', (name,))
        exists = cur.fetchall()
        if exists:
            conn.close()
            raise HTTPException(status_code=409, detail='用户名已存在')
        cur.execute('UPDATE users SET username=%s WHERE id=%s', (name, payload['id']))
    conn.close()
    return {'ok': True, 'username': name}

@app.get('/api/photos')
def list_photos(q: str = None, tag: str = None, category: str = None, photographer: str = None, page: int = 1, pageSize: int = 20):
    offset = (page - 1) * pageSize
    where = 'WHERE 1=1'
    params = []
    if q:
        where += ' AND (photos.title LIKE %s OR photos.description LIKE %s)'
        params.extend([f"%{q}%", f"%{q}%"])
    if category:
        where += ' AND photos.category = %s'
        params.append(category)
    if photographer:
        where += ' AND users.username = %s'
        params.append(photographer)
    tagJoin = ''
    if tag:
        tagJoin = ' JOIN photo_tags pt ON pt.photo_id = photos.id JOIN tags t ON t.id = pt.tag_id AND t.name = %s'
        params.append(tag)
    sql = f"""
      SELECT photos.id,
             photos.title,
             COALESCE(photos.thumb_url, photos.image_url, photos.original_url) AS thumb_url,
             COALESCE(photos.image_url, photos.original_url) AS image_url,
             photos.category,
             users.username AS author
      FROM photos JOIN users ON users.id = photos.user_id {tagJoin} {where}
      ORDER BY photos.id DESC LIMIT %s OFFSET %s
    """
    params.extend([pageSize, offset])
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
    conn.close()
    return [normalize_row_urls(r) for r in rows]

@app.get('/api/photos/{photo_id}')
def photo_detail(photo_id: int, authorization: str = Header(None)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('SELECT p.*, u.username as author FROM photos p LEFT JOIN users u ON u.id=p.user_id WHERE p.id=%s', (photo_id,))
        photo = cur.fetchone()
        if not photo:
            conn.close()
            raise HTTPException(status_code=404, detail='作品不存在')
        cur.execute('SELECT t.name FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.photo_id = %s', (photo_id,))
        tags = [r['name'] for r in cur.fetchall()]
        cur.execute('SELECT COUNT(*) as c FROM likes WHERE photo_id=%s', (photo_id,))
        likes = cur.fetchone()['c']
        cur.execute('SELECT COUNT(*) as c FROM favorites WHERE photo_id=%s', (photo_id,))
        favorites = cur.fetchone()['c']
        cur.execute('SELECT c.id, c.content, c.created_at, u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE c.photo_id=%s ORDER BY c.id DESC', (photo_id,))
        comments = cur.fetchall()
        liked_by_me = False
        favorited_by_me = False
        if authorization and authorization.startswith('Bearer '):
            try:
                payload = jwt.decode(authorization[7:], JWT_SECRET, algorithms=['HS256'])
                uid = payload.get('id')
                if uid:
                    cur.execute('SELECT id FROM likes WHERE user_id=%s AND photo_id=%s', (uid, photo_id))
                    liked_by_me = bool(cur.fetchone())
                    cur.execute('SELECT id FROM favorites WHERE user_id=%s AND photo_id=%s', (uid, photo_id))
                    favorited_by_me = bool(cur.fetchone())
            except Exception:
                pass
    conn.close()
    photo['tags'] = tags
    photo['likes'] = likes
    photo['favorites'] = favorites
    photo['comments'] = comments
    photo['liked_by_me'] = liked_by_me
    photo['favorited_by_me'] = favorited_by_me
    return normalize_row_urls(photo)

@app.post('/api/photos/{photo_id}/like')
def toggle_like(photo_id: int, request: Request, payload: dict = Depends(auth_required)):
    require_csrf(request, payload)
    conn = get_conn()
    liked = False
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM photos WHERE id=%s', (photo_id,))
        if not cur.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail='作品不存在')
        cur.execute('SELECT id FROM likes WHERE user_id=%s AND photo_id=%s', (payload['id'], photo_id))
        row = cur.fetchone()
        if row:
            cur.execute('DELETE FROM likes WHERE id=%s', (row['id'],))
            liked = False
        else:
            cur.execute('INSERT INTO likes (user_id, photo_id) VALUES (%s,%s)', (payload['id'], photo_id))
            liked = True
        cur.execute('SELECT COUNT(*) as c FROM likes WHERE photo_id=%s', (photo_id,))
        cnt = cur.fetchone()['c']
    conn.close()
    return {'ok': True, 'liked': liked, 'likes': cnt}

@app.post('/api/photos/{photo_id}/favorite')
def toggle_favorite(photo_id: int, request: Request, payload: dict = Depends(auth_required)):
    require_csrf(request, payload)
    conn = get_conn()
    favorited = False
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM photos WHERE id=%s', (photo_id,))
        if not cur.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail='作品不存在')
        cur.execute('SELECT id FROM favorites WHERE user_id=%s AND photo_id=%s', (payload['id'], photo_id))
        row = cur.fetchone()
        if row:
            cur.execute('DELETE FROM favorites WHERE id=%s', (row['id'],))
            favorited = False
        else:
            cur.execute('INSERT INTO favorites (user_id, photo_id) VALUES (%s,%s)', (payload['id'], photo_id))
            favorited = True
        cur.execute('SELECT COUNT(*) as c FROM favorites WHERE photo_id=%s', (photo_id,))
        cnt = cur.fetchone()['c']
    conn.close()
    return {'ok': True, 'favorited': favorited, 'favorites': cnt}

@app.post('/api/photos/{photo_id}/comment')
async def add_comment(photo_id: int, request: Request, payload: dict = Depends(auth_required)):
    require_csrf(request, payload)
    content = None
    try:
        form = await request.form()
        v = form.get('content')
        if isinstance(v, str):
            content = v
    except Exception:
        pass
    if not content:
        try:
            data = await request.json()
            if isinstance(data, dict):
                v = data.get('content')
                if isinstance(v, str):
                    content = v
        except Exception:
            pass
    if not isinstance(content, str) or not content.strip():
        raise HTTPException(status_code=400, detail='评论内容不能为空')
    content = content.strip()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM photos WHERE id=%s', (photo_id,))
        if not cur.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail='作品不存在')
        cur.execute('INSERT INTO comments (user_id, photo_id, content) VALUES (%s,%s,%s)', (payload['id'], photo_id, content))
        cid = cur.lastrowid
        cur.execute('SELECT c.id, c.content, c.created_at, u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE c.id=%s', (cid,))
        cmt = cur.fetchone()
    conn.close()
    return {'ok': True, 'comment': cmt}

@app.post('/api/photos')
def upload_photos(request: Request, payload: dict = Depends(auth_required), files: List[UploadFile] = File(...), title: str = Form(None), description: str = Form(None), camera: str = Form(None), settings: str = Form(None), category: str = Form(None), tags: str = Form(None)):
    role_required(payload, 'admin')
    require_csrf(request, payload)
    user_id = payload['id']
    uploads_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
    originals = os.path.join(uploads_root, 'originals')
    processed = os.path.join(uploads_root, 'processed')
    thumbs = os.path.join(uploads_root, 'thumbs')
    items = []
    conn = get_conn()
    with conn.cursor() as cur:
        day_limit = int(os.getenv('UPLOAD_MAX_PER_DAY_BYTES', '0') or '0')
        month_limit = int(os.getenv('UPLOAD_MAX_PER_MONTH_BYTES', '0') or '0')
        cur.execute('SELECT COALESCE(SUM(size_bytes),0) as sum FROM photos WHERE user_id=%s AND DATE(created_at)=CURDATE()', (user_id,))
        day_used = int(cur.fetchone()['sum'] or 0)
        cur.execute("SELECT COALESCE(SUM(size_bytes),0) as sum FROM photos WHERE user_id=%s AND DATE_FORMAT(created_at,'%%Y-%%m')=DATE_FORMAT(CURDATE(),'%%Y-%%m')", (user_id,))
        month_used = int(cur.fetchone()['sum'] or 0)
        for uf in files:
            base = f"{int(datetime.utcnow().timestamp()*1000)}-{os.urandom(4).hex()}"
            ext = os.path.splitext(uf.filename)[1].lower() or '.jpg'
            size_bytes = 0
            uf.file.seek(0)
            content = b''
            while True:
                chunk = uf.file.read(1024*1024)
                if not chunk:
                    break
                content += chunk
                size_bytes += len(chunk)
            if day_limit and (day_used + size_bytes) > day_limit:
                raise HTTPException(status_code=429, detail='超出每日上传总量限制')
            if month_limit and (month_used + size_bytes) > month_limit:
                raise HTTPException(status_code=429, detail='超出每月上传总量限制')
            day_used += size_bytes
            month_used += size_bytes
            
            image_url = None
            thumb_url = None
            original_url = None
            try:
                img = Image.open(io.BytesIO(content))
                img_copy = img.copy()
                img_copy.thumbnail((2000, 2000))
                buf_proc = io.BytesIO()
                img_copy.save(buf_proc, format='WEBP', quality=80)
                proc_key = f"processed/{base}.webp"
                ok_proc = _minio_put_bytes(proc_key, buf_proc.getvalue(), content_type='image/webp')
                th = img.copy()
                th.thumbnail((480, 480))
                buf_th = io.BytesIO()
                th.save(buf_th, format='WEBP', quality=70)
                th_key = f"thumbs/{base}_thumb.webp"
                ok_th = _minio_put_bytes(th_key, buf_th.getvalue(), content_type='image/webp')
                orig_key = f"originals/{base}{ext}"
                ok_orig = _minio_put_bytes(orig_key, content, content_type=uf.content_type or 'application/octet-stream')
                image_url = _minio_url(proc_key) if ok_proc else None
                thumb_url = _minio_url(th_key) if ok_th else None
                original_url = _minio_url(orig_key) if ok_orig else None
            except Exception:
                pass
            
            if not (image_url and thumb_url and original_url):
                orig_path = os.path.join(originals, base + ext)
                proc_path = os.path.join(processed, base + '.webp')
                thumb_path = os.path.join(thumbs, base + '_thumb.webp')
                with open(orig_path, 'wb') as out:
                    out.write(content)
                try:
                    img = Image.open(orig_path)
                    img_copy = img.copy()
                    img_copy.thumbnail((2000, 2000))
                    img_copy.save(proc_path, format='WEBP', quality=80)
                    th = img.copy()
                    th.thumbnail((480, 480))
                    th.save(thumb_path, format='WEBP', quality=70)
                    image_url = asset_url(f'uploads/processed/{os.path.basename(proc_path)}')
                    thumb_url = asset_url(f'uploads/thumbs/{os.path.basename(thumb_path)}')
                except Exception:
                    image_url = asset_url(f'uploads/originals/{os.path.basename(orig_path)}')
                    thumb_url = image_url
                original_url = asset_url(f'uploads/originals/{os.path.basename(orig_path)}')
            t = title or uf.filename
            cur.execute('INSERT INTO photos (user_id, title, description, camera, settings, category, original_url, image_url, thumb_url, size_bytes) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)', (user_id, t, description, camera, settings, category, original_url, image_url, thumb_url, size_bytes))
            photo_id = cur.lastrowid
            tags_arr = [s.strip() for s in (tags or '').split(',') if s.strip()]
            for tg in tags_arr:
                cur.execute('SELECT id FROM tags WHERE name=%s', (tg,))
                r = cur.fetchone()
                tag_id = None
                if r:
                    tag_id = r['id']
                else:
                    cur.execute('INSERT INTO tags (name) VALUES (%s)', (tg,))
                    tag_id = cur.lastrowid
                cur.execute('INSERT IGNORE INTO photo_tags (photo_id, tag_id) VALUES (%s,%s)', (photo_id, tag_id))
            items.append({'id': photo_id, 'image_url': image_url, 'thumb_url': thumb_url})
    conn.close()
    return {'ok': True, 'items': items}

@app.post('/api/admin/minio-import')
def admin_minio_import(request: Request, payload: dict = Depends(auth_required), url: str = Form(...), title: str = Form(None), description: str = Form(None), camera: str = Form(None), settings: str = Form(None), category: str = Form(None), tags: str = Form(None)):
    role_required(payload, 'admin')
    require_csrf(request, payload)
    key = _minio_key_from_url(url) or (url or '').strip()
    if not key:
        raise HTTPException(status_code=400, detail='无效URL')
    data = _minio_get_bytes(key)
    if not data:
        raise HTTPException(status_code=404, detail='对象不存在或不可读取')
    base = os.path.splitext(os.path.basename(key))[0]
    ext = os.path.splitext(key)[1].lower() or '.jpg'
    image_url = None
    thumb_url = None
    try:
        img = Image.open(io.BytesIO(data))
        img_copy = img.copy()
        img_copy.thumbnail((2000, 2000))
        buf_proc = io.BytesIO()
        img_copy.save(buf_proc, format='WEBP', quality=80)
        proc_key = f"processed/{base}.webp"
        ok_proc = _minio_put_bytes(proc_key, buf_proc.getvalue(), content_type='image/webp')
        th = img.copy()
        th.thumbnail((480, 480))
        buf_th = io.BytesIO()
        th.save(buf_th, format='WEBP', quality=70)
        th_key = f"thumbs/{base}_thumb.webp"
        ok_th = _minio_put_bytes(th_key, buf_th.getvalue(), content_type='image/webp')
        image_url = _minio_url(proc_key) if ok_proc else None
        thumb_url = _minio_url(th_key) if ok_th else None
    except Exception:
        pass
    original_url = _minio_url(key)
    conn = get_conn()
    with conn.cursor() as cur:
        t = title or os.path.basename(key)
        cur.execute('INSERT INTO photos (user_id, title, description, camera, settings, category, original_url, image_url, thumb_url, size_bytes) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)', (payload['id'], t, description, camera, settings, category, original_url, image_url or original_url, thumb_url or image_url or original_url, len(data)))
        photo_id = cur.lastrowid
        tags_arr = [s.strip() for s in (tags or '').split(',') if s.strip()]
        for tg in tags_arr:
            cur.execute('SELECT id FROM tags WHERE name=%s', (tg,))
            r = cur.fetchone()
            tag_id = r['id'] if r else None
            if tag_id is None:
                cur.execute('INSERT INTO tags (name) VALUES (%s)', (tg,))
                tag_id = cur.lastrowid
            cur.execute('INSERT IGNORE INTO photo_tags (photo_id, tag_id) VALUES (%s,%s)', (photo_id, tag_id))
    conn.close()
    return {'ok': True, 'id': photo_id, 'image_url': image_url or original_url, 'thumb_url': thumb_url or image_url or original_url}

@app.post('/api/admin/minio-upload')
def admin_minio_upload(request: Request, payload: dict = Depends(auth_required), file: UploadFile = File(...), title: str = Form(None), description: str = Form(None), camera: str = Form(None), settings: str = Form(None), category: str = Form(None), tags: str = Form(None)):
    role_required(payload, 'admin')
    require_csrf(request, payload)
    base = f"{int(datetime.utcnow().timestamp()*1000)}-{os.urandom(4).hex()}"
    ext = os.path.splitext(file.filename or '')[1].lower() or '.jpg'
    content = file.file.read()
    image_url = None
    thumb_url = None
    original_url = None
    try:
        img = Image.open(io.BytesIO(content))
        img_copy = img.copy(); img_copy.thumbnail((2000, 2000))
        buf_proc = io.BytesIO(); img_copy.save(buf_proc, format='WEBP', quality=80)
        th = img.copy(); th.thumbnail((480, 480))
        buf_th = io.BytesIO(); th.save(buf_th, format='WEBP', quality=70)
        ok_proc = _minio_put_bytes(f"processed/{base}.webp", buf_proc.getvalue(), content_type='image/webp')
        ok_th = _minio_put_bytes(f"thumbs/{base}_thumb.webp", buf_th.getvalue(), content_type='image/webp')
        ok_orig = _minio_put_bytes(f"originals/{base}{ext}", content, content_type=file.content_type or 'application/octet-stream')
        image_url = _minio_url(f"processed/{base}.webp") if ok_proc else None
        thumb_url = _minio_url(f"thumbs/{base}_thumb.webp") if ok_th else None
        original_url = _minio_url(f"originals/{base}{ext}") if ok_orig else None
    except Exception:
        pass
    if not (image_url and thumb_url and original_url):
        uploads_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
        originals = os.path.join(uploads_root, 'originals')
        processed = os.path.join(uploads_root, 'processed')
        thumbs = os.path.join(uploads_root, 'thumbs')
        orig_path = os.path.join(originals, base + ext)
        proc_path = os.path.join(processed, base + '.webp')
        th_path = os.path.join(thumbs, base + '_thumb.webp')
        with open(orig_path, 'wb') as out:
            out.write(content)
        try:
            img = Image.open(orig_path)
            img_copy = img.copy(); img_copy.thumbnail((2000, 2000))
            img_copy.save(proc_path, format='WEBP', quality=80)
            th = img.copy(); th.thumbnail((480, 480))
            th.save(th_path, format='WEBP', quality=70)
            image_url = asset_url(f'uploads/processed/{os.path.basename(proc_path)}')
            thumb_url = asset_url(f'uploads/thumbs/{os.path.basename(th_path)}')
        except Exception:
            image_url = asset_url(f'uploads/originals/{os.path.basename(orig_path)}')
            thumb_url = image_url
        original_url = asset_url(f'uploads/originals/{os.path.basename(orig_path)}')
    conn = get_conn()
    with conn.cursor() as cur:
        t = title or file.filename
        cur.execute('INSERT INTO photos (user_id, title, description, camera, settings, category, original_url, image_url, thumb_url, size_bytes) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)', (payload['id'], t, description, camera, settings, category, original_url, image_url, thumb_url, len(content)))
        photo_id = cur.lastrowid
        tags_arr = [s.strip() for s in (tags or '').split(',') if s.strip()]
        for tg in tags_arr:
            cur.execute('SELECT id FROM tags WHERE name=%s', (tg,))
            r = cur.fetchone(); tag_id = r['id'] if r else None
            if tag_id is None:
                cur.execute('INSERT INTO tags (name) VALUES (%s)', (tg,))
                tag_id = cur.lastrowid
            cur.execute('INSERT IGNORE INTO photo_tags (photo_id, tag_id) VALUES (%s,%s)', (photo_id, tag_id))
    conn.close()
    return {'ok': True, 'id': photo_id, 'image_url': image_url, 'thumb_url': thumb_url}

@app.post('/api/admin/minio-delete')
def admin_minio_delete(request: Request, payload: dict = Depends(auth_required), url: str = Form(...), remove_related: bool = Form(True)):
    role_required(payload, 'admin')
    require_csrf(request, payload)
    key = _minio_key_from_url(url) or (url or '').strip()
    if not key:
        raise HTTPException(status_code=400, detail='无效URL')
    _minio_remove(key)
    if not remove_related:
        return {'ok': True}
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('SELECT * FROM photos WHERE original_url=%s OR image_url=%s OR thumb_url=%s', (url, url, url))
        rows = cur.fetchall()
        for photo in rows:
            pid = photo['id']
            cur.execute('SELECT id, image_url, thumb_url FROM home_carousel WHERE photo_id=%s', (pid,))
            related = cur.fetchall()
            for hc in related:
                ik = _minio_key_from_url(hc.get('image_url') or '')
                tk = _minio_key_from_url(hc.get('thumb_url') or '')
                if ik:
                    _minio_remove(ik)
                if tk:
                    _minio_remove(tk)
                cur.execute('DELETE FROM home_carousel WHERE id=%s', (hc['id'],))
            for u in [photo.get('image_url'), photo.get('thumb_url'), photo.get('original_url')]:
                if u:
                    k = _minio_key_from_url(u)
                    if k:
                        _minio_remove(k)
            cur.execute('DELETE FROM photo_tags WHERE photo_id=%s', (pid,))
            cur.execute('DELETE FROM likes WHERE photo_id=%s', (pid,))
            cur.execute('DELETE FROM favorites WHERE photo_id=%s', (pid,))
            cur.execute('DELETE FROM comments WHERE photo_id=%s', (pid,))
            cur.execute('DELETE FROM photos WHERE id=%s', (pid,))
    conn.close()
    return {'ok': True}

def _process_carousel_image(content: bytes):
    img = Image.open(io.BytesIO(content))
    w, h = img.size
    target_w, target_h = 2560, 1067
    ratio = target_w / target_h
    cur = w / h
    if cur > ratio:
        new_w = int(h * ratio)
        x = (w - new_w) // 2
        img = img.crop((x, 0, x + new_w, h))
    else:
        new_h = int(w / ratio)
        y = (h - new_h) // 2
        img = img.crop((0, y, w, y + new_h))
    img = img.resize((target_w, target_h))
    th = img.copy()
    th.thumbnail((480, 480))
    return img, th

@app.get('/api/carousel')
def list_carousel():
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('SELECT hc.id, hc.image_url, hc.thumb_url, hc.sort_order, p.title FROM home_carousel hc LEFT JOIN photos p ON p.id = hc.photo_id ORDER BY hc.sort_order ASC, hc.id ASC')
        rows = cur.fetchall()
    conn.close()
    return [normalize_row_urls(r) for r in rows]

@app.get('/api/admin/carousel')
def admin_list_carousel(payload: dict = Depends(auth_required)):
    role_required(payload, 'admin')
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('SELECT hc.id, hc.image_url, hc.thumb_url, hc.sort_order, p.title FROM home_carousel hc LEFT JOIN photos p ON p.id = hc.photo_id ORDER BY hc.sort_order ASC, hc.id ASC')
        rows = cur.fetchall()
    conn.close()
    return [normalize_row_urls(r) for r in rows]

@app.post('/api/admin/carousel')
def admin_add_carousel(request: Request, payload: dict = Depends(auth_required), file: UploadFile = File(...)):
    role_required(payload, 'admin')
    require_csrf(request, payload)
    if file.content_type not in ('image/jpeg', 'image/png', 'image/webp'):
        raise HTTPException(status_code=400, detail='仅支持JPG/PNG图片')
    content = file.file.read()
    try:
        img, thumb = _process_carousel_image(content)
    except Exception:
        raise HTTPException(status_code=400, detail='图片处理失败或格式不支持')
    base = f"{int(datetime.utcnow().timestamp()*1000)}-{os.urandom(4).hex()}"
    buf_img = io.BytesIO(); img.save(buf_img, format='WEBP', quality=85)
    buf_th = io.BytesIO(); thumb.save(buf_th, format='WEBP', quality=75)
    car_key = f"carousel/{base}.webp"
    th_key = f"carousel_thumbs/{base}_thumb.webp"
    ok_img = _minio_put_bytes(car_key, buf_img.getvalue(), content_type='image/webp')
    ok_th = _minio_put_bytes(th_key, buf_th.getvalue(), content_type='image/webp')
    image_url = _minio_url(car_key) if ok_img else None
    thumb_url = _minio_url(th_key) if ok_th else None
    if not (image_url and thumb_url):
        uploads_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
        car_dir = os.path.join(uploads_root, 'carousel')
        car_thumbs = os.path.join(uploads_root, 'carousel_thumbs')
        proc_path = os.path.join(car_dir, base + '.webp')
        thumb_path = os.path.join(car_thumbs, base + '_thumb.webp')
        img.save(proc_path, format='WEBP', quality=85)
        thumb.save(thumb_path, format='WEBP', quality=75)
        image_url = asset_url(f'uploads/carousel/{os.path.basename(proc_path)}')
        thumb_url = asset_url(f'uploads/carousel_thumbs/{os.path.basename(thumb_path)}')
    conn = get_conn()
    with conn.cursor() as cur:
        # 同步到作品库
        title = os.path.splitext(file.filename or '')[0] or '首页轮播图'
        cur.execute('INSERT INTO photos (user_id, title, description, camera, settings, category, original_url, image_url, thumb_url, size_bytes) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)', (payload['id'], title, None, None, None, 'carousel', None, image_url, thumb_url, len(content)))
        photo_id = cur.lastrowid
        cur.execute('SELECT COUNT(*) as c FROM home_carousel')
        c = cur.fetchone()['c']
        if c >= 9:
            try:
                os.remove(proc_path)
                os.remove(thumb_path)
            except Exception:
                pass
            raise HTTPException(status_code=400, detail='最多只能上传9张轮播图')
        cur.execute('SELECT COALESCE(MAX(sort_order), 0) as m FROM home_carousel')
        m = cur.fetchone()['m']
        cur.execute('INSERT INTO home_carousel (image_url, thumb_url, photo_id, sort_order) VALUES (%s,%s,%s,%s)', (image_url, thumb_url, photo_id, m + 1))
        new_id = cur.lastrowid
    conn.close()
    return {'ok': True, 'id': new_id, 'image_url': image_url, 'thumb_url': thumb_url}

@app.put('/api/admin/carousel/sort')
async def admin_sort_carousel(request: Request, payload: dict = Depends(auth_required)):
    role_required(payload, 'admin')
    require_csrf(request, payload)
    data = await request.json()
    ids = data.get('ids') or []
    if not isinstance(ids, list) or not all(isinstance(i, int) for i in ids):
        raise HTTPException(status_code=400, detail='请求格式错误')
    conn = get_conn()
    with conn.cursor() as cur:
        order = 1
        for cid in ids:
            cur.execute('UPDATE home_carousel SET sort_order=%s WHERE id=%s', (order, cid))
            order += 1
    conn.close()
    return {'ok': True}

@app.delete('/api/admin/carousel/{cid}')
def admin_delete_carousel(cid: int, request: Request, payload: dict = Depends(auth_required)):
    role_required(payload, 'admin')
    require_csrf(request, payload)
    uploads_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
    car_dir = os.path.join(uploads_root, 'carousel')
    car_thumbs = os.path.join(uploads_root, 'carousel_thumbs')
    conn = get_conn()
    image = None
    thumb = None
    with conn.cursor() as cur:
        cur.execute('SELECT image_url, thumb_url FROM home_carousel WHERE id=%s', (cid,))
        row = cur.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail='轮播图不存在')
        image = os.path.join(car_dir, os.path.basename(row['image_url'] or ''))
        thumb = os.path.join(car_thumbs, os.path.basename(row['thumb_url'] or ''))
        ik = _minio_key_from_url(row.get('image_url') or '')
        tk = _minio_key_from_url(row.get('thumb_url') or '')
        if ik:
            _minio_remove(ik)
        if tk:
            _minio_remove(tk)
        cur.execute('DELETE FROM home_carousel WHERE id=%s', (cid,))
    conn.close()
    try:
        if image and os.path.exists(image):
            os.remove(image)
        if thumb and os.path.exists(thumb):
            os.remove(thumb)
    except Exception:
        pass
    return {'ok': True}

@app.put('/api/admin/carousel/{cid}')
def admin_replace_carousel(cid: int, request: Request, payload: dict = Depends(auth_required), file: UploadFile = File(...)):
    role_required(payload, 'admin')
    require_csrf(request, payload)
    if file.content_type not in ('image/jpeg', 'image/png', 'image/webp'):
        raise HTTPException(status_code=400, detail='仅支持JPG/PNG图片')
    content = file.file.read()
    uploads_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
    car_dir = os.path.join(uploads_root, 'carousel')
    car_thumbs = os.path.join(uploads_root, 'carousel_thumbs')
    try:
        img, thumb = _process_carousel_image(content)
    except Exception:
        raise HTTPException(status_code=400, detail='图片处理失败或格式不支持')
    conn = get_conn()
    old_proc = None
    old_thumb = None
    with conn.cursor() as cur:
        cur.execute('SELECT image_url, thumb_url FROM home_carousel WHERE id=%s', (cid,))
        row = cur.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail='轮播图不存在')
        if row['image_url']:
            old_proc = os.path.join(car_dir, os.path.basename(row['image_url']))
        if row['thumb_url']:
            old_thumb = os.path.join(car_thumbs, os.path.basename(row['thumb_url']))
        base = f"{int(datetime.utcnow().timestamp()*1000)}-{os.urandom(4).hex()}"
        buf_img = io.BytesIO(); img.save(buf_img, format='WEBP', quality=85)
        buf_th = io.BytesIO(); thumb.save(buf_th, format='WEBP', quality=75)
        car_key = f"carousel/{base}.webp"
        th_key = f"carousel_thumbs/{base}_thumb.webp"
        ok_img = _minio_put_bytes(car_key, buf_img.getvalue(), content_type='image/webp')
        ok_th = _minio_put_bytes(th_key, buf_th.getvalue(), content_type='image/webp')
        image_url = _minio_url(car_key) if ok_img else None
        thumb_url = _minio_url(th_key) if ok_th else None
        if not (image_url and thumb_url):
            proc_path = os.path.join(car_dir, base + '.webp')
            thumb_path = os.path.join(car_thumbs, base + '_thumb.webp')
            img.save(proc_path, format='WEBP', quality=85)
            thumb.save(thumb_path, format='WEBP', quality=75)
            image_url = asset_url(f'uploads/carousel/{os.path.basename(proc_path)}')
            thumb_url = asset_url(f'uploads/carousel_thumbs/{os.path.basename(thumb_path)}')
        # 同步到作品库
        title = os.path.splitext(file.filename or '')[0] or '首页轮播图'
        cur.execute('INSERT INTO photos (user_id, title, description, camera, settings, category, original_url, image_url, thumb_url, size_bytes) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)', (payload['id'], title, None, None, None, 'carousel', None, image_url, thumb_url, len(content)))
        new_pid = cur.lastrowid
        cur.execute('UPDATE home_carousel SET image_url=%s, thumb_url=%s, photo_id=%s WHERE id=%s', (image_url, thumb_url, new_pid, cid))
    conn.close()
    try:
        if old_proc and os.path.exists(old_proc):
            os.remove(old_proc)
        if old_thumb and os.path.exists(old_thumb):
            os.remove(old_thumb)
    except Exception:
        pass
    return {'ok': True, 'id': cid, 'image_url': image_url, 'thumb_url': thumb_url}

@app.put('/api/photos/{photo_id}')
async def update_photo(photo_id: int, request: Request, payload: dict = Depends(auth_required)):
    require_csrf(request, payload)
    fields = {'title': None, 'description': None, 'camera': None, 'settings': None, 'category': None, 'tags': None}
    try:
        form = await request.form()
        for k in list(fields.keys()):
            v = form.get(k)
            if isinstance(v, str):
                fields[k] = v
    except Exception:
        pass
    try:
        data = await request.json()
        if isinstance(data, dict):
            for k in list(fields.keys()):
                v = data.get(k)
                if isinstance(v, str):
                    fields[k] = v
    except Exception:
        pass
    conn = get_conn()
    before = None
    with conn.cursor() as cur:
        cur.execute('SELECT * FROM photos WHERE id=%s', (photo_id,))
        photo = cur.fetchone()
        if not photo:
            conn.close()
            raise HTTPException(status_code=404, detail='作品不存在')
        if payload.get('role') not in ('admin','super_admin') and photo['user_id'] != payload['id']:
            conn.close()
            raise HTTPException(status_code=403, detail='无权限')
        sets = []
        params = []
        for k in ['title','description','camera','settings','category']:
            v = fields.get(k)
            if isinstance(v, str):
                sets.append(f"{k}=%s")
                params.append(v)
        if sets:
            sql = f"UPDATE photos SET {', '.join(sets)} WHERE id=%s"
            params.append(photo_id)
            cur.execute(sql, params)
        tg = fields.get('tags')
        if isinstance(tg, str):
            cur.execute('DELETE FROM photo_tags WHERE photo_id=%s', (photo_id,))
            tags_arr = [s.strip() for s in tg.split(',') if s.strip()]
            for name in tags_arr:
                cur.execute('SELECT id FROM tags WHERE name=%s', (name,))
                r = cur.fetchone()
                tag_id = r['id'] if r else None
                if tag_id is None:
                    cur.execute('INSERT INTO tags (name) VALUES (%s)', (name,))
                    tag_id = cur.lastrowid
                cur.execute('INSERT IGNORE INTO photo_tags (photo_id, tag_id) VALUES (%s,%s)', (photo_id, tag_id))
    conn.close()
    return {'ok': True}

@app.delete('/api/photos/{photo_id}')
def delete_photo(photo_id: int, request: Request, payload: dict = Depends(auth_required)):
    require_csrf(request, payload)
    conn = get_conn()
    uploads_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
    processed = os.path.join(uploads_root, 'processed')
    thumbs = os.path.join(uploads_root, 'thumbs')
    car_dir = os.path.join(uploads_root, 'carousel')
    car_thumbs = os.path.join(uploads_root, 'carousel_thumbs')
    with conn.cursor() as cur:
        cur.execute('SELECT * FROM photos WHERE id=%s', (photo_id,))
        photo = cur.fetchone()
        if not photo:
            conn.close()
            raise HTTPException(status_code=404, detail='作品不存在')
        if payload.get('role') not in ('admin','super_admin') and photo['user_id'] != payload['id']:
            conn.close()
            raise HTTPException(status_code=403, detail='无权限')
        cur.execute('SELECT id, image_url, thumb_url FROM home_carousel WHERE photo_id=%s', (photo_id,))
        related = cur.fetchall()
        for hc in related:
            cur.execute('DELETE FROM home_carousel WHERE id=%s', (hc['id'],))
            try:
                if hc.get('image_url'):
                    key = _minio_key_from_url(hc['image_url'])
                    if key:
                        _minio_remove(key)
                    p = os.path.join(car_dir, os.path.basename(hc['image_url']))
                    if os.path.exists(p):
                        os.remove(p)
                if hc.get('thumb_url'):
                    key = _minio_key_from_url(hc['thumb_url'])
                    if key:
                        _minio_remove(key)
                    t = os.path.join(car_thumbs, os.path.basename(hc['thumb_url']))
                    if os.path.exists(t):
                        os.remove(t)
            except Exception:
                pass
        cur.execute('DELETE FROM photo_tags WHERE photo_id=%s', (photo_id,))
        cur.execute('DELETE FROM likes WHERE photo_id=%s', (photo_id,))
        cur.execute('DELETE FROM favorites WHERE photo_id=%s', (photo_id,))
        cur.execute('DELETE FROM comments WHERE photo_id=%s', (photo_id,))
        cur.execute('DELETE FROM photos WHERE id=%s', (photo_id,))
    conn.close()
    try:
        for u in [photo.get('image_url'), photo.get('thumb_url'), photo.get('original_url')]:
            if u:
                key = _minio_key_from_url(u)
                if key:
                    _minio_remove(key)
            if u:
                
                dirs = [processed, thumbs, car_dir, car_thumbs]
                for d in dirs:
                    p = os.path.join(d, os.path.basename(u))
                    if os.path.exists(p):
                        os.remove(p)
    except Exception:
        pass
    return {'ok': True}

@app.post('/api/admin/superadmin')
def set_super_admin(request: Request, payload: dict = Depends(auth_required), username: str = Form(...)):
    role_required(payload, 'admin')
    require_csrf(request, payload)
    conn = get_conn()
    uploads_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
    processed = os.path.join(uploads_root, 'processed')
    thumbs = os.path.join(uploads_root, 'thumbs')
    total_deleted = 0
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM users WHERE username=%s', (username,))
        row = cur.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail='用户不存在')
        target_id = row['id']
        cur.execute('UPDATE users SET role=%s WHERE id=%s', ('super_admin', target_id))
        cur.execute('SELECT id FROM users WHERE role=%s AND id<>%s', ('admin', target_id))
        admins = [r['id'] for r in cur.fetchall()]
        for aid in admins:
            cur.execute('SELECT id, image_url, thumb_url FROM photos WHERE user_id=%s', (aid,))
            photos = cur.fetchall()
            for p in photos:
                pid = p['id']
                cur.execute('UPDATE home_carousel SET photo_id=NULL WHERE photo_id=%s', (pid,))
                cur.execute('DELETE FROM photo_tags WHERE photo_id=%s', (pid,))
                cur.execute('DELETE FROM likes WHERE photo_id=%s', (pid,))
                cur.execute('DELETE FROM favorites WHERE photo_id=%s', (pid,))
                cur.execute('DELETE FROM comments WHERE photo_id=%s', (pid,))
                cur.execute('DELETE FROM photos WHERE id=%s', (pid,))
                total_deleted += 1
                if p.get('image_url'):
                    try:
                        ip = os.path.join(processed, os.path.basename(p['image_url']))
                        if os.path.exists(ip):
                            os.remove(ip)
                    except Exception:
                        pass
                if p.get('thumb_url'):
                    try:
                        tp = os.path.join(thumbs, os.path.basename(p['thumb_url']))
                        if os.path.exists(tp):
                            os.remove(tp)
                    except Exception:
                        pass
    conn.close()
    return {'ok': True, 'super_admin_username': username, 'deleted_photos': total_deleted}

@app.get('/api/admin/admin-stats')
def admin_stats(payload: dict = Depends(auth_required)):
    role_required(payload, 'admin')
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT id, username, role FROM users WHERE role IN ('admin','super_admin')")
        users = cur.fetchall()
        result = []
        for u in users:
            cur.execute('SELECT COUNT(*) as c FROM photos WHERE user_id=%s', (u['id'],))
            c = cur.fetchone()['c']
            result.append({'id': u['id'], 'username': u['username'], 'role': u['role'], 'photos_count': c})
    conn.close()
    return result
