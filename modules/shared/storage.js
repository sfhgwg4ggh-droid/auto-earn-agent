/**
 * JSON 文件读写工具 — 用 Git 仓库做"数据库"
 * 所有持久数据以 JSON 文件存储在 data/ 目录
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import CONFIG from './config.js';

/**
 * 读取 JSON 文件，不存在则返回默认值
 * @param {string} filename - 文件名 (如 'keywords.json')
 * @param {*} defaultValue - 默认值
 */
export async function readJSON(filename, defaultValue = null) {
  const filepath = resolve(CONFIG.dataDir, filename);
  try {
    const raw = await readFile(filepath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return defaultValue;
    }
    console.error(`[storage] 读取失败: ${filepath}`, err.message);
    throw err;
  }
}

/**
 * 写入 JSON 文件，自动创建目录
 * @param {string} filename
 * @param {*} data
 */
export async function writeJSON(filename, data) {
  const filepath = resolve(CONFIG.dataDir, filename);
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 追加条目到 JSON 数组文件
 * @param {string} filename
 * @param {*} item - 要追加的条目
 * @param {string} [uniqueKey] - 去重字段名
 */
export async function appendToJSON(filename, item, uniqueKey = null) {
  const existing = (await readJSON(filename, [])) || [];
  if (uniqueKey) {
    const exists = existing.some(e => e[uniqueKey] === item[uniqueKey]);
    if (exists) return existing;
  }
  existing.push({ ...item, _updated: new Date().toISOString() });
  await writeJSON(filename, existing);
  return existing;
}

/**
 * 更新 JSON 文件中的单条记录
 * @param {string} filename
 * @param {function} predicate - 匹配函数
 * @param {object} updates - 更新的字段
 */
export async function updateJSON(filename, predicate, updates) {
  const data = (await readJSON(filename, [])) || [];
  const idx = data.findIndex(predicate);
  if (idx === -1) return null;
  data[idx] = { ...data[idx], ...updates, _updated: new Date().toISOString() };
  await writeJSON(filename, data);
  return data[idx];
}

export default { readJSON, writeJSON, appendToJSON, updateJSON };
