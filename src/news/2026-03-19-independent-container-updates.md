---
title: How Dangerzone distributes sandbox updates
date: 2026-03-19
---

***TL; DR:** In 0.10.0, Dangerzone introduced a feature that allows users to auto-update the container used to do conversions.*

*This article goes through why that matters and how we implemented it:*

- *attesting the provenance of the images*
- *making them reproducible, and*
- *signing them using an auditable system.*
- *Signatures are stored in a transparency log and verified prior to any download and use.*

<hr />

In case you don't already know Dangerzone, here is a quick summary: It's a tool that uses containers to convert documents (`.docx`, `.pdf`, images, etc.) into pixels and then reconstruct them as PDFs. This renders any embedded script or malware ineffective. The conversion is done in an *untrusted* container that takes a binary stream as input and returns a pixel stream as output. We consider opening a document unsafe and exploitable, which is why we distrust the container.

With that being said, this container still needs to be kept up to date in order to avoid an attacker using known exploits. It's better to think about this in layers: If an attacker wants to compromise Dangerzone, they would need first to exploit the document viewer and then find a container escape.

Originally, Dangerzone bundled the container image within its installers, which made it difficult for us maintainers to release container updates in a timely fashion. Emergency releases of the container were time-costly, because they meant a full-blown release: testing on Windows, macOS, and many Linux flavors, which tends to generate some delay and stress.

This “Independent Container Updates” feature makes that stress go away, enabling us to release a new version of the Dangerzone container quickly, and without blindly trusting the container registry used to distribute the images.

Here is what we're doing when [releasing a container image](https://github.com/freedomofpress/dangerzone/blob/main/docs/developer/release/sign-image.md), implementing the steps best known as the [Triangle of Secure Code delivery](https://defuse.ca/triangle-of-secure-code-delivery.htm):

1. Attesting its provenance.  
2. Making sure it is reproducible.  
3. Signing it.

So, how do we do this? Let's go for a small walk\!

## Checking image provenance

Currently, our container images are built nightly by our Continuous Integration system in a GitHub runner. This allows us to automatically run tests against them.

Since we don't *blindly* trust the GH runners for doing what they claim (see the next section about reproducibility), we verify the image was generated from a specific workflow and repository.

