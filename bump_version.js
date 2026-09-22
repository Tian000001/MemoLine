#!/usr/bin/env node
/**
 * bump_version.js — 版本号自增脚本（TTQ-time 版本号的唯一修改入口）。
 *
 * 规则（沿用 TTTQ-yundong-Linux-vue2 约定）：
 *   - 版本号三段各 0~9（禁止两位段），逢 10 进 1（V1.9.9 -> V2.0.0）；
 *   - versionCode = 主*100 + 次*10 + 补；
 *   - 每次代码改动版本号至少 +1（默认 patch）。
 *
 * 用法：
 *   node bump_version.js          # patch +1（默认）
 *   node bump_version.js minor    # 次段 +1，补段归零
 *   node bump_version.js major    # 主段 +1，其余归零
 *
 * 同步写入：version.js、VERSION。CHANGELOG.md 请手动补充条目。
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const versionFile = path.join(root, 'version.js');

const raw = fs.readFileSync(versionFile, 'utf8');
const match = raw.match(/V(\d)\.(\d)\.(\d)/);
if (!match) {
  console.error('[bump] cannot parse version from version.js: ' + JSON.stringify(raw));
  process.exit(1);
}

let maj = Number(match[1]);
let min = Number(match[2]);
let pat = Number(match[3]);
const scope = (process.argv[2] || 'patch').toLowerCase();

if (scope === 'major') {
  maj += 1;
  min = 0;
  pat = 0;
} else if (scope === 'minor') {
  min += 1;
  pat = 0;
} else if (scope === 'patch') {
  pat += 1;
} else {
  console.error('[bump] unknown scope: ' + scope + ' (use major|minor|patch)');
  process.exit(1);
}

if (pat > 9) { pat = 0; min += 1; }
if (min > 9) { min = 0; maj += 1; }
if (maj > 9) {
  console.error('[bump] major segment overflow (V9.x.x max)');
  process.exit(1);
}

const version = 'V' + maj + '.' + min + '.' + pat;
const versionCode = maj * 100 + min * 10 + pat;

fs.writeFileSync(versionFile, "module.exports = '" + version + "';\n", 'utf8');
fs.writeFileSync(path.join(root, 'VERSION'), version + '\n', 'utf8');

console.log('[bump] ' + match[0] + ' -> ' + version + ' (versionCode=' + versionCode + ')');
