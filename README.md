![github_thum.png](github_thum.png)


# CloudMoon InPlay

Cloudmoon InPlay is a simple JS site that proxies, hides, and loads Cloudmoon in a browser using Cloudflare workers, allowing you to effortlessly play Roblox, Fortnight, Call of Duty Mobile, Delta Force, and More in Browser at School or Work!

> [!NOTE]
> If you fork or use this repository, Please consider sharing or giving us a Star!

## Deploy

To deploy your own Cloudmoon InPlay Cloudflare worker, click the deploy to Cloudflare button, and then play through the workers preview! 
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sriail/Cloudmoon-InPlay)

> [!TIP]
> Be Shure to share it with your Friends / Co-workers. If you're worried about the url being blocked, Deploy a new worker or create a mirror using the code below on a html site host like Codesandbox of Github pages! Also has a bypass to chrome extension and AI autoblock software (blocks extensions at the root).

Optional second DOM Embed layer (Recommended if under heavy restrictions, to use on a different HTML site with your original worker URL)
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Home - Classroom</title>
    <style>
      /* Ensure the container takes up the full viewport */
      html,
      body {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
      }
      full-page-frame {
        display: block;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <!-- Custom element that will hold the triple Shadow DOM -->
    <full-page-frame
      src="Worker"  <!-- Replace with your own proxy / Cloudflare Worker -->
    ></full-page-frame>
    <script>
      class FullPageFrame extends HTMLElement {
        connectedCallback() {
          // Layer 1: First Shadow DOM
          const shadow1 = this.attachShadow({ mode: "closed" });
          
          // Create first layer container
          const layer1Container = document.createElement("div");
          layer1Container.setAttribute("id", "layer1");
          
          const style1 = document.createElement("style");
          style1.textContent = `
            #layer1 {
              width: 100%;
              height: 100%;
              display: block;
            }
          `;
          
          shadow1.appendChild(style1);
          shadow1.appendChild(layer1Container);
          
          // Layer 2: Second Shadow DOM (nested)
          const shadow2 = layer1Container.attachShadow({ mode: "closed" });
          
          const layer2Container = document.createElement("div");
          layer2Container.setAttribute("id", "layer2");
          
          const style2 = document.createElement("style");
          style2.textContent = `
            #layer2 {
              width: 100%;
              height: 100%;
              display: block;
            }
          `;
          
          shadow2.appendChild(style2);
          shadow2.appendChild(layer2Container);
          
          // Layer 3: Third Shadow DOM (nested)
          const shadow3 = layer2Container.attachShadow({ mode: "closed" });
          
          const layer3Container = document.createElement("div");
          layer3Container.setAttribute("id", "layer3");
          
          const style3 = document.createElement("style");
          style3.textContent = `
            #layer3 {
              width: 100%;
              height: 100%;
              display: block;
            }
            iframe {
              width: 100%;
              height: 100%;
              border: none;
              display: block;
            }
          `;
          
          shadow3.appendChild(style3);
          shadow3.appendChild(layer3Container);
          
          // Final iframe in the innermost layer
          const iframe = document.createElement("iframe");
          iframe.src = this.getAttribute("src");
          
          // Additional security attributes
          iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox");
          iframe.setAttribute("referrerpolicy", "no-referrer");
          
          layer3Container.appendChild(iframe);
          
          // Optional: Add random attributes to obfuscate structure
          this.setAttribute("data-component", this.generateRandomId());
          layer1Container.setAttribute("data-layer", this.generateRandomId());
          layer2Container.setAttribute("data-layer", this.generateRandomId());
          layer3Container.setAttribute("data-layer", this.generateRandomId());
        }
        
        generateRandomId() {
          return Math.random().toString(36).substring(2, 15);
        }
      }
      
      // Register the custom element
      customElements.define("full-page-frame", FullPageFrame);
    </script>
  </body>
</html>
```

## Usage

> [!IMPORTANT]
> Because of google's authentication policies, the google sign in button will NOT WORK. You must hit sign in with email and password instead. You will also need to register your cloudmoon account at home with google and set a password in settings before using elsewhere (Google Sign In button is now visibly hidden to avoid confusion).

Once you sign in, you can click and play games or apps in Cloudmoons library!
After that, you can use the Control bar for navigation, and go home using the home button, as well as fullscreening in-game (since many School / Work Pcs use low end hardwher runing Windows 10 or Chrome OS, all ads are proxied and removed, striping any unecacary content)


> [!NOTE]
> When Cloudmoon tries to open a new Tab, it will open in the central iframe to avoid being blocked, keeping everything self contained in the site.

## Updates / Bug Fixes

- [x] Fix Proxy Reinizulaiztion
- [x] Add Fullscreen Fix
- [x] Add Adblocking
- [x] Remove Google Sign in Button
- [x] Renove Adboxes in Game
- [ ] Add Fullscreen Typebox Fix
