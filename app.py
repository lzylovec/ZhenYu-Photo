import os
import sys
import subprocess
import importlib.util

REQUIRED = [
    'fastapi',
    'uvicorn',
    'PyJWT',
    'bcrypt',
    'pymysql',
    'python-multipart',
    'Pillow',
]

def _spec(name: str):
    m = name.replace('-', '_')
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
        'MYSQL_HOST': '127.0.0.1',
        'MYSQL_PORT': '3306',
        'MYSQL_USER': 'root',
        'MYSQL_PASSWORD': 'liutaotao0202',
        'MYSQL_DB': 'person_photo',
        'JWT_SECRET': 'change_me',
        'ADMIN_USERNAME': 'admin',
        'ADMIN_PASSWORD': 'admin123',
        'ASSET_BASE_URL': 'http://localhost:4002',
        'HOST': '0.0.0.0',
        'PORT': '4002',
        'ALLOWED_REFERRERS': 'http://localhost:5173, http://localhost:4002, http://192.168., http://10., http://172., https://*.ngrok-free.app, https://*.ngrok-free.dev, https://*.ngrok.io',
    }
    for k, v in env.items():
        if not os.getenv(k):
            os.environ[k] = v

def main():
    root = os.path.abspath(os.path.dirname(__file__))
    os.chdir(root)
    default_env()
    print('Python解释器:', sys.executable)
    print('工作目录:', root)
    print('数据库:', os.getenv('MYSQL_USER'), '@', os.getenv('MYSQL_HOST'), ':', os.getenv('MYSQL_PORT'), '/', os.getenv('MYSQL_DB'))
    ensure_deps()
    # 确保可导入包
    if not os.getenv('PYTHONPATH'):
        os.environ['PYTHONPATH'] = os.getcwd()
    if os.getcwd() not in sys.path:
        sys.path.insert(0, os.getcwd())
    print('PYTHONPATH:', os.environ.get('PYTHONPATH'))
    print('sys.path[0]:', sys.path[0])

    import uvicorn
    host = os.getenv('HOST', '127.0.0.1')
    port = int(os.getenv('PORT', '4002'))
    print('后端地址:', f'http://{host}:{port}/api')
    try:
        from python_server.main import app as fastapi_app
        uvicorn.run(fastapi_app, host=host, port=port)
    except Exception as e:
        print('导入 python_server.main 失败:', e)
        import runpy
        mod_path = os.path.join(os.getcwd(), 'python_server', '__main__.py')
        print('使用运行路径加载:', mod_path)
        g = runpy.run_path(mod_path)
        fastapi_app = g.get('app')
        if fastapi_app is None:
            raise RuntimeError('未找到 app 实例')
        uvicorn.run(fastapi_app, host=host, port=port)

if __name__ == '__main__':
    main()