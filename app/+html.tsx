import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* PWA */}
        <meta name="application-name" content="Top Burger" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Top Burger" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#E63946" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />

        <title>Top Burger</title>

        <ScrollViewStyleReset />

        <style>{`
          html, body, #root {
            height: 100%;
            background-color: #0F0F0F;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
