import * as https from 'https';
import * as http from 'http';

export interface MarketplaceExtension {
  id: string;           // "publisher.name"
  publisher: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
}

export interface Marketplace {
  id: 'openvsx' | 'ms';
  label: string;
  searchExtensions(query: string): Promise<MarketplaceExtension[]>;
  getExtensionById(id: string): Promise<MarketplaceExtension | null>;
  getVsixUrl(ext: MarketplaceExtension): Promise<string>;
}

function httpRequest(url: string, options?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options?.method || 'GET',
      headers: {
        'User-Agent': 'Marketplace-Switcher-Extension',
        'Accept': 'application/json',
        ...options?.headers
      }
    };

    if (options?.body) {
      requestOptions.headers = {
        ...requestOptions.headers,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(options.body)
      };
    }

    const req = client.request(requestOptions, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage || 'Request failed'}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(data);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Network error: ${err.message}`));
    });

    if (options?.body) {
      req.write(options.body);
    }

    req.end();
  });
}

export class OpenVSXMarketplace implements Marketplace {
  id: 'openvsx' = 'openvsx';
  label = 'Open VSX';

  async searchExtensions(query: string): Promise<MarketplaceExtension[]> {
    try {
      const url = `https://open-vsx.org/api/-/search?size=50&sortBy=relevance&query=${encodeURIComponent(query)}`;
      const response = await httpRequest(url);
      const data = JSON.parse(response);
      
      const extensions: MarketplaceExtension[] = [];
      if (data.extensions && Array.isArray(data.extensions)) {
        for (const ext of data.extensions) {
          extensions.push({
            id: `${ext.namespace}.${ext.name}`,
            publisher: ext.namespace || '',
            name: ext.name || '',
            displayName: ext.displayName || ext.name || '',
            description: ext.description || '',
            version: ext.version || ''
          });
        }
      }
      return extensions;
    } catch (err: any) {
      throw new Error(`Failed to search Open VSX: ${err.message || String(err)}`);
    }
  }

  async getExtensionById(id: string): Promise<MarketplaceExtension | null> {
    try {
      const parts = id.split('.');
      if (parts.length !== 2) {
        throw new Error('Invalid extension ID format. Expected "publisher.name"');
      }
      const [publisher, name] = parts;
      const url = `https://open-vsx.org/api/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}`;
      const response = await httpRequest(url);
      const ext = JSON.parse(response);
      
      if (!ext || !ext.namespace || !ext.name) {
        return null;
      }

      return {
        id: `${ext.namespace}.${ext.name}`,
        publisher: ext.namespace,
        name: ext.name,
        displayName: ext.displayName || ext.name,
        description: ext.description || '',
        version: ext.version || ''
      };
    } catch (err: any) {
      if (err.message && err.message.includes('HTTP 404')) {
        return null;
      }
      throw new Error(`Failed to get extension from Open VSX: ${err.message || String(err)}`);
    }
  }

  async getVsixUrl(ext: MarketplaceExtension): Promise<string> {
    try {
      // First try to get the latest version info to check for files.download
      const url = `https://open-vsx.org/api/${encodeURIComponent(ext.publisher)}/${encodeURIComponent(ext.name)}`;
      const response = await httpRequest(url);
      const data = JSON.parse(response);
      
      // Prefer files.download if available
      if (data.files && data.files.download) {
        return data.files.download;
      }
      
      // Otherwise construct the URL
      const version = ext.version || data.version || '';
      if (!version) {
        throw new Error('Extension version not found');
      }
      return `https://open-vsx.org/api/${encodeURIComponent(ext.publisher)}/${encodeURIComponent(ext.name)}/${encodeURIComponent(version)}/file/${encodeURIComponent(ext.name)}-${encodeURIComponent(version)}.vsix`;
    } catch (err: any) {
      throw new Error(`Failed to get VSIX URL from Open VSX: ${err.message || String(err)}`);
    }
  }
}

export class MSMarketplace implements Marketplace {
  id: 'ms' = 'ms';
  label = 'VS Marketplace';

  private baseUrl = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=3.0-preview.1';

  private async queryExtensions(filters: any[]): Promise<any[]> {
    try {
      const requestBody = JSON.stringify({
        filters,
        flags: 98  // Include versions and assets
      });

      const response = await httpRequest(this.baseUrl, {
        method: 'POST',
        body: requestBody
      });

      const data = JSON.parse(response);
      if (data.results && data.results.length > 0 && data.results[0].extensions) {
        return data.results[0].extensions;
      }
      return [];
    } catch (err: any) {
      throw new Error(`Failed to query VS Marketplace: ${err.message || String(err)}`);
    }
  }

