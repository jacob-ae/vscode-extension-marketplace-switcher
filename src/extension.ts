import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

type Gallery = { serviceUrl: string; itemUrl: string; cacheUrl?: string; [key: string]: unknown };

// --- Known endpoints
const OPENVSX: Gallery = {
  serviceUrl: 'https://open-vsx.org/vscode/gallery',
  itemUrl: 'https://open-vsx.org/vscode/item'
};

const MS: Gallery = {
  serviceUrl: 'https://marketplace.visualstudio.com/_apis/public/gallery',
  itemUrl: 'https://marketplace.visualstudio.com/items',
  cacheUrl: 'https://vscode.blob.core.windows.net/gallery/index'
};

const CURSOR: Gallery = {
  galleryId: 'cursor',
  serviceUrl: 'https://marketplace.cursorapi.com/_apis/public/gallery',
  itemUrl: 'https://marketplace.cursorapi.com/items',
  resourceUrlTemplate: 'https://marketplace.cursorapi.com/{publisher}/{name}/{version}/{path}',
  controlUrl: 'https://api2.cursor.sh/extensions-control',
  recommendationsUrl: '',
  nlsBaseUrl: '',
  publisherUrl: ''
};

// --- Platform-specific support dir
function supportFolderFromAppName(appName: string): string {
  const lower = appName.toLowerCase();
  if (lower.includes('cursor')) return 'Cursor';
  if (appName.includes('Codium')) {
    return appName.includes('Insiders') ? 'VSCodium - Insiders' : 'VSCodium';
  }
  if (appName.includes('Code - OSS')) return 'Code - OSS';
  if (appName.includes('Insiders')) return 'Code - Insiders';
  return 'Code';
}