To that goal, we are using the [SLSA](https://slsa.dev/) framework. Runners add *attestations* to our container registry, and we then check them before going further.

Practically, attestations are information about the run: from which repository, which branch, which commit?

All the information about the run is added to the container registry (*ghcr.io* in our case) at a specific location, matching the digest of the published image: `container-registry/image:sha256-{digest}.att`.

The attestation is a base64-encoded blob that can be read in a human form using this script:

```Docker
IMAGE=ghcr.io/freedomofpress/dangerzone/v1
TAG=latest

# Retrieve the digest of the latest tagged image
DIGEST=$(crane digest ${IMAGE?}:${TAG?})

# Generate the sha256-{digest}.att location
ATT_MANIFEST=${IMAGE?}:${DIGEST/:/-}.att

# This will list the 
ATT_BLOB=${IMAGE?}@$(crane manifest ${ATT_MANIFEST?} | jq -r '.layers[0].digest')
crane blob ${ATT_BLOB?} | jq -r '.payload' | base64 -d >> attestation.json
```

The resulting `attestation.json` is too large to be displayed, so let's just view a part of it as an example:

```bash
cat attestation.json | jq '.predicate.invocation.configSource'
{
  "uri": "git+https://github.com/freedomofpress/dangerzone@refs/heads/main",
  "digest": {
    "sha1": "58aed2d6f6dedebc2bbbc4a96fe69ac9c425b508"
  },
  "entryPoint": ".github/workflows/release-container-image.yml"
}
```

Then, prior to reproducing and signing the image, we use this information in our own builders to verify the provenance of the container.

For this, we're using a `CUE` policy. In our case, we ensure that the *entrypoint* of the workflow and the *repository* match our expectations.

{% raw %}
```json
// The predicateType field must match this string
predicateType: "https://slsa.dev/provenance/v0.2"

predicate: {{
  // This condition verifies that the builder is the builder we
  // expect and trust. The following condition can be used
  // unmodified. It verifies that the builder is the container
  // workflow.
  builder: {{
    id: =~"^https://github.com/slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@refs/tags/v[0-9]+.[0-9]+.[0-9]+$"
  }}
  invocation: {{
    configSource: {{
      // This condition verifies the entrypoint of the workflow.
      // Replace with the relative path to your workflow in your
      // repository.
      entryPoint: "{workflow}"

      // This condition verifies that the image was generated from
      // the source repository we expect. Replace this with your
      // repository.
      uri: =~"^git\\+https://github.com/{repository}"
    }}
  }}
}}
```
{% endraw %}


Of course, you don't have to know all this\! Just using `cosign verify-attestation` will do that for you (if you don’t know Cosign*,* don’t fret; we’ll talk about it again very soon).

## Reproducible images

Once we are sure the image comes from the expected repository and workflow, we want to make sure we are able to reproduce the container image.

One of our prerequisites is that you don't really have to trust us. When we ship a container image, you should be able to verify that the container image matches our published source code.

That's where reproducible container images enter in the landscape. You can build yourself a container image based on a specific git commit, and it will be bit for bit the same as the one we have signed and distributed.

If you are interested in knowing more about this, you can [read our article on the matter](https://dangerzone.rocks/news/2026-03-02-repro-build/)

## Signing an image

The last thing we want to do (but not the least) is to sign the image and verify the signatures locally.

We are using the [Sigstore](https://www.sigstore.dev/) ecosystem for this, which provides a tool named [Cosign](https://github.com/sigstore/cosign), that signs and verifies container images. Sigstore differs from traditional signing mechanisms because signatures can be audited; every signature is recorded in Sigstore’s transparency log. *Having our signatures auditable makes it possible for us (or anybody) to know when our keys are used.*

It's worth noting that Sigstore can be used in a number of different ways, one of them being *keyless signatures*. In our case, though, our process relies on physical keys, so we are using the Sigstore ecosystem mainly for the auditable logs.

So, how do you sign container images? Use `cosign sign`\! It does the following:

1. Generates a signature using the provided keys.  
2. Uploads the signature to the auditable log and gets back a tamper-resistant proof.  
3. Attaches the signature and the proof to the container registry, at sha256-{digest}.sig .

The signature itself and the way the signature is attached to the container registry is part of [the signature specification](https://github.com/sigstore/cosign/blob/main/specs/SIGNATURE_SPEC.md#storage).

*\[The following section explains how signatures are computed and applied to a container registry. If you are not interested in the deep dive, you can skip to [the following section about verifying the container signatures](#verifying-the-signatures)\]*

Let's have a look at the signatures for our latest container image:

```bash
crane manifest ghcr.io/freedomofpress/dangerzone/v1:sha256-7396780b5862cf8b37527854a2a2331e5c746b6a71aa1f424258c3bfaf3a1bd7.sig | jq
```

Outputs:

```json
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "config": {
    "mediaType": "application/vnd.oci.image.config.v1+json",
    "size": 233,
    "digest": "sha256:a3b01184f5d756fc9601d3386b49fe1c3cd3eedea08b8a6e11137b2a7988ed5f"
  },
  "layers": [
    {
      "mediaType": "application/vnd.dev.cosign.simplesigning.v1+json",
      "size": 252,
      "digest": "sha256:88b8a2ac5b829f47bd25a5a4d9c2ccb0fccff7f53a17477b6d9b5680436aa80f",
      "annotations": {
        "dev.cosignproject.cosign/signature": "MEQCIAQScnT03MVfmxjYyW5qAmvQ6TSoukPuw0HmSVlMBwYEAiAzGb76cvDb4CHJ+H6tD00bW1Sh1CK6opaRmI2ist4p2A==",
        "dev.sigstore.cosign/bundle": "{\"SignedEntryTimestamp\":\"MEYCIQCsAt/PgYO2WFKoQX/P42vXCWJVUEgqRLXZ0BlrKwY40QIhAOTu/oE7jDtL8XP4PiZJhJ3nSlW3yXUp5ErSmjedzdCv\",\"Payload\":{\"body\":\"eyJhcGlWZXJzaW9uIjoiMC4wLjEiLCJraW5kIjoiaGFzaGVkcmVrb3JkIiwic3BlYyI6eyJkYXRhIjp7Imhhc2giOnsiYWxnb3JpdGhtIjoic2hhMjU2IiwidmFsdWUiOiI4OGI4YTJhYzViODI5ZjQ3YmQyNWE1YTRkOWMyY2NiMGZjY2ZmN2Y1M2ExNzQ3N2I2ZDliNTY4MDQzNmFhODBmIn19LCJzaWduYXR1cmUiOnsiY29udGVudCI6Ik1FUUNJQVFTY25UMDNNVmZteGpZeVc1cUFtdlE2VFNvdWtQdXcwSG1TVmxNQndZRUFpQXpHYjc2Y3ZEYjRDSEorSDZ0RDAwYlcxU2gxQ0s2b3BhUm1JMmlzdDRwMkE9PSIsInB1YmxpY0tleSI6eyJjb250ZW50IjoiTFMwdExTMUNSVWRKVGlCUVZVSk1TVU1nUzBWWkxTMHRMUzBLVFVacmQwVjNXVWhMYjFwSmVtb3dRMEZSV1VsTGIxcEplbW93UkVGUlkwUlJaMEZGTTBOVmJHNTNhRGd5TlZvMWQxRkJTbFkyVkdWclJXazJZa05MTWdwWmRrRm5OMEVyWVdWbGNrMDFhSFpqTkVORFEwcEdRbUZsTlVGcWJuTnFSMGgyTkZZdk0zaDZjM05qYXpabE5URlhLMkl3YWxVMGNWWjNQVDBLTFMwdExTMUZUa1FnVUZWQ1RFbERJRXRGV1MwdExTMHRDZz09In19fX0=\",\"integratedTime\":1770622892,\"logIndex\":929816779,\"logID\":\"c0d23d6ad406973f9559f3ba2d1ca01f84147d8ffc5b8445c224f98b9591801d\"}}"
      }
    }
  ]
}
```

There is a lot to unpack here. Two main things are of interest:

First, the digest of our *payload* is stored under the `layer.digest` key, where you can read `sha256:88b8a2ac5b829f47bd25a5a4d9c2ccb0fccff7f53a17477b6d9b5680436aa80f`. Retrieving the referenced blob, we can see:

```bash
crane blob ghcr.io/freedomofpress/dangerzone/v1@sha256:88b8a2ac5b829f47bd25a5a4d9c2ccb0fccff7f53a17477b6d9b5680436aa80f | jq .
```

```json
{
  "critical": {
    "identity": {
      "docker-reference": "ghcr.io/freedomofpress/dangerzone/v1"
    },
    "image": {
      "docker-manifest-digest": "sha256:7396780b5862cf8b37527854a2a2331e5c746b6a71aa1f424258c3bfaf3a1bd7"
    },
    "type": "cosign container image signature"
  },
  "optional": null
}
```

That's what we sign: the digest of our image (the `sha256:7396780…` bit). 

Let’s back up for a moment: How does that work?

Container registries store *manifests* (and *blobs*, for that matter) at their *digest* address, meaning signing a *digest is* actually like signing the whole *manifest*.

If we verify the signature for a specific *digest*, then it's the same as verifying the signature of the image itself.

Second, the `sha256-{digest}.sig` signature we retrieved from the container registry provides us a *bundle* in the `dev.sigstore.cosign/bundle` field. It contains:

* The base64-encoded body (which embeds *the public key* and *the signature*).  
* The *logIndex* and *logID*, which refer to the published log on Rekor.

Verifying a signature means verifying that the provided *signature* matches the expected *payload* and public key, and that it matches the accompanying inclusion proof in the auditable log.

Here is the bundle:

```bash
jq -r '.layers[0].annotations."dev.sigstore.cosign/bundle"' | jq
```

```json
{
  "SignedEntryTimestamp": "MEYCIQCsAt/PgYO2WFKoQX/P42vXCWJVUEgqRLXZ0BlrKwY40QIhAOTu/oE7jDtL8XP4PiZJhJ3nSlW3yXUp5ErSmjedzdCv",
  "Payload": {
    "body": "eyJhcGlWZXJzaW9uIjoiMC4wLjEiLCJraW5kIjoiaGFzaGVkcmVrb3JkIiwic3BlYyI6eyJkYXRhIjp7Imhhc2giOnsiYWxnb3JpdGhtIjoic2hhMjU2IiwidmFsdWUiOiI4OGI4YTJhYzViODI5ZjQ3YmQyNWE1YTRkOWMyY2NiMGZjY2ZmN2Y1M2ExNzQ3N2I2ZDliNTY4MDQzNmFhODBmIn19LCJzaWduYXR1cmUiOnsiY29udGVudCI6Ik1FUUNJQVFTY25UMDNNVmZteGpZeVc1cUFtdlE2VFNvdWtQdXcwSG1TVmxNQndZRUFpQXpHYjc2Y3ZEYjRDSEorSDZ0RDAwYlcxU2gxQ0s2b3BhUm1JMmlzdDRwMkE9PSIsInB1YmxpY0tleSI6eyJjb250ZW50IjoiTFMwdExTMUNSVWRKVGlCUVZVSk1TVU1nUzBWWkxTMHRMUzBLVFVacmQwVjNXVWhMYjFwSmVtb3dRMEZSV1VsTGIxcEplbW93UkVGUlkwUlJaMEZGTTBOVmJHNTNhRGd5TlZvMWQxRkJTbFkyVkdWclJXazJZa05MTWdwWmRrRm5OMEVyWVdWbGNrMDFhSFpqTkVORFEwcEdRbUZsTlVGcWJuTnFSMGgyTkZZdk0zaDZjM05qYXpabE5URlhLMkl3YWxVMGNWWjNQVDBLTFMwdExTMUZUa1FnVUZWQ1RFbERJRXRGV1MwdExTMHRDZz09In19fX0=",
    "integratedTime": 1770622892,
    "logIndex": 929816779,
    "logID": "c0d23d6ad406973f9559f3ba2d1ca01f84147d8ffc5b8445c224f98b9591801d"
  }
}
```

When we retrieve the entry related to this logIndex on the Rekor log, we can see that it matches the base64-decoded body in `Payload.body`:

```bash
curl https://rekor.sigstore.dev/api/v1/log/entries?logIndex=929816779 | jq -r ".[].body" | base64 --decode | jq
```

```json
{
  "apiVersion": "0.0.1",
  "kind": "hashedrekord",
  "spec": {
    "data": {
      "hash": {
        "algorithm": "sha256",
        "value": "88b8a2ac5b829f47bd25a5a4d9c2ccb0fccff7f53a17477b6d9b5680436aa80f"
      }
    },
    "signature": {
      "content": "MEQCIAQScnT03MVfmxjYyW5qAmvQ6TSoukPuw0HmSVlMBwYEAiAzGb76cvDb4CHJ+H6tD00bW1Sh1CK6opaRmI2ist4p2A==",
      "publicKey": {
        "content": "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUZrd0V3WUhLb1pJemowQ0FRWUlLb1pJemowREFRY0RRZ0FFM0NVbG53aDgyNVo1d1FBSlY2VGVrRWk2YkNLMgpZdkFnN0ErYWVlck01aHZjNENDQ0pGQmFlNUFqbnNqR0h2NFYvM3h6c3NjazZlNTFXK2IwalU0cVZ3PT0KLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tCg=="
      }
    }
  }
}
```

The public key is base64-encoded; here is the decoded version:

```
-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE3CUlnwh825Z5wQAJV6TekEi6bCK2
YvAg7A+aeerM5hvc4CCCJFBae5AjnsjGHv4V/3xzssck6e51W+b0jU4qVw==
-----END PUBLIC KEY-----
```

## Verifying the signatures

Now that you understand how everything is stored in the container registry, let's switch perspectives and step into the shoes of the user of the application. How can we validate that the signatures are valid?

As usual in these cases, don't do it yourself\! `Cosign` provides a tool to verify a *signature* against a *payload* and a *public key*. In our case, we need to do a small rearrangement of how the payload is laid out to follow the format expected by *Cosign*, but that's mainly it.

In Dangerzone, we implemented the logic to do that [using Python](https://github.com/freedomofpress/dangerzone/blob/58aed2d6f6dedebc2bbbc4a96fe69ac9c425b508/dangerzone/updater/signatures.py#L108-L157), but here is a version that's easier to use in a terminal, using *`jq`*:

```bash
jq --rawfile payload payload --slurpfile bundle registry_bundle '
    .layers[0] as $layer |
    $bundle[0] as $bundle |
    {
      base64Signature: $layer.annotations["dev.cosignproject.cosign/signature"],
      Payload: ($payload | @base64),
      cert: null,
      chain: null,
      rekorBundle: {
        SignedEntryTimestamp: $bundle.SignedEntryTimestamp,
        Payload: {
          body: $bundle.Payload.body,
          integratedTime: $bundle.Payload.integratedTime,
          logIndex: $bundle.Payload.logIndex,
          logID: $bundle.Payload.logID
        }
      },
      RFC3161Timestamp: null
    }' > bundle
```

Then, with this new bundle, we can verify that the signature is valid:

```bash
cosign verify-blob --key share/freedomofpress-dangerzone.pub --bundle bundle payload
```

## Storing signatures

Once the signatures are deemed valid, we can store them locally. Here is how we do it:

```bash
tree ~/.local/share/dangerzone/signatures/
├── <pubkey-digest>
│   ├── <image-digest>.json
│   ├── <image-digest>.json
└── last_log_index
```

The `last_log_index` file is used to keep track of the last log index processed by the updater. When we apply an update, we verify that the new log index is actually greater than the last known log index, effectively ensuring that an attacker cannot downgrade our container image once installed.

The format used in the `.json` file is the `cosign download` signature, which differs from the "bundle" one used in the code, as we've just seen earlier.

Right before running the container, we verify that the signatures are valid for the *digest* we have signatures for.

## Wrapping up

So, here is how we've been setting things up related to images and signatures for Dangerzone. At the time of writing, image signing is a moving target: Cosign recently issued a version 3, where they slightly changed the format used for the bundles, but the main idea remains the same.

In the end, releasing a new image is as simple as:

* Picking an image, most probably the latest *nightly* build.  
* Logging to our build machines.  
* Verifying the provenance of the image.  
* Reproducing it locally.  
* Signing the container image and tagging it as `latest`.

The Dangerzone application checks for new versions of the sandbox, at most, every 12 hours (if you’ve enabled this feature). When we detect a new version, we:

* Check the signatures against our stored public key (distributed alongside the software).  
* Store the signatures locally.  
* Proceed with the `podman pull` of the image.

Then, we verify the validity of the signatures right before summoning the sandbox for doing conversions.

One extra benefit from doing this, is that *now the Dangerzone container image can be used without Dangerzone itself.* That enables a whole world of possibilities, in case you have an idea where doing a conversion to pixels without exposing the host makes sense. It’s as simple as: `podman pull ghcr.io/freedomofpress/dangerzone/v1` while using [a correct container policy, as outlined in this issue](https://github.com/freedomofpress/dangerzone/issues/1368).

P.S. We’re also working on a way for you to use Dangerzone as a library, but let’s save that for a different time!
