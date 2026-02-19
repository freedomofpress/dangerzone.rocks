---
title: Reproducing the reproducible images
date: 2026-02-19
---

The Dangerzone project has to be a bit distrustful: It distrusts the document that is processed in its container, and it also distrusts the registries that serve its image, which is why we sign it and ensure it’s bit-for-bit reproducible.

The reproducibility of our container image is one of our core defenses against supply chain attacks, and in this post, we talk a bit more broadly about this often-overlooked subject. We will also introduce [a collection of tools and CI helpers for reproducible images](https://github.com/freedomofpress/repro-build), which should be generic enough to apply to your project as well.

For those new to what “reproducible” means, here’s a helpful definition by the [Reproducible Builds](https://reproducible-builds.org/) project:

> “A build is **reproducible** if given the same source code, build environment and build instructions, any party can recreate bit-by-bit identical copies of all specified artifacts.”

When talking about reproducible **container** images, the two main container managers, Docker (BuildKit) and Podman (Buildah), suggest specifying both `SOURCE_DATE_EPOCH` and an argument to rewrite the image layers:

* For BuildKit, specify `SOURCE_DATE_EPOCH` in your Dockerfile (or environment) and pass the `rewrite-timestamp=true` option ([source](https://github.com/moby/buildkit/blob/master/docs/build-repro.md)).
* For Buildah, specify `SOURCE_DATE_EPOCH` in your Dockerfile (or environment or use the CLI option `--source-date-epoch`) and pass the `--rewrite-timestamp` option ([source](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/building_running_and_managing_containers/introduction-to-reproducible-container-builds)).

## Let’s create a reproducible image

Reproducibility is actually much more than setting a timestamp. The image itself must be free of any sources of nondeterminism. Let’s consider a Dockerfile, where we install `gcc` in a Debian image that was created on 2023-09-04 and has remained the same ever since:

```Dockerfile
FROM debian:bookworm-20230904-slim
RUN apt-get update && apt-get install -y gcc
```

Is this container image reproducible? Let’s find out:

```shell
$ export SOURCE_DATE_EPOCH=1677619260  # Just a random UNIX epoch
$ docker buildx --no-cache --output type=docker,dest=image.tar,rewrite-timestamp=true .
[...]
 => => rewriting layers with source-date-epoch 1677619260 (2023-02-28 21:21:00 +0000 UTC)                                                                                                                                                9.7s
 => => exporting manifest sha256:81ebf01e608e298f2827d3da4e546e531e6b8b19f2f793df10b058f16b85545a
```

Once more, with feeling:

```shell
$ docker buildx --no-cache --output type=docker,dest=image.tar,rewrite-timestamp=true .
 [...]
 => => rewriting layers with source-date-epoch 1677619260 (2023-02-28 21:21:00 +0000 UTC)                                                                                                                                                9.7s
 => => exporting manifest sha256:231a1e36dae728a3f8bc3bdfa20a856c3bb78f0a3759ad98a1ea13d2d4920614                                                                                                                                        0.0s
```

That’s interesting, the digests differ!

So, the Dockerfile is not reproducible, but why? The [Reproducible Containers](https://github.com/reproducible-containers) project by [Akihiro Suda](https://github.com/AkihiroSuda) fills an important gap in the understanding and tooling around reproducible container images. Among other utilities, it offers a tool to diff OCI images: `diffoci`.

So, let’s check why those images differ with [`diffoci`](https://github.com/reproducible-containers/diffoci). We’ll use the `--semantic` flag here, to check only file differences, and the `--report-dir diffs/` option to write the differing files into a `diffs/` directory:

```shell
$ diffoci diff --semantic --report-dir diffs/ <image1> <image2>
TYPE    NAME                            INPUT-0                                                             INPUT-1
File    var/log/apt/term.log            f78e67afe7aca12045cd74a73d6bdb38fd2ef3621f64b178feb0b82fad9d26a2    e3b6ff496d4253810b97f432eec285bc0a4f85ae87d667cc7ef6f4c7c2eaef1f
File    var/cache/ldconfig/aux-cache    c0bd5b8e12012d153bf527509e6ef0d125bafbd998e33443d8bca12c9352abb4    37f21a5282b0bc13af266cbab5c6819d7045c346f28c782a5920d52044f2720f
File    var/log/dpkg.log                fe4e8edc30b2b0a8d936b9930ece042c9affa8b2b567f74d160a680d57874a73    530173cae986e3607bac1eef1b1739d1a3cfbfa539f9aebfaa7397b397f31712
File    var/log/alternatives.log        abb1f05b7ff0598fcbe7374f513898a0acf6f23260661420ebb1e732bd09b192    da346849248fbcd01371339956f2a90a9e28ace7c54e596ed1dc95df06919111
File    var/log/apt/history.log         99e8510b67d705a84899115a25c15206fa9affd52f75af1e6ef6ecd06e679552    766b51931e938fee62973d04c495e38d9a36be7ca4b2efafb76883ac502672f2
```

It seems that some APT-related files are different. Let’s check them out:

```shell
$ diff diffs/input-{0,1}/layers-1/var/log/apt/term.log
2c2
< Log started: 2026-01-22  09:58:37
---
> Log started: 2026-01-22  09:59:38
355c355
< Log ended: 2026-01-22  09:58:47
---
> Log ended: 2026-01-22  09:59:48
```

Makes sense, the fact that we define `SOURCE_DATE_EPOCH` does not alter the time within the container image and what will be written in the logs. A simple way to solve this problem is to remove the logs after `apt-get` is done.

But there’s more to that:

```shell
$ docker run --rm <image> apt-cache policy gcc
gcc:
  Installed: 4:12.2.0-3
  Candidate: 4:12.2.0-3
  Version table:
 *** 4:12.2.0-3 500
        500 http://deb.debian.org/debian bookworm/main amd64 Packages
        100 /var/lib/dpkg/status
```

Turns out that the `gcc` package does not come from Debian’s archives (https://snapshot.debian.org/), but from the main bookworm one (see `http://deb.debian.org/debian bookworm/main)`. Granted, Bookworm is `oldstable` by now, and `gcc` does not change often, but that doesn’t mean that one of its dependencies can’t.

The proper solution here is another project by Reproducible Containers, [`repro-sources-list.sh`](https://github.com/reproducible-containers/repro-sources-list.sh/blob/master/repro-sources-list.sh). This script configures /etc/apt/sources.list and similar files for installing packages from a snapshot, using [https://snapshot.debian.org](https://snapshot.debian.org) in place of the default APT source.

Here’s a better Dockerfile using this script:

```Dockerfile
FROM debian:bookworm-20230904-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN \
  --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  --mount=type=bind,source=./repro-sources-list.sh,target=/usr/local/bin/repro-sources-list.sh \
  repro-sources-list.sh && \
  apt-get update && \
  apt-get install -y gcc && \
  : "Clean up for improving reproducibility (optional)" && \
  rm -rf /var/log/* /var/cache/ldconfig/aux-cache
```

This is now a bit-for-bit reproducible container image. As long as the Debian snapshot servers work, its digest is guaranteed to be `sha256:b0088ba0110c2acfe757eaf41967ac09fe16e96a8775b998577f86d90b3dbe53`.

Because we want to make sure that what we’re building now can be reproduced in a month or a year from now, we actually went ahead and created a nightly CI job that constantly builds this image and verifies its digest is the expected one, and it worked.

Well, until Feb. 20, 2025. But more on that below — we’re getting ahead of ourselves.

## On build environments

Reminder: A requirement for reproducible builds is to have the same **build environment** and **build instructions**. For container images, the build environment is the base container image, and the build instructions are the Dockerfile. But that’s not the whole story.

What if we build the above image with Podman?

```shell
$ podman build --no-cache --source-date-epoch 1677619260 --rewrite-timestamp
[...]
4eb5ec336a90d4fb2ab7449782c3efdbfac8dcd11037b89213bf90ef2faec977
```

**The digest is different**. Let’s check how many differences `diffoci` reports:

```shell
$ diffoci diff <image1> <image2> | wc -l
847
```

Welp, that’s a lot of stuff there. The majority of those are filename reorders within the layer tarballs, some others are about `.wh.*` files, and some are about the image format itself (OCI vs. Docker). And yet, that does not mean that the container image is not reproducible. Quoting again from Reproducible Builds:

> Reproducible builds does not mandate that a given piece of source code is turned into the same bytes in all situations. This would be unfeasible. The output of a compiler is likely to be different from one version to another as better optimizations are integrated all the time.
>
> Instead, reproducible builds happen in the context of a build environment. It usually comprises the set of tools, required versions, and other assumptions about the operating system and its configuration. A description of this environment should typically be recorded and provided alongside any distributed binary package.

The point here is that the image builder, its version, and its arguments are part of the build environment and the build instructions. That’s why projects like Tor and Bitcoin use their own version of a [static toolchain](https://reproducible-builds.org/docs/virtual-machine-drivers/), possibly within a machine or container. And not only that, but OSes like Debian have [CI tests](https://tests.reproducible-builds.org/debian/reproducible.html) that verify packages remain reproducible and don’t have regressions.

So, what happened on Feb. 20, 2025? BuildKit `v0.20.0` was released, and our CI tests picked it up. This release had a small regression and added an extra field in the image config:

```diff
    "rootfs": {
      "type": "layers",
      "diff_ids": ["sha256:341de903..."]
-   }
+   },
+   "variant": "v8"
```

This was enough to affect the digest of the image. But because we had these CI tests in place, we detected it immediately and opened [moby/buildkit#5774](https://github.com/moby/buildkit/issues/5774). The regression has been fixed, and the hash has remained unchanged ever since.

## Introducing repro-build, a collection of helpers for reproducible images

We strongly believe that reproducible containers that are built and verified only once are prone to rot. If we want more people to engage with them, they need a toolchain to work with and an easy way to continuously reproduce them as part of their CI tests.

With this in mind, we created [https://github.com/freedomofpress/repro-build](https://github.com/freedomofpress/repro-build), which holds:

* A script that reproducibly builds container images using a static build environment.
* Two GitHub Actions:
  *  One that reproducibly builds and pushes container images (and can be used in place of `docker/build-push-action`).
  *  One that rebuilds a container image and compares the digests.

Let’s see that in more detail:

### The Python script

[`repro-build`](https://github.com/freedomofpress/repro-build?tab=readme-ov-file#build-a-container-image-locally):

```
$ ./repro-build build --source-date-epoch 0 .
2025-02-24 09:17:48 - INFO - Build environment:
- Container runtime: docker
- BuildKit image: moby/buildkit:v0.19.0@sha256:14aa1b4dd92ea0a4cd03a54d0c6079046ea98cd0c0ae6176bdd7036ba370cbbe
- Rootless support: False
- Caching enabled: True
- Build context: ./repro-build
- Dockerfile: (not provided)
- Output: ./repro-build/image.tar

Build parameters:
- SOURCE_DATE_EPOCH: 0
- Build args: (not provided)
- Tag: (not provided)
- Platform: (default)

Podman-only arguments:
- BuildKit arguments: (not provided)

Docker-only arguments:
- Docker Buildx arguments: (not provided)

[...]
```

This is a simple script that:

* Works with Docker and Podman, and ensures that BuildKit is used under the hood.
* Pins BuildKit to a specific version.
* Enforces the usage of a source date epoch or a human-friendly timestamp.
* Removes some common sources of nondeterminism by rewriting timestamps and removing build provenance.

It’s our tested version of a static toolchain.

### A replacement for the [`docker/build-push-action`](https://github.com/docker/build-push-action) GitHub action that can reproducibly build container images

[`freedomofpress/repro-build@v1`](https://github.com/freedomofpress/repro-build?tab=readme-ov-file#reproducible-build-action-freedomofpressrepro-buildv1):

```yaml
- name: Reproducibly build and push image
  uses: freedomofpress/repro-build@v1
  with:
    tags: ghcr.io/my-org/my-image:latest
    file: Dockerfile
    platforms: linux/amd64,linux/arm64
    source_date_epoch: 1677619260
    push: true
```

For simple image builds, you can consider this a drop-in replacement for `docker/build-push-action`, doing a similar job as the above script. We know, because we make sure that both this action and the above script create, bit-for-bit, the same images.

### A GitHub action that rebuilds a container image and compares the digests

[`freedomofpress/repro-build/verify@v1`](https://github.com/freedomofpress/repro-build?tab=readme-ov-file#reproduce-and-verify-action-freedomofpressrepro-buildverifyv1):

```yaml
- name: Verify image reproducibility
  uses: freedomofpress/repro-build/verify@v1
  with:
    target_image: ghcr.io/my-org/my-image:latest
    file: Dockerfile
    platforms: linux/amd64
    source_date_epoch: 1677619260
    runtime: podman
```

### Reproducible container images

Our [repro-build](https://github.com/freedomofpress/repro-build) repo has a CI job that builds new container images nightly and then rebuilds them immediately, to make sure that they are reproducible. This CI job reuses the helpers we mentioned above, and produces container images that you can independently reproduce and verify:

| Distro | Dockerfile | GHCR Link |
| ----- | ----- | ----- |
| Debian | [Dockerfile.debian](https://github.com/freedomofpress/repro-build/blob/main/Dockerfile.debian) | [ghcr.io/freedomofpress/repro-build/debian](https://ghcr.io/freedomofpress/repro-build/debian) |

Also, it has a CI job that still reproduces `sha256:b0088ba0110c2acfe757eaf41967ac09fe16e96a8775b998577f86d90b3dbe53` every night, across container runtimes, BuildKit versions, and host images. You are more than welcome to copy our workflow and do the same for your images.

## Future work

There are several things that we’d like to tackle, but we haven’t managed to do so yet:

1. Include the build environment and instructions within the container image.
2. Implement a CI system where we can enroll reproducible images and continuously build and verify them, same as Debian has for their packages.
3. Improve ergonomics for multi-arch images.

We want to make it easy for folks to create their first reproducible container image, which is why we are offering the tools we use ourselves. We believe that with increased adoption of these practices and a systematic way to verify that they work, the container ecosystem will become more robust against supply chain attacks, which is something we deeply care about. So try them out and give us your feedback!

For more, [view a 20-minute talk](https://fosdem.org/2026/schedule/event/RYM8SF-repro-build/) we gave on this subject at FOSDEM 2026.
