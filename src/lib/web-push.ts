import { api } from '@/lib/api';

export type WebPushRegistrationResult = { registered: true } | { error: string };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function registerForWebPushAsync(): Promise<WebPushRegistrationResult> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || typeof window === 'undefined' || !('PushManager' in window)) {
    return { error: 'This browser does not support web push notifications.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { error: 'Notification permission was not granted.' };
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const { public_key: publicKey } = await api.getVapidPublicKey();
    if (!publicKey) {
      return { error: 'Web push is not configured on the server yet.' };
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    const json = subscription.toJSON();
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!json.endpoint || !p256dh || !auth) {
      return { error: 'Could not read the browser push subscription.' };
    }

    await api.registerWebPushSubscription({ endpoint: json.endpoint, p256dh, auth });
    return { registered: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not register for web push.' };
  }
}
