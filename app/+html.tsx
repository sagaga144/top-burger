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
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
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
          html {
            background-color: #0F0F0F;
          }
          /* iOS PWA fix: useSafeAreaInsets() returns 0 on installed iOS PWAs
             (expo/expo#26011), so React Navigation's tab bar sits flush with
             the home indicator. Apply safe-area padding at the BODY level so
             the entire app (including the RN flex-laid-out tab bar) is pushed
             above the home indicator. Also use 100dvh so iOS Safari's dynamic
             viewport is respected. This is the same pattern used by gymion. */
          body {
            margin: 0;
            background-color: #0F0F0F;
            min-height: 100vh;
            min-height: 100dvh;
            padding-top: env(safe-area-inset-top, 0);
            padding-bottom: env(safe-area-inset-bottom, 0);
            padding-left: env(safe-area-inset-left, 0);
            padding-right: env(safe-area-inset-right, 0);
            box-sizing: border-box;
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
          }
          #root {
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            min-height: 0;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
