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

// Web Share API utilities
export function canShareFiles(): boolean {
  const nav = navigator as any;
  return nav && typeof nav.share === 'function' && typeof nav.canShare === 'function';
}

export function canShareURL(): boolean {
  const nav = navigator as any;
  return nav && typeof nav.share === 'function';
}
