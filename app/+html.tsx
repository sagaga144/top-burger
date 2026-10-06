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
            height: 100%;
            background-color: #0F0F0F;
          }
          /* Safe-area handling on web / iOS PWA:
             Body padding pushes the RN flex tree into the safe viewport.
             A background gradient paints the bottom safe-area strip in
             the tab-bar color (#1C1C1E) so no z-index overlay is needed.
             useSafeAreaInsets() returns 0 on installed iOS PWAs
             (expo/expo#26011), so we rely on CSS env(). */
          body {
            margin: 0;
            background-color: #0F0F0F;
            background: linear-gradient(
              to bottom,
              #0F0F0F 0%,
              #0F0F0F calc(100% - env(safe-area-inset-bottom, 0px)),
              #1C1C1E calc(100% - env(safe-area-inset-bottom, 0px)),
              #1C1C1E 100%
            );
            /* 100% of html, not 100vh/100dvh: in an installed iOS PWA with a
               black-translucent status bar, the viewport units come out short
               by the status-bar height, leaving a dead strip under the tab bar. */
            height: 100%;
            padding-top: env(safe-area-inset-top, 0);
            padding-bottom: env(safe-area-inset-bottom, 0);
            padding-left: env(safe-area-inset-left, 0);
            padding-right: env(safe-area-inset-right, 0);
            box-sizing: border-box;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          #root {
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            min-height: 0;
          }
          /* In standalone PWA mode, force a minimum bottom padding
             in case env() underreports the home indicator area. */
          @media (display-mode: standalone) {
            body {
              padding-bottom: max(env(safe-area-inset-bottom, 0px), 34px);
              background: linear-gradient(
                to bottom,
                #0F0F0F 0%,
                #0F0F0F calc(100% - max(env(safe-area-inset-bottom, 0px), 34px)),
                #1C1C1E calc(100% - max(env(safe-area-inset-bottom, 0px), 34px)),
                #1C1C1E 100%
              );
            }
          }
          /* RTL: react-native-web gives every Text dir="auto", so Latin text
             (restaurant names) would align left inside a Hebrew layout. Align
             it to the layout's start like native RN does, unless the text has
             an explicit alignment class. */
          html[dir="rtl"] [dir="auto"]:not(.text-center):not(.text-right):not(.text-left) {
            text-align: right;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
