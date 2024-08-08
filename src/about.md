---
title: "About Dangerzone: Convert potentially dangerous documents into safe PDFs"
layout: article.njk
---

About Dangerzone
================

**By Micah Lee**

Have you ever heard the computer security advice, “Don’t open attachments”? This is solid advice, but unfortunately for journalists, activists, and many other people, it’s impossible to follow. Imagine if you were a journalist and got an email from someone claiming to work for the Trump Organization with “Donald Trump tax returns.pdf” attached. Are you really going to reply saying, “Sorry, I don’t open attachments” and leave it at that?

The truth is, as a journalist, it’s your _job_ to open documents from strangers, whether you get them in an email, a Signal or WhatsApp message, or through SecureDrop. Journalists also must open and read documents downloaded from all manner of websites, from leaked or hacked email dumps, or from any number of other potentially untrustworthy sources.

<div class="screenshots">
  <img class="adjacent" src="/assets/img/screenshot-settings.png" alt="Dangerzone Settings">
  <img class="adjacent" src="/assets/img/screenshot-conversions.png" alt="Dangerzone File Conversions">
</div>

Dangerzone aims to solve this problem. You can install Dangerzone on your Mac, Windows, or Linux computer, and then use it to open a variety of types of documents: PDFs, Microsoft Office or LibreOffice documents, or images. Even if the original document is dangerous and would normally hack your computer, Dangerzone will convert it into a safe PDF that you can open and read.

You can think of it like printing a document and then rescanning it to remove anything sketchy, except all done in software.

