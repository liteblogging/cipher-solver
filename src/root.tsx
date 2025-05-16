import { cssBundleHref } from '@remix-run/css-bundle'
import type { LinksFunction, MetaFunction } from '@remix-run/node'
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react'
import styles from './styles/index.css'

const App = () => (
  <html lang='en' className="h-full">
    <head>
      <meta charSet='utf-8' />
      <meta
        name='viewport'
        content='width=device-width,initial-scale=1,viewport-fit=cover'
      />
      <Meta />
      <Links />
      <script dangerouslySetInnerHTML={{
        __html: `
          const setAppHeight = () => {
            document.documentElement.style.setProperty('--app-height', \`\${window.innerHeight}px\`);
          };
          window.addEventListener('resize', setAppHeight);
          window.addEventListener('orientationchange', setAppHeight);
          setAppHeight();
        `
      }} />
    </head>
    <body className="h-full bg-slate-900 flex flex-col">
      <Outlet />
      <ScrollRestoration />
      <Scripts />
      <LiveReload />
    </body>
  </html>
)

export const meta: MetaFunction = () => {
  const title = `CipherSolver`
  const description = `Automated tool to decode and solve cryptograms and substitution ciphers.`

  return [
    { title },
    { name: `description`, content: description },
    {
      name: `keywords`,
      content: [
        `cipher`,
        `ciphertext`,
        `cryptogram`,
        `cryptoquip`,
        `cryptoquote`,
        `plaintext`,
        `puzzle`,
        `solver`,
        `decode`,
        `decrypt`,
      ].join(`,`),
    },
    { name: `theme-color`, content: `#0f172a` },
    
    // Set X-Frame-Options to allow embedding in iframes
    { 'http-equiv': 'X-Frame-Options', content: 'ALLOWALL' },
    
    // CSP policy to allow embedding
    { 
      'http-equiv': 'Content-Security-Policy',
      content: "frame-ancestors *;"
    },
  ]
}

export const links: LinksFunction = () => [
  { rel: `stylesheet`, href: styles },
  ...(cssBundleHref ? [{ rel: `stylesheet`, href: cssBundleHref }] : []),
  { rel: `preconnect`, href: `https://fonts.googleapis.com` },
  {
    rel: `preconnect`,
    href: `https://fonts.gstatic.com`,
    crossOrigin: `anonymous`,
  },
  {
    rel: `stylesheet`,
    href: `https://fonts.googleapis.com/css2?family=Inter:wght@300..800&display=swap`,
  },
]

export default App
