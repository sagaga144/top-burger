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

        {/* Installed iOS PWA with a black-translucent status bar: the page is
            drawn from the top of the screen, but its viewport height comes out
            short by the status-bar height (100%, 100vh and 100dvh alike),
            leaving a dead strip under the tab bar. The app is portrait-only, so
            size the page to the full screen height. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function () {
  var standalone = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (standalone && window.screen.height > window.innerHeight) {
    document.documentElement.style.height = window.screen.height + 'px';
  }
})();`,
          }}
        />

        <style>{`
          html {
            height: 100%;
            overflow: hidden;
            background-color: #0F0F0F;
          }
          /* Safe areas on web: SafeAreaView (every screen) and the tab bar read
             the real insets through CSS env(), the same as on native, so the
             body adds no padding of its own. Padding here as well doubled the
             top gap in the installed iOS PWA. */
          body {
            margin: 0;
            background-color: #0F0F0F;
            height: 100%;
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
