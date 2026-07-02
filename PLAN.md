# 出海 GIS MVP 实施方案

> 业务定位：**汉堡项目（北美连锁餐饮实地落地）+ 出海企业 GIS 服务** 双轨
> 目标：用**完全免费或免费层**的工具链，达到 ESRI 70–80% 体验，跑通 MVP
> 落地者：投资小智不敢碰，回到岛上
> 实际代码：投资小智也只是参谋；落地由老板 + 工程团队执行
> 状态：v0.1 草拟（待老板审核）

---

## 一、为什么不用 ESRI？

| ESRI 的体验 | 我们要的体验 | 可行替代 |
|---|---|---|
| ArcGIS Online 制图 | 商业地图与点位 | Mapbox / Leaflet |
| Business Analyst（商圈分析） | 商圈指标 | Census Bureau API + 自计算 |
| Tapestry（消费画像） | 画像标签 | 暂时缺（后期接 Esri Business Analyst PP 账号）|
| ArcGIS Pro 专业 GIS | 小程序地图 + 自有数据 | PostGIS + pgAdmin |
| ArcGIS Enterprise 本地化部署 | 自建后端 | PostGIS + Node |

结论：**80% 体验免费可达，深度画像得付费**——按需分批采购。

---

## 二、MVP 技术栈（"四件套"）

```
┌──────────────────────────────────────────────────────────────────┐
│  前端（小程序 / H5 / App）                                         │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Leaflet（地图引擎，开源 BSD）                            │   │
│  │ + Mapbox GL JS（可选升级，矢量 + 自定义样式）             │   │
│  │ + Turf.js（前端空间运算：面积 / 距离 / 缓冲圈）           │   │
│  │ + D3.js（统计图表）                                      │   │
│  └────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│  后端空间计算                                                       │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ PostGIS（PostgreSQL 的空间扩展）                       │   │
│  │ + pgAdmin（可视化管理）                                 │   │
│  │ + GeoServer（OGC 标准服务，动态切片）— 后期              │   │
│  └────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│  免费数据源                                                         │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ 1. OpenStreetMap（OSM）— 地图底图 + POI                    │   │
│  │ 2. U.S. Census Bureau API — ACS 人口统计（0 限额）       │   │
│  │ 3. Foursquare Places API — 北美 POI（1万次/日免费）       │   │
│  │ 4. CARTO 免费层 — 热力图渲染 + 切片                        │   │
│  │ 5. NYC/LA/SF 市级开放数据（NYC Open Data 等）              │   │
│  └────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│  自有业务数据                                                         │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ PostGIS 仓储：用户、订单、门店、自有 POI                  │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 为什么这么选？

| 工具 | 价格 | 为什么替代 ESRI | 主要短板 |
|---|---|---|---|
| **Leaflet** | 免费 | 极简开源 BSD，1 个 JS 文件搞定 70% GIS 场景 | 矢量渲染不如 Mapbox；性能差于 Mapbox |
| **OSM** | 免费 | 200+ 国家底图全部免费 | 中国地图精度差，**出海用没问题** |
| **Census API** | 免费 | 美国 ACS 人口数据 100% 公开 | 仅美国 + 不含消费画像 |
| **Foursquare Places** | 1万次/日免费 | POI 数量 1 亿+，与 SafeGraph 等价 | 中国数据无 |
| **PostGIS** | 免费（自建）| ESRI 商业版要 1万+，PostGIS 免费 | 需运维 |
| **Turf.js** | 免费 | 前端空间运算 | 计算量小，没法做大规模 |
| **CARTO** | 1,500 view/月免费 | 出图漂亮 | 上量后贵 |

---

## 三、集成方案（按业务场景拆解）

### 场景 1：北美连锁选址调研
**输入**：城市名 / 地址 / 半径（米）
**输出**：地图 + 周边竞品 + 人口画像 + 商圈租金近似

```
Step 1: 地址 → 地理编码
  POST https://api.opencagedata.com/geocode/v1/json
       ?q={address}&key={OPENCAGE_KEY}
  免费 2500/日，OpenStreetMap 数据源

Step 2: 在 PostGIS 找半径内 POI / 自有门店
  SELECT * FROM places
  WHERE ST_DWithin(location, ST_MakePoint(lng,lat)::geography, 1609)  -- 1英里
  LIMIT 200;

Step 3: Census ACS 拉人口画像
  GET https://api.census.gov/data/2023/acs/acs5/profile
      ?get=DP02_0001E,DP05_0033E,DP05_0071E  -- 人口/亚裔/华裔
      &for=tract:{tract_code}&in=state:{FIPS}

Step 4: Leaflet 渲染
  - 中心点 marker
  - 半径 buffer circle
  - POI markers（按类别上色）
  - 人口统计图表（D3）
