import { usePWA } from '@/hooks/usePWA';
import { Wifi, WifiOff } from 'lucide-react';

export default function OfflineIndicator() {
  const { isOnline } = usePWA();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white text-center py-2 px-4">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="h-4 w-4" />
        <span className="text-sm font-medium">You're offline. Some features may be limited.</span>
      </div>
    </div>
  );
}
