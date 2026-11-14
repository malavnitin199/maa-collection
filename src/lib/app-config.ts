export const APP_NAME = 'Maa Collection' as const;

/** Single shop for now; every record carries store_id so more can be added later. */
export const STORE_ID = 'maa-collection' as const;
export const STORE_NAME = 'Maa Collection' as const;
/** "Today" and "this month" are computed in the shop's time zone, not the server's. */
export const STORE_TIMEZONE = 'Asia/Kolkata' as const;
/** Items at or below this stock count show as low stock. */
export const LOW_STOCK_THRESHOLD = 2;