**[Download Dangerzone for Windows, macOS or Linux](/#downloads)** to get started.

How can a document be dangerous?
--------------------------------

PDFs and office documents are incredibly complex. They can be made to automatically load an image from a remote server when the document is open, tracking when a document is opened and from what IP address. They can contain JavaScript or macros that, depending on how your software is configured, could automatically execute code when opened, potentially taking over your computer. And finally, like all software, the programs you use to open documents – Preview, Adobe Reader, Microsoft Word, LibreOffice, etc. – have bugs, and these bugs can sometimes be exploited to take over your computer. (You can reduce your risk of getting hacked by always installing your updates, which fix the bugs that software vendors are aware of.)

For example, if an attacker knows about a security bug in Microsoft Word, they can carefully craft a Word document that, when opened using a vulnerable version of Word, will hack your computer. All they have to do is trick you into opening it, perhaps by sending you a convincing enough phishing email.

This is exactly what Russian military intelligence did during the 2016 US election. First, they hacked a US election vendor known as VR Systems and got their client list. Then they send 122 emails to VR Systems’ clients (election workers in swing states) from the email address **vrelections@gmail.com**, with the attachment "New EViD User Guides.docm".


![Email screenshot claiming to be from VR Systems Inc with subject "New EViD User Guides" containing a 523 KB .docm attachment](/assets/img/evid.jpg)

_Screenshot of spearphishing email [provided to The Intercept](https://theintercept.com/2018/06/01/election-hacking-voting-systems-email/) from a North Carolina public records request_

If any of the election workers who got this email opened the attachment using a vulnerable version of Word in Windows, the malware would have created a backdoor into their computer for the Russian hackers. (We don’t know if anyone opened the document or not, but they might have.)

If you got this email today and opened New EViD User Guides.docm using Dangerzone, it will convert it into a safe PDF (New EViD User Guides-safe.pdf), and you can safely open this document in a PDF viewer, without risking getting hacked.

Inspired by Qubes TrustedPDF
----------------------------

I got the idea for Dangerzone from Qubes, an operating system that runs everything in virtual machines. In Qubes, you can right-click on a PDF and choose “Convert to TrustedPDF”. I [gave a talk](https://www.youtube.com/watch?v=f4U8YbXKwog) called Qubes OS: The Operating System That Can Protect You Even If You Get Hacked in 2018 at the Circle of HOPE hacker conference in New York. I talk about how TrustedPDF works for about 2 minutes [starting at 9:20](https://youtu.be/f4U8YbXKwog?t=560).

Dangerzone was inspired by TrustedPDF but it works in non-Qubes operating systems, which is important, because most of the journalists I know use Macs and probably won’t be jumping to Qubes for some time.

It uses Linux containers to sandbox dangerous documents instead of virtual machines. And it also adds some features that TrustedPDF doesn’t have: it works with any office documents, not just PDFs; it uses optical character recognition (OCR) to make the safe PDF have a searchable text layer; and it compresses the final safe PDF.

How does Dangerzone work?
-------------------------

Dangerzone uses Linux containers (two of them), which are sort of like quick, lightweight virtual machines that share the Linux kernel with their host. The easiest way to get containers running on Mac and Windows is by using [Docker Desktop](https://www.docker.com/products/docker-desktop). So when you first install Dangerzone, if you don’t already have Docker Desktop installed, it helps you download and install it.

When Dangerzone starts containers, it _disables networking_, and the only file it mounts is the suspicious document itself. So if a malicious document hacks the container, it doesn’t have access to your data and it can’t use the internet, so there’s not much it could do.

Here’s how it works. The first container:

* _Mounts a volume with the original document_
* Uses _LibreOffice_ or _GraphicsMagick_ to convert original document to a PDF
* Uses _poppler_ to split PDF into individual pages, and to convert those to PNGs
* Uses _GraphicsMagick_ to convert PNG pages to RGB pixel data
* _Stores RGB pixel data in separate volume_

Then that container quits. A second container starts and:

* _Mounts a volume with the RGB pixel data_
* If OCR is enabled, uses _GraphicsMagick_ to convert RGB pixel data into PNGs, and _Tesseract_ to convert PNGs into searchable PDFs
* Otherwise uses _GraphicsMagick_ to convert RGB pixel data into flat PDFs
* Uses _poppler_ to merge PDF pages into a single multipage PDF
* Uses _ghostscript_ to compress final save PDF
* _Stores safe PDF in separate volume_

Then that container quits, and the user can open the newly created safe PDF.

Here are types of documents that Dangerzone can convert into safe PDFs:

* PDF (.pdf)
* Microsoft Word (.docx, .doc)
* Microsoft Excel (.xlsx, .xls)
* Microsoft PowerPoint (.pptx, .ppt)
* ODF Text (.odt)
* ODF Spreadsheet (.ods)
* ODF Presentation (.odp)
* ODF Graphics (.odg)
* EPUB (.epub)
* Jpeg (.jpg, .jpeg)
* GIF (.gif)
* PNG (.png)
* SVG (.svg)
* TIFF (.tif, .tiff)
* Other image formats (.bmp, .pnm, .pbm, ppm)

It’s still possible to get hacked with Dangerzone
-------------------------------------------------

Like all software, it’s possible that Dangerzone (and more importantly, the software that it relies on like LibreOffice and Docker) has security bugs. Malicious documents are designed to target a specific piece of software – for example, Adobe Reader on Mac. It’s possible that someone could craft a malicious document that specifically targets Dangerzone itself. An attacker would need to chain these exploits together to succeed at hacking Dangerzone:

* An exploit for either LibreOffice or GraphicsMagic
* A container escape exploit in the Linux kernel
* In Mac and Windows, a VM escape exploit for Docker Desktop

If you opened such a malicious document with Dangerzone, it would start the first container and begin the conversion process. While it was converting the original document (say, a docx file) into a PDF using LibreOffice, it would exploit a vulnerability in LibreOffice to hack the container. Then, it would exploit a vulnerability in the Linux kernel to escape the container, and from there attempt to take over the computer.

If you keep Docker Desktop updated and regularly update the container that Dangerzone uses, such attacks will be much more expensive for attackers.

Another way a malicious document may harm your system, even with Dangerzone, is if it is crafted to attack the document previewing capabilities of the operating system itself (e.g. the part that generates file thumbnails or document previews in a side-panel of the file manager). Due to the high level of integration of these features in the operating system, disabling them completely may be challenging. For this reason, keeping your system always up to date is the most practical solution to minimize this risk.

Dangerzone is open source
-------------------------

This tool is still in early development, so there may be bugs. If you find any, please check the [issues on GitHub](https://github.com/freedomofpress/dangerzone/issues) and open one if your issue doesn’t exist. Please start discussions and make pull requests if you’d like to get involved.

You can find the code for the Mac, Windows, Linux graphical app and the Docker container here: [https://github.com/freedomofpress/dangerzone](https://github.com/freedomofpress/dangerzone)

_Dangerzone is released under the [AGPLv3 license](https://www.gnu.org/licenses/agpl-3.0.en.html). It was developed by Micah Lee at First Look Media and is now a project of [Freedom of the Press Foundation](https://freedom.press/)._

</div>
</div>
