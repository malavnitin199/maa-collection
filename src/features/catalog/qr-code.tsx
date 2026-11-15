import QRCode from 'qrcode';

/**
 * QR code drawn as SVG squares (crisp when printed). Error correction M copes
 * with a creased or slightly dirty tag. 2-module white margin; the tag around
 * it is white too.
 */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  let path = '';
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) if (modules.get(row, col)) path += `M${col} ${row}h1v1h-1z`;
  }
  return (
    <svg role="img" aria-label={label} viewBox={`-2 -2 ${n + 4} ${n + 4}`} shapeRendering="crispEdges" className={className}>
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
