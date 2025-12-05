# Extension Marketplace Switcher

<p align="center">
  <img src="images/ems-icon.png" alt="Extension Marketplace Switcher icon" width="160" height="160">
</p>


**Switch VSCodium/VS Code/Cursor between the Cursor marketplace, Open VSX registry, Microsoft Marketplace, or a custom gallery.**  

**VS Code/VSCodium**: Edits `product.json → extensionsGallery` to switch the built-in Extensions view.  
**Cursor**: Uses VSIX-based installation to install extensions from any marketplace without modifying Cursor's internal configuration.

Your settings/themes/extensions remain unchanged.

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

### VS Code / VSCodium

- **Status Bar** (typically **bottom-left**): `$(extensions) Marketplace` — click to open a quick picker with all actions:
  - **Switch to Open VSX**
  - **Switch to Microsoft Marketplace**
  - **Switch to Cursor Marketplace**
  - **Set custom gallery endpoints…**

- **Command Palette** (⇧⌘P / Ctrl+Shift+P):
  - **Extension Marketplace Switcher: Switch to Open VSX**
  - **Extension Marketplace Switcher: Switch to Microsoft Marketplace**
  - **Extension Marketplace Switcher: Switch to Cursor Marketplace**
  - **Extension Marketplace Switcher: Set custom gallery endpoints…**
  - **Extension Marketplace Switcher: Install from Marketplace** *(search and install via VSIX)*
  - **Extension Marketplace Switcher: Install by ID** *(install by publisher.name via VSIX)*
  - **Extension Marketplace Switcher: Quit App** *(after switching, do this)*
  - **Extension Marketplace Switcher: Open product.json**
  - **Extension Marketplace Switcher: Revert product.json from latest backup**

> After switching you **must fully quit and relaunch** the app.  
> A normal **Reload Window** is **not enough**. Choose **Quit App** when prompted, then reopen.

### Cursor

In Cursor, the extension uses **VSIX-based installation** instead of editing `product.json`:

- **Status Bar**: Shows the current default marketplace (Open VSX, VS Marketplace, or Cursor)
- **Switch commands**: Set your preferred marketplace and immediately open a search UI to install extensions
- **Install commands**: 
  - **Install from Marketplace**: Search and install extensions from your default marketplace
  - **Install by ID**: Install a specific extension by ID (e.g., `vadimcn.vscode-lldb`)

> In Cursor, switching marketplaces **does not require a restart**. The extension uses VSIX downloads to install extensions directly, bypassing Cursor's locked marketplace configuration.

---

## Notes

### VS Code / VSCodium
- Only `extensionsGallery` in `product.json` is changed; your data folder is untouched, so settings/themes/extensions persist.
- After switching, you must fully quit and relaunch for changes to take effect.

### Cursor
- The extension does **not** modify Cursor's internal `product.json` or app bundle.
- Extensions are installed via VSIX download, working around Cursor's marketplace restrictions.
- No restart required when switching marketplaces or installing extensions.
- The default marketplace preference is stored in extension settings and persists across sessions.

### General
- Use of the Microsoft marketplace may be subject to Microsoft's terms; please review and ensure your use complies.
- Both Open VSX and Microsoft VS Marketplace are fully supported for VSIX-based installation.
- **Linux compatibility**: The extension now properly handles Linux systems where `/tmp` is mounted on a separate filesystem, preventing EXDEV cross-device rename errors when switching marketplaces.

---

## License & Attribution

MIT © Jacob Eernisse.  
If you embed or fork this, please include attribution (link back to this repo and mention “Extension Marketplace Switcher by Jacob Eernisse | https://github.com/jacob-ae/”).
