export const metadata = {
  title: 'Marley Spoon Rezepte',
  description: 'Public React app for highlighting Marley Spoon recipes with search and filters.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
