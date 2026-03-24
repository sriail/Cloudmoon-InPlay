// Cloudflare Worker - CloudMoon Proxy with Multi-Layer Shadow DOM Protection + Ad Blocking
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Common ad domains and patterns to block
const AD_PATTERNS = [
  'googlesyndication.com',
  'doubleclick.net',
  'googleadservices.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com',
  'adservice.google.com',
  'pagead2.googlesyndication.com',
  'tpc.googlesyndication.com',
  'video-ad-stats.googlesyndication.com',
  'ads.google.com',
  'adssettings.google.com',
  'static.ads-twitter.com',
  'ads-api.twitter.com',
  'ads.facebook.com',
  'an.facebook.com',
  'adnxs.com',
  'advertising.com',
  'outbrain.com',
  'taboola.com',
  'criteo.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'adsafeprotected.com',
  'moatads.com',
  'scorecardresearch.com',
  '/ads/',
  '/ad/',
  '/advert/',
  '/advertisement/',
  '/adsense/',
  '/adserver/',
  '/analytics/',
  'prebid',
  'advertis',
  'banner',
  'popup'
];

function isAdRequest(url) {
  const urlLower = url.toLowerCase();
  return AD_PATTERNS.some(pattern => urlLower.includes(pattern));
}

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Serve the main HTML page
  if (url.pathname === '/' || url.pathname === '') {
    return new Response(getMainHTML(), {
      headers: {
        'Content-Type': 'text/html',
        'Permissions-Policy': 'accelerometer=*, gyroscope=*, camera=*, microphone=*, geolocation=*, hid=*, midi=*, clipboard-read=*, clipboard-write=*, xr-spatial-tracking=*, gamepad=*'
      }
    });
  }
  
  // Serve manifest.json for PWA
  if (url.pathname === '/manifest.json') {
    return new Response(getManifest(), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Serve service worker for PWA
  if (url.pathname === '/sw.js') {
    return new Response(getServiceWorker(), {
      headers: { 
        'Content-Type': 'application/javascript',
        'Service-Worker-Allowed': '/'
      }
    });
  }

  // Serve favicon.png from root — proxy Google Classroom's real icon
  if (url.pathname === '/favicon.png') {
    const iconRes = await fetch('https://ssl.gstatic.com/classroom/favicon.png');
    const iconHeaders = new Headers(iconRes.headers);
    iconHeaders.set('Cache-Control', 'public, max-age=86400');
    return new Response(iconRes.body, {
      status: iconRes.status,
      headers: iconHeaders
    });
  }
  
  // Proxy everything else to CloudMoon
  return proxyCloudMoon(request);
}

async function proxyCloudMoon(request) {
  const url = new URL(request.url);
  
  // Build the target URL
  let targetURL;
  
  if (url.pathname.startsWith('/proxy/')) {
    // Extract and decode the proxied URL
    const encodedURL = url.pathname.substring('/proxy/'.length);
    try {
      targetURL = decodeURIComponent(encodedURL);
      // Add back query string if present
      if (url.search) {
        targetURL += url.search;
      }
    } catch (e) {
      console.error('Failed to decode proxy URL:', encodedURL);
      return new Response('Invalid proxy URL', { status: 400 });
    }
  } else {
    // Direct proxy to CloudMoon
    targetURL = 'https://web.cloudmoonapp.com' + url.pathname + url.search;
  }
  
  // Block ad requests
  if (isAdRequest(targetURL)) {
    console.log('Blocked ad request:', targetURL);
    return new Response('', { status: 204 });
  }
  
  console.log('Proxying:', targetURL);
  
  const headers = new Headers(request.headers);
  headers.set('Host', new URL(targetURL).host);
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('x-forwarded-proto');
  headers.delete('x-real-ip');
  
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  }
  
  const proxyRequest = new Request(targetURL, {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: 'follow'
  });
  
  let response;
  try {
    response = await fetch(proxyRequest);
  } catch (error) {
    console.error('Proxy fetch failed:', error);
    return new Response('Failed to fetch resource', { status: 502 });
  }
  
  // If response is 404, log it but still return it
  if (response.status === 404) {
    console.log('Resource not found (404):', targetURL);
  }
  
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', '*');
  newHeaders.set('Access-Control-Allow-Headers', '*');
  newHeaders.set('Access-Control-Allow-Credentials', 'true');
  newHeaders.delete('Content-Security-Policy');
  newHeaders.delete('X-Frame-Options');
  newHeaders.delete('Frame-Options');
  
  const contentType = response.headers.get('Content-Type') || '';
  
  if (contentType.includes('text/html')) {
    let html = await response.text();
    
    // Remove ad-related elements and scripts
    html = blockAdsInHTML(html);
    
    const injectionCode = `
<style id="cm-ad-blocker-css">
  /* Hide ONLY the specific ad container divs */
  .a-div-horizontal,
  .a-div-vertical,
  .a-div-placeholder,
  .a-div-box {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    position: absolute !important;
    width: 0 !important;
    height: 0 !important;
    overflow: hidden !important;
  }
</style>
<script id="cm-fix-js">
(function(){
  // Block ad network requests at runtime
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && isAdUrl(url)) {
      console.log('[Ad Blocked]', url);
      return Promise.reject(new Error('Ad blocked'));
    }
    return originalFetch.apply(this, args);
  };
  
  const originalXHR = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function(method, url) {
    if (isAdUrl(url)) {
      console.log('[Ad Blocked]', url);
      return;
    }
    return originalXHR.apply(this, arguments);
  };
  
  function isAdUrl(url) {
    const adPatterns = [
      'googlesyndication', 'doubleclick', 'googleadservices',
      'google-analytics', 'googletagmanager', 'googletagservices',
      '/ads/', '/ad/', '/advert', 'adsense', 'analytics',
      'facebook.com/ads', 'twitter.com/ads'
    ];
    return adPatterns.some(pattern => url.toLowerCase().includes(pattern));
  }
  
  // Remove ad elements from DOM - ONLY target specific ad containers
  function removeAds() {
    // Only remove Google ad-related elements
    const googleAdSelectors = [
      'iframe[src*="googlesyndication"]',
      'iframe[src*="doubleclick"]',
      'iframe[src*="google-analytics"]',
      'div[id*="google_ads"]',
      'div[class*="adsbygoogle"]',
      'ins.adsbygoogle',
      '[data-ad-slot]',
      '[data-ad-client]'
    ];
    
    googleAdSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.style.display = 'none';
        try { el.remove(); } catch (e) {}
      });
    });
    
    // ONLY target the specific CloudMoon ad containers with exact class names
    const adDivs = document.querySelectorAll('.a-div-horizontal, .a-div-vertical, .a-div-placeholder, .a-div-box');
    adDivs.forEach(el => {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.style.position = 'absolute';
      el.style.width = '0';
      el.style.height = '0';
      el.style.overflow = 'hidden';
      try { el.remove(); } catch (e) {}
    });
  }
  
  function fixButtons() {
    var allBtns = document.querySelectorAll("button.google-button");
    for (var i = 0; i < allBtns.length; i++) {
      var btn = allBtns[i];
      var styleAttr = btn.getAttribute("style") || "";
      
      // Check for purple background (123, 108, 196) - SHOW this button
      if (styleAttr.indexOf("123, 108, 196") !== -1 || styleAttr.indexOf("123,108,196") !== -1) {
        btn.style.setProperty("display", "flex", "important");
        btn.style.setProperty("visibility", "visible", "important");
        btn.style.setProperty("opacity", "1", "important");
        btn.style.setProperty("pointer-events", "auto", "important");
        btn.style.setProperty("flex-direction", "row", "important");
        btn.style.setProperty("justify-content", "center", "important");
        btn.style.setProperty("align-items", "center", "important");
        btn.style.setProperty("gap", "1rem", "important");
        btn.style.setProperty("width", "min(350px, 100%)", "important");
        btn.style.setProperty("height", "45px", "important");
        btn.style.setProperty("border-radius", "5rem", "important");
        btn.style.setProperty("cursor", "pointer", "important");
        btn.style.setProperty("font-size", "1rem", "important");
      }
      // Check for white background - HIDE this button (OAuth)
      else if (styleAttr.indexOf("255, 255, 255") !== -1 || styleAttr.indexOf("#fff") !== -1 || styleAttr.indexOf("white") !== -1 || btn.querySelector("svg")) {
        btn.style.setProperty("display", "none", "important");
        btn.style.setProperty("visibility", "hidden", "important");
      }
    }
  }
  
  // Run ad removal immediately
  removeAds();
  
  // Run immediately
  fixButtons();
  
  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      fixButtons();
      removeAds();
      console.log('[CloudMoon] DOM ready - ads removed');
    });
  }
  
  // Run on window load
  window.addEventListener("load", function() {
    fixButtons();
    removeAds();
    console.log('[CloudMoon] Window loaded - ads removed');
  });
  
  // Run every 200ms (balanced performance and ad blocking)
  setInterval(function() {
    fixButtons();
    removeAds();
  }, 200);
  
  // MutationObserver
  var observer = new MutationObserver(function() {
    fixButtons();
    removeAds();
  });
  
  function startObserver() {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"]
      });
    } else {
      setTimeout(startObserver, 10);
    }
  }
  startObserver();
  
  // Intercept window.open for games - now proxy through worker
  var origOpen = window.open;
  window.open = function(u, t, f) {
    if (u && u.indexOf("run-site") > -1) {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({type: "LOAD_GAME", url: u}, "*");
      } else {
        window.location.href = u;
      }
      return {closed: false, close: function(){}, focus: function(){}};
    }
    return origOpen.call(this, u, t, f);
  };
  
  // Listen for fullscreen requests from parent
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'REQUEST_FULLSCREEN') {
      var gameWrapper = document.querySelector('#gameWrapper');
      if (gameWrapper) {
        if (gameWrapper.requestFullscreen) {
          gameWrapper.requestFullscreen();
        } else if (gameWrapper.webkitRequestFullscreen) {
          gameWrapper.webkitRequestFullscreen();
        } else if (gameWrapper.mozRequestFullScreen) {
          gameWrapper.mozRequestFullScreen();
        } else if (gameWrapper.msRequestFullscreen) {
          gameWrapper.msRequestFullscreen();
        }
        console.log('[CloudMoon] Game container fullscreen requested');
      } else {
        console.log('[CloudMoon] Game container not found, using document fullscreen');
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        }
      }
    }
  });
  
  console.log("[CloudMoon Fix] Initialized with ad blocking");
})();
</script>`;
    
    if (html.includes('</head>')) {
      html = html.replace('</head>', injectionCode + '</head>');
    } else {
      html = injectionCode + html;
    }
    
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
  
  // Block ads in JavaScript files
  if (contentType.includes('javascript') || contentType.includes('application/x-javascript')) {
    const targetUrlLower = targetURL.toLowerCase();
    if (isAdRequest(targetURL)) {
      console.log('Blocked ad script:', targetURL);
      return new Response('// Ad script blocked', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' }
      });
    }
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

function blockAdsInHTML(html) {
  // Remove Google AdSense scripts
  html = html.replace(/<script[^>]*googlesyndication[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script[^>]*adsbygoogle[^>]*>[\s\S]*?<\/script>/gi, '');
  
  // Remove Google Analytics
  html = html.replace(/<script[^>]*google-analytics[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script[^>]*googletagmanager[^>]*>[\s\S]*?<\/script>/gi, '');
  
  // Remove DoubleClick
  html = html.replace(/<script[^>]*doubleclick[^>]*>[\s\S]*?<\/script>/gi, '');
  
  // Remove ad iframes
  html = html.replace(/<iframe[^>]*googlesyndication[^>]*>[\s\S]*?<\/iframe>/gi, '');
  html = html.replace(/<iframe[^>]*doubleclick[^>]*>[\s\S]*?<\/iframe>/gi, '');
  
  // Remove ad insertion elements
  html = html.replace(/<ins[^>]*adsbygoogle[^>]*>[\s\S]*?<\/ins>/gi, '');
  
  // Remove divs with ad IDs
  html = html.replace(/<div[^>]*id="google_ads[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  return html;
}

function getMainHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Home - Classroom</title>
    <meta name="description" content="Play Roblox, Fortnite, Call of Duty Mobile, Delta Force, and more in your browser">
    
    <!-- PWA Meta Tags -->
    <meta name="theme-color" content="#2d2d2d">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="CloudMoon">
    <link rel="manifest" href="/manifest.json">
    <link rel="apple-touch-icon" href="/favicon.png">
    
    <link rel="icon" id="favicon" type="image/png" href="/favicon.png">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: #0d1117;
            color: #c9d1d9;
            overflow: hidden;
        }
        
        #container {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        #frame-container {
            flex: 1;
            width: 100%;
            height: 100%;
            background: white;
            position: relative;
        }
        
        iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: white;
            outline: none;
        }
        
        iframe:focus {
            outline: none;
        }

        /* Floating button dock — bottom left */
        #btn-dock {
            position: fixed;
            bottom: 18px;
            left: 18px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 9999;
            transition: opacity 0.3s;
        }

        #btn-dock.hidden {
            opacity: 0;
            pointer-events: none;
        }

        .dock-btn {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            border: none;
            background: rgba(45, 45, 45, 0.85);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            color: #e0e0e0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.4);
            transition: background 0.2s, transform 0.15s;
        }

        .dock-btn:hover {
            background: rgba(74, 74, 74, 0.95);
        }

        .dock-btn:active {
            transform: scale(0.93);
        }

        #home-btn {
            display: none;
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="frame-container"></div>
    </div>

    <!-- Floating bottom-left controls -->
    <div id="btn-dock">
        <button class="dock-btn" id="home-btn" onclick="goBack()" title="Home">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6"/>
            </svg>
        </button>
        <button class="dock-btn" id="fullscreen-btn" onclick="enterFullscreen()" title="Fullscreen">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
            </svg>
        </button>
    </div>

    <script>
        const frameContainer = document.getElementById('frame-container');
        const homeBtn = document.getElementById('home-btn');
        const btnDock = document.getElementById('btn-dock');
        
        let isShowingGame = false;
        let mainURL = '/web.cloudmoonapp.com/';
        let shadowRoots = [];
        let currentIframe = null;
        
        const SANDBOX_HOME = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock allow-top-navigation-by-user-activation';
        const SANDBOX_GAME = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock allow-top-navigation-by-user-activation';
        const ALLOW_PERMISSIONS = 'accelerometer; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; clipboard-read; clipboard-write; xr-spatial-tracking; gamepad';
        
        const SHADOW_LAYERS = 4;
        
        function createMultiLayerShadowFrame(url, isGame = false) {
            frameContainer.innerHTML = '';
            shadowRoots = [];
            
            let currentHost = document.createElement('div');
            currentHost.style.width = '100%';
            currentHost.style.height = '100%';
            currentHost.style.margin = '0';
            currentHost.style.padding = '0';
            currentHost.style.border = 'none';
            currentHost.style.display = 'block';
            currentHost.style.overflow = 'hidden';
            currentHost.setAttribute('data-id', generateRandomId());
            currentHost.setAttribute('data-component', 'container');
            
            frameContainer.appendChild(currentHost);
            
            for (let i = 0; i < SHADOW_LAYERS; i++) {
                const shadowRoot = currentHost.attachShadow({ mode: 'closed' });
                shadowRoots.push(shadowRoot);
                
                if (i < SHADOW_LAYERS - 1) {
                    const nextHost = document.createElement('div');
                    nextHost.style.width = '100%';
                    nextHost.style.height = '100%';
                    nextHost.style.margin = '0';
                    nextHost.style.padding = '0';
                    nextHost.style.border = 'none';
                    nextHost.style.display = 'block';
                    nextHost.style.overflow = 'hidden';
                    nextHost.setAttribute('data-layer', i.toString());
                    nextHost.setAttribute('data-id', generateRandomId());
                    
                    shadowRoot.appendChild(nextHost);
                    currentHost = nextHost;
                    
                    console.log(\`%c Shadow Layer \${i + 1} created\`, 'color: #667eea; font-weight: bold;');
                } else {
                    const iframe = document.createElement('iframe');
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.border = 'none';
                    iframe.style.margin = '0';
                    iframe.style.padding = '0';
                    iframe.style.display = 'block';
                    iframe.style.overflow = 'hidden';
                    
                    const sandboxAttr = isGame ? SANDBOX_GAME : SANDBOX_HOME;
                    iframe.setAttribute('sandbox', sandboxAttr);
                    iframe.setAttribute('allow', ALLOW_PERMISSIONS);
                    iframe.setAttribute('title', isGame ? 'Game Preview' : 'CloudMoon Preview');
                    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
                    iframe.setAttribute('importance', 'high');
                    iframe.setAttribute('loading', 'eager');
                    iframe.setAttribute('data-frame-id', generateRandomId());
                    iframe.setAttribute('data-secure', 'true');
                    
                    iframe.src = url;
                    
                    shadowRoot.appendChild(iframe);
                    currentIframe = iframe;
                    
                    iframe.addEventListener('load', () => {
                        focusIframe();
                    });
                    
                    iframe.addEventListener('error', (e) => {
                        console.error('Iframe error:', e);
                    });
                    
                    console.log(\`%c Final Shadow Layer \${SHADOW_LAYERS} with iframe created\`, 'color: #10b981; font-weight: bold;');
                }
            }
            
            console.log(\`%c \${SHADOW_LAYERS}-Layer Shadow DOM Protection Active\`, 'color: #667eea; font-size: 14px; font-weight: bold;');
        }
        
        function generateRandomId() {
            return 'x' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        }
        
        function createShadowFrame(url, isGame = false) {
            createMultiLayerShadowFrame(url, isGame);
        }
        
        function focusIframe() {
            setTimeout(() => {
                if (currentIframe) {
                    currentIframe.focus();
                    try {
                        currentIframe.contentWindow.focus();
                    } catch (e) {
                        // Cross-origin, expected
                    }
                }
            }, 100);
        }
        
        // Initialize with multi-layer shadow DOM
        createMultiLayerShadowFrame(mainURL, false);
        
        document.addEventListener('click', (e) => {
            if (currentIframe && e.target !== currentIframe) {
                focusIframe();
            }
        });
        
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'LOAD_GAME') {
                const gameUrl = event.data.url;
                console.log('Game URL received:', gameUrl);
                loadGame(gameUrl);
            }
        });
        
        function loadGame(url) {
            let fixedURL = url;
            const workerDomain = window.location.origin;
            
            // Check if URL is already on our worker domain
            if (url.includes(workerDomain)) {
                // Already on our domain, use as-is (avoid double-proxying)
                fixedURL = url;
                console.log('Game URL already on worker domain, using directly');
            } else if (url.includes('://')) {
                // External URL - proxy it through worker
                fixedURL = workerDomain + '/proxy/' + encodeURIComponent(url);
                console.log('External game URL, proxying through worker');
            } else if (url.startsWith('/')) {
                // Relative URL - keep it (will be proxied automatically)
                fixedURL = url;
                console.log('Relative game URL, using as-is');
            }
            
            console.log(\`%c Loading game with \${SHADOW_LAYERS}-layer Shadow DOM protection\`, 'color: #667eea; font-weight: bold;');
            console.log('Final game URL:', fixedURL);
            
            createMultiLayerShadowFrame(fixedURL, true);
            
            isShowingGame = true;
            homeBtn.style.display = 'flex';
        }
        
        function goBack() {
            createMultiLayerShadowFrame(mainURL, false);
            isShowingGame = false;
            homeBtn.style.display = 'none';

            // Exit fullscreen if active
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }

        function enterFullscreen() {
            // Try to send message to iframe to fullscreen the game container
            if (currentIframe) {
                try {
                    // Send message through all shadow layers to reach the iframe
                    currentIframe.contentWindow.postMessage({type: 'REQUEST_FULLSCREEN'}, '*');
                    console.log('Sent fullscreen request to game container');
                } catch (e) {
                    console.log('Cannot send message to iframe (cross-origin), using fallback');
                    // Fallback to document fullscreen
                    document.documentElement.requestFullscreen();
                }
            } else {
                // No iframe, use document fullscreen
                document.documentElement.requestFullscreen();
            }
            // Hide the dock while fullscreen
            btnDock.classList.add('hidden');
        }

        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                // Restore dock when exiting fullscreen
                btnDock.classList.remove('hidden');
            }
        });
        
        console.log('%c CloudMoon Proxy Active with Ad Blocking', 'color: #667eea; font-size: 18px; font-weight: bold;');
        console.log(\`%c Multi-Layer Shadow DOM Protection: \${SHADOW_LAYERS} Layers\`, 'color: #10b981; font-size: 14px; font-weight: bold;');
        
        // Register Service Worker for PWA
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then((registration) => {
                        console.log('%c PWA Service Worker registered', 'color: #667eea; font-weight: bold;');
                        
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('%c New version available!', 'color: #10b981; font-weight: bold;');
                                }
                            });
                        });
                    })
                    .catch((error) => {
                        console.log('Service Worker registration failed:', error);
                    });
            });
        }
        
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
        });
        
        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
        });
    </script>
</body>
</html>`;
}

function getManifest() {
  return JSON.stringify({
    "name": "Google Classroom",
    "short_name": "Google Classroom",
    "description": "Google Classroom is a free, secure, and easy-to-use blended learning platform within Google Workspace for Education that allows educators to create, distribute, and grade assignments in one place.",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0d1117",
    "theme_color": "#2d2d2d",
    "orientation": "any",
    "scope": "/",
    "icons": [
      {
        "src": "/favicon.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any maskable"
      }
    ],
    "categories": ["education", "learning"],
    "screenshots": [],
    "shortcuts": [
      {
        "name": "Open Classroom",
        "short_name": "Open Classroom",
        "description": "Open Google Classroom",
        "url": "/",
        "icons": [
          {
            "src": "/favicon.png",
            "sizes": "96x96",
            "type": "image/png"
          }
        ]
      }
    ]
  });
}

function getServiceWorker() {
  return `// CloudMoon InPlay Service Worker
const CACHE_NAME = 'cloudmoon-v1';
const RUNTIME_CACHE = 'cloudmoon-runtime';

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll([
        '/',
        '/manifest.json',
        '/sw.js',
        '/favicon.png'
      ]);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[ServiceWorker] Removing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests - let browser handle them
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If response is valid, clone it and cache it
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          }).catch((error) => {
            console.error('[ServiceWorker] Cache put error:', error);
          });
        }
        return response;
      })
      .catch((error) => {
        console.log('[ServiceWorker] Fetch failed, trying cache:', event.request.url);
        // If network fails, try to serve from cache
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          // If not in cache, return a basic offline page for navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          // For other resources, return a minimal response to prevent errors
          return new Response('', { 
            status: 200, 
            statusText: 'OK',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});`;
}
