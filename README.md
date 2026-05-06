# Dangerzone.rocks website

This is a static website, currently hosted at https://dangerzone.rocks/

We use the static site generator [Eleventy](https://www.11ty.dev/) to build the site,
and publish it via [GitHub Pages](https://pages.github.com/). On every push to `main`,
the [`Publish`](.github/workflows/publish.yaml) workflow builds the site and deploys
the contents of `dist/` to GitHub Pages.

To run Eleventy locally, you need Node.js (an LTS release or later). Run `npm install`
to install the dependencies, then run `npm run serve` to serve the site on port 8080.
