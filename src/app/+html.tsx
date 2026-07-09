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
        <title>Budgiette</title>

        {/* Expo already injects a favicon <link> from app.json's web.favicon config. */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon.png" />

        {/* Lets Safari (and other mobile browsers) run the app full-screen,
            without browser chrome, when added to the home screen. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Budgiette" />

        <meta name="theme-color" content="#F8F4EE" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#101A24" media="(prefers-color-scheme: dark)" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
