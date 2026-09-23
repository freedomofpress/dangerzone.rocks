# Dangerzone.rocks website

We use the static site generator [Eleventy](https://www.11ty.dev/) to build the site.

> [!NOTE]
> The Node.js version is documented in the `.nvmrc` file. If you are using 
> [`nvm`](https://github.com/nvm-sh/nvm) the correct version will be activated automatically.

To run Eleventy directly, you need Node.js (an LTS release or later). Run `npm install` to
install the dependencies, then run `npm run serve` to serve the site on port 8080.

The production is deployed to [https://dangerzone.rocks](https://dangerzone.rocks) by Cloudflare Pages.
