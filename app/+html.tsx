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
          /* Safe-area handling on web / iOS PWA.
             Top / left / right: padded at body level for notch + rounded corners.
             Bottom: padded ON THE TAB BAR ITSELF so its background extends down
             to the edge of the screen (no visible gap under the home indicator).
             useSafeAreaInsets() returns 0 on installed iOS PWAs (expo/expo#26011),
             so we can't rely on React Navigation's JS-side paddingBottom — we
             apply it via CSS env() which DOES work in iOS PWAs.
             Target the outer tab bar container via :has(> [role="tablist"]),
             since role="tablist" is on the INNER wrapper, not the outer View. */
          body {
            margin: 0;
            background-color: #0F0F0F;
            min-height: 100vh;
            min-height: 100dvh;
            padding-top: env(safe-area-inset-top, 0);
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
          /* Extend the tab bar background into the home-indicator safe area. */
          div:has(> div[role="tablist"]) {
            height: auto !important;
            min-height: 56px !important;
            padding-bottom: env(safe-area-inset-bottom, 0px) !important;
            box-sizing: content-box !important;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
