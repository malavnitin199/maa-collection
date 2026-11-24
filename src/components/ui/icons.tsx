/**
 * Small line icons (24 px grid, 1.8 stroke, currentColor) for the dock and the
 * header — drawn for this app instead of symbol characters. Decorative: the
 * text next to each icon names it.
 */
type IconProps = { className?: string };
const base = (path: React.ReactNode, className = 'h-6 w-6') => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

export const IconHome = ({ className }: IconProps) => base(<><path d="M3.5 10.5 12 4l8.5 6.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" /></>, className);
/** A hang tag: the app's own tag, with its thread hole. */
export const IconTag = ({ className }: IconProps) => base(<><path d="M7 3.5h10l2.5 2.5v14.5h-15V6L7 3.5Z" /><circle cx="12" cy="7.5" r="1.3" /><path d="M8.5 12h7M8.5 15.5h4.5" /></>, className);
/** A QR code (three finder squares and a few modules): Stocks card → the product's label (ADR-070). */
export const IconQr = ({ className }: IconProps) => base(<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h1M20 14v1" /></>, className);
/** A paper bill with a torn bottom edge: the dock's Bills (ADR-070). */
export const IconBill = ({ className }: IconProps) => base(<><path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3v-17Z" /><path d="M9 8h6M9 11.5h6M9 15h3.5" /></>, className);
export const IconStockAdd = ({ className }: IconProps) => base(<><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" /><path d="M12 9.5v6M9 12.5h6" /></>, className);
/** Home → Add new stock (owner, 2026-11-22, ADR-064): a shirt with a plus. */
export const IconAddStock = ({ className }: IconProps) => base(<><path d="M9 4.5 4.5 6.8 3 10.3l3.2 1.3V20h11.6v-8.4l3.2-1.3-1.5-3.5L15 4.5c-.5 1.4-1.6 2.2-3 2.2s-2.5-.8-3-2.2Z" /><path d="M12 11.5v5M9.5 14h5" /></>, className);
/** Scan: a barcode inside viewfinder corners. */
export const IconScan = ({ className }: IconProps) => base(<><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M8 8.5v7M10.5 8.5v7M13.5 8.5v7M16 8.5v7" /></>, className);
export const IconMenu = ({ className }: IconProps) => base(<><path d="M4.5 7h15M4.5 12h15M4.5 17h15" /></>, className);
export const IconSwap = ({ className }: IconProps) => base(<><path d="M5 8.5h13l-3.5-3.5" /><path d="M19 15.5H6l3.5 3.5" /></>, className);
export const IconRupee = ({ className }: IconProps) => base(<><path d="M7 5h10M7 9h10" /><path d="M9.5 5c3.6 0 5 1.6 5 4s-1.9 4-5 4H8l7 6" /></>, className);
export const IconBook = ({ className }: IconProps) => base(<><path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5Z" /><path d="M12 6.5v13" /></>, className);
export const IconPalette = ({ className }: IconProps) => base(<><path d="M12 4a8 8 0 1 0 0 16c1.2 0 1.8-.9 1.5-1.9-.3-1 .3-2.1 1.5-2.1H17a3 3 0 0 0 3-3c0-5-3.6-9-8-9Z" /><circle cx="8" cy="11" r="1.1" /><circle cx="11" cy="7.8" r="1.1" /><circle cx="15" cy="8.5" r="1.1" /></>, className);
export const IconSun = ({ className }: IconProps) => base(<><circle cx="12" cy="12" r="3.8" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>, className);
export const IconMoon = ({ className }: IconProps) => base(<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />, className);
export const IconPhone = ({ className }: IconProps) => base(<><rect x="7" y="3.5" width="10" height="17" rx="2" /><path d="M11 17.5h2" /></>, className);
export const IconSound = ({ className }: IconProps) => base(<><path d="M5 9.5h3l4-3.5v12l-4-3.5H5v-5Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 7a7 7 0 0 1 0 10" /></>, className);
export const IconMute = ({ className }: IconProps) => base(<><path d="M5 9.5h3l4-3.5v12l-4-3.5H5v-5Z" /><path d="m16 10 4 4M20 10l-4 4" /></>, className);
export const IconLogout = ({ className }: IconProps) => base(<><path d="M10 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H10" /><path d="M14 8l4 4-4 4M18 12H9.5" /></>, className);
export const IconBackspace = ({ className }: IconProps) => base(<><path d="M9 5.5h10.5v13H9L3.5 12 9 5.5Z" /><path d="m12.5 9.5 4 5M16.5 9.5l-4 5" /></>, className);
export const IconCamera = ({ className }: IconProps) => base(<><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" /><circle cx="12" cy="12.5" r="3.3" /></>, className);
export const IconUsers = ({ className }: IconProps) => base(<><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" /><path d="M15.5 5.8a3 3 0 0 1 0 5.4M17.5 14.6c1.6.6 2.7 2.2 3 4.4" /></>, className);
export const IconChart = ({ className }: IconProps) => base(<><path d="M4 20h16" /><path d="M7 16.5v-5M12 16.5V7M17 16.5v-8" /></>, className);
export const IconClock = ({ className }: IconProps) => base(<><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>, className);
export const IconGear = ({ className }: IconProps) => base(<><circle cx="12" cy="12" r="2.8" /><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6" /></>, className);
export const IconPrinter = ({ className }: IconProps) => base(<><path d="M7 9V4h10v5" /><rect x="4" y="9" width="16" height="7" rx="1.5" /><path d="M7 14h10v6H7z" /></>, className);
export const IconCheckList = ({ className }: IconProps) => base(<><path d="m4.5 7 1.5 1.5L9 5.5M4.5 13l1.5 1.5L9 11.5M4.5 19l1.5 1.5 3-3" /><path d="M12 7h7.5M12 13h7.5M12 19h7.5" /></>, className);
export const IconTruck = ({ className }: IconProps) => base(<><path d="M3.5 6.5h10v9h-10z" /><path d="M13.5 9.5h3.5l3 3v3h-6.5" /><circle cx="7" cy="17.5" r="1.7" /><circle cx="16.5" cy="17.5" r="1.7" /></>, className);
export const IconGrid = ({ className }: IconProps) => base(<><rect x="4" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" /></>, className);
export const IconHelp = ({ className }: IconProps) => base(<><circle cx="12" cy="12" r="8" /><path d="M9.8 9.5a2.3 2.3 0 0 1 4.4.9c0 1.6-2.2 2-2.2 3.4" /><path d="M12 16.8v.2" /></>, className);
/** Bulk addition (ADR-072): a list of rows and a plus. */
export const IconBulkAdd = ({ className }: IconProps) => base(<><path d="M4 6.5h11M4 11.5h11M4 16.5h6" /><path d="M17.5 13.5v6M14.5 16.5h6" /></>, className);
export const IconBoxes = ({ className }: IconProps) => base(<><path d="M4 9.5 12 5l8 4.5-8 4.5-8-4.5Z" /><path d="M4 9.5v5L12 19l8-4.5v-5" /></>, className);
/** A fixed collection (Men / Women, ADR-064): always there. */
export const IconLock = ({ className }: IconProps) => base(<><rect x="5.5" y="10.5" width="13" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>, className);
export const IconPencil = ({ className }: IconProps) => base(<><path d="M14.5 5.5 18.5 9.5 9 19H5v-4l9.5-9.5Z" /><path d="m12.5 7.5 4 4" /></>, className);
export const IconPlay = ({ className }: IconProps) => base(<path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />, className);
export const IconPause = ({ className }: IconProps) => base(<><rect x="7" y="5.5" width="3.2" height="13" rx="1" fill="currentColor" /><rect x="13.8" y="5.5" width="3.2" height="13" rx="1" fill="currentColor" /></>, className);
export const IconStop = ({ className }: IconProps) => base(<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" />, className);
export const IconPrev = ({ className }: IconProps) => base(<><path d="M17.5 6v12L9 12l8.5-6Z" fill="currentColor" /><path d="M6.5 6v12" /></>, className);
export const IconNext = ({ className }: IconProps) => base(<><path d="M6.5 6v12L15 12 6.5 6Z" fill="currentColor" /><path d="M17.5 6v12" /></>, className);
export const IconChevron = ({ className }: IconProps) => base(<path d="m9.5 6 6 6-6 6" />, className);
/** Selecting many (plan v17): bolder strokes so they read clearly on the dark bars. */
const bold = (path: React.ReactNode, className = 'h-6 w-6') => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);
export const IconSelect = ({ className }: IconProps) => bold(<><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><path d="m8 12.3 2.8 2.8L16.3 9.5" /></>, className);
export const IconClose = ({ className }: IconProps) => bold(<path d="M6 6l12 12M18 6 6 18" />, className);
export const IconEyeOff = ({ className }: IconProps) => bold(<><path d="M3.5 12S7 5.5 12 5.5c1.6 0 3 .5 4.2 1.2M20.5 12S17 18.5 12 18.5c-1.6 0-3-.5-4.2-1.2" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="m4 4 16 16" /></>, className);
export const IconTrash = ({ className }: IconProps) => bold(<><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" /><path d="M10 11v5M14 11v5" /></>, className);
export const IconEye = ({ className }: IconProps) => bold(<><path d="M3.5 12S7 5.5 12 5.5 20.5 12 20.5 12 17 18.5 12 18.5 3.5 12 3.5 12Z" /><circle cx="12" cy="12" r="3" /></>, className);
export const IconRename = ({ className }: IconProps) => bold(<><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m13.5 8.5 3 3" /></>, className);
export const IconBuilding = ({ className }: IconProps) => bold(<><path d="M4.5 20.5V6.5l7-3v17" /><path d="M11.5 9.5h8v11" /><path d="M3 20.5h18M7.5 9h1M7.5 12.5h1M7.5 16h1M14.5 13h2M14.5 16.5h2" /></>, className);
export const IconLayers = ({ className }: IconProps) => bold(<><path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8 12 3.5Z" /><path d="m3.5 12 8.5 4.5 8.5-4.5" /><path d="m3.5 16 8.5 4.5 8.5-4.5" /></>, className);
export const IconPeople = ({ className }: IconProps) => bold(<><circle cx="9" cy="8" r="3" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9.5" r="2.3" /><path d="M15.5 14.6a4.5 4.5 0 0 1 5 4.9" /></>, className);
export const IconPriceTag = ({ className }: IconProps) => bold(<><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0L3.5 12.2Z" /><circle cx="8" cy="8" r="1.6" /></>, className);
export const IconPrint = ({ className }: IconProps) => bold(<><path d="M7 8.5V3.5h10v5" /><rect x="3.5" y="8.5" width="17" height="8" rx="2" /><path d="M7 14.5h10v6H7z" /></>, className);
export const IconTick = ({ className }: IconProps) => bold(<path d="m4.5 12.5 5 5L19.5 7" />, className);
export const IconReject = ({ className }: IconProps) => bold(<><circle cx="12" cy="12" r="8.5" /><path d="m6 6 12 12" /></>, className);

/** ⋯ The header's menu (plan v17). */
export const IconDots = ({ className }: IconProps) => base(<><circle cx="5.5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="18.5" cy="12" r="1.6" fill="currentColor" /></>, className);
/** Back arrow for a screen's title bar (plan v17). */
export const IconBack = ({ className }: IconProps) => base(<><path d="M19.5 12h-15" /><path d="m10.5 6-6 6 6 6" /></>, className);
/** Rows of tags that scroll sideways (All tags, plan v13). */
export const IconRows = ({ className }: IconProps) => base(<><rect x="3.5" y="5" width="5" height="5.5" rx="1" /><rect x="10" y="5" width="5" height="5.5" rx="1" /><path d="M16.5 5h4M16.5 10.5h4" /><rect x="3.5" y="13.5" width="5" height="5.5" rx="1" /><rect x="10" y="13.5" width="5" height="5.5" rx="1" /><path d="M16.5 13.5h4M16.5 19h4" /></>, className);
/** Plan v18: no internet (Wi-Fi arcs, crossed out). */
export const IconWifiOff = ({ className }: IconProps) => bold(<><path d="M2.5 8.8a14.5 14.5 0 0 1 4-2.6M10 5.1a14.6 14.6 0 0 1 11.5 3.7M5.4 12.4a9.6 9.6 0 0 1 3.3-2M13.8 9.9a9.6 9.6 0 0 1 4.8 2.5M8.8 15.9a4.8 4.8 0 0 1 6.4 0" /><path d="M12 19.5h.01" /><path d="m3.5 3.5 17 17" /></>, className);
/** Plan v18: a sale saved on the phone, going up to the shop. */
export const IconUpload = ({ className }: IconProps) => bold(<><path d="M7.5 18.5H6.8a4.3 4.3 0 0 1-.6-8.6 6 6 0 0 1 11.6 0 4.3 4.3 0 0 1-.6 8.6h-.7" /><path d="M12 20.5v-8M9 15l3-3 3 3" /></>, className);
/** Plan v18: try again. */
export const IconRetry = ({ className }: IconProps) => bold(<><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></>, className);
