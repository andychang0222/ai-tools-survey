// 產生 apps-script/Code.gs = assets/schema.js（題目與驗證） + apps-script/server.gs（後端主程式）
// 用法：node apps-script/build.js
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'assets', 'schema.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, 'server.gs'), 'utf8');

const header = `/**
 * 八貫企業股份有限公司（Cathay Consolidated, Inc）
 * AI 工具使用現況與需求調查：Google Apps Script 後端
 *
 * ※ 本檔由 apps-script/build.js 自動產生，請勿直接修改。
 *   題目請改 assets/schema.js，後端請改 apps-script/server.gs，再執行 node apps-script/build.js。
 *
 * 部署方式見 README.md。管理密碼放在「專案設定 → 指令碼屬性」的 ADMIN_PASSWORD。
 */

`;

const out = header + schema.trim() + '\n\n' + server.trim() + '\n';
fs.writeFileSync(path.join(__dirname, 'Code.gs'), out, 'utf8');
console.log('已產生 apps-script/Code.gs（' + out.split('\n').length + ' 行）');
