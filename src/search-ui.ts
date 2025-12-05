import * as vscode from 'vscode';
import { Marketplace, MarketplaceExtension, getMarketplace } from './marketplaces';
import { installVsixFromUrl } from './vsix-installer';

export async function showMarketplaceSearch(marketplace: Marketplace): Promise<void> {
  const query = await vscode.window.showInputBox({
    prompt: `Search ${marketplace.label} for extensions`,
    placeHolder: 'e.g. python, eslint, theme'
  });

  if (!query) {
    return;
  }

  let results: MarketplaceExtension[];
  try {
    results = await marketplace.searchExtensions(query);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to search ${marketplace.label}: ${err.message || String(err)}`);
    return;
  }

  if (!results.length) {
    vscode.window.showInformationMessage(`No extensions found in ${marketplace.label} for "${query}".`);
    return;
  }

  const pick = await vscode.window.showQuickPick(
    results.map(ext => ({
      label: `${ext.publisher}.${ext.name}`,
      description: ext.version,
      detail: `${ext.description} [Source: ${marketplace.label}]`,
      ext
    })),
    {
      placeHolder: `Select an extension to install from ${marketplace.label}`
    }
  );

  if (!pick) {
    return;
  }

  try {
    const vsixUrl = await marketplace.getVsixUrl(pick.ext);
    await installVsixFromUrl(vsixUrl);
    vscode.window.showInformationMessage(`Installed ${pick.label} from ${marketplace.label}.`);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to install ${pick.label} from ${marketplace.label}: ${err.message || String(err)}`);
  }
}

export async function showDirectInstall(marketplace: Marketplace): Promise<void> {
  const id = await vscode.window.showInputBox({
    prompt: `Install extension by ID from ${marketplace.label} (publisher.name)`,
    placeHolder: 'publisher.name'
  });

  if (!id) {
    return;
  }

  if (!id.includes('.')) {
    vscode.window.showErrorMessage('Please use the format "publisher.name".');
    return;
  }

  let ext: MarketplaceExtension | null;
  try {
    ext = await marketplace.getExtensionById(id);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to look up ${id} in ${marketplace.label}: ${err.message || String(err)}`);
    return;
  }

  if (!ext) {
    vscode.window.showErrorMessage(`Extension "${id}" not found in ${marketplace.label}.`);
    return;
  }

  try {
    const vsixUrl = await marketplace.getVsixUrl(ext);
    await installVsixFromUrl(vsixUrl);
    vscode.window.showInformationMessage(`Installed ${ext.publisher}.${ext.name} from ${marketplace.label}.`);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to install ${id} from ${marketplace.label}: ${err.message || String(err)}`);
  }
}

export async function showMarketplaceSearchForMarketplaceId(id: 'openvsx' | 'ms'): Promise<void> {
  const marketplace = getMarketplace(id);
  await showMarketplaceSearch(marketplace);
}

export async function showDirectInstallForMarketplaceId(id: 'openvsx' | 'ms'): Promise<void> {
  const marketplace = getMarketplace(id);
  await showDirectInstall(marketplace);
}

