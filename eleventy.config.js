import pluginRss from "@11ty/eleventy-plugin-rss";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import markdownPrismJs from "@11ty/eleventy-plugin-syntaxhighlight/src/markdownSyntaxHighlightOptions.js";
import { gte } from "semver";
import markdownIt from "markdown-it";

export default function (eleventyConfig) {
  const markdown = markdownIt({
    html: true,
    highlight: markdownPrismJs({ lineSeparator: "\n" }),
  });
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/favicon.ico");
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(syntaxHighlight);

  eleventyConfig.setFrontMatterParsingOptions({
    excerpt: true,
  });

  eleventyConfig.addFilter("md", function (content = "") {
    return markdown.render(content);
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
      if (item.data.version == undefined) return latest;
      return !latest || gte(item.data.version, latest)
        ? item.data.version
        : latest;
    }, null);
  });

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_layouts",
    },
  };
}
