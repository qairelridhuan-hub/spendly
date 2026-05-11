import { ScrollViewStyleReset } from "expo-router/html";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body, #root {
              background-image: none !important;
              background-color: #0a0a0e !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            /* Remove any injected dot/grid patterns */
            [class*="css-"] {
              background-image: none !important;
            }
          `,
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
