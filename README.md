# CloudMoon InPlay

Cloudmoon InPlay is a simple site that proxies, hides, and loads cloudmoon in a browser using Cloudflare workers, allowing you to effortlessly play Roblox, Fortnight, Call of Duty Mobile, Delta Force, and More in Browser at school or work!

> [!NOTE]
> If you fork or use this repository, Please consider sharing or giving us a Star!

## Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sriail/Cloudmoon-InPlay)

## Use

> [!IMPORTANT]
> Because of google's authentication policies, the google sign in button will NOT WORK. You must hit sign in with email and password instead. You will also need to register your cloudmoon account at home with google and set a password in settings.

Once you sign in, you can click and play games in Cloudmoons library!
After that, you can use the upper navbar to help you navigate, cloak the site with About:Blank, and reload the site with the reload button.


> [!NOTE]
> When Cloudmoon tries to open a new Tab, it will open in the central iframe to avoid being blocked.

## Deploy

To deploy your owen cloudmoon worker, click the deploy to cloudflare button, for maxamu sicurity, it is recomended that it is embeded into another site using this code (blocks extentions with restrictive content policies)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Shadow DOM Full Page Iframe</title>
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
    <!-- Custom element that will hold the Shadow DOM -->
    <full-page-frame
      src="Worker"  <!-- Replace with your owen proxy / Cloudflare Worker -->
    ></full-page-frame>

    <script>
      class FullPageFrame extends HTMLElement {
        connectedCallback() {
          // 1. Attach the Shadow DOM
          const shadow = this.attachShadow({ mode: "open" });

          // 2. Create the iframe element
          const iframe = document.createElement("iframe");
          iframe.src = this.getAttribute("src");

          // 3. Apply internal styles to the Shadow DOM
          const style = document.createElement("style");
          style.textContent = `
                    iframe {
                        width: 100%;
                        height: 100%;
                        border: none;
                        display: block;
                    }
                `;

          // 4. Append to the shadow root
          shadow.appendChild(style);
          shadow.appendChild(iframe);
        }
      }

      // Register the custom element
      customElements.define("full-page-frame", FullPageFrame);
    </script>
  </body>
</html>
```

