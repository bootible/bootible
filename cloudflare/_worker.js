/**
 * Bootible - Cloudflare Pages Function
 *
 * Routes:
 *   /rog        -> targets/ally.ps1 (ROG Ally / Windows)
 *   /deck       -> targets/deck.sh  (Steam Deck / SteamOS)
 *   /rog-beta, /deck-beta, /android-beta -> same scripts, beta channel
 *   /docs       -> Redirect to docs.bootible.dev
 *   /           -> Landing page (browser) or help text (CLI)
 *   /*.png      -> Static assets (served by Pages)
 *
 * Channels:
 *   Stable routes serve the latest GitHub release tag (fallback: main).
 *   '-beta' routes always serve main.
 */

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/bootible/bootible';

/**
 * Script routes with SHA256 checksums for integrity verification.
 *   sha256       - beta channel (main); auto-updated by the Update Checksums workflow
 *   sha256Stable - stable channel (latest release tag); pinned by the release process
 * Field order matters: CI extracts the beta hash as the first sha256 after the route key.
 */
const ROUTES = {
  '/rog': {
    path: '/targets/ally.ps1',
    description: 'ROG Ally (Windows)',
    sha256: '2bd68382dd71ab1154bdfd3a7e1e9cd1640de0a910d00b4676bc5a78a2af6d3b',
    sha256Stable: '2bd68382dd71ab1154bdfd3a7e1e9cd1640de0a910d00b4676bc5a78a2af6d3b',
  },
  '/deck': {
    path: '/targets/deck.sh',
    description: 'Steam Deck (SteamOS)',
    sha256: 'c23f103215486331469565e3448281c1c0edb6e0735554a60b975951de4f1183',
    sha256Stable: 'c23f103215486331469565e3448281c1c0edb6e0735554a60b975951de4f1183',
  },
  '/android': {
    path: '/targets/android.sh',
    description: 'Android (Wireless ADB)',
    sha256: '27f3a64f3d023b18641978ef894b11666d53ca9495d5306fc63ed077aa97b301',
    sha256Stable: '27f3a64f3d023b18641978ef894b11666d53ca9495d5306fc63ed077aa97b301',
  },
};

// Cache settings
const SCRIPT_CACHE_TTL = 300; // 5 minutes - how long to serve cached scripts
const STALE_CACHE_TTL = 86400; // 24 hours - how long to keep stale cache as fallback
const FETCH_TIMEOUT_MS = 10000; // 10 second timeout for upstream fetches

// Release channel settings
const RELEASE_API = 'https://api.github.com/repos/bootible/bootible/releases/latest';
const RELEASE_CACHE_TTL = 300; // seconds - how long to cache the latest-release lookup

/**
 * Resolve which git ref a request should be served from.
 * '-beta' routes serve main; stable routes serve the latest release tag (fallback main).
 */
async function resolveRef(pathname) {
  if (pathname.endsWith('-beta')) return 'main';
  try {
    const resp = await fetch(RELEASE_API, {
      headers: { 'User-Agent': 'bootible-worker' },
      cf: { cacheTtl: RELEASE_CACHE_TTL, cacheEverything: true },
    });
    if (!resp.ok) return 'main';
    const release = await resp.json();
    return release.tag_name || 'main';
  } catch {
    return 'main';
  }
}

/**
 * Fetch with timeout using AbortController
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Compute SHA256 hash of content using Web Crypto API
 */
