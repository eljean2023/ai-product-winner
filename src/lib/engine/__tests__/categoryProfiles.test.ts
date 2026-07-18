import { describe, expect, it } from "vitest";
import { findCategoryProfile } from "../categoryProfiles";

describe("findCategoryProfile — best-match, not first-match", () => {
  it("picks the more specific/longer-matching category over an earlier, more generic one", () => {
    // "gaming" alone (6 chars) matches the Gaming profile, which is listed
    // first in the category array — but "bluetooth speaker" + "speaker" +
    // "charger" together are a stronger, more specific match for
    // Electronics. Best-match scoring should pick Electronics; the old
    // first-match-wins behavior would have incorrectly picked Gaming.
    const profile = findCategoryProfile("gaming bluetooth speaker charger");
    expect(profile?.category).toBe("Electronics");
  });

  it("still matches a single unambiguous keyword", () => {
    expect(findCategoryProfile("ergonomic office chair with footrest")?.category).toBe("Office");
  });

  it("returns null when nothing matches", () => {
    expect(findCategoryProfile("1234567890 asdfghjkl qwerty")).toBeNull();
  });
});
