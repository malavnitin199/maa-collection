import type { MetadataRoute } from 'next';
import { BRAND_GREEN } from '@/lib/app-icon';

/** Lets staff "Add to Home screen": opens full-screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Maa Collection',
    short_name: 'Maa Collection',
    description: 'Shop app: scan and sell, stock, barcodes and labels.',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: BRAND_GREEN,
    icons: [
      { src: '/app-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
