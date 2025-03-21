---
title: Known errors with Docker Desktop for macOS users
date: 2025-03-21
---

We recently [found an
issue](https://github.com/freedomofpress/dangerzone/issues/1101) with the latest
version of Docker Desktop for macOS, which prevents Dangerzone from operating
normally.

If you are on a faulty Docker Desktop version, the conversion of documents might
fail in unpredictable ways.

## Am I affected by this?

You are probably affected if:

* You are a macOS user and are on the latest macOS 15.2 (Sequoia) version of the
  OS. You can find out your OS version with
  [these](https://support.apple.com/en-us/109033) instructions.
* You are using Docker Desktop version `4.39.0` or greater

## What can I do?

In order to get back to a situation where you can convert your
documents without issue, you should use the last version of Docker
Desktop without the aforementioned bug:
[Docker Desktop v4.38.0](https://docs.docker.com/desktop/release-notes/#4380).

If you have not yet upgraded your system to macOS 15 (Sequoia), it *seems* that
you should be unaffected.
