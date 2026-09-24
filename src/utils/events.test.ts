import { describe, expect, it } from "vitest";
import {
  JIATING_MIXER_POINTS,
  JIATING_MIXER_SIX_WAY_POINTS,
  jiatingMixerPointValue,
} from "@/utils/events";

const six = ["jt-1", "jt-2", "jt-3", "jt-4", "jt-5", "jt-6"];

describe("jiatingMixerPointValue", () => {
  it("is 3 points when all 6 active Jiatings are selected", () => {
    expect(jiatingMixerPointValue(six, six)).toBe(JIATING_MIXER_SIX_WAY_POINTS);
  });

  it("is 2 points when any of the 6 is missing", () => {
    expect(jiatingMixerPointValue(six.slice(0, 5), six)).toBe(
      JIATING_MIXER_POINTS,
    );
    expect(jiatingMixerPointValue([], six)).toBe(JIATING_MIXER_POINTS);
  });

  it("stays 2 points unless there are exactly 6 active Jiatings", () => {
    expect(jiatingMixerPointValue(six.slice(0, 5), six.slice(0, 5))).toBe(
      JIATING_MIXER_POINTS,
    );
    expect(jiatingMixerPointValue([...six, "jt-7"], [...six, "jt-7"])).toBe(
      JIATING_MIXER_POINTS,
    );
  });
});
