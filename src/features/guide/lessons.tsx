import {
  CountArt,
  DesignGridArt,
  ExchangeArt,
  LoginArt,
  PhotoArt,
  PricesArt,
  PrintArt,
  QrArt,
  ReportArt,
  ScanArt,
  StockFlowArt,
  TeamArt,
} from './illustrations';

export type Audience = 'everyone' | 'sellers' | 'stock' | 'owner';

export type Lesson = {
  id: string;
  title: string;
  audience: Audience;
  minutes: number;
  /** Why this matters, in one line. */
  intro: string;
  art?: React.ReactNode;
  steps: React.ReactNode[];
  /** Screens to try it on. */
  open?: { href: string; label: string }[];
  tip?: React.ReactNode;
  /** Extra content under the steps (tables, the tag picture). */
  extra?: 'tag-anatomy' | 'routine';
};

export const AUDIENCES: { id: Audience; label: string; who: string }[] = [
  { id: 'everyone', label: 'Everyone', who: 'Start here' },
  { id: 'sellers', label: 'Selling', who: 'Every salesman' },
  { id: 'stock', label: 'Stock & tags', who: 'Catalog / stock people' },
  { id: 'owner', label: 'Owner', who: 'Owner and trusted staff' },
];

export const LESSONS: Lesson[] = [
  {
    id: 'start',
    title: 'Log in and find your way',
    audience: 'everyone',
    minutes: 2,
    intro: 'Your name, your PIN, and the tabs at the bottom of the screen.',
    art: <LoginArt />,
    steps: [
      <>Open the app and tap <strong>your name</strong>, then type your <strong>PIN</strong> (the owner gives it to you).</>,
      <>Put it on your home screen: Chrome ⋮ → <em>Add to Home screen</em>; iPhone Share → <em>Add to Home Screen</em>. It then opens like an app.</>,
      <>Use the tabs at the bottom: <strong>Sell</strong>, <strong>Exchange</strong>, <strong>My sales</strong> — plus <strong>Catalog</strong> or <strong>+ Stock</strong> if the owner gave you those rights.</>,
      <>Finished on a shared phone? Tap <strong>Log out</strong> at the top.</>,
    ],
    open: [{ href: '/pos', label: 'Open Sell' }],
    tip: <>Can&apos;t log in? The owner can set a new PIN in Staff &amp; permissions.</>,
  },
  {
    id: 'tag',
    title: 'Read a tag',
    audience: 'everyone',
    minutes: 1,
    intro: 'Every piece wears a tag. Here is what each part means.',
    steps: [],
    extra: 'tag-anatomy',
    open: [{ href: '/admin/labels', label: 'See all tags' }],
  },
  {
    id: 'sell',
    title: 'Sell an item',
    audience: 'sellers',
    minutes: 2,
    intro: 'Scan, check, agree the price, record. Stock goes down on every phone at once.',
    art: <ScanArt />,
    steps: [
      <>Tab <strong>Sell</strong> → tap <strong>Scan with camera</strong> (or use the USB/Bluetooth scanner, or type the number under the barcode).</>,
      <>Check the <strong>photo, size and colour</strong> match the piece in your hand.</>,
      <>Tap <strong>Sell this item</strong> → quantity → the <strong>price you agreed</strong> with the customer (never above MRP).</>,
      <>Selling for a colleague? Pick them in <strong>Credit sale to</strong>.</>,
      <>Tap <strong>Record sale</strong>. Done — see it in <strong>My sales</strong>.</>,
    ],
    open: [
      { href: '/pos', label: 'Open Sell' },
      { href: '/pos/my-sales', label: 'My sales' },
    ],
    tip: <>Camera won&apos;t read it? Hold the tag flat, 15–20 cm away, in good light — or type the number.</>,
  },
  {
    id: 'qr',
    title: 'Open an item from its QR code',
    audience: 'everyone',
    minutes: 1,
    intro: 'Point your normal phone camera at the QR code on a tag — the item opens in the app.',
    art: <QrArt />,
    steps: [
      <>Open the phone&apos;s <strong>camera</strong> (no app needed) and point it at the <strong>QR code</strong> on the tag.</>,
      <>Tap the link that appears. You must be logged in on that phone.</>,
      <>Salesmen land on <strong>Sell</strong> with the item ready; catalog/stock people and the owner land on the <strong>product page</strong> (photos, stock, prices).</>,
      <>The in-app scanner and USB scanners read the QR code too — it works just like the barcode.</>,
    ],
    tip: <>Customers who scan it only see the login page — no prices or stock are shown to them.</>,
  },
  {
    id: 'exchange',
    title: 'Exchange an item',
    audience: 'sellers',
    minutes: 2,
    intro: 'The returned piece goes back into stock; the new one goes out — one step.',
    art: <ExchangeArt />,
    steps: [
      <>Tab <strong>Exchange</strong> → scan the piece the customer brought back → pick the sale it came from.</>,
      <>Scan the new piece → check the price.</>,
      <>The app shows <em>Customer pays ₹…</em> or <em>Give back ₹…</em>. Tap <strong>Confirm exchange</strong>.</>,
    ],
    open: [{ href: '/pos/exchange', label: 'Open Exchange' }],
    tip: <>Never fix stock by hand after an exchange — the app already did it.</>,
  },
  {
    id: 'new-design',
    title: 'New stock: one design in sizes × colours',
    audience: 'stock',
    minutes: 3,
    intro: 'One entry makes every size and colour, each with its own barcode and tag.',
    art: <DesignGridArt />,
    steps: [
      <><strong>+ Stock</strong> → <strong>One design in sizes × colours</strong>. Choose the company and category.</>,
      <>Type the design name (one name per design, e.g. &ldquo;Cotton Straight Kurta&rdquo;), tap the <strong>sizes</strong> (the category&apos;s sizes come first) and add the <strong>colours</strong>.</>,
      <>Enter <strong>MRP</strong>, <strong>selling price</strong> (empty = MRP), <strong>purchase price</strong> and <strong>pieces each</strong>.</>,
      <>Bigger sizes cost more? Open <strong>Price by size</strong> and type that size&apos;s own prices — grey = default, green = the size&apos;s own. Every colour of that size gets it.</>,
      <>Check the <strong>preview</strong>, then <strong>Save and print labels</strong>.</>,
    ],
    open: [
      { href: '/admin/stock/new', label: 'New design' },
      { href: '/admin/stock/quick', label: 'Many different products' },
    ],
    tip: <>Many different products from one company? Use <strong>Many different products</strong> instead — one card each.</>,
  },
  {
    id: 'print',
    title: 'Print and attach tags',
    audience: 'stock',
    minutes: 2,
    intro: 'One tag per piece, the same day the goods are entered.',
    art: <PrintArt />,
    steps: [
      <>After saving, the <strong>Labels</strong> page opens. Or later: <strong>print today&apos;s labels</strong>.</>,
      <>Pick the format: <strong>Tags on A4</strong> (16 per page, 40 × 60 mm — cut and punch the circle), <strong>Tag printer 40×60 mm</strong>, or the small <strong>Sticker printer 50×25 mm</strong>.</>,
      <>Tap <strong>Print</strong> → choose the printer (or &ldquo;Save as PDF&rdquo;). One tag per piece by default.</>,
      <>Attach each tag to its piece with the thread through the hole, in the same place on every item.</>,
    ],
    open: [{ href: '/admin/labels/print?mine=today', label: "Today's labels" }],
    tip: <>Print and attach in the same session so tags never get mixed up between sizes.</>,
  },
  {
    id: 'old-stock',
    title: 'Tag stock already in the shop',
    audience: 'stock',
    minutes: 3,
    intro: 'Photo → details → barcode, about 30 seconds per item.',
    art: <PhotoArt />,
    steps: [
      <><strong>Catalog → Tag old stock</strong>. Item already has a company barcode? <strong>Scan it first</strong> — the app uses it.</>,
      <><strong>📷 Take photo</strong> (1–4): good light, plain background, whole item.</>,
      <>Category, name, size, colour, <strong>MRP</strong> and <strong>pieces counted</strong>.</>,
      <><strong>Save and get barcode</strong> → <strong>Next item →</strong> (category and company stay filled in).</>,
      <>At the end: <strong>print today&apos;s labels</strong>.</>,
    ],
    open: [{ href: '/admin/stock/old', label: 'Tag old stock' }],
    tip: <>Go shelf by shelf, one category at a time. Two people can work on different shelves together.</>,
  },
  {
    id: 'restock',
    title: 'More pieces of items you already have',
    audience: 'stock',
    minutes: 1,
    intro: 'Scan each new piece: every scan adds one.',
    art: <CountArt />,
    steps: [
      <><strong>+ Stock → More of existing items</strong> (needs the <em>Stock</em> right).</>,
      <>Scan each piece — the same tag again adds one more. Or search by name and tap <strong>+</strong>.</>,
      <>Add the company bill number, then <strong>Receive … pieces and print labels</strong>.</>,
    ],
    open: [{ href: '/admin/stock/receive', label: 'Receive stock' }],
  },
  {
    id: 'inventory',
    title: 'Managing your inventory',
    audience: 'owner',
    minutes: 4,
    intro: 'A simple daily and weekly routine keeps the app and the shelves the same.',
    art: <StockFlowArt />,
    steps: [
      <><strong>Every piece has a tag</strong> — no tag, no sale. Untagged piece found? Tag it with <em>Tag old stock</em>.</>,
      <><strong>Never sell without scanning</strong>, so stock is always right on every phone.</>,
      <><strong>Stock only changes</strong> by receiving, selling and exchanging — so every number has a history (open a product → Stock history).</>,
      <><strong>One name per design</strong>, so sizes and colours stay together and the size row on tags is right.</>,
    ],
    extra: 'routine',
    open: [
      { href: '/admin/catalog/check', label: 'Needs attention' },
      { href: '/admin/dashboard', label: 'Home (low stock)' },
      { href: '/admin/reports', label: 'Reports' },
    ],
  },
  {
    id: 'prices',
    title: 'Prices, price by size and the code price',
    audience: 'owner',
    minutes: 2,
    intro: 'MRP is the ceiling; each sale records the price actually agreed.',
    art: <PricesArt />,
    steps: [
      <>Change rates: open any product → <strong>Rates for the whole design</strong>. Change the default or one size under <strong>Price by size</strong> → <strong>Apply</strong>.</>,
      <>Every colour of a size always gets the same price. Past sales keep the price they were sold at.</>,
      <><strong>Code price</strong>: Settings → a 10-letter word. Tags then show the purchase price in letters only your staff can read.</>,
    ],
    open: [
      { href: '/admin/products', label: 'Products' },
      { href: '/admin/settings', label: 'Settings' },
    ],
  },
  {
    id: 'team',
    title: 'Staff and permissions',
    audience: 'owner',
    minutes: 2,
    intro: 'Give each person exactly the rights they need.',
    art: <TeamArt />,
    steps: [
      <><strong>Staff &amp; permissions</strong> → add a person with a PIN.</>,
      <>Tick rights: <em>Catalog</em> (products, photos, tags), <em>Prices</em> (change rates), <em>Stock</em> (receive goods), <em>Purchase price</em> (trusted staff only).</>,
      <>Someone leaves? <strong>Deactivate</strong> them — their past sales stay.</>,
    ],
    open: [{ href: '/admin/staff', label: 'Staff & permissions' }],
  },
  {
    id: 'reports',
    title: 'Reports and the accountant export',
    audience: 'owner',
    minutes: 2,
    intro: 'What sells, what doesn’t, who sold it — and a file for the accountant.',
    art: <ReportArt />,
    steps: [
      <><strong>Reports</strong> → choose Today / 7 days / 30 days / month.</>,
      <>Best sellers → reorder. <strong>Not selling</strong> → move to the front or discount.</>,
      <>Sales by category, company and salesperson.</>,
      <><strong>Download CSV</strong> (sales, stock) and send it to the accountant — opens in Excel.</>,
    ],
    open: [{ href: '/admin/reports', label: 'Reports' }],
  },
];
