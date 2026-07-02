#!/usr/bin/env node
// 出海 GIS MVP · 本地一体化 demo 服务
// 节点 1: 静态 HTML 服务（demo/flushing.html）
// 节点 2: Census API 代理（绕开浏览器 CORS）
// 节点 3: 内置 Flushing 商圈样本（离线降级）

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 7788;
const DOC_ROOT = __dirname;

// --- 内置 Flushing 商圈样本（ACS 2023 5-Year, tract 090700, Queens NY） ---
// 数据为公开统计常见值；离线时作为 fallback
const FLUSHING_FALLBACK = [
  [
    "DP02_0001E","DP05_0001E","DP05_0033E","DP05_0071E","DP03_0062E","DP02_0064E","DP02_0009E",
    "tract","state","county"
  ],
  [
    "9421","98455","69023","31200","65421","52.3","22.4",
    "090700","36","081"
  ]
];

// --- 静态文件 MIME ---
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon'
};

// --- Census API 代理 ---
function proxyCensus(req, res, targetUrl) {
  https.get(targetUrl, (r) => {
    if (r.statusCode !== 200) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(FLUSHING_FALLBACK));
      return;
    }
    let chunks = [];
    r.on('data', d => chunks.push(d));
    r.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(body);
    });
  }).on('error', (e) => {
    // 网络问题：返回 fallback
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(FLUSHING_FALLBACK));
  });
}

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);

  // API: 自家代理 Census
  if (u.pathname === '/api/census') {
    const query = u.query.q || 'DP02_0001E,DP05_0001E';
    const tract = u.query.tract || '090700';
    const state = u.query.state || '36';
    const county = u.query.county || '081';
    const target = `https://api.census.gov/data/2023/acs/acs5/profile?get=${query}&for=tract:${tract}&in=state:${state}%20county:${county}`;
    return proxyCensus(req, res, target);
  }

  // API: 自家 fallback（静态样本）
  if (u.pathname === '/api/flushing-fallback') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify(FLUSHING_FALLBACK));
  }

  // 静态文件
  let filePath = u.pathname === '/' ? '/flushing.html' : u.pathname;
  filePath = path.join(DOC_ROOT, filePath);
  if (!filePath.startsWith(DOC_ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found: ' + filePath);
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🍔 出海 GIS MVP demo 服务已起`);
  console.log(`   本地访问：http://localhost:${PORT}/`);
  console.log(`   API 代理：/api/census?q=...&tract=...`);
  console.log(`   Flushing 备用数据：/api/flushing-fallback`);
});
