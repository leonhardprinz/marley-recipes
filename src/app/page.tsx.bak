"use client";

import React, { useEffect, useMemo, useState } from 'react';

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

export default function Page() {
  const [all, setAll] = useState<Recipe[]>([]);
  const [q, setQ] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [ingredient, setIngredient] = useState('');

  useEffect(() => {
    fetch('/api/recipes')
      .then((r) => r.json())
      .then((data: Recipe[]) => setAll(data))
      .catch(() => setAll([]));
  }, []);

  const tags = useMemo(() => {
    const t = new Set<string>();
    for (const r of all) r.tags?.forEach((x) => x && t.add(x));
    return Array.from(t).sort((a, b) => a.localeCompare(b));
  }, [all]);

  const filtered = useMemo(() => {
    const qn = q.trim().toLowerCase();
    const ing = ingredient.trim().toLowerCase();

    return all.filter((r) => {
      const matchesQuery =
        !qn ||
        r.title.toLowerCase().includes(qn) ||
        r.ingredients?.some((i) => i.toLowerCase().includes(qn));

      const matchesIngredient = !ing || r.ingredients?.some((i) => i.toLowerCase().includes(ing));

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every((t) => r.tags?.map((x) => x.toLowerCase()).includes(t.toLowerCase()));

      return matchesQuery && matchesIngredient && matchesTags;
    });
  }, [all, q, ingredient, selectedTags]);

  const toggleTag = (t: string) => {
    setSelectedTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  return (
    <main style={{ padding: '16px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Marley Spoon – Aktuelle Rezepte</h1>
      <p style={{ marginBottom: 16, color: '#444' }}>
        Suchbar, filterbar. Klick öffnet das Original-Rezept auf marleyspoon.de.
      </p>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }}>
        <input
          placeholder="Suche nach Titel oder Zutat"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ padding: 10, gridColumn: 'span 2', border: '1px solid #ccc', borderRadius: 8 }}
        />
        <input
          placeholder="Filter: Zutat (z. B. Huhn, Basilikum)"
          value={ingredient}
          onChange={(e) => setIngredient(e.target.value)}
          style={{ padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
        />
      </div>

      <details style={{ marginBottom: 16 }}>
        <summary style={{ cursor: 'pointer' }}>Filter: Kategorien & Tags</summary>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                border: selectedTags.includes(t) ? '2px solid #111' : '1px solid #bbb',
                background: selectedTags.includes(t) ? '#f2f2f2' : 'white',
                cursor: 'pointer'
              }}
              aria-pressed={selectedTags.includes(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </details>

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))'
        }}
      >
        {filtered.map((r) => (
          <a
            key={r.id}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid #eee',
              borderRadius: 12,
              overflow: 'hidden',
              background: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ aspectRatio: '4/3', background: '#fafafa', overflow: 'hidden' }}>
              {r.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.image}
                  alt={r.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : null}
            </div>
            <div style={{ padding: 12 }}>
              <h2 style={{ fontSize: 18, lineHeight: 1.2, margin: 0 }}>{r.title}</h2>
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {r.totalTimeMinutes ? (
                  <span style={{ fontSize: 12, padding: '3px 8px', border: '1px solid #eee', borderRadius: 999 }}>
                    {r.totalTimeMinutes} Min
                  </span>
                ) : null}
                {r.calories ? (
                  <span style={{ fontSize: 12, padding: '3px 8px', border: '1px solid #eee', borderRadius: 999 }}>
                    {r.calories}
                  </span>
                ) : null}
                {r.tags?.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    style={{ fontSize: 12, padding: '3px 8px', border: '1px solid #eee', borderRadius: 999 }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </a>
        ))}
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: '#666' }}>
        Nicht offiziell von Marley Spoon. Rezepte und Bilder © Marley Spoon. Dieses Tool verlinkt auf die Originalseiten.
      </p>
    </main>
  );
}
