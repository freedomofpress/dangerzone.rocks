---
title: Upcoming Docker Desktop disruptions for macOS users
date: 2025-01-27
---

The Docker Desktop team has issued an
[announcement](https://www.docker.com/blog/incident-update-docker-desktop-for-mac)
in anticipation of an upcoming macOS Sequoia update that will affect Docker
users. If you update macOS *before* updating Docker Desktop, it's possible that
Docker may not start, or you may even see a warning like the one below:

> Malware Blocked. “com.docker.vmnetd” was not opened because it contains
> malware. This action did not harm your Mac.

<figure>
<img class="mid" src="/assets/img/docker-malware-detection.png" alt="Screenshot showing an incorrect macOS malware notice for Docker Desktop"></img>
<figcaption>Incorrect macOS malware notice for Docker Desktop</figcaption>
</figure>

This warning is inaccurate. Docker Desktop is not affected by malware, but
instead was signed in a way that trips up the macOS malware detection mechanism.

## Am I affected by this?

You are probably affected by the upcoming macOS update if:

* You are a macOS user and are on the latest macOS 15 (Sequoia) version of the
  OS. You can find out your OS version with
  [these](https://support.apple.com/en-us/109033) instructions.
* You are using Docker Desktop to run Dangerzone and haven’t updated since Jan.
  9, 2025\.

## What can I do?

You are strongly advised to upgrade to the latest Docker Desktop version (4.37.2
or newer), either by
[downloading](https://docs.docker.com/desktop/setup/install/mac-install/) the
latest version or via the Docker Desktop in-app update window. If you have
installed Docker Desktop via Homebrew, it is recommended to do a full reinstall,
following
[these instructions](https://docs.docker.com/desktop/cert-revoke-solution/#homebrew-casks).

If you have not yet upgraded your system to macOS 15 (Sequoia), you should
upgrade your Docker Desktop version *before* migrating to the new macOS version.

If the malware notification persists, you can consult [this troubleshooting
guide](https://docs.docker.com/desktop/cert-revoke-solution).