  async searchExtensions(query: string): Promise<MarketplaceExtension[]> {
    try {
      const filters = [{
        criteria: [
          { filterType: 7, value: query }
        ]
      }];

      const extensions = await this.queryExtensions(filters);
      const result: MarketplaceExtension[] = [];

      for (const ext of extensions) {
        if (!ext.publisher || !ext.extensionName || !ext.versions || ext.versions.length === 0) {
          continue;
        }

        const latestVersion = ext.versions[0];
        result.push({
          id: `${ext.publisher.publisherName}.${ext.extensionName}`,
          publisher: ext.publisher.publisherName || '',
          name: ext.extensionName || '',
          displayName: ext.displayName || ext.extensionName || '',
          description: ext.shortDescription || ext.displayName || '',
          version: latestVersion.version || ''
        });
      }

      return result;
    } catch (err: any) {
      throw new Error(`Failed to search VS Marketplace: ${err.message || String(err)}`);
    }
  }

  async getExtensionById(id: string): Promise<MarketplaceExtension | null> {
    try {
      const parts = id.split('.');
      if (parts.length !== 2) {
        throw new Error('Invalid extension ID format. Expected "publisher.name"');
      }
      const [publisherName, extensionName] = parts;

      const filters = [{
        criteria: [
          { filterType: 7, value: id }
        ]
      }];

      const extensions = await this.queryExtensions(filters);
      
      // Find exact match
      const ext = extensions.find(e => 
        e.publisher?.publisherName === publisherName && 
        e.extensionName === extensionName
      );

      if (!ext || !ext.publisher || !ext.extensionName || !ext.versions || ext.versions.length === 0) {
        return null;
      }

      const latestVersion = ext.versions[0];
      return {
        id: `${ext.publisher.publisherName}.${ext.extensionName}`,
        publisher: ext.publisher.publisherName,
        name: ext.extensionName,
        displayName: ext.displayName || ext.extensionName,
        description: ext.shortDescription || ext.displayName || '',
        version: latestVersion.version || ''
      };
    } catch (err: any) {
      throw new Error(`Failed to get extension from VS Marketplace: ${err.message || String(err)}`);
    }
  }

  async getVsixUrl(ext: MarketplaceExtension): Promise<string> {
    try {
      // Get the extension again to get the latest version with assets
      const fullExt = await this.getExtensionById(ext.id);
      if (!fullExt) {
        throw new Error(`Extension ${ext.id} not found`);
      }

      // Query again to get the full version info with assets
      const filters = [{
        criteria: [
          { filterType: 7, value: ext.id }
        ]
      }];

      const extensions = await this.queryExtensions(filters);
      const foundExt = extensions.find(e => 
        e.publisher?.publisherName === ext.publisher && 
        e.extensionName === ext.name
      );

      if (!foundExt || !foundExt.versions || foundExt.versions.length === 0) {
        throw new Error(`Extension ${ext.id} version information not found`);
      }

      const latestVersion = foundExt.versions[0];
      
      // Check files first
      if (latestVersion.files && Array.isArray(latestVersion.files)) {
        const vsixFile = latestVersion.files.find((f: any) => 
          f.assetType === 'Microsoft.VisualStudio.Services.VSIXPackage'
        );
        if (vsixFile && vsixFile.source) {
          return vsixFile.source;
        }
      }

      // Check assets
      if (latestVersion.assets && Array.isArray(latestVersion.assets)) {
        const vsixAsset = latestVersion.assets.find((a: any) => 
          a.assetType === 'Microsoft.VisualStudio.Services.VSIXPackage'
        );
        if (vsixAsset && vsixAsset.source) {
          return vsixAsset.source;
        }
      }

      throw new Error(`VSIX package not found for extension ${ext.id}`);
    } catch (err: any) {
      throw new Error(`Failed to get VSIX URL from VS Marketplace: ${err.message || String(err)}`);
    }
  }
}

const openVSX = new OpenVSXMarketplace();
const ms = new MSMarketplace();

export function getMarketplace(id: 'openvsx' | 'ms'): Marketplace {
  return id === 'ms' ? ms : openVSX;
}

