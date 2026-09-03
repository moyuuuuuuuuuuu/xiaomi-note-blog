# 小米笔记博客

把小米云笔记同步到自托管服务器本地，作为个人博客/碎片记录站点使用。

## 运行

安装依赖：

```bash
pnpm install
```

复制环境变量示例并设置管理员密码：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
ADMIN_PASSWORD=你的管理员密码
PORT=8787
DATA_DIR=./data
PASSWORD_LOCK_MAX_ATTEMPTS=5
PASSWORD_LOCK_MS=86400000
```

开发时需要同时启动 API 服务和 Vite：

```bash
pnpm run server
pnpm run dev
```

生产运行：

```bash
pnpm run build
pnpm start
```

访问 `http://127.0.0.1:8787/`。

## 部署到 NAS Container

项目已包含多阶段 `Dockerfile` 和 `compose.yaml`。镜像运行时只包含构建后的前端、Node API 服务和数据目录，适用于支持 Docker Compose 的 NAS（群晖 Container Manager、威联通 Container Station 等）。

1. 将整个项目目录上传或克隆到 NAS，例如 `/volume1/docker/xiaomi-note-blog`。
2. 复制 `.env.example` 为 `.env`，至少修改 `ADMIN_PASSWORD`，不要保留示例密码。
3. 在项目目录中构建并启动：

```bash
docker compose up -d --build
```

4. 打开 `http://NAS-IP:8787/`。容器健康状态可通过下面的命令查看：

```bash
docker compose ps
```

`./data` 会映射到容器内的 `/app/data`，升级或重建容器不会丢失站点设置、笔记和已缓存的图片。迁移现有数据时，在首次启动前将原来的 `data/` 完整复制到 NAS 项目目录即可。

容器启动时会检查 `/app/data` 的写入权限并修正该目录的属主，然后降权为普通 `node` 用户运行服务。这可以避免群晖等 NAS 创建 bind mount 目录后，保存 Cookie 时出现 `EACCES: permission denied, open '/app/data/settings.json'`。

服务会在启动 1 分钟后检查一次小米云 Cookie，之后默认每 6 小时检查。检查只读取最小笔记列表来验证登录状态，不会同步或改写笔记；如果小米响应下发了更新后的 Cookie，服务会自动合并并保存到 `data/settings.json`。检测状态和最近刷新时间仅在管理员认证后的同步设置页面显示。

可在 `.env` 中调整检测周期：

```env
COOKIE_CHECK_INTERVAL_MS=21600000
COOKIE_CHECK_START_DELAY_MS=60000
```

将 `COOKIE_CHECK_INTERVAL_MS` 设置为 `0` 可关闭自动检测。Cookie 真正失效且小米要求重新登录、验证码或二次验证时，仍需在设置页人工粘贴新 Cookie。

如果端口 `8787` 已被占用，在 `.env` 中修改对外端口即可，例如 `HOST_PORT=18887`，随后通过 `http://NAS-IP:18887/` 访问。容器内部仍固定监听 `8787`。如果前面只有一层可信的 Nginx/反向代理，并且需要按访客真实 IP 执行密码防爆破，可将 `.env` 中的 `TRUST_PROXY_HOPS` 设置为 `1`；直接通过 NAS 端口访问时保持 `0`。

更新版本：

```bash
git pull
docker compose up -d --build
```

停止服务：

```bash
docker compose down
```

`docker compose down` 不会删除 `./data`。不要使用 `down -v`，也不要在升级时删除 NAS 上的 `data/` 目录。

## 数据存储

默认数据目录是项目根目录下的 `data/`：

```txt
data/
  settings.json
  notes.json
```

可以通过 `DATA_DIR=/path/to/data` 改变位置。`data/` 已加入 `.gitignore`，不要提交到 GitHub。

## 密码防爆破

文章密码和分类密码由服务端验证。同一 IP 错误次数达到 `PASSWORD_LOCK_MAX_ATTEMPTS` 后会被锁定，锁定时长由 `PASSWORD_LOCK_MS` 控制，默认是 5 次错误后锁定 1 天。

## Cookie 安全

小米云 Cookie 只保存在服务器本地，不会返回到前端。设置页只显示是否已配置和更新时间。

修改小米云 Cookie 需要先输入服务端环境变量 `ADMIN_PASSWORD` 配置的管理员密码。认证成功后，服务端通过 HttpOnly session cookie 维持管理状态。

## 同步

在设置页配置小米云 Cookie 后，点击“同步笔记”。服务端会读取本地保存的 Cookie 请求小米云，拉取笔记并写入 `data/notes.json`。