```

### 场景 2：商户自有数据可视化（汉堡项目总部看板）
**输入**：PostGIS 内的 6500 家门店 + 订单数据
**输出**：实时地图（点选查看）

```
Leaflet.heat + L.divIcon 渲染
+ 聚合显示：marker-cluster
+ hover: 显示门店信息
+ click: 跳转详情页
```

### 场景 3：跨境出海企业 GIS 服务（产品化）

```
给客户开账号 → 客户上传自家门店 / 客户 / 订单数据
→ 后端 PostGIS 隔离 schema
→ 共享切图层（CARTO 或自建 GeoServer）
→ 商圈选址 / 库存 / 配送路径一站式
```

---

## 四、成本估算

### 月运营成本（MBP 阶段，1–1000 用户）

| 类别 | 工具 | 月成本 |
|---|---|---|
| 地图引擎 | Leaflet + OSM | **$0** |
| 数据库 | 自建 PostGIS (pgAdmin + 4 核 8G) | $20 / 月 |
| 域名 + CDN | Cloudflare 免费层 | **$0** |
| 地理编码 | OpenCage 2,500/日 | **$0** |
| POI | Foursquare 1万次/日 | **$0** |
| 人口数据 | Census Bureau API | **$0** |
| 热力渲染 | CARTO | **$0** |
| **合计** | | **$20–50 / 月** |

### 增长期成本（>1 万用户）

| 升级点 | 升级为 | 月增成本 |
|---|---|---|
| 矢量更美 | Mapbox 5万+加载 | $5+ / 千次 ≈ $50 / 月起 |
| POI 上量 | Foursquare Pro | $0.5 / 千次 |
| 切片渲染 | CARTO Builder | $199 / 月 |
| 深度画像 | ESRI BA 订阅 | $700 / 年个人许可 |

---

## 五、MVP 路线图（4 周）

### 第 1 周 — 跑通"地图 + 数据"
- [ ] 本地 demo：Flushing 商圈地图（Leaflet + OSM）
- [ ] Census ACS 拉 5 个关键字段叠加（人口 / 亚裔比例 / 收入中位 / 教育 / 家庭）
- [ ] 输出 PDF/HTML 商圈报告

### 第 2 周 — 接业务数据
- [ ] PostGIS 装好，建商家 POI 表
- [ ] 在 demo 中接入"汉堡候选位置"标记

### 第 3 周 — 做移动版 + 多源
- [ ] 小程序版（H5 内嵌 + uni-app 跨端）
- [ ] 增加 Foursquare 落点对比（竞品识别）

### 第 4 周 — 上线内测
- [ ] 内部使用（汉堡项目踏勘 + 出海服务基地客户演示）
- [ ] 收集反馈 → v0.2 迭代

---

## 六、代码骨架（最小可跑 demo 见 demo/）

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>汉堡项目选址 demo - Flushing</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css">
  <style>body{margin:0}#map{height:100vh}</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
  <script>
    // 1) 初始化地图 - 法拉盛
    const map = L.map('map').setView([40.7587, -73.8302], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OSM'
    }).addTo(map);

    // 2) Census ACS 拉人口 (Flushing tract)
    fetch('https://api.census.gov/data/2023/acs/acs5/profile'
      + '?get=DP02_0001E,DP05_0033E,DP05_0071E,DP03_0062E,DP02_0064E'
      + '&for=tract:090700&in=state:36%20county:081')
      .then(r => r.json())
      .then(data => {
        // data[0] 是 headers, data[1] 是值
        const [pop, asian, ageMed, incomeMed, bachelor] = data[1];
        // 显示人口画像
        const info = L.control();
        info.onAdd = () => {
          const div = L.DomUtil.create('div');
          div.innerHTML = `<div style="background:#fff;padding:10px;border-radius:4px">
            <b>Flushing 商圈画像</b><br>
            人口：${(+pop).toLocaleString()}<br>
            亚裔比例：${(+asian).toFixed(1)}%<br>
            收入中位：${"$"+ (+incomeMed).toLocaleString()}<br>
            25+ 学历本科比例：${(+bachelor).toFixed(1)}%
          </div>`;
          return div;
        };
        info.addTo(map);
      });
  </script>
</body>
</html>
```

参见：`demo/flushing.html`

---

## 七、风险 + 决策点

| 风险 | 缓解 |
|---|---|
| OSM 中国 POI 弱（出海用没问题）| 接 Foursquare / 市级开放数据 |
| Census 数据滞后（ACS 5 年估计）| 接受 / 后期接 Placer.ai 实时数据 |
| Leaflet 卡顿（>5000 点）| 切 marker-cluster / 切 Mapbox |
| ESRI 深度画像缺失 | 预算允许接 Esri BA 个人许可 $700/年 |
| PostGIS 运维 | 用 Supabase / Neon / Carto Cloud 托管 |

---

## 八、推荐决策（给您拍板）

| # | 决策项 | 我的推荐 |
|---|---|---|
| 1 | 是否上 MVP？ | ✅ 上，4 周 / $50 月成本 |
| 2 | 数据栈用 OSM+Leaflet 还是 Mapbox | 🅰 默认 OSM+Leaflet 免登录；后期切 Mapbox |
| 3 | 数据库放哪 | 🅰 自建 EC2 / Supabase / Neon 任选其一 |
| 4 | 跨境出海客户隔离 | 🅰 PostGIS 多 schema 隔离 |
| 5 | 头像（我个人） | 不参与实施，您执行 |

---

## 附录 A：相关情报卡 ID（公司情报库）

- Esri（含 Tapestry 章节）：note_id=`7478378512805699`
- SafeGraph / Near / Spatial.ai / Placer.ai（同 2026-07-02 入档）
- Census Bureau ACS：note_id=`7478392853122007`
- Social Explorer、MRI-Simmons、CoStar、LoopNet（同日入档）

详见：公司情报库 / 普通公司 / 上述 7 个子文件夹。
