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

## 数据存储

默认数据目录是项目根目录下的 `data/`：

```txt
data/
  settings.json
  notes.json
```

可以通过 `DATA_DIR=/path/to/data` 改变位置。`data/` 已加入 `.gitignore`，不要提交到 GitHub。

## Cookie 安全

小米云 Cookie 只保存在服务器本地，不会返回到前端。设置页只显示是否已配置和更新时间。

修改小米云 Cookie 需要先输入服务端环境变量 `ADMIN_PASSWORD` 配置的管理员密码。认证成功后，服务端通过 HttpOnly session cookie 维持管理状态。

## 同步

在设置页配置小米云 Cookie 后，点击“同步笔记”。服务端会读取本地保存的 Cookie 请求小米云，拉取笔记并写入 `data/notes.json`。
