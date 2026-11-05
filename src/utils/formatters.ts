/**
 * Official Bakery Instagram Link requested by user
 */
export const OFFICIAL_INSTAGRAM_URL = 'https://www.instagram.com/browniegirlcakes?exln=dTU4eXBuMjNmYmJr';

/**
 * Resolves Instagram setting to a valid working URL.
 * Supports:
 * - Full URL: returns as is
 * - Handle with or without @: formats properly
 * - Default/browniegirlcakes/browinegirlcakes: returns the exact official link with parameters
 */
export function getInstagramUrl(setting?: string): string {
  if (!setting) return OFFICIAL_INSTAGRAM_URL;
  const trimmed = setting.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const clean = trimmed.replace(/^@/, '');
  if (!clean || clean.toLowerCase() === 'browniegirlcakes' || clean.toLowerCase() === 'browinegirlcakes') {
    return OFFICIAL_INSTAGRAM_URL;
  }
  return `https://www.instagram.com/${clean}`;
}

/**
 * Converts any price string or numeric value into Indian Rupees (₹)
 * Examples:
 * "$4.50 / piece" -> "₹199 / piece"
 * "$85 / person" -> "₹1,999 / person"
 * "24" -> "₹499"
 * "$50.00" -> "₹1,048"
 */
export function formatRupee(priceStr: string | number): string {
  if (priceStr === null || priceStr === undefined) return '₹199';
  const str = String(priceStr).trim();
  if (!str) return '₹199';

  // Already in rupees
  if (str.includes('₹') || str.includes('Rs') || str.includes('INR')) {
    return str;
  }

  // Common conversions from default dollar seed values
  if (str.includes('$4.50')) return str.replace('$4.50', '₹199');
  if (str.includes('$5.00')) return str.replace('$5.00', '₹229');
  if (str.includes('$5.25')) return str.replace('$5.25', '₹249');
  if (str.includes('$5.50')) return str.replace('$5.50', '₹259');
  if (str.includes('$24.00') || str.includes('$24')) return str.replace(/\$24(\.00)?/, '₹499');
  if (str.includes('$26.00') || str.includes('$26')) return str.replace(/\$26(\.00)?/, '₹549');
  if (str.includes('$27.00') || str.includes('$27')) return str.replace(/\$27(\.00)?/, '₹579');
  if (str.includes('$28.00') || str.includes('$28')) return str.replace(/\$28(\.00)?/, '₹599');
  if (str.includes('$48.00') || str.includes('$48')) return str.replace(/\$48(\.00)?/, '₹999');
  if (str.includes('$50.00') || str.includes('$50')) return str.replace(/\$50(\.00)?/, '₹1,048');
  if (str.includes('$52.00') || str.includes('$52')) return str.replace(/\$52(\.00)?/, '₹1,098');
  if (str.includes('$74.00') || str.includes('$74')) return str.replace(/\$74(\.00)?/, '₹1,499');
  if (str.includes('$75')) return str.replace('$75', '₹1,499');
  if (str.includes('$85')) return str.replace('$85', '₹1,999');
  if (str.includes('$95')) return str.replace('$95', '₹2,499');

  // Generic dollar replacement
  if (str.includes('$')) {
    return str.replace('$', '₹');
  }

  return `₹${str}`;
}

/**
 * Compresses an image file selected from local device storage using HTML5 Canvas.
 * Returns an optimized Base64 Data URL (~60-150KB) that renders instantly and fits
 * within Firestore & LocalStorage limits.
 */
export function compressImageFile(
  file: File,
  maxWidth = 1200,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width || 800;
        let height = img.height || 800;
        const maxDim = maxWidth;

        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.max(1, Math.round((height * maxDim) / width));
            width = maxDim;
          } else {
            width = Math.max(1, Math.round((width * maxDim) / height));
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        // Fill warm white background so transparent PNGs/WebPs render cleanly in JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Ensure compressed image stays well below Firestore's 1MB document limit (~600KB max string size)
        let currentQuality = quality;
        while (dataUrl.length > 600000 && currentQuality > 0.4) {
          currentQuality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', Math.max(0.35, currentQuality));
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to read image file'));
      img.src = e.target?.result as string;
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Formats a phone number for WhatsApp wa.me links (defaults to +91 for 10-digit Indian numbers).
 */
export function formatWhatsAppNumber(rawPhone?: string, fallback = '7339651529'): string {
  const digits = (rawPhone || fallback).replace(/[^0-9]/g, '');
  if (!digits) return `91${fallback}`;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

/**
 * Builds a complete https://wa.me/ URL with encoded message text.
 */
export function buildWhatsAppUrl(rawPhone: string | undefined, message: string, fallback = '7339651529'): string {
  const formattedPhone = formatWhatsAppNumber(rawPhone, fallback);
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Triggers opening a WhatsApp URL in a new tab using a temporary anchor element
 * (avoids window.open while respecting iframe/browser security policies).
 */
export function triggerWhatsAppRedirect(url: string): void {
  try {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.warn('Could not auto-trigger WhatsApp link:', err);
  }
}

