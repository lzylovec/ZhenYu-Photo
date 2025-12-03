import os
import sys
import subprocess
import importlib.util

REQUIRED = [
    'fastapi',
    'uvicorn',
    'PyJWT',
    'bcrypt',
    'python-multipart',
    'Pillow',
    'psycopg2-binary',
]

def _spec(name: str):
    m = name.replace('-', '_')
    if name == 'psycopg2-binary':
        m = 'psycopg2'
    return importlib.util.find_spec(m)

def ensure_deps():
    missing = [x for x in REQUIRED if _spec(x) is None]
    if not missing:
        return
    print('缺少依赖:', ', '.join(missing))
    req = os.path.join(os.path.dirname(__file__), 'python_server', 'requirements.txt')
    if os.path.exists(req):
        print('自动安装依赖:', req)
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', req])
        except Exception as e:
            print('自动安装失败，请手动执行: pip install -r python_server/requirements.txt')
            raise e
    else:
        print('未找到 requirements.txt，请手动安装')

def default_env():
    env = {
        'JWT_SECRET': 'change_me',
        'ADMIN_USERNAME': 'admin',
        'ADMIN_PASSWORD': 'admin123',
        'ASSET_BASE_URL': 'http://localhost:4002',
        'HOST': '0.0.0.0',
        'PORT': '4002',
        'ALLOWED_REFERRERS': 'http://localhost:5173, http://localhost:4002, http://192.168., http://10., http://172., https://*.ngrok-free.app, https://*.ngrok-free.dev, https://*.ngrok.io',
        'R2_SECURE': 'true',
        'R2_BUCKET': 'photos',
    }
    for k, v in env.items():
        if not os.getenv(k):
            os.environ[k] = v

def main():
    root = os.path.abspath(os.path.dirname(__file__))
    os.chdir(root)
    def load_env_file():
        for name in ('.env.local', '.env'):
            path = os.path.join(root, name)
            if os.path.exists(path):
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        for line in f:
                            s = line.strip()
                            if not s or s.startswith('#'):
                                continue
                            if '=' not in s:
                                continue
                            k, v = s.split('=', 1)
                            k = k.strip()
                            v = v.strip().strip('"').strip("'")
                            if not os.getenv(k):
                                os.environ[k] = v
                except Exception:
                    pass
                break
    load_env_file()
    default_env()
    print('Python解释器:', sys.executable)
    print('工作目录:', root)
    print('数据库:', os.getenv('DATABASE_URL'))
    ensure_deps()
    # 确保可导入包
    if not os.getenv('PYTHONPATH'):
        os.environ['PYTHONPATH'] = os.getcwd()
    if os.getcwd() not in sys.path:
        sys.path.insert(0, os.getcwd())
    print('PYTHONPATH:', os.environ.get('PYTHONPATH'))
    print('sys.path[0]:', sys.path[0])

    import uvicorn
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', '4002'))
    print('后端地址:', f'http://{host}:{port}/api')
    try:
        from python_server.main import app as fastapi_app
        uvicorn.run(fastapi_app, host=host, port=port)
