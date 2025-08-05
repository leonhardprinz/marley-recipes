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
  console.log('Opening menu...');
  await page.goto('https://marleyspoon.de/menu', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const linkHrefs = await page.$$eval('a[href*="/menu/"]', as => {
    const hrefs = new Set();
    for (const a of as) {
      const href = a.getAttribute('href') || '';
      if (href.includes('/menu/') && !href.endsWith('/menu') && !href.endsWith('/menu/') && /\/menu\/[^/].+/.test(href)) {
        hrefs.add(href);
      }
    }
    return Array.from(hrefs);
  });
  const recipeUrls = Array.from(new Set(linkHrefs.map(toAbs)));

  console.log(`Found ~${recipeUrls.length} candidate recipe links.`);

  // load existing data
  let existingData = [];
  let existingIds = new Set();
  try {
    const buf = await fs.readFile('data/recipes.json', 'utf-8');
    existingData = JSON.parse(buf);
    if (!Array.isArray(existingData)) existingData = [];
    for (const r of existingData) {
      if (r && r.id) existingIds.add(r.id);
    }
  } catch {
    existingData = [];
  }

  const recipes = [];

  for (const url of recipeUrls) {
    try {
      const p = await browser.newPage();
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await p.waitForTimeout(800);
      // parse JSON-LD
      const jsonLdList = await p.$$eval('script[type="application/ld+json"]', nodes =>
        nodes.map(n => {
          try {
            return JSON.parse(n.textContent || 'null');
          } catch {
            return null;
          }
        }).filter(Boolean)
      );
      let recipeNode = null;
      for (const node of jsonLdList) {
        if (Array.isArray(node['@graph'])) {
          for (const g of node['@graph']) {
            const types = Array.isArray(g['@type']) ? g['@type'] : [g['@type']];
            if (types && types.includes('Recipe')) {
              recipeNode = g;
              break;
            }
          }
        } else {
          const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
          if (types && types.includes('Recipe')) {
            recipeNode = node;
            break;
          }
        }
        if (recipeNode) break;
      }

      const title = recipeNode?.name || (await p.title()).replace(/\s+\|\s*Marley Spoon.*$/i, '').trim() || '';

      // skip error pages: 'Error: The request could not be satisfied'
      const titleLower = title.toLowerCase();
      if (titleLower.includes('error') && titleLower.includes('request could not be satisfied')) {
        await p.close();
        continue;
      }

      const id = url.replace(/^https?:\/\//, '');
      if (existingIds.has(id)) {
        await p.close();
        continue;
      }

      let image = null;
      if (recipeNode && recipeNode.image) {
        image = Array.isArray(recipeNode.image) ? recipeNode.image[0] : recipeNode.image;
      }
      if (!image) {
        // fallback: meta og:image
        try {
          const og = await p.locator('meta[property="og:image"]').first().getAttribute('content');
          if (og && og.startsWith('http')) image = og;
        } catch {}
      }
      if (!image) {
        // fallback: data-src or srcset or src from first img
        try {
          const imgEl = p.locator('img').first();
          const src = await imgEl.getAttribute('src');
          const dataSrc = await imgEl.getAttribute('data-src');
          const srcset = await imgEl.getAttribute('srcset');
          if (src && src.startsWith('http')) image = src;
          else if (dataSrc && dataSrc.startsWith('http')) image = dataSrc;
          else if (srcset && srcset.trim() !== '') {
            const first = srcset.split(',')[0].trim().split(' ')[0];
            if (first && first.startsWith('http')) image = first;
          }
        } catch {}
      }
      const ingredients = Array.isArray(recipeNode?.recipeIngredient) ? recipeNode.recipeIngredient.map(s => s.trim()).filter(Boolean) : [];
      const totalTimeMinutes = extractMinutesFromISO8601Duration(recipeNode?.totalTime || recipeNode?.cookTime || recipeNode?.prepTime);
      let calories = undefined;
      if (recipeNode?.nutrition?.calories) {
        calories = String(recipeNode.nutrition.calories);
      }
      const tags = [];
      const add = v => {
        if (!v) return;
        if (Array.isArray(v)) v.forEach(add);
        else if (typeof v === 'string') v.split(',').forEach(x => tags.push(x.trim()));
      };
      add(recipeNode?.recipeCategory);
      add(recipeNode?.keywords);
      add(recipeNode?.recipeCuisine);
      add(recipeNode?.suitableForDiet);

      const uniqTags = Array.from(new Set(tags.filter(Boolean).map(t => t.toLowerCase())));

      recipes.push({
        id,
        title,
        url,
        image,
        tags: uniqTags,
        totalTimeMinutes,
        calories,
        ingredients
      });
      await p.close();
    } catch (err) {
      console.warn('Failed to parse', url, err.message);
    }
  }

  await browser.close();

  // remove error entries from existing data
  const existingFiltered = existingData.filter(r => r && r.title && !(r.title.toLowerCase().includes('error') && r.title.toLowerCase().includes('request could not be satisfied')));

  const combined = existingFiltered.concat(recipes);

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

scrape().catch(e => { console.error(e); process.exit(1); });