async function sha256(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Detect if request is from a browser (vs curl/PowerShell)
 */
function isBrowser(request) {
  const userAgent = request.headers.get('User-Agent') || '';
  const accept = request.headers.get('Accept') || '';
  return accept.includes('text/html') && userAgent.includes('Mozilla');
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize URL to prevent javascript: and data: XSS attacks
 */
function sanitizeUrl(url) {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
    return '#blocked';
  }
  return escapeHtml(url);
}

/**
 * Generate plain text help for CLI clients
 */
function getPlainTextHelp() {
  return `Bootible - One-liner setup for gaming handhelds

Usage:

  Steam Deck:
    curl -fsSL https://bootible.dev/deck | bash

  ROG Ally X:
    irm https://bootible.dev/rog | iex

  Android (from host with ADB):
    curl -fsSL https://bootible.dev/android | bash

More info: https://github.com/bootible/bootible
`;
}

/**
 * Landing page HTML
 */
function getLandingPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bootible - One-liner setup for gaming handhelds</title>
  <meta name="description" content="Bootible automates the setup of Steam Deck, ROG Ally X, Android handhelds, and other gaming devices with a single command.">
  <link rel="icon" type="image/png" href="/favicon.png">
  <style>
    :root {
      --bg-dark: #0d1117;
      --bg-card: #161b22;
      --bg-card-hover: #1c2128;
      --accent: #58a6ff;
      --accent-glow: rgba(88, 166, 255, 0.3);
      --text-primary: #f0f6fc;
      --text-secondary: #8b949e;
      --text-muted: #6e7681;
      --border: #30363d;
      --success: #3fb950;
      --gradient-start: #8b5cf6;
      --gradient-end: #1a1a2e;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(180deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
      color: var(--text-primary);
      min-height: 100vh;
      line-height: 1.6;
    }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    .hero { text-align: center; padding: 60px 0 40px; }
    .logo {
      width: 140px;
      height: 140px;
      margin-bottom: 24px;
      filter: drop-shadow(0 0 30px var(--accent-glow));
      animation: float 3s ease-in-out infinite;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    .hero h1 {
      font-size: 3.5rem;
      font-weight: 700;
      margin-bottom: 16px;
      background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .tagline { font-size: 1.4rem; color: rgba(255, 255, 255, 0.85); margin-bottom: 40px; }
    .callout {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 16px 24px;
      margin-bottom: 40px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .callout-icon { font-size: 1.5rem; flex-shrink: 0; }
    .callout-content { flex: 1; }
    .callout-title { font-weight: 600; margin-bottom: 4px; }
    .callout-text { color: rgba(255, 255, 255, 0.75); font-size: 0.9rem; }
    .callout-link { color: #ffffff; text-decoration: none; font-weight: 600; white-space: nowrap; }
    .callout-link:hover { text-decoration: underline; }
    .devices { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 60px; }
    .device-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    .device-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--accent), var(--success));
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .device-card:hover {
      background: var(--bg-card-hover);
      border-color: var(--accent);
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    .device-card:hover::before { opacity: 1; }
    .device-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .device-icon { width: 48px; height: 48px; flex-shrink: 0; object-fit: contain; }
    .device-info { flex: 1; }
    .device-name { font-size: 1.2rem; font-weight: 600; margin-bottom: 2px; }
    .device-name .variant { font-size: 0.75rem; font-weight: 400; color: var(--text-muted); }
    .device-name .beta-badge { font-size: 0.6rem; font-weight: 600; background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 2px 6px; border-radius: 4px; vertical-align: middle; margin-left: 4px; }
    .device-platform { color: var(--text-muted); font-size: 0.8rem; }
    .command-wrapper { display: flex; flex-direction: column; gap: 8px; }
    .copy-btn {
      align-self: flex-end;
      background: var(--bg-dark);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      padding: 4px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.75rem;
      transition: all 0.2s ease;
    }
    .copy-btn:hover { background: var(--accent); color: var(--bg-dark); border-color: var(--accent); }
    .copy-btn.copied { background: var(--success); border-color: var(--success); color: var(--bg-dark); }
    .command-block {
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 12px;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 0.8rem;
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .command-block::-webkit-scrollbar { display: none; }
    .command-block code { color: var(--accent); white-space: nowrap; }
    .features { margin-bottom: 60px; }
    .features h2 { text-align: center; font-size: 2rem; margin-bottom: 32px; color: var(--text-primary); }
    .feature-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    @media (max-width: 800px) { .feature-grid { grid-template-columns: repeat(2, 1fr); } }
    .feature {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      transition: border-color 0.3s ease;
    }
    .feature:hover { border-color: var(--accent); }
    .feature-icon { font-size: 2rem; margin-bottom: 12px; }
    .feature-title { font-weight: 600; margin-bottom: 8px; }
    .feature-desc { color: var(--text-secondary); font-size: 0.9rem; }
    .info {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 40px;
    }
    .info h3 { font-size: 1.3rem; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
    .info p { color: var(--text-secondary); margin-bottom: 12px; }
    .info ul { list-style: none; padding-left: 0; }
    .info li { color: var(--text-secondary); padding: 8px 0; padding-left: 24px; position: relative; }
    .info li::before { content: '✓'; position: absolute; left: 0; color: var(--success); }
    footer { text-align: center; padding: 40px 0; border-top: 1px solid var(--border); }
    footer a { color: var(--accent); text-decoration: none; transition: opacity 0.2s ease; }
    footer a:hover { opacity: 0.8; }
    .footer-links { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .github-link, .kofi-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      padding: 12px 24px;
      border-radius: 8px;
      color: var(--text-primary);
      font-weight: 500;
      transition: all 0.2s ease;
    }
    .github-link:hover { background: var(--bg-card-hover); border-color: var(--accent); }
    .kofi-link:hover { background: var(--bg-card-hover); border-color: #ff5e5b; }
    .github-link svg, .kofi-link svg { width: 20px; height: 20px; fill: currentColor; }
    @media (max-width: 600px) { .devices { grid-template-columns: 1fr; } }
    @media (max-width: 600px) {
      .hero h1 { font-size: 2.5rem; }
      .tagline { font-size: 1.1rem; }
      .logo { width: 100px; height: 100px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <section class="hero">
      <img src="/bootible-dark.png" alt="Bootible Logo" class="logo">
      <h1>Bootible</h1>
      <p class="tagline">One-liner setup for gaming handhelds</p>
    </section>

    <div class="callout">
      <span class="callout-icon">📖</span>
      <div class="callout-content">
        <div class="callout-title">New to Bootible?</div>
        <div class="callout-text">Read the documentation to understand what gets installed and how to customize your setup.</div>
      </div>
      <a href="https://docs.bootible.dev" class="callout-link">Read the Docs →</a>
    </div>

    <section class="devices">
      <div class="device-card">
        <div class="device-header">
          <img class="device-icon" src="/steamdeck.png" alt="Steam Deck">
          <div class="device-info">
            <h3 class="device-name">Steam Deck</h3>
            <p class="device-platform">SteamOS / Arch Linux</p>
          </div>
        </div>
        <div class="command-wrapper">
          <button class="copy-btn" onclick="copyCommand(this, 'curl -fsSL https://bootible.dev/deck | bash')">Copy</button>
          <div class="command-block">
            <code>curl -fsSL https://bootible.dev/deck | bash</code>
          </div>
        </div>
      </div>

      <div class="device-card">
        <div class="device-header">
          <img class="device-icon" src="/rog.png" alt="ROG Ally">
          <div class="device-info">
            <h3 class="device-name">ROG Ally <span class="variant">(all variants)</span></h3>
            <p class="device-platform">Windows 11</p>
          </div>
        </div>
        <div class="command-wrapper">
          <button class="copy-btn" onclick="copyCommand(this, 'irm https://bootible.dev/rog | iex')">Copy</button>
          <div class="command-block">
            <code>irm https://bootible.dev/rog | iex</code>
          </div>
        </div>
      </div>

      <div class="device-card">
        <div class="device-header">
          <img class="device-icon" src="/android.png" alt="Android">
          <div class="device-info">
            <h3 class="device-name">Android <span class="variant">(via ADB)</span> <span class="beta-badge">ALPHA</span></h3>
            <p class="device-platform">Gaming Handhelds</p>
          </div>
        </div>
        <div class="command-wrapper">
          <button class="copy-btn" onclick="copyCommand(this, 'curl -fsSL https://bootible.dev/android | bash')">Copy</button>
          <div class="command-block">
            <code>curl -fsSL https://bootible.dev/android | bash</code>
          </div>
        </div>
      </div>
    </section>

    <section class="features">
      <h2>What You Get</h2>
      <div class="feature-grid">
        <div class="feature">
          <div class="feature-icon">🧩</div>
          <div class="feature-title">Apps & Tools</div>
          <div class="feature-desc">Discord, Spotify, browsers, and more</div>
        </div>
        <div class="feature">
          <div class="feature-icon">🎮</div>
          <div class="feature-title">Gaming</div>
          <div class="feature-desc">Steam, launchers, Decky Loader</div>
        </div>
        <div class="feature">
          <div class="feature-icon">📡</div>
          <div class="feature-title">Streaming</div>
          <div class="feature-desc">Moonlight, Chiaki, Sunshine</div>
        </div>
        <div class="feature">
          <div class="feature-icon">👾</div>
          <div class="feature-title">Emulation</div>
          <div class="feature-desc">EmuDeck, RetroArch</div>
        </div>
        <div class="feature">
          <div class="feature-icon">🔐</div>
          <div class="feature-title">Passwords</div>
          <div class="feature-desc">1Password, Bitwarden</div>
        </div>
        <div class="feature">
          <div class="feature-icon">🔄</div>
          <div class="feature-title">Cloud Sync</div>
          <div class="feature-desc">Save games, configs, dotfiles</div>
        </div>
        <div class="feature">
          <div class="feature-icon">🚀</div>
          <div class="feature-title">Optimization</div>
          <div class="feature-desc">Debloat, tweaks, performance</div>
        </div>
        <div class="feature">
          <div class="feature-icon">🌐</div>
          <div class="feature-title">Remote Access</div>
          <div class="feature-desc">SSH, Tailscale, RDP</div>
        </div>
      </div>
    </section>

    <section class="info">
      <h3>🛡️ Safe by Default</h3>
      <p>Bootible runs in <strong>dry-run mode</strong> by default. Preview all changes before applying.</p>
      <ul>
        <li>Everything is opt-in via config</li>
        <li>Creates restore points (Windows) and btrfs snapshots (Steam Deck)</li>
        <li>Private config stays in your own repo</li>
        <li>Open source and auditable</li>
      </ul>
    </section>

    <footer>
      <div class="footer-links">
        <a href="https://github.com/bootible/bootible" class="github-link">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          View on GitHub
        </a>
        <a href="https://ko-fi.com/gavinmcfall" class="kofi-link">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/>
          </svg>
          Support on Ko-fi
        </a>
      </div>
    </footer>
  </div>

  <script>
    function copyCommand(btn, text) {
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    }
  </script>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle root path - landing page for browsers, redirect CLI to /deck
    if (path === '/' || path === '') {
      if (isBrowser(request)) {
        return new Response(getLandingPage(), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
      // CLI request (curl, wget) - redirect to /deck for convenience
      return Response.redirect(`${url.origin}/deck`, 302);
    }

    // Redirect old /docs to new docs site
    if (path === '/docs') {
      return Response.redirect('https://docs.bootible.dev', 301);
    }

    // Handle script routes (proxy from GitHub with caching and integrity verification)
    // '-beta' aliases (e.g. /rog-beta) serve the same script from main
    const routeKey = path.endsWith('-beta') ? path.slice(0, -'-beta'.length) : path;
    const route = ROUTES[routeKey];
    if (route) {
      // Resolve the channel's git ref; ALL assets for this request come from this ref,
      // and the integrity checksum is selected by the ref actually being served
      const ref = await resolveRef(path);
      const expectedSha256 = ref === 'main' ? route.sha256 : route.sha256Stable;

      const cache = caches.default;
      // Include ref and query string in cache key so channels stay distinct and ?v=X can bust cache
      const cacheKey = new Request(`https://bootible.dev/cache/${ref}${route.path}${url.search}`, request);

      // Try to get from cache first
      let cachedResponse = await cache.match(cacheKey);
      const cacheAge = cachedResponse
        ? parseInt(cachedResponse.headers.get('X-Bootible-Cached-At') || '0')
        : 0;
      const cacheIsStale = Date.now() - cacheAge > SCRIPT_CACHE_TTL * 1000;

      // If cache is fresh, serve it directly
      if (cachedResponse && !cacheIsStale) {
        const headers = new Headers(cachedResponse.headers);
        headers.set('X-Bootible-Cache', 'HIT');
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          headers,
        });
      }

      // Try to fetch fresh from GitHub
      let script = null;
      let fetchError = null;

      try {
        const cacheBuster = Date.now();
        const scriptUrl = `${GITHUB_RAW_BASE}/${ref}${route.path}?cb=${cacheBuster}`;

        const response = await fetchWithTimeout(scriptUrl, {
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (response.ok) {
          script = await response.text();

          // Verify script integrity against the checksum for the ref being served
          const computedHash = await sha256(script);
          if (computedHash !== expectedSha256) {
            console.error(`Integrity check failed for ${route.path}@${ref}: expected ${expectedSha256}, got ${computedHash}`);
            script = null; // Don't use tampered script
            fetchError = `Integrity verification failed (expected ${expectedSha256.slice(0, 8)}..., got ${computedHash.slice(0, 8)}...)`;
          }
        } else {
          fetchError = `GitHub returned ${response.status}`;
        }
      } catch (error) {
        fetchError = `Fetch failed: ${error.message || error}`;
      }

      // If we got a valid script, cache it and serve
      if (script) {
        const responseHeaders = {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Bootible-Device': route.description,
          'X-Bootible-Ref': ref,
          'X-Bootible-Integrity': `sha256-${expectedSha256}`,
          'X-Bootible-Cache': cachedResponse ? 'REFRESH' : 'MISS',
          'X-Bootible-Cached-At': String(Date.now()),
        };

        const freshResponse = new Response(script, { headers: responseHeaders });

        // Cache the response (clone because body can only be read once)
        const cacheResponse = new Response(script, {
          headers: {
            ...responseHeaders,
            'Cache-Control': `public, max-age=${STALE_CACHE_TTL}`,
          },
        });
        await cache.put(cacheKey, cacheResponse);

        return freshResponse;
      }

      // GitHub failed - try stale cache as fallback
      if (cachedResponse) {
        console.warn(`GitHub unavailable, serving stale cache for ${route.path}: ${fetchError}`);
        const headers = new Headers(cachedResponse.headers);
        headers.set('X-Bootible-Cache', 'STALE');
        headers.set('X-Bootible-Stale-Reason', fetchError);
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          headers,
        });
      }

      // No cache and GitHub failed
      return new Response(
        `Failed to fetch script and no cached version available.\n` +
        `Error: ${fetchError}\n\n` +
        `GitHub may be temporarily unavailable. Please try again in a few minutes.\n` +
        `If the problem persists, report at https://github.com/bootible/bootible/issues`,
        {
          status: 502,
          headers: { 'Content-Type': 'text/plain' },
        }
      );
    }

    // Static assets - let Pages serve them
    return env.ASSETS.fetch(request);
  },
};
