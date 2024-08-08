# Dangerzone.rocks website

This is a static website, currently hosted at https://dangerzone.rocks/

We use the static site generator [Eleventy](https://www.11ty.dev/) to build the site.

To run Eleventy directly, you need Node.js (an LTS release or later). Run `npm install` to
install the dependencies, then run `npm run serve` to serve the site on port 8080.

In production, we use a containerized setup. You can also use it to serve the site:

To test the deploy container:

```sh
docker build -t dzr -f deploy/Dockerfile .
docker run --rm -p 127.0.0.1:8080:5080 dzr
```

This will also serve the site on port 8080.