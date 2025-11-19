# PersonPhoto 项目说明

## 概览
- 前后端一体的照片/视频展示平台，支持首页视频展示、瀑布流作品浏览、轮播图、点赞/收藏/评论等功能。
- 角色权限：`admin` 与 `super_admin`；首页视频的上传/删除仅限 `super_admin`。

## 技术栈
- 后端：FastAPI、MySQL、MinIO（对象存储）、Uvicorn
- 前端：React、Vite、React Router、Axios

## 目录结构
- `python_server/` 后端代码
- `client/` 前端代码
- `uploads/` 本地回退存储（未配置 MinIO 时使用）
- `docs/minio-config.md` MinIO 配置说明
- `app.py` 后端统一入口

## 快速启动
- 后端（开发）
  - 创建虚拟环境并安装依赖：
    - `pip install -r python_server/requirements.txt`
  - 启动（本地存储）：
    - `./.venv/bin/python app.py`
  - 启动（MinIO 存储，请替换为你的实际值）：
    - ```
      MINIO_ENDPOINT=http://<your-minio-host>:<port> \
      MINIO_ACCESS_KEY=<your-access-key> \
      MINIO_SECRET_KEY=<your-secret-key> \
      MINIO_BUCKET=zhenyu-photo \
      MINIO_PUBLIC_BASE=http://<your-minio-host>:<port> \
      ./.venv/bin/python app.py
      ```
- 前端（开发）
  - 在 `client/` 目录运行：
    - `VITE_API_BASE=http://localhost:4002/api npm run dev`
  - 访问地址：`http://localhost:5173/`

## 环境变量
- 数据库（必填）
  - `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DB`
- 应用
  - `PORT`（默认 `4002`）、`HOST`（默认 `127.0.0.1`）
  - `JWT_SECRET`（建议自定义）、`ASSET_BASE_URL`（用于静态资源的绝对地址拼接）
- MinIO（可选，配置后优先使用对象存储，详见 `docs/minio-config.md`）
  - `MINIO_ENDPOINT`、`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`、`MINIO_BUCKET`、`MINIO_PUBLIC_BASE`、`MINIO_SECURE`

## 首页改版说明
- 第一屏：视频展示模块
  - 数据源：`GET /api/home-videos`
  - 特性：自动播放、静音、循环，移动端兼容
- 第二板块：流式滑动轮播图
  - 使用 `Carousel` 组件的 `flow` 模式实现连续横向滚动

## 管理功能
- 超级管理员首页视频管理
  - 路由：`/admin-home-videos`
  - 接口：
    - 列表：`GET /api/admin/home-videos`
    - 上传：`POST /api/admin/home-videos`（表单字段：`file`, `title`）
    - 删除：`DELETE /api/admin/home-videos/{vid}`
- 轮播图管理
  - 路由：`/admin-carousel`
  - 接口：`GET /api/carousel`、`POST /api/admin/carousel`、`DELETE /api/admin/carousel/{cid}`

## 权限与认证
- 登录成功后返回 `token`，请求需携带 `Authorization: Bearer <token>`
- 管理接口需校验 CSRF：`X-CSRF-Token: <sha256(user_id:JWT_SECRET)>`，通过 `GET /api/csrf` 获取
- 超级管理员：调用 `POST /api/admin/superadmin` 将指定用户升级为 `super_admin`

## 常见问题
- 前端显示不出视频/图片：检查资源 URL 前缀是否为 MinIO 公网地址或本地 `uploads/`；若 403，请确认桶策略允许 GetObject。
- 上传失败：确认登录身份为 `super_admin` 并携带 CSRF；视频上传仅允许 `video/*` MIME 类型。
- 连接 MySQL 失败：确认服务已启动、账号口令与端口正确；首次连接会自动初始化数据库与表结构。

## 安全建议
- 不要把密钥与口令写入仓库；使用进程环境变量或安全配置管理。
- 如需外网访问，建议为 MinIO 配置合适的策略与域名，并通过 CDN/反向代理暴露 `MINIO_PUBLIC_BASE`。

## 代码位置提示
- MinIO 客户端与配置：`python_server/main.py:51-79`
- 首页视频接口：`python_server/main.py:1008, 1027`
- 首页视频展示：`client/src/pages/Home.jsx:150-194`
- 流式轮播：`client/src/components/Carousel.jsx:75-119` 与 `client/src/index.css:670-680`

## 运行地址
- 后端：`http://localhost:4002/api`
- 静态资源：`http://localhost:4002/uploads/`
- 前端：`http://localhost:5173/`