function productJsonDir(): string {
  const appName = vscode.env.appName || '';
  const support = supportFolderFromAppName(appName);
  const platform = process.platform;

  if (platform === 'darwin') {
    const home = process.env.HOME;
    if (!home) throw new Error('HOME is not set on macOS');
    return path.join(home, 'Library', 'Application Support', support);
  } else if (platform === 'win32') {
    const appdata = process.env.APPDATA;
    if (!appdata) throw new Error('APPDATA is not set on Windows');
    return path.join(appdata, support);
  } else if (platform === 'linux') {
    const home = process.env.HOME;
    if (!home) throw new Error('HOME is not set on Linux');
    return path.join(home, '.config', support);
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

function productJsonPath(): string {
  return path.join(productJsonDir(), 'product.json');
}

function latestBackupPath(dir: string): string | undefined {
  const prefix = 'product.json.bak-';
  try {
    const files = fs.readdirSync(dir).filter(f => f.startsWith(prefix));
    files.sort(); // ISO timestamps sort correctly
    return files.length ? path.join(dir, files[files.length - 1]) : undefined;
  } catch {
    return undefined;
  }
}

function isProbablyUrl(s?: string): boolean {
  return !!s && /^https?:\/\//i.test(s);
}

function readExistingProduct(): any {
  const file = productJsonPath();
  if (!fs.existsSync(file)) return {};
  try {
    const txt = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(txt);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

function writeJsonAtomic(filePath: string, data: any) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');

  // Backup current
  if (fs.existsSync(filePath)) {
    try {
      fs.copyFileSync(filePath, path.join(dir, `product.json.bak-${ts}`));
    } catch (e) {
      console.warn('Failed to backup product.json:', e);
    }
  }

  // Atomic write
  const tmp = path.join(tmpdir(), `product-${process.pid}-${ts}.json`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function writeGallery(g: Gallery) {
  const file = productJsonPath();
  const existing = readExistingProduct();
  const currentGallery = existing?.extensionsGallery || {};
  
  // For Cursor, we need to handle galleryId carefully
  // Cursor uses galleryId to determine which marketplace to use
  // If galleryId is "cursor", it may ignore serviceUrl
  const isCursor = vscode.env.appName?.toLowerCase().includes('cursor') ?? false;
  const isSwitchingToCursor = (g as any).galleryId === 'cursor';
  
  if (isCursor && isSwitchingToCursor) {
    // Switching TO Cursor marketplace - preserve all Cursor fields
    (existing as any).extensionsGallery = {
      ...currentGallery,
      ...g,
      galleryId: 'cursor',
      resourceUrlTemplate: currentGallery.resourceUrlTemplate || (g as any).resourceUrlTemplate,
      controlUrl: currentGallery.controlUrl || (g as any).controlUrl,
      recommendationsUrl: currentGallery.recommendationsUrl ?? (g as any).recommendationsUrl ?? '',
      nlsBaseUrl: currentGallery.nlsBaseUrl ?? (g as any).nlsBaseUrl ?? '',
      publisherUrl: currentGallery.publisherUrl ?? (g as any).publisherUrl ?? ''
    };
  } else {
    // Switching to non-Cursor marketplace (or not Cursor app)
    // CRITICAL: Remove galleryId and all Cursor-specific fields
    // Cursor may use galleryId to override serviceUrl, so we must delete it
    const newGallery: any = {
      serviceUrl: g.serviceUrl,
      itemUrl: g.itemUrl
    };
    if (g.cacheUrl) {
      newGallery.cacheUrl = g.cacheUrl;
    }
    // Explicitly do NOT include galleryId, resourceUrlTemplate, controlUrl, etc.
    // This ensures Cursor will use the serviceUrl instead of its hardcoded marketplace
    (existing as any).extensionsGallery = newGallery;
  }
  
  writeJsonAtomic(file, existing);
}

// --- Status bar dynamic label
type GalleryKind = 'openvsx' | 'ms' | 'cursor' | 'custom' | 'unknown';
let statusBar: vscode.StatusBarItem;

function detectCurrentGallery(): GalleryKind {
  const existing = readExistingProduct();
  const g = existing?.extensionsGallery || {};
  const s = String(g.serviceUrl || '');
  const galleryId = (g as any).galleryId;
  
  // If galleryId is set to 'cursor', Cursor may ignore serviceUrl
  // This is a known limitation - Cursor may read from app bundle first
  if (galleryId === 'cursor') return 'cursor';
  
  if (s.includes('open-vsx.org')) return 'openvsx';
  if (s.includes('marketplace.visualstudio.com')) return 'ms';
  if (s.includes('marketplace.cursorapi.com')) return 'cursor';
  if (s.startsWith('http')) return 'custom';
  return 'unknown';
}

function labelFor(kind: GalleryKind): string {
  switch (kind) {
    case 'openvsx': return '$(extensions) Market: Open VSX';
    case 'ms':      return '$(extensions) Market: Microsoft';
    case 'cursor':  return '$(extensions) Market: Cursor';
    case 'custom':  return '$(extensions) Market: Custom';
    default:        return '$(extensions) Market';
  }
}

function refreshStatusBar() {
  if (!statusBar) return;
  try {
    statusBar.text = labelFor(detectCurrentGallery());
  } catch {
    statusBar.text = '$(extensions) Market';
  }
}

// --- Actions
async function forceQuitApp() {
  try {
    await vscode.commands.executeCommand('workbench.action.quit');
  } catch (e: any) {
    vscode.window.showWarningMessage('Could not quit automatically. Please quit and reopen the app.');
  }
}

async function doSwitch(kind: 'openvsx' | 'ms' | 'cursor' | 'custom') {
  try {
    const isCursor = vscode.env.appName?.toLowerCase().includes('cursor') ?? false;
    
    if (kind === 'custom') {
      const serviceUrl = await vscode.window.showInputBox({ prompt: 'serviceUrl (e.g. https://...)' });
      if (!isProbablyUrl(serviceUrl)) { vscode.window.showErrorMessage('Invalid serviceUrl. Must start with http(s)://'); return; }
      const itemUrl = await vscode.window.showInputBox({ prompt: 'itemUrl (e.g. https://...)' });
      if (!isProbablyUrl(itemUrl))   { vscode.window.showErrorMessage('Invalid itemUrl. Must start with http(s)://'); return; }
      const cacheUrl = await vscode.window.showInputBox({ prompt: 'cacheUrl (optional, https://...)', value: '' });
      const g: Gallery = { serviceUrl: serviceUrl!, itemUrl: itemUrl! };
      if (cacheUrl && isProbablyUrl(cacheUrl)) g.cacheUrl = cacheUrl;
      writeGallery(g);
    } else if (kind === 'cursor') {
      writeGallery(CURSOR);
    } else {
      writeGallery(kind === 'openvsx' ? OPENVSX : MS);
    }

    refreshStatusBar();

    let message = 'Marketplace switched. A FULL quit/relaunch is required. Reload Window is NOT enough.';
    if (isCursor && kind !== 'cursor') {
      message += '\n\n⚠️ Cursor Note: If Cursor still shows its curated shop after restart, it may be reading product.json from the app bundle. This is a Cursor limitation.';
    }
    
    const choice = await vscode.window.showInformationMessage(
      message,
      'Quit Now (required)'
    );
    if (choice) await forceQuitApp();
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed: ${err?.message ?? err}`);
  }
}

async function openProductJson() {
  const file = productJsonPath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) {
      writeJsonAtomic(file, readExistingProduct());
    }
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
    await vscode.window.showTextDocument(doc, { preview: false });
  } catch (err: any) {
    vscode.window.showErrorMessage(`Open failed: ${err?.message ?? err}`);
  }
}

async function revertLastBackup() {
  const dir = productJsonDir();
  const last = latestBackupPath(dir);
  if (!last) {
    vscode.window.showInformationMessage('No product.json backup found.');
    return;
  }
  const file = productJsonPath();
  try {
    fs.copyFileSync(last, file);
    refreshStatusBar();
    vscode.window.showInformationMessage('Reverted product.json from latest backup. Quit and relaunch to apply.');
  } catch (err: any) {
    vscode.window.showErrorMessage(`Revert failed: ${err?.message ?? err}`);
  }
}

// --- Status bar quick pick with ALL actions
interface PickItem extends vscode.QuickPickItem { run: () => Thenable<void> | void; }
async function showSwitcherQuickPick() {
  const items: PickItem[] = [
    { label: 'Switch to Open VSX', run: () => doSwitch('openvsx') },
    { label: 'Switch to Microsoft Marketplace', run: () => doSwitch('ms') },
    { label: 'Switch to Cursor Marketplace', run: () => doSwitch('cursor') },
    { label: 'Set custom gallery endpoints…', run: () => doSwitch('custom') },
    { label: 'Quit App', run: () => forceQuitApp() },
    { label: 'Open product.json', run: () => openProductJson() },
    { label: 'Revert product.json from latest backup', run: () => revertLastBackup() }
  ];
  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: 'Extension Marketplace Switcher',
    ignoreFocusOut: true
  });
  if (pick) await pick.run();
}

// --- Entry points
export function activate(ctx: vscode.ExtensionContext) {
  // Commands
  ctx.subscriptions.push(
    vscode.commands.registerCommand('gallery.switchOpenVSX', () => doSwitch('openvsx')),
    vscode.commands.registerCommand('gallery.switchMicrosoft', () => doSwitch('ms')),
    vscode.commands.registerCommand('gallery.switchCursor', () => doSwitch('cursor')),
    vscode.commands.registerCommand('gallery.switchCustom', () => doSwitch('custom')),
    vscode.commands.registerCommand('gallery.openProductJson', () => openProductJson()),
    vscode.commands.registerCommand('gallery.revertLastBackup', () => revertLastBackup()),
    vscode.commands.registerCommand('gallery.forceRestart', () => forceQuitApp()),
    vscode.commands.registerCommand('gallery.switcherQuickPick', () => showSwitcherQuickPick()),
  );

  // Status bar
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.tooltip = 'Extension Marketplace Switcher';
  statusBar.command = 'gallery.switcherQuickPick';
  statusBar.show();
  ctx.subscriptions.push(statusBar);
  refreshStatusBar();

  // Update label when product.json is saved or when window refocuses
  ctx.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.uri.fsPath === productJsonPath()) refreshStatusBar();
    }),
    vscode.window.onDidChangeWindowState(() => refreshStatusBar())
  );

  // First-run prompt (once)
  const firstActivationKey = 'gallerySwitcher.hasBeenActivated';
  if (!ctx.globalState.get(firstActivationKey)) {
    ctx.globalState.update(firstActivationKey, true);
    vscode.window.showInformationMessage(
      'Welcome to Extension Marketplace Switcher. Choose your preferred marketplace (requires full quit after switching).',
      'Open VSX',
      'Microsoft',
      'Cursor'
    ).then((selection?: string) => {
      if (selection === 'Open VSX') void doSwitch('openvsx');
      if (selection === 'Microsoft') void doSwitch('ms');
      if (selection === 'Cursor') void doSwitch('cursor');
    });
  }
}

export function deactivate() {}
