import { chromium } from 'playwright';
import fs from 'node:fs/promises';

type Recipe = {
  id: string;
  title: string;
  url: string;
  image: string | null;
  tags: string[];
  totalTimeMinutes?: number;
  calories?: string;
  ingredients: string[];
};

function toAbs(href: string) {
  const u = new URL(href, 'https://marleyspoon.de');
  return u.toString();
}

function extractMinutesFromISO8601Duration(d?: string | null): number | undefined {
  // e.g. PT30M, PT1H, PT1H15M
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

  // Wait for any anchor that looks like a menu recipe card
  await page.waitForTimeout(2500);

  const linkHrefs = await page.$$eval('a[href*="/menu/"]', (as) => {
    const hrefs = new Set<string>();
    for (const a of as as HTMLAnchorElement[]) {
      const href = a.getAttribute('href') || '';
      // Filter obvious non-recipe anchors (week tabs etc.) and keep detail links that contain a slug or id
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

  // De-dup and normalize
  const recipeUrls = Array.from(new Set(linkHrefs.map(toAbs)));

  console.log(`Found ~${recipeUrls.length} candidate recipe links.`);

  const recipes: Recipe[] = [];

  for (const url of recipeUrls) {
    try {
      const p = await browser.newPage();
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await p.waitForTimeout(800);

      // Pull JSON-LD if present
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

      // Find Recipe object inside JSON-LD (could be a graph)
      let recipeNode: any | null = null;
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

      // Fallbacks via DOM
      const title =
        (await p.title())?.replace(/\s+\|\s*Marley Spoon.*$/i, '').trim() ||
        (await p.locator('h1').first().textContent()).then((t) => t?.trim() || '') ||
        '';

      // Image: try JSON-LD first
      let image: string | null = null;
      if (recipeNode?.image) {
        image = Array.isArray(recipeNode.image) ? recipeNode.image[0] : recipeNode.image;
      }
      if (!image) {
        const imgEl = p.locator('img').first();
        try {
          const src = await imgEl.getAttribute('src');
          image = src && src.startsWith('http') ? src : null;
        } catch {
          image = null;
        }
      }

      // Ingredients
      const ingredients: string[] = Array.isArray(recipeNode?.recipeIngredient)
        ? recipeNode.recipeIngredient.map((s: string) => s.trim()).filter(Boolean)
        : [];

      // Total time
      const totalTimeMinutes = extractMinutesFromISO8601Duration(
        recipeNode?.totalTime || recipeNode?.cookTime || recipeNode?.prepTime
      );

      // Calories (often appears in nutrition)
      let calories: string | undefined = undefined;
      if (recipeNode?.nutrition?.calories) {
        calories = String(recipeNode.nutrition.calories);
      }

      // Tags: collect from recipeCategory, keywords
      const tags: string[] = [];
      const add = (v: any) => {
        if (!v) return;
        if (Array.isArray(v)) v.forEach(add);
        else if (typeof v === 'string') v.split(',').forEach((x) => tags.push(x.trim()));
      };
      add(recipeNode?.recipeCategory);
      add(recipeNode?.keywords);

      // Create a stable id from URL
      const id = url.replace(/^https?:\/\//, '');

      recipes.push({
        id,
        title: title || recipeNode?.name || 'Rezept',
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
      console.warn(`\nFailed to parse ${url}:`, (e as Error).message);
    }
  }

  await browser.close();

  // Remove obvious duplicates by URL or title
  const uniqueByUrl = new Map<string, Recipe>();
  for (const r of recipes) {
    if (!uniqueByUrl.has(r.url)) uniqueByUrl.set(r.url, r);
  }
  const cleaned = Array.from(uniqueByUrl.values());

  // Persist
  await fs.writeFile('data/recipes.json', JSON.stringify(cleaned, null, 2), 'utf-8');
  console.log(`\nSaved ${cleaned.length} recipes to data/recipes.json`);
}

scrape().catch((e) => {
  console.error(e);
  process.exit(1);
});
