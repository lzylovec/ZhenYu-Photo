# 项目运行与 PyCharm 配置指南

## 一键运行
- 直接运行项目根目录的 `app.py` 即可启动后端服务。
- 启动地址：`http://localhost:4002/api`，静态资源：`http://localhost:4002/uploads/`。

## 项目结构
- 后端代码目录：`python_server/`
- 统一入口：`app.py`
- 依赖清单：`python_server/requirements.txt`
- 前端代码目录：`client/`

## 依赖管理
- 后端依赖已固定版本：见 `python_server/requirements.txt`。
- 首次运行 `app.py` 会自动检测依赖并尝试安装缺失依赖；如失败，请手动执行：
  - `pip install -r python_server/requirements.txt`

## PyCharm 配置
- Python 解释器：选择本项目对应的虚拟环境或系统 Python3。
- 运行配置：
  - Script path：指向项目根的 `app.py`
  - Working directory：项目根目录
  - Environment：
    - `MYSQL_HOST=127.0.0.1`
    - `MYSQL_PORT=3306`
    - `MYSQL_USER=root`
    - `MYSQL_PASSWORD=liutaotao0202`
    - `MYSQL_DB=person_photo`
    - `JWT_SECRET=change_me`
    - `ADMIN_USERNAME=admin`
    - `ADMIN_PASSWORD=admin123`
    - `ASSET_BASE_URL=http://localhost:4002`
    - 可选：`PORT=4002`、`HOST=127.0.0.1`

## 常见问题
- 依赖安装失败：确认使用的解释器与项目一致，手动执行 `pip install -r python_server/requirements.txt`。
- 图片不显示：确保文件位于项目根 `uploads/processed`、`uploads/thumbs` 等目录，并可通过 `http://localhost:4002/uploads/...` 访问。
- 数据库连接失败：确认 MySQL 已开启，账号密码端口正确；数据库会在首次连接时自动创建为 `person_photo`。

## 使用方法
- 管理员登录后可进行上传与轮播图管理；普通用户可浏览与查看详情。
- 如需同时运行前端，请在 `client` 目录执行：`VITE_API_BASE=http://localhost:4002/api npm run dev`。