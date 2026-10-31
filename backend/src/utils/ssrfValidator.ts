import dns from 'dns';
import { URL } from 'url';

/**
 * Checks if an IP is in a private, loopback, link-local, or cloud-metadata range.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv4 Loopback (127.0.0.0/8)
  if (/^127\./.test(ip)) return true;

  // IPv4 Link-local (169.254.0.0/16) - includes AWS/GCP metadata service 169.254.169.254
  if (/^169\.254\./.test(ip)) return true;

  // IPv4 Private Class A (10.0.0.0/8)
  if (/^10\./.test(ip)) return true;

  // IPv4 Private Class B (172.16.0.0/12)
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;

  // IPv4 Private Class C (192.168.0.0/16)
  if (/^192\.168\./.test(ip)) return true;

  // IPv4 0.0.0.0
  if (ip === '0.0.0.0') return true;

  // IPv6 Loopback / Link-local / Unique Local Address
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::' || lower.startsWith('fc00:') || lower.startsWith('fe80:')) {
    return true;
  }

  return false;
}

/**
 * Validates a URL against SSRF attacks.
 * Resolves DNS and verifies all resolved IP addresses are public.
 */
export async function validateSafeUrl(urlString: string): Promise<URL> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Only allow HTTP and HTTPS
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only http: and https: are allowed.`);
  }

  const hostname = parsedUrl.hostname;

  // Disallow localhost names
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Access to local/internal domains is blocked.');
  }

  // Resolve DNS to verify IP addresses
  const resolvedIps = await dns.promises.lookup(hostname, { all: true });

  if (!resolvedIps || resolvedIps.length === 0) {
    throw new Error(`Could not resolve hostname: ${hostname}`);
  }

  for (const record of resolvedIps) {
    if (isPrivateIp(record.address)) {
      throw new Error(`Destination address ${record.address} is in a restricted private network range.`);
    }
  }

  return parsedUrl;
}
