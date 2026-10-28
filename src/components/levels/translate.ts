import type { TFunction } from "i18next";
import type { Translate } from "@/utils/levels";

/** Adapts the `stamp` namespace's `t` to the plain translate the level helpers take. */
export function levelsTranslate(t: TFunction<"stamp">): Translate {
  return (key, vars) => String(t(key as never, vars as never));
}
