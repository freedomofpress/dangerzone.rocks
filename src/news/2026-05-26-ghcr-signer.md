---
title: The GHCR Signer
date: 2026-06-02
---

*TL;DR: We [implemented a tool](https://github.com/freedomofpress/ghcr-signer) to help us handle signatures and updates to the GitHub container registry, without having to use personal access tokens.*

We recently started publishing the Dangerzone images on the GitHub container registry, ghcr.io, [as outlined in a previous post](https://dangerzone.rocks/news/2026-04-02-independent-container-updates/).

Our setup has some peculiarities:

1. We are signing using **a physical hardware *token***, and of course, we don't want to provide GitHub with our secret key — which excludes the usage of a bot user.  
2. **Our organization has disabled personal access tokens,** as they are considered [a bad security practice](https://hackersvanguard.com/harden-device-trust-with-token-permissions/#:~:text=However%2C%20a%20critical,Access%20Tokens%20\(PATs\).) (these tokens aren't fine-grained and can give more privileges than intended to the bearer, opening security breaches).

Frustratingly, the GitHub Container Registry [only supports PATs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-to-the-container-registry) to authenticate to their service, and so we had to find ways around this limitation.

As a result, we implemented a pull-request-based flow that verifies signatures and then uses GitHub Actions to authenticate to push to [*ghcr.io*](http://ghcr.io) on our behalf.

It works like this when you want to publish a new version of a container:

1. **Generate the signatures** from the machine with the physical hardware token (think YubiKeys), using a *temporary local registry*.  
2. Retrieve the signatures, **commit them in** the ghcr-signer repo, and open a *pull-request* upstream.  
3. The CI runs and **verifies the signatures** against a known public key.  
4. The maintainers perform manual review checks.  
5. Once merged, **signatures are uploaded to the *GHCR***.  
6. The `latest` tag is updated in the *GHCR*.

The implementation involves running local registries, downloading files, and then syncing them to a different one. Pretty fun! Here is how it works:

## Understanding a signature

In very abstract terms, a signature is really a set of `manifests` and blobs in the container registry. Container images may have multiple signatures, especially if they are multi-architecture ones. For simplicity’s sake, let's just consider they are *files* on a *registry*, which are created by the `cosign` utility.

First, spawn a local container registry and direct cosign to upload the signatures to it:

```bash
set LOCAL_REGISTRY="127.0.0.1:7777"
set LOCAL_REPOSITORY="$LOCAL_REGISTRY/local-dangerzone"

# Spawn a temporary local container registry
crane registry serve --address $LOCAL_REGISTRY

# Direct cosign to upload the signatures to this local registry
set COSIGN_REPOSITORY=$LOCAL_REPOSITORY
cosign sign --verbose -y $IMAGE
```

Then, retrieve the generated files and store them locally, using [`oras`](https://oras.land/):

```bash
# Retrieve the signature
oras manifest fetch \
    "$LOCAL_REPOSITORY:sha256-{image_hash}.sig" \
    --plain-http >> signature
```

Here is the content of the `signature` file:

```json
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "config": {
    "mediaType": "application/vnd.oci.image.config.v1+json",
    "size": 233,
    "digest": "{CONFIG_BLOB_DIGEST}"
  },
  "layers": [
    {
      "mediaType": "application/vnd.dev.cosign.simplesigning.v1+json",
      "size": 252,
      "digest": "{PAYLOAD_BLOB_DIGEST}",
      "annotations": {
        "dev.cosignproject.cosign/signature": "<snip-for-readability>",
        "dev.sigstore.cosign/bundle": "<snip-for-readability>"
      }
    }
  ]
}
```

We similarly need to retrieve two other files — the "payload blob" and the "config blob”:

```bash
oras blob fetch {LOCAL_REPOSITORY}@{blob}\
    --plain-http --output "PAYLOAD_BLOB"
```

We run that recursively (for each architecture and for the merged manifest) and end up locally with files that we arrange like that:

```
├── 2026-02-09T07:41:13+00:00
│   ├── 1be0ea6f7d59d875249bee2ed9e913fc98eba184a02fb9b15145dcb877aaaf2f
│   │   ├── CONFIG_BLOB
│   │   ├── IMAGE
│   │   ├── MANIFEST
│   │   └── PAYLOAD_BLOB
│   ├── 7396780b5862cf8b37527854a2a2331e5c746b6a71aa1f424258c3bfaf3a1bd7
│   │   ├── CONFIG_BLOB
│   │   ├── IMAGE
│   │   ├── LATEST
│   │   ├── MANIFEST
│   │   └── PAYLOAD_BLOB
│   └── e4ff5b3ffa3af38cd8a9ae0a3083064434ed5edfbf67329d0aeb0f8fd0353601
│       ├── CONFIG_BLOB
│       ├── IMAGE
│       ├── MANIFEST
│       └── PAYLOAD_BLOB
```

That is,  a date + time as the top folder, and then a folder for each digest, which contains the three files we discussed (`MANIFEST`, `CONFIG_BLOB`, and `PAYLOAD_BLOB`).

Two additional files are there as well: `LATEST` (only if this digest is actually what `latest` needs to point to), and `IMAGE`, the full location of the image:

```
ghcr.io/freedomofpress/dangerzone/v1@sha256:1be0ea6f7d59d875249bee2ed9e913fc98eba184a02fb9b15145dcb877aaaf2f
```

## Pull-request-based workflow

When a pull request is opened, a GHA workflow verifies the signatures, basically doing the same, but in reverse:

* Starting a local registry.  
* Pushing the manifests and blob files there.  
* Verifying that signatures are valid.

On merge, these blobs and manifests are pushed to production, and then `latest` is updated. The added benefit is that we have an easy way to track what was signed when, as you can see from this `git log` output:

```bash
$ git log --oneline --no-merges -n 5

f976c6b Sign new container image
0f8f86d (origin/2026-01-08-new-image) Sign new image for v0.10.0
4142991 Sign image for 0.10.0 (final)
c9f9f80 (origin/2025-11-20, 2025-11-20) Add new signatures
850d1aa Add signatures for the v0.10.0 RC2 image
```

You can find the code for the ghcr-signer at [github.com/freedomofpress/ghcr-signer](http://github.com/freedomofpress/ghcr-signer). Feel free to fork this repo and use it for signing your images.