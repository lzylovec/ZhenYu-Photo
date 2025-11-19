# MinIO 配置说明

此项目的后端通过环境变量读取 MinIO 配置，并优先将素材上传到 MinIO；当未配置或连接失败时，会优雅回退到本地 `uploads/` 目录。

## 环境变量
- `MINIO_ENDPOINT`：MinIO 服务地址，含协议与端口，例如 `http://172.16.4.231:9999`
- `MINIO_ACCESS_KEY`：aicadmin
- `MINIO_SECRET_KEY`：XcEvHHuc3eAYa9wnzbK0kHZno66KSyDx
- `MINIO_BUCKET`：存储桶名称，示例：`zhenyu-photo`
- `MINIO_PUBLIC_BASE`：用于拼接公开访问 URL 的基地址，例如 `http://172.16.4.231:9999`
- `MINIO_SECURE`：是否使用 HTTPS（`true`/`false`，默认 `false`）
- `MINIO_CONNECT_TIMEOUT`：连接超时秒数（默认 `2`）
- `MINIO_READ_TIMEOUT`：读超时秒数（默认 `10`）
- `MINIO_RETRY`：请求重试次数（默认 `1`）

代码位置：
- `_minio_client`：`python_server/main.py:51-79`
- `_minio_public_base`：`python_server/main.py:81-92`
- `_minio_url`：`python_server/main.py:93-104`
- `_minio_put_bytes`：`python_server/main.py:105-115`
- `_minio_remove`：`python_server/main.py:116-124`
- `_minio_key_from_url`：`python_server/main.py:126-134`

## 存储前缀约定
- 首页视频：`videos/`
- 轮播图原图：`carousel/`
- 轮播图缩略图：`carousel_thumbs/`
- 作品处理后图：`processed/`
- 作品缩略图：`thumbs/`
- 作品原图：`originals/`

首页视频接口：
- 列表（匿名可读）：`GET /api/home-videos`（`python_server/main.py:1008`）
- 管理列表（超级管理员）：`GET /api/admin/home-videos`
- 上传（超级管理员）：`POST /api/admin/home-videos`（`python_server/main.py:1027`）
- 删除（超级管理员）：`DELETE /api/admin/home-videos/{vid}`

## 启动示例（注入环境变量）
开发环境建议直接在启动命令前注入：

```
MINIO_ENDPOINT=http://172.16.4.231:9999 \
MINIO_ACCESS_KEY=aicadmin \
MINIO_SECRET_KEY=XcEvHHuc3eAYa9wnzbK0kHZno66KSyDx \
MINIO_BUCKET=zhenyu-photo \
MINIO_PUBLIC_BASE=http://172.16.4.231:9999 \
./.venv/bin/python app.py
```

## 公开访问与桶策略
- 当设置了 `MINIO_PUBLIC_BASE` 时，后端会拼接公开 URL：`{MINIO_PUBLIC_BASE}/{bucket}/{object_name}`
- 为了让前端直接访问对象，需为桶设置允许 `GetObject` 的策略。示例（注意按照你的桶名修改）：

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": "*"},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::zhenyu-photo/*"]
    }
  ]
}
```

## 验证步骤
- 上传首页视频后，调用 `GET /api/home-videos`：
  - 若 `video_url` 前缀为 `http://172.16.4.231:9999/zhenyu-photo/videos/...`，说明使用了 MinIO
  - 若前缀为 `http://localhost:4002/uploads/videos/...`，说明回退到本地存储
- 使用 `curl -I <video_url>` 验证资源可访问与响应头类型为 `video/mp4`

## 故障排查
- 未设置或设置错误的 `MINIO_*`：后端会自动回退本地；检查环境变量并重启后端
- 桶不存在：后端会尝试 `make_bucket` 创建；必要时手动在 MinIO 控制台创建
- 访问 403：检查桶策略是否允许公开读取或前端是否使用了签名 URL
- 网络不通或证书问题：确认 `MINIO_ENDPOINT` 可达，HTTPS 场景务必配置正确证书并设置 `MINIO_SECURE=true`

## 安全建议
- 切勿将 `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` 写入代码仓库或前端；使用进程环境变量或安全的配置管理
- 若需外网访问，建议使用专用 CDN 或反向代理公开 `MINIO_PUBLIC_BASE`