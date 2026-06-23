export const scannerRegistry = {
  personal: ['mail-import', 'credential-store-import', 'browser-import', 'public-page', 'breach-summary', 'code-host'],
  company: ['dns', 'https-header', 'certificate-log', 'code-host', 'asset-search'],
  accounts: ['platform-catalog', 'review-workflow']
};
export function getScannerRegistry() { return scannerRegistry; }
