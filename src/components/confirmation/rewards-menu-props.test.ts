/**
 * Every RewardsMenu in a flow must be told about held rewards.
 *
 * `canRedeem` on the points screens is true when the customer holds a reward,
 * even with nothing on the ladder affordable. The menu that opens therefore has
 * to be able to show that reward — otherwise "Redeem now" leads to a sheet of
 * locked prices and the employee cannot hand over the thing the customer is
 * visibly holding.
 *
 * PointsFlow renders the menu twice, once for the entry screen and once after
 * points are added. The second one was missing the held-reward props, which is
 * a defect no type-check catches: they are optional, because the STAMP flow's
 * menu legitimately has no ladder. A source check is the honest guard.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(
  join(import.meta.dir, 'PointsFlow.tsx'),
  'utf8'
);

/** Every `<RewardsMenu ... />` element in the file, as raw text. */
function rewardsMenuElements(source: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf('<RewardsMenu', from);
    if (start === -1) break;
    const end = source.indexOf('/>', start);
    if (end === -1) break;
    out.push(source.slice(start, end + 2));
    from = end + 2;
  }
  return out;
}

describe('PointsFlow rewards menus', () => {
  const menus = rewardsMenuElements(SOURCE);

  test('the scan actually finds both menus', () => {
    // A parser that quietly matched nothing would pass every check below.
    expect(menus.length).toBe(2);
  });

  test.each(['heldRewards', 'onRedeemHeld', 'redeemingHeldId'])(
    'every menu receives %s',
    (prop) => {
      const missing = menus.filter((m) => !m.includes(prop));
      expect(missing).toEqual([]);
    }
  );

  test('the balance each menu shows is its own screen\'s balance', () => {
    // The post-add menu must price the ladder against the NEW balance, not the
    // one from before the points landed.
    const [afterAdd, entry] = menus;
    expect(afterAdd).toContain('balance={after}');
    expect(entry).toContain('balance={balance}');
  });
});
