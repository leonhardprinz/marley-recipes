import React, { ReactNode } from 'react';

export const metadata = {
  title: 'Marley Spoon Rezepte',
  description: 'Searchable highlights of Marley Spoon weekly recipes.',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="de">
      <body style={{ margin: 0, fontFamily: 'sans-serif' }}>{children}</body>
    </html>
  );
}
