---
title: Why we switched our container from Alpine Linux to Debian Stable
date: 2026-02-05
---

We’ve been so busy bringing changes to fruition for Dangerzone this past year that writing about them was mostly an afterthought. So to make up for that, this article kickstarts our attempt in the coming weeks to document those modifications and their rationale.

One of these changes was the switch of our container image from Alpine Linux to Debian stable. Dangerzone uses a container as a sandbox, in order to open documents in a restricted environment and return a pixel buffer to the host. In this article, we’ll explain how we improved our image's footprint, security and build complexity, by switching from Alpine Linux to Debian Stable.

## Our issues with Alpine

Dangerzone initially chose Alpine for its small size, security focus (musl libc, quick CVE fixes), and faster builds.

Dangerzone requires a container image with the following tools:

* LibreOffice, for rendering office documents to PDF
* PyMuPDF, for rendering PDFs to pixels
* A Java runtime (OpenJDK), for the H2ORestart LibreOffice plug-in
* Python, and the `python3-magic` package, to run our sanitization logic
* A font that supports Chinese, Japanese, and Korean languages ([Noto CJK)](https://fonts.google.com/noto/specimen/Noto+Sans+TC)

The Alpine-based container image of Dangerzone 0.8.1 clocked in at roughly 1.1 GiB and included 283 packages (you can [download](https://github.com/freedomofpress/dangerzone/releases/download/v0.8.1/container-0.8.1-i686.tar.gz) it). This size is unexpected for an Alpine image with just five packages installed, so we dug into the package list and found the culprit: a significant number of seemingly unnecessary packages in a headless container context. We found graphical utilities like `mesa`, `wayland-libs-server`, and `libx11`, alongside multimedia frameworks like `gstreamer`.

Why are these installed? Unlike package managers in other distributions, Alpine's `apk` offers less granular control over dependencies. To the best of our knowledge, there's no straightforward way to install LibreOffice on Alpine without pulling in this extensive and unwanted dependency tree, nor is there an officially packaged headless variant of LibreOffice available in the Alpine repositories.

### Security woes

The inclusion of GStreamer, for example, isn't theoretical bloat; it has directly led to security headaches. A GStreamer CVE necessitated a hotfix release (see [security advisory](https://github.com/freedomofpress/dangerzone/blob/main/docs/advisories/2024-12-24.md) 2024-12-24), and we narrowly avoided another due to a separate GStreamer vulnerability.

On a separate occasion, a critical vulnerability ([CVE-2023-43115](https://nvd.nist.gov/vuln/detail/CVE-2023-43115)) was discovered in Ghostscript, a core library we used circa 2023, on Sept. 18. The Ghostscript authors fixed it in their main branch but didn't immediately cut a new release. This meant downstream distributors had to backport the patch themselves. Distributions like Debian and Fedora had patches available by mid-October. The Ghostscript authors finally released a new version on Nov. 1, which Alpine packaged on Nov. 9. By then, Dangerzone had released a new container image using the vulnerable Ghostscript version, forcing us to issue a hotfix.

One could argue that Alpine’s security model of following upstream brings in more security fixes early on, even if it didn’t work out for us in the above case. That’s a fair point, but we never used the edge distribution of Alpine anyway. We always used the stable distribution, in which the packages are not updated that often. Case in point, on May 28, 2025, Alpine Linux v3.21 still had LibreOffice 7.6.7.2, built on Nov. 11, 2024, i.e., roughly *half a year* without updates.

We must stress that keeping up with CVEs and triaging them requires *a lot* of effort and diligence for every package that Alpine Linux maintains, which can be taxing for a small team like Alpine’s. And Alpine's security team punches way above its weight (as highlighted in [this insightful post](https://ariadne.space/2021/06/07/the-vulnerability-remediation-lifecycle-of.html)). So this does not mean that Alpine’s or Debian’s security model is superior, only that Debian benefits from a larger number of maintainers.

### Slower image builds

PyMuPDF isn't available in the standard Alpine repositories, so we installed it via PyPI. This is fine for amd64 builds where pre-compiled wheels are available. However, for arm64 architectures (like those found in Apple Silicon Macs), there's no musl-compatible arm64 wheel on PyPI. This forced our build process to compile PyMuPDF from source, a computationally expensive task that adds considerable time to builds, even with caching.

## Switching to Debian Stable

Considering the above, we decided to switch to Debian Stable for the following reasons:

1. **Smaller and leaner image:** Using Debian's `apt --no-install-recommends` and headless packages (e.g., `libreoffice-nogui`), the Debian image is about 10% smaller (around 1 GiB) and contains only essential packages, drastically reducing the attack surface.
2. **Reasonably good security:** In addition to a smaller attack surface, Debian Stable improves our baseline security by patching known vulnerabilities as soon as they are out, or marking CVEs as "won’t fix." When our security scans start ringing, this helps with our triaging a lot.
3. **Faster and simpler builds:** Debian repositories include packaged PyMuPDF for all architectures, eliminating slow source compilation on arm64.

Another important factor is the potential for improved build reproducibility, a topic we are exploring in a separate effort.

P.S. For a more nuanced take, check an [interesting discussion](https://github.com/freedomofpress/dangerzone/issues/1046) on this subject with GrapheneOS creator, Daniel Micay.
