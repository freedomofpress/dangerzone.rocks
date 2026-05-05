---
title: April is the cruelest month
date: 2026-05-06
---

This April has been a wild ride. At the start of the month, Anthropic made bold claims about the security research abilities of its [Claude Mythos](https://red.anthropic.com/2026/mythos-preview/) model. Any open source project under the sun is now in the danger zone, and Dangerzone even more so.

In the past few days, we became aware of some AI-assisted vulnerabilities that *could* affect Dangerzone, but thankfully are mitigated by our defenses.

On April 17, a security team [disclosed](https://blog.calif.io/p/mad-bugs-even-cat-readmetxt-is-not) that iTerm2 was vulnerable to a PTY confusion attack. The details of the attack and its impact are not what matter here, but the crucial point is that there are popular terminal emulators out there that may parse untrusted output and perform actions based on it. Our `dangerzone-cli`, the CLI counterpart to the Dangerzone GUI, does handle untrusted content and may print it to the terminal, but thankfully, it sanitizes it first:

<figure>
<img src="/assets/img/iterm2-escape.png" alt="A screenshot of an iTerm2 terminal. It shows some logs by the Dangerzone CLI, and some Unicode replacement characters (�) in place of the ANSII escape sequences of the original iTerm2 exploit.">
<figcaption>Testing Dangerzone against a file that begins with the control characters of the <a href=https://github.com/califio/publications/tree/main/MADBugs/iTerm2>iTerm2 exploit</a>. Dangerzone replaces escape sequences with � characters.</figcaption>
</figure>

We were aware of this attack vector from internal research we had performed a while back, which was the result of our [first-ever security advisory](https://github.com/freedomofpress/dangerzone/security/advisories/GHSA-pvwq-6vpp-2632).

On April 29, the [`copy.fail`](https://copy.fail/) vulnerability was disclosed by another security team. This vulnerability allows any unprivileged user in the system to gain root privileges on any Linux system since 2017, via an exploit in the kernel crypto API (`AF_ALG`). This would theoretically affect all of our users, since Dangerzone uses Linux VMs to run its sandbox, even on Windows and macOS.

Our [gVisor integration](https://dangerzone.rocks/news/2024-09-23-gvisor/), though, saved the day:

<figure>
<img src="/assets/img/copy-fail-protection.png" alt="A screenshot of a terminal session. This session shows a command that invokes Dangerzone's outer container (Podman), a command that invokes the inner sandbox (gVisor), and the payload of the copy.fail exploit. The exploit fails to run because gVisor does not implement the vulnerable protocol.">
<figcaption>Testing Dangerzone against the <a href=https://github.com/theori-io/copy-fail-CVE-2026-31431>copy.fail exploit</a>. gVisor does not support the vulnerable protocol and thwarts the attack.</figcaption>
</figure>

We are confident that our security measures in place will still hold for the foreseeable future, but [ne'er cast a clout till May be out](https://www.phrases.org.uk/meanings/till-may-is-out.html)!
