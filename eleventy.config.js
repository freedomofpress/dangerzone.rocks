const pluginRss = require("@11ty/eleventy-plugin-rss");
const markdownIt = require("markdown-it");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/favicon.ico");
  eleventyConfig.addPlugin(pluginRss);

  eleventyConfig.setFrontMatterParsingOptions({
    excerpt: true,
  });

  eleventyConfig.addFilter("md", function (content = "") {
    return markdownIt({ html: true }).render(content);
  });

  eleventyConfig.addFilter("dateIso", (date) => {
    return date.toISOString();
  });

  eleventyConfig.addFilter("dateReadable", (date) => {
    return date.toDateString();
  });

  eleventyConfig.addCollection("posts", function (collection) {
    return collection.getFilteredByGlob("src/news/*.md");
  });

  eleventyConfig.addFilter("getLatestVersion", function (collection) {
    // Find the latest known version from the collection
    return collection?.reduce((latest, item) => {
      return !latest || item.data.version > latest ? item.data.version : latest;
    }, null);
  });

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_layouts",
    },
  };
};
