# Extension Marketplace Switcher

<p align="center">
  <img src="images/ems-icon.png" alt="Extension Marketplace Switcher icon" width="160" height="160">
</p>


**Switch VSCodium/VS Code between the Open VSX registry, the Microsoft Marketplace, or a custom gallery.**  
This extension only edits `product.json → extensionsGallery`. Your settings/themes/extensions remain.
> I built this on a whim after wanting VSCodium
> but still being able to selectively pull in extensions from other marketplaces when needed.
> Hope you enjoy it! :) **Jacob **

[![Ko-fi](https://img.shields.io/badge/Support%20me%20on-Ko%E2%80%91fi-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/G2G11KHMLD)




---

## Install (pick one)

[![Open VSX](https://img.shields.io/badge/Install%20from-Open%20VSX-2e7d32?logo=openvsx&logoColor=white)](https://open-vsx.org/extension/jacob-ae/vscodium-marketplace-toggle)
[![(Manual) Download VSIX](https://img.shields.io/badge/Download-VSIX-555?logo=github)](https://github.com/jacob-ae/vscode-extension-marketplace-switcher/releases/latest)

---

## How to use

- **Status Bar** (typically **bottom-left**): `$(extensions) Marketplace` — click to open a quick picker with all actions:
  - **Switch to Open VSX**
  - **Switch to Microsoft Marketplace**
  - **Set custom gallery endpoints…**

- **Command Palette** (⇧⌘P / Ctrl+Shift+P):
  - **Extension Marketplace Switcher: Switch to Open VSX**
  - **Extension Marketplace Switcher: Switch to Microsoft Marketplace**
  - **Extension Marketplace Switcher: Set custom gallery endpoints…**
  - **Extension Marketplace Switcher: Quit App** *(after switching, do this)*
  - **Extension Marketplace Switcher: Open product.json**
  - **Extension Marketplace Switcher: Revert product.json from latest backup**

> After switching you **must fully quit and relaunch** the app.  
> A normal **Reload Window** is **not enough**. Choose **Quit App** when prompted, then reopen.

---

## Notes

- Only `extensionsGallery` is changed; your data folder is untouched, so settings/themes/extensions persist.
- Use of the Microsoft marketplace may be subject to Microsoft’s terms; please review and ensure your use complies.

---

## License & Attribution

MIT © Jacob Eernisse.  
If you embed or fork this, please include attribution (link back to this repo and mention “Extension Marketplace Switcher by Jacob Eernisse | https://github.com/jacob-ae/”).
