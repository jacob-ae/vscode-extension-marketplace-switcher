import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { tmpdir } from 'os';
import { execFile } from 'child_process';

export async function downloadVsix(vsixUrl: string): Promise<string> {
  const dir = path.join(tmpdir(), 'marketplace-switcher');
  fs.mkdirSync(dir, { recursive: true });
  const vsixPath = path.join(dir, `ext-${Date.now()}.vsix`);

  return new Promise((resolve, reject) => {
    const urlObj = new URL(vsixUrl);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const file = fs.createWriteStream(vsixPath);

    const requestOptions: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Marketplace-Switcher-Extension'
      }
    };

    const req = client.request(requestOptions, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(vsixPath, () => {});
        reject(new Error(`HTTP ${res.statusCode}: Failed to download VSIX`));
        return;
      }

      res.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          resolve(vsixPath);
        });
      });
    });

    req.on('error', (err) => {
      file.close();
      fs.unlink(vsixPath, () => {});
      reject(new Error(`Network error downloading VSIX: ${err.message}`));
    });

    req.end();
  });
}

async function installViaCli(vsixPath: string): Promise<void> {
  const binary = process.execPath;
  return new Promise<void>((resolve, reject) => {
    execFile(binary, ['--install-extension', vsixPath], (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`CLI failed: ${stderr || err.message}`));
      } else {
        resolve();
      }
    });
  });
}

export async function installVsixFromUrl(vsixUrl: string): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Installing extension…',
      cancellable: false
    },
    async () => {
      const vsixPath = await downloadVsix(vsixUrl);

      try {
        await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(vsixPath));
        return;
      } catch {
        // ignore and try next
      }

      try {
        await vscode.commands.executeCommand('workbench.extensions.installVSIX', vscode.Uri.file(vsixPath));
        return;
      } catch {
        // ignore and try CLI fallback
      }

      await installViaCli(vsixPath);
    }
  );
}

