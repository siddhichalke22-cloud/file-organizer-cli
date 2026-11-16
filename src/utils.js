import { readFile } from 'node:fs/promises';

export async function loadCustomCategories(configPath) {
  if (!configPath) return {};

  let config;
  try {
    config = JSON.parse(await readFile(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot load configuration "${configPath}": ${error.message}`, { cause: error });
  }

  if (!config || Array.isArray(config) || typeof config !== 'object') {
    throw new TypeError('Configuration must be a JSON object with a "categories" object.');
  }
  const categories = config.categories;
  if (!categories || Array.isArray(categories) || typeof categories !== 'object') {
    throw new TypeError('Configuration must include a "categories" object.');
  }
  return categories;
}
