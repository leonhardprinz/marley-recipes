const { chromium } = require('playwright');
const fs = require('fs/promises');

function toAbs(href) {
  const u = new URL(href, 'https://marleyspoon.de');
  return u.toString();
}

function extractMinutesFromISO8601Duration(d) {
  if (!d) return undefined;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return undefined;
  const hours = m[1] ? parseInt(m[1], 10) : 0;
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  return hours * 60 + mins;
}

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log('Opening menu…');
  await page.goto('https://marleyspoon.de/menu', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const hrefs = await page.$$eval('a[href*="/menu/"]', as => {
    const urls = new Set();
    for (const a of as) {
      const href = a.getAttribute('href') || '';
      if (href.includes('/menu/') && !href.endsWith('/menu') && !href.endsWith('/menu/')) {
        urls.add(href);
      }
    }
    return Array.from(urls);
  });
  const recipeUrls = Array.from(new Set(hrefs.map(toAbs)));

  // load existing data
  let existingData = [];
  const existingIds = new Set();
  try {
    const txt = await fs.readFile('data/recipes.json', 'utf-8');
    const data = JSON.parse(txt);
    if (Array.isArray(data)) {
      existingData = data;
      for (const r of data) {
        if (r && r.id) existingIds.add(r.id);
      }
    }
  } catch (err) {
    existingData = [];
  }

  const recipes = [];
  for (const url of recipeUrls) {
    const id = url.replace(/^https?:\/\//, '');
    if (existingIds.has(id)) continue;
    try {
      const p = await browser.newPage();
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await p.waitForTimeout(800);

      // parse JSON-LD
      const jsonLdList = await p.$$eval('script[type="application/ld+json"]', nodes =>
        nodes
          .map(n => {
            try {
              return JSON.parse(n.textContent || 'null');
            } catch {
              return null;
            }
          })
          .filter(Boolean)
      );
      let recipeNode = null;
      for (const node of jsonLdList) {
        if (!node) continue;
        if (Array.isArray(node['@graph'])) {
          for (const g of node['@graph']) {
            const type = g['@type'];
            if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
              recipeNode = g;
              break;
            }
          }
        } else {
          const type = node['@type'];
          if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
            recipeNode = node;
          }
        }
        if (recipeNode) break;
      }

      // title
      let title = '';
      try {
        title = (await p.title()) || '';
        title = title.replace(/\s+\|\s*Marley Spoon.*$/i, '').trim();
      } catch {}
      if (!title && recipeNode && recipeNode.name) {
        title = recipeNode.name;
      }
      const titleLower = title.toLowerCase();
      if (titleLower.includes('error') && titleLower.includes('request could not be satisfied')) {
        await p.close();
        continue;
      }

      // image
      let image = null;
      if (recipeNode && recipeNode.image) {
        image = Array.isArray(recipeNode.image) ? recipeNode.image[0] : recipeNode.image;
      }
      if (!image) {
        try {
          const ogImg = await p.locator('meta[property="og:image"]').first().getAttribute('content');
          if (ogImg && ogImg.startsWith('http')) image = ogImg;
        } catch {}
      }
      if (!image) {
        try {
          const imgEl = p.locator('img').first();
          const src = await imgEl.getAttribute('src');
          const dataSrc = await imgEl.getAttribute('data-src');
          const srcset = await imgEl.getAttribute('srcset');
          if (src && src.startsWith('http')) image = src;
          else if (dataSrc && dataSrc.startsWith('http')) image = dataSrc;
          else if (srcset) {
            const parts = srcset.split(',').map(s => s.trim().split(' ')[0]);
            const maybe = parts.find(u => u.startsWith('http'));
            if (maybe) image = maybe;
          }
        } catch {}
      }

      // ingredients
      const ingredients = [];
      if (recipeNode && Array.isArray(recipeNode.recipeIngredient)) {
        for (const i of recipeNode.recipeIngredient) {
          if (typeof i === 'string') ingredients.push(i.trim());
        }
      }

      const totalTimeMinutes = extractMinutesFromISO8601Duration(
        (recipeNode && (recipeNode.totalTime || recipeNode.cookTime || recipeNode.prepTime))
      );
      let calories;
      if (recipeNode && recipeNode.nutrition && recipeNode.nutrition.calories) {
        calories = String(recipeNode.nutrition.calories);
      }

      const tags = [];
      const add = v => {
        if (!v) return;
        if (Array.isArray(v)) v.forEach(add);
        else if (typeof v === 'string') v.split(',').forEach(x => tags.push(x.trim()));
      };
      add(recipeNode && recipeNode.recipeCategory);
      add(recipeNode && recipeNode.keywords);
      add(recipeNode && recipeNode.recipeCuisine);
      add(recipeNode && recipeNode.suitableForDiet);
      const uniqTags = Array.from(new Set(tags.filter(Boolean).map(t => t.toLowerCase())));

      recipes.push({
        id,
        title,
        url,
        image,
        tags: uniqTags,
        totalTimeMinutes,
        calories,
        ingredients,
      });

      await p.close();
    } catch (err) {
      console.warn('Failed to parse', url, err.message);
    }
  }

  await browser.close();

  // Combine and deduplicate
  const combined = existingData.concat(recipes);
  const uniqueByUrl = new Map();
  for (const r of combined) {
    if (r && r.url && !uniqueByUrl.has(r.url)) {
      uniqueByUrl.set(r.url, r);
    }
  }
  const cleaned = Array.from(uniqueByUrl.values());
  await fs.writeFile('data/recipes.json', JSON.stringify(cleaned, null, 2), 'utf-8');
  console.log(`Saved ${cleaned.length} recipes to data/recipes.json`);
}

scrape().catch(e => {
  console.error(e);
  process.exit(1);
});
