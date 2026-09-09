import { describe, expect, test } from "bun:test";
import { protectedLanding } from "./protected-landing";

const base = {
  signedIn: true,
  membershipsResolved: true,
  membershipsFailed: false,
  atGroupRoot: true,
  hasCurrentBusiness: false,
  membershipCount: 0,
};

describe("protectedLanding", () => {
  test("a signed-in member with a selected shop goes to the lobby", () => {
    expect(
      protectedLanding({ ...base, hasCurrentBusiness: true, membershipCount: 1 }),
    ).toBe("/lobby");
  });

  test("several shops and none selected goes to the picker", () => {
    expect(protectedLanding({ ...base, membershipCount: 3 })).toBe("/businesses");
  });

  test("signed in on no team goes to the code screen", () => {
    // The business picker would just show an empty list.
    expect(protectedLanding(base)).toBe("/join");
  });

  test("nothing is decided away from the group root", () => {
    // Already on a real screen; redirecting would fight the user's navigation.
    expect(
      protectedLanding({ ...base, atGroupRoot: false, membershipCount: 2 }),
    ).toBeNull();
    expect(
      protectedLanding({
        ...base,
        atGroupRoot: false,
        hasCurrentBusiness: true,
        membershipCount: 1,
      }),
    ).toBeNull();
  });

  describe("when the membership fetch failed", () => {
    // A failed request resolves the list too -- the alternative was freezing
    // routing behind a network blip -- so `membershipCount` is 0 for a reason
    // that has nothing to do with who this employee works for. Reading that as
    // "on no team" put a scanner of four months on a code field, offline, with
    // no way back: the join screen's only exits are creating a business and
    // signing out.
    const failed = { ...base, membershipsFailed: true };

    test("an empty list is not read as being on no team", () => {
      expect(protectedLanding(failed)).not.toBe("/join");
    });

    test("it goes to the picker, which shows the error and a retry", () => {
      expect(protectedLanding(failed)).toBe("/businesses");
      // From any screen, like every other rule that answers an empty list.
      expect(protectedLanding({ ...failed, atGroupRoot: false })).toBe("/businesses");
    });

    test("a shop is still selected, so nothing moves", () => {
      // Refreshing in place failed; the employee keeps working with what the
      // app already had rather than being sent anywhere.
      expect(
        protectedLanding({ ...failed, hasCurrentBusiness: true }),
      ).toBeNull();
    });

    test("a list that came back empty still means no team", () => {
      expect(protectedLanding({ ...base, membershipsFailed: false })).toBe("/join");
    });
  });

  test("NO TEAM IS ANSWERED THE SAME WAY FROM EVERY SCREEN", () => {
    // The second half of the same bug. This rule used to run only at the group
    // root, so it decided nothing on a cold start: index sends a signed-in
    // person to the lobby, the lobby has no business so it bounced to the
    // picker, and the picker answered the empty list its own way. Same account,
    // same state, a different screen depending on how the app was opened.
    expect(protectedLanding({ ...base, atGroupRoot: false })).toBe("/join");
  });

  test("AN UNRESOLVED MEMBERSHIP LIST DECIDES NOTHING", () => {
    // The bug this exists for. An empty list means two completely different
    // things: "this person is on no team" and "we have not asked yet". The
    // context reports zero memberships and not-loading in the gap between a
    // session arriving and the fetch starting, so treating that as an answer
    // sent a scanner with a perfectly good membership to the join screen —
    // and /join sits outside this group, so the correction never ran.
    expect(protectedLanding({ ...base, membershipsResolved: false })).toBeNull();
    expect(
      protectedLanding({
        ...base,
        membershipsResolved: false,
        hasCurrentBusiness: true,
        membershipCount: 1,
      }),
    ).toBeNull();
  });

  test("SIGNING OUT NEVER ROUTES ANYWHERE", () => {
    // Same shape, other direction: sign-out clears memberships, which used to
    // look like "signed in, no team" and fired /join while the session was
    // tearing down.
    expect(protectedLanding({ ...base, signedIn: false })).toBeNull();
    expect(
      protectedLanding({
        ...base,
        signedIn: false,
        hasCurrentBusiness: true,
        membershipCount: 2,
      }),
    ).toBeNull();
  });

  test.each([true, false])(
    "signed out beats every other signal (resolved=%p)",
    (membershipsResolved) => {
      expect(
        protectedLanding({ ...base, signedIn: false, membershipsResolved }),
      ).toBeNull();
    },
  );

  test("the join screen is only ever reached from a resolved, signed-in, empty list", () => {
    // Guards the one destination that can strand someone outside the group.
    const joins = [true, false].flatMap((signedIn) =>
      [true, false].flatMap((membershipsResolved) =>
        [0, 1].map((membershipCount) => ({
          signedIn,
          membershipsResolved,
          membershipCount,
          result: protectedLanding({
            ...base,
            signedIn,
            membershipsResolved,
            membershipCount,
          }),
        })),
      ),
    );
    joins
      .filter((j) => j.result === "/join")
      .forEach((j) => {
        expect(j.signedIn).toBe(true);
        expect(j.membershipsResolved).toBe(true);
        expect(j.membershipCount).toBe(0);
      });
    expect(joins.some((j) => j.result === "/join")).toBe(true);
  });
});
