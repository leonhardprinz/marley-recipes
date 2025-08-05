"use client";

import React, { useEffect, useState, useMemo } from 'react';

export default function Page() {
  const [all, setAll] = useState([]);
  const [q, setQ] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Fetch recipes
  useEffect(() => {
    fetch('/api/recipes')
      .then((r) => r.json())
      .then((data) => setAll(data))
      .catch(() => setAll([]));
  }, []);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('favorites') || '[]');
      if (Array.isArray(stored)) setFavorites(stored);
    } catch (e) {
      // ignore
    }
  }, []);

  // Save favorites to localStorage whenever favorites change
  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return all.filter((r) => {
      const matchesQuery =
        !query ||
        r.title.toLowerCase().includes(query) ||
        (Array.isArray(r.ingredients) &&
          r.ingredients.some((i) => i.toLowerCase().includes(query)));
      const matchesFavorites =
        !showFavoritesOnly || favorites.includes(r.id);
      return matchesQuery && matchesFavorites;
    });
  }, [all, q, favorites, showFavoritesOnly]);

  const toggleFavorite = (id) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleFavoritesFilter = () => {
    setShowFavoritesOnly((prev) => !prev);
  };

  return (
    <main style={{ padding: '16px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        Simple 6-step recipes for every day
      </h1>
      <p style={{ marginBottom: 16, color: '#444' }}>
        Suchbar. Klick öffnet das Original-Rezept auf marleyspoon.de.
      </p>
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <input
          placeholder='Suche nach Titel oder Zutat'
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            flex: 1,
            padding: 10,
            border: '1px solid #ccc',
            borderRadius: 8,
          }}
        />
        <button
          onClick={toggleFavoritesFilter}
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid #bbb',
            background: showFavoritesOnly ? '#f2f2f2' : 'white',
            cursor: 'pointer',
          }}
          aria-pressed={showFavoritesOnly}
        >
          {showFavoritesOnly ? '★ Favoriten' : '☆ Favoriten'}
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        }}
      >
        {filtered.map((r) => (
          <a
            key={r.id}
            href={r.url}
            target='_blank'
            rel='noopener noreferrer'
            style={{
              position: 'relative',
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid #eee',
              borderRadius: 12,
              overflow: 'hidden',
              background: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                aspectRatio: '4/3',
                background: '#fafafa',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {r.image ? (
                <img
                  src={r.image}
                  alt={r.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : null}
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                toggleFavorite(r.id);
              }}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'transparent',
                border: 'none',
                fontSize: 20,
                cursor: 'pointer',
                zIndex: 10,
              }}
              aria-label='Toggle favorite'
            >
              {favorites.includes(r.id) ? '★' : '☆'}
            </button>
            <div style={{ padding: 12 }}>
              <h2
                style={{
                  fontSize: 18,
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                {r.title}
              </h2>
              <div
                style={{
                  marginTop: 8,
                  display: 'flex',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                {r.totalTimeMinutes ? (
                  <span
                    style={{
                      fontSize: 12,
                      padding: '3px 8px',
                      border: '1px solid #eee',
                      borderRadius: 999,
                    }}
                  >
                    {r.totalTimeMinutes} Min
                  </span>
                ) : null}
                {r.calories ? (
                  <span
                    style={{
                      fontSize: 12,
                      padding: '3px 8px',
                      border: '1px solid #eee',
                      borderRadius: 999,
                    }}
                  >
                    {r.calories}
                  </span>
                ) : null}
                {r.tags &&
                  r.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 12,
                        padding: '3px 8px',
                        border: '1px solid #eee',
                        borderRadius: 999,
                      }}
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
