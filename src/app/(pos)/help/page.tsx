import Link from 'next/link';
import { card, link, muted, sectionTitle } from '@/components/ui/styles';

export const metadata = { title: 'Help · Maa Collection' };

function Section({ id, title, intro, children, open = false }: { id: string; title: string; intro: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details id={id} open={open} className={`${card} scroll-mt-20`}>
      <summary className="cursor-pointer list-none">
        <span className="text-lg font-semibold">{title}</span>
        <span className={`block text-sm ${muted}`}>{intro}</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed">{children}</div>
    </details>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">{i + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

const Tip = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">💡 {children}</p>
);

export default function HelpPage() {
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Help & guide</h1>
        <p className={`text-sm ${muted}`}>Tap a section to open it. Start with &ldquo;New here?&rdquo;.</p>
      </div>

      <nav aria-label="Help sections" className="flex flex-wrap gap-2 text-sm">
        {[
          ['#start', 'New here?'],
          ['#sell', 'Selling'],
          ['#catalog', 'Catalog & old stock'],
          ['#owner', 'Owner'],
          ['#required', 'Required vs optional'],
          ['#tips', 'Tips'],
          ['#faq', 'Problems & fixes'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-zinc-300 px-3 py-1 dark:border-zinc-700">
            {label}
          </a>
        ))}
      </nav>

      <Section id="start" title="New here? Start in 2 minutes" intro="Logging in, the tabs, and setting up your phone." open>
        <Steps
          items={[
            <>Open the app on your phone and tap <strong>your name</strong>, then type your <strong>PIN</strong> (the owner gives it to you).</>,
            <>Add it to your home screen: in Chrome tap ⋮ → <em>Add to Home screen</em>; on iPhone tap Share → <em>Add to Home Screen</em>. It then opens like an app.</>,
            <>Use the tabs at the bottom: <strong>Sell</strong> (scan and sell), <strong>Exchange</strong>, <strong>My sales</strong>. If the owner gave you catalog work you also see <strong>Catalog</strong>.</>,
            <>To scan, tap <strong>Scan with camera</strong> and allow the camera once. Hold the barcode flat inside the green box, 15–20 cm away.</>,
            <>Done for the day? Tap <strong>Log out</strong> at the top, especially on a shared phone.</>,
          ]}
        />
        <Tip>Can&apos;t log in? Ask the owner to reset your PIN in Staff & permissions.</Tip>
      </Section>

      <Section id="sell" title="Selling and exchanges" intro="For every salesman.">
        <h3 className="font-semibold">Sell an item</h3>
        <Steps
          items={[
            <>Tab <strong>Sell</strong> → scan the tag (camera or USB/Bluetooth scanner) or type the code under the barcode.</>,
            <>Check the photo, size and colour match the item in your hand.</>,
            <>Tap <strong>Sell this item</strong>, set quantity and the price agreed with the customer (up to MRP).</>,
            <>Selling for a colleague? Choose them in <strong>Credit sale to</strong>. It is recorded that you entered it.</>,
            <>Tap <strong>Record sale</strong>. Stock goes down straight away on every phone.</>,
          ]}
        />
        <h3 className="font-semibold">Exchange</h3>
        <Steps
          items={[
            <>Tab <strong>Exchange</strong> → scan the item the customer brought back → choose the sale it came from.</>,
            <>Scan the new item → check the price → the app shows <em>Customer pays ₹…</em> or <em>Give back ₹…</em>.</>,
            <>Tap <strong>Confirm exchange</strong>. The returned piece goes back into stock automatically.</>,
          ]}
        />
        <Tip>&ldquo;My sales&rdquo; shows your totals for today and this month, including sales you entered for others.</Tip>
      </Section>

      <Section id="catalog" title="Catalog & old stock (catalog / QC person)" intro="Photos, details, barcodes and labels — including stock already in the shop.">
        <p>The owner turns this on for you in <em>Staff & permissions</em> (right: <strong>Catalog</strong>). Then open <strong>Catalog → Tag old stock</strong>.</p>
        <h3 className="font-semibold">Tag one item (about 30 seconds)</h3>
        <Steps
          items={[
            <>Item already has a <strong>barcode from the company</strong>? Tap <strong>Scan the tag&apos;s barcode</strong> first — the app uses it (no new sticker) or tells you if the item is already in the app.</>,
            <><strong>📷 Take photo</strong> of the item (1–4 photos). Good light, plain background, whole item visible.</>,
            <>Choose the <strong>category</strong>, type the <strong>name</strong> (e.g. &ldquo;Phulkari Dupatta&rdquo;), tap a <strong>size</strong>, add the <strong>colour</strong>.</>,
            <>Enter <strong>MRP</strong>, the <strong>selling price</strong> (leave empty = MRP) and <strong>pieces counted</strong>.</>,
            <>Tap <strong>Save and get barcode</strong>. The label appears.</>,
            <>Tap <strong>Next item →</strong>. Category, company and size stay filled in for the next one.</>,
            <>At the end: <strong>Print today&apos;s labels</strong> → one label per piece → stick one on each piece. Using a sticker printer? Choose <strong>Sticker printer 50×25 mm</strong> before printing.</>,
          ]}
        />
        <Tip>Same item in several sizes or colours? Use <Link href="/admin/stock/new" className={link}>New design in sizes × colours</Link>: one entry creates all of them.</Tip>
        <h3 className="font-semibold">New deliveries and more stock</h3>
        <ul className="list-disc pl-5">
          <li><strong>Many different products from one company</strong> → Add stock → Many different products.</li>
          <li><strong>More pieces of items you already have</strong> → Add stock → More of existing items (needs the <em>Stock</em> right). Scanning the same tag again adds one more piece.</li>
          <li><strong>Edit a product or its photos</strong> → Products → tap the item.</li>
          <li><strong>What&apos;s left to fix?</strong> → Catalog → <strong>Needs attention</strong>: items without photo, company or stock.</li>
        </ul>
      </Section>

      <Section id="owner" title="For the owner" intro="Set-up, permissions, prices and reports.">
        <Steps
          items={[
            <><strong>Companies & categories</strong>: Menu → Companies / Categories. Add the companies you buy from and the kinds of items you sell.</>,
            <><strong>Staff & permissions</strong>: add each person with a PIN. Tick extra rights per salesman: <em>Catalog</em> (products, photos, labels), <em>Prices</em> (change MRP/selling price), <em>Stock</em> (receive stock), <em>Purchase price</em> (see the code price — trusted staff only).</>,
            <><strong>Code price</strong>: Settings → choose a 10-letter word; labels then show the purchase price in letters only your staff can read.</>,
            <><strong>Rates</strong>: open any product → Rates for the whole design. Past sales keep their prices.</>,
            <><strong>Track</strong>: Home shows today and this month, sales per salesperson, low stock; Activity lists every sale and exchange.</>,
            <><strong>Reports</strong>: best sellers, what is not selling, sales by category / company / salesperson for any period, and <strong>CSV downloads</strong> (sales, stock) for your accountant.</>,
          ]}
        />
      </Section>

      <Section id="required" title="What is required and what is optional" intro="So you don't waste time on fields you can skip.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={muted}>
              <tr>
                <th className="py-1 pr-3 font-medium">When</th>
                <th className="py-1 pr-3 font-medium">Required</th>
                <th className="py-1 font-medium">Optional</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-3">Tag old stock</td>
                <td className="py-2 pr-3">Category, name, MRP, pieces</td>
                <td className="py-2">Photo (recommended), size (= Free), colour, company, selling price (= MRP), purchase price</td>
              </tr>
              <tr className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-3">Quick add</td>
                <td className="py-2 pr-3">Company, category, each name and MRP</td>
                <td className="py-2">Brand, bill no., selling/purchase price, size, colour</td>
              </tr>
              <tr className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-3">Sale</td>
                <td className="py-2 pr-3">Scan, quantity, price</td>
                <td className="py-2">Credit to a colleague</td>
              </tr>
              <tr className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-3">Company</td>
                <td className="py-2 pr-3">Name</td>
                <td className="py-2">Contact, phone, GSTIN, notes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="tips" title="Tips & suggestions" intro="How to move all existing stock into the app quickly.">
        <h3 className="font-semibold">Plan for old stock</h3>
        <Steps
          items={[
            <>Go <strong>shelf by shelf</strong> (one category at a time) — the app keeps the category for the next item.</>,
            <>Count the pieces of one design and size together, tag them as one item with that count.</>,
            <>Print <strong>today&apos;s labels</strong> at the end of each session and stick them the same day, so nothing is mixed up.</>,
            <>Put labels in the same place on every item (e.g. on the price tag or inside the collar).</>,
            <>Two catalog people can work at the same time on different shelves.</>,
          ]}
        />
        <h3 className="font-semibold">Good habits</h3>
        <ul className="list-disc pl-5">
          <li>Always check the photo at the counter before recording a sale.</li>
          <li>Use one name for one design (&ldquo;Cotton Straight Kurta&rdquo;), so sizes and colours group together.</li>
          <li>Give the <em>Purchase price</em> right only to people the owner fully trusts.</li>
          <li>Printing from a phone: open the labels page → Print → choose your printer or &ldquo;Save as PDF&rdquo;.</li>
        </ul>
      </Section>

      <Section id="faq" title="Problems & fixes" intro="Camera, scanner, PIN, printing.">
        <dl className="flex flex-col gap-3">
          {[
            ['The camera does not open', 'Allow the camera for this site in the browser settings and reload. It only works on the https:// address.'],
            ['The camera does not read the barcode', 'Hold the label flat in the green box, 15–20 cm away, in good light, and wait a second for focus. You can always type the number under the barcode.'],
            ['"No item found"', 'This item has no label in the app yet. A catalog person can tag it with Tag old stock.'],
            ['"Only N left in stock"', 'Stock in the app is lower than on the shelf. Ask a person with the Stock right to receive the missing pieces.'],
            ['I cannot see Catalog or Prices', 'The owner has not given you that right. Ask them to tick it in Staff & permissions.'],
            ['Wrong PIN', 'Check your name is selected. The owner can set a new PIN.'],
            ['Photo will not upload', 'Try a smaller photo or better signal; photos are reduced automatically. Up to 8 photos per product.'],
          ].map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold">{q}</dt>
              <dd className={muted}>{a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <p className={`text-center text-xs ${muted}`}>
        Still stuck? Tell the owner what you tapped and what you saw. <Link href="/pos" className={link}>Back to selling</Link>
      </p>
      <h2 className={`${sectionTitle} sr-only`}>End of help</h2>
    </main>
  );
}
