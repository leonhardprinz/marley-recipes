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
  const linkHrefs = await page.$$eval('a[href*="/menu/"]', (as) => {
    const hrefs = new Set();
    for (const a of as) {
      const href = a.getAttribute('href') || '';
      if (
        href.includes('/menu/') &&
        !href.endsWith('/menu') &&
        !href.endsWith('/menu/') &&
        /\/menu\/[^/].+/.test(href)
      ) {
        hrefs.add(href);
      }
    }
    return Array.from(hrefs);
  });
  const recipeUrls = Array.from(new Set(linkHrefs.map(toAbs)));
  console.log(`Found ~${recipeUrls.length} candidate recipe links.`);
  const recipes = [];
  for (const url of recipeUrls) {
    try {
      const p = await browser.newPage();
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await p.waitForTimeout(800);
      const jsonLdList = await p.$$eval('script[type="application/ld+json"]', (nodes) =>
        nodes
          .map((n) => {
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
            if (g['@type'] === 'Recipe' || (Array.isArray(g['@type']) && g['@type'].includes('Recipe'))) {
              recipeNode = g;
              break;
            }
          }
        } else if (node['@type'] === 'Recipe' || (Array.isArray(node['@type']) && node['@type'].includes('Recipe'))) {
          recipeNode = node;
        }
        if (recipeNode) break;
      }
      const title =
        (await p.title())?.replace(/\s+\|\s*Marley Spoon.*$/i, '').trim() ||
        ((await p.locator('h1').first().textContent()) || '').trim() ||
        '';
      let image = null;
      if (recipeNode && recipeNode.image) {
        image = Array.isArray(recipeNode.image) ? recipeNode.image[0] : recipeNode.image;
      }
      if (!image) {
        try {
          const src = await p.locator('img').first().getAttribute('src');
          image = src && src.startsWith('http') ? src : null;
        } catch {
          image = null;
        }
      }
      const ingredients = Array.isArray(recipeNode && recipeNode.recipeIngredient)
        ? recipeNode.recipeIngredient.map((s) => s.trim()).filter(Boolean)
        : [];
      const totalTimeMinutes = extractMinutesFromISO8601Duration(
        (recipeNode && (recipeNode.totalTime || recipeNode.cookTime || recipeNode.prepTime)) || null
      );
      let calories;
      if (recipeNode && recipeNode.nutrition && recipeNode.nutrition.calories) {
        calories = String(recipeNode.nutrition.calories);
      }
      const tags = [];
      const add = (v) => {
        if (!v) return;
        if (Array.isArray(v)) v.forEach(add);
        else if (typeof v === 'string') v.split(',').forEach((x) => tags.push(x.trim()));
      };
      if (recipeNode) {
        add(recipeNode.recipeCategory);
        add(recipeNode.keywords);
      }
      const id = url.replace(/^https?:\/\//, '');
      recipes.push({
        id,
        title: title || (recipeNode && recipeNode.name) || 'Rezept',
        url,
        image,
        tags: Array.from(new Set(tags.filter(Boolean).map((t) => t.toLowerCase()))),
        totalTimeMinutes,
        calories,
        ingredients
      });
      await p.close();
      process.stdout.write('.');
    } catch (e) {
      console.warn(`\nFailed to parse ${url}:`, e.message);
    }
  }
  await browser.close();
  const uniqueByUrl = new Map();
  for (const r of recipes) {
    if (!uniqueByUrl.has(r.url)) uniqueByUrl.set(r.url, r);
  }
  const cleaned = Array.from(uniqueByUrl.values());
  await fs.writeFile('data/recipes.json', JSON.stringify(cleaned, null, 2), 'utf-8');
  console.log(`\nSaved ${cleaned.length} recipes to data/recipes.json`);
}

scrape().catch((e) => {
  console.error(e);
  process.exit(1);
});
