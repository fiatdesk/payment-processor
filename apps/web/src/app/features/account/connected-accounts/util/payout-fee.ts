// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Display helpers for payout batch fees and deadlines. Fees arrive as wei
 * decimal strings; they are formatted with bigint arithmetic so large values
 * keep every digit.
 */

const WEI_PER_MICRO_ETH = BigInt('1000000000000');
const WEI_PER_GWEI = 1e9;

/** Wei as ETH with exactly 6 decimals, rounded half up: `0.003000`. */
export function FormatEth(wei: string | bigint): string {
  const value = BigInt(wei);
  const micro = (value + WEI_PER_MICRO_ETH / BigInt(2)) / WEI_PER_MICRO_ETH;
  const whole = micro / BigInt(1000000);
  const fraction = (micro % BigInt(1000000)).toString().padStart(6, '0');
  return `${whole.toString()}.${fraction}`;
}

/** The fee each recipient's payout carries: total / recipients, in wei. */
export function PerRecipientFee(wei: string, recipients: number): bigint {
  return BigInt(wei) / BigInt(Math.max(recipients, 1));
}

/** Wei per gas as gwei with up to 3 significant digits: `20`, `0.0123`. */
export function FormatGwei(wei: string): string {
  return (Number(wei) / WEI_PER_GWEI).toLocaleString('en-US', {
    maximumSignificantDigits: 3,
  });
}

/** Unix seconds as the viewer's local `HH:MM`. */
export function FormatClockTime(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
