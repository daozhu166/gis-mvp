# 出海 GIS MVP · 起航包

> 岛主小秘 v1 · 2026-07-02

老板这个目录里有：

```
gis-mvp/
├── PLAN.md                    # 完整技术方案（11.8 KB）
└── demo/
    ├── flushing.html          # 单文件 HTML demo（Leaflet + OSM + Census）
    └── server.js              # 本地 Node 服务（含 Census API 代理 + fallback）
```

## 快速跑

### 本地
```bash
cd demo
node server.js
# 浏览器打开 http://localhost:7788/
```

### 期望看到
- 📍 Flushing 商圈中心
- 🍔 3 个汉堡候选位置 marker
- 🟢 1 英里商圈圈
- 📊 商圈画像面板（人口 / 亚裔 / 华裔 / 收入 / 学历 / 年龄）

### Census API 不通时
服务内置 fallback 数据；同时 `console.warn` 提示原因（国内网络抖）。

## 公网部署（白嫖 4 件套）

| 平台 | 怎么弄 | 月成本 |
|---|---|---|
| **Cloudflare Pages** | `wrangler pages deploy ./demo` | $0 |
| **Vercel** | import repo 自动 | $0 |
| **Render** | `render.yaml` 一键 | $0 |
| **Railway** | git push 自动 | $5 起 |

## 升级路线（从 MVP 到 SAAS）

| 阶段 | 投入 | 输出 |
|---|---|---|
| MVP | $0 / 月 | 地图 + 商圈画像 |
| 业务数据 | $50 / 月 | 商家自有数据可视化 |
| 移动 App | $500 / 月 uni-app 跨端 | 小程序 + iOS / Android |
| 多源数据 | $1k / 月 | Foursquare + Placer.ai + CARTO |
| SAAS | $5k+ / 月 | 商业化对客户开账号 |

## 关联情报
- 公司情报库：Esri / Placer.ai / SafeGraph / Near Intelligence / Spatial.ai / CoStar / LoopNet / Social Explorer / MRI-Simmons / Census Bureau ACS

——岛主小秘 v1 · 2026-07-02
