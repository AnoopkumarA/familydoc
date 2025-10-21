import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Mobile detection utilities
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

export function isAndroidStudio(): boolean {
  return /Android/.test(navigator.userAgent) && 
         (navigator.userAgent.includes('wv') || 
          window.navigator.standalone === undefined);
}

// Web Share API utilities
export function canShareFiles(): boolean {
  const nav = navigator as any;
  return nav && typeof nav.share === 'function' && typeof nav.canShare === 'function';
}

export function canShareURL(): boolean {
  const nav = navigator as any;
  return nav && typeof nav.share === 'function';
}

export function isWebView(): boolean {
  return window.navigator.standalone === undefined && 
         !window.matchMedia('(display-mode: standalone)').matches;
}

export function debugShareCapabilities(): void {
  const nav = navigator as any;
  console.log('Share API Debug Info:', {
    userAgent: navigator.userAgent,
    hasShare: typeof nav.share === 'function',
    hasCanShare: typeof nav.canShare === 'function',
    isMobile: isMobileDevice(),
    isAndroid: isAndroid(),
    isIOS: isIOS(),
    isWebView: isWebView(),
    isAndroidStudio: isAndroidStudio(),
    standalone: window.navigator.standalone,
    displayMode: window.matchMedia('(display-mode: standalone)').matches,
    // Test file sharing capabilities
    testFileSharing: () => {
      if (typeof nav.canShare === 'function') {
        const testFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
        return nav.canShare({ files: [testFile] });
      }
      return false;
    }
  });
}
