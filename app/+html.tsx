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
          /* Safe-area handling on web / iOS PWA:
             1. Body gets padding on all 4 sides from env(safe-area-inset-*).
                This pushes the RN flex tree (including the tab bar at the bottom)
                into the safe viewport, so the tab bar is never cropped by the
                iOS home indicator and its content (icons + labels) is not clipped.
             2. A fixed pseudo-element paints a #1C1C1E rectangle over the bottom
                safe-area strip, so the gap between the tab bar's actual bottom
                edge and the screen edge LOOKS like part of the tab bar (matching
                background color) instead of a dark cut-off strip.
             useSafeAreaInsets() returns 0 on installed iOS PWAs (expo/expo#26011),
             so we must rely on CSS env() — which DOES work in iOS PWAs. */
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
            position: relative;
          }
          #root {
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            min-height: 0;
          }
          /* Visually fill the home-indicator safe area with the tab-bar color,
             so the tab bar appears to extend edge-to-edge on iOS PWA. */
          body::after {
            content: '';
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            height: env(safe-area-inset-bottom, 0);
            background-color: #1C1C1E;
            pointer-events: none;
            z-index: 1;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
