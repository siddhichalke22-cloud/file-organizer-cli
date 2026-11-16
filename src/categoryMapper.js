import { defaultCategories } from '../config/defaultCategories.js';

function normalizeExtension(extension) {
  return String(extension).trim().replace(/^\./, '').toLowerCase();
}

export function createCategoryMapper(customCategories = {}) {
  const categories = { ...defaultCategories };
  const extensionMap = new Map();

  for (const [category, extensions] of Object.entries(categories)) {
    for (const extension of extensions) {
      extensionMap.set(normalizeExtension(extension), category);
    }
  }

  for (const [category, extensions] of Object.entries(customCategories)) {
    if (
      !category.trim() ||
      category === '.' ||
      category === '..' ||
      /[\\/]/.test(category) ||
      !Array.isArray(extensions)
    ) {
      throw new TypeError(`Invalid category definition: "${category}"`);
    }

    for (const extension of extensions) {
      const normalized = normalizeExtension(extension);
      if (!normalized || /[\\/]/.test(normalized)) {
        throw new TypeError(`Invalid extension in category "${category}"`);
      }
      extensionMap.set(normalized, category);
    }
    categories[category] = [...new Set([...(categories[category] ?? []), ...extensions])];
  }

  return {
    categories,
    getCategory(extension) {
      return extensionMap.get(normalizeExtension(extension)) ?? 'Others';
    }
  };
}

export function getCategoryForFile(filename, mapper = createCategoryMapper()) {
  const extension = filename.includes('.') ? filename.split('.').pop() : '';
  return mapper.getCategory(extension);
}
