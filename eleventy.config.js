const pluginRss = require("@11ty/eleventy-plugin-rss");

module.exports = function(eleventyConfig) {
    eleventyConfig.addPassthroughCopy("src/assets");
    eleventyConfig.addPassthroughCopy("src/favicon.ico");
    eleventyConfig.addPlugin(pluginRss);

    eleventyConfig.addCollection("posts", function(collection) {
        return collection.getFilteredByGlob("src/news/*.md");
    });

    eleventyConfig.addFilter("dateIso", date => {
        return date.toISOString();
    });

    eleventyConfig.addFilter("dateReadable", date => {
       return date.toDateString();
    });

    return {
        dir: {
            input: "src",
            output: "dist",
            includes: "_layouts"
        }
    };
}