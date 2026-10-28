import { useTranslation } from "react-i18next";
import { getCustomer } from "@/api/customers";
import type { Customer, StampResponse } from "@/types/api";
import {
  LEVEL_UP_READ_MS,
  freshCustomerOnLevelUp,
  levelUpOf,
  levelUpSuccess,
  type LevelUpSuccess,
  type LevelUpSuccessInput,
} from "./levels";
import { levelsTranslate } from "./translate";

/**
 * What a scan flow does about a level-up, in one call: re-read the customer
 * after a scan that moved them up, say whether the scan was a level milestone
 * for the haptic, and describe the success screen.
 */
export function useLevelUpSuccess(businessId: string, enrollmentId: string) {
  const { t } = useTranslation("stamp");
  return {
    /** The re-read customer (null when nobody moved or the read failed) and whether the scan moved them up. */
    async afterScan(
      result: Pick<StampResponse, "level_before" | "level_after">
    ): Promise<{ fresh: Customer | null; movedUp: boolean }> {
      const fresh = await freshCustomerOnLevelUp(result, () =>
        getCustomer(businessId, enrollmentId, { timeoutMs: LEVEL_UP_READ_MS })
      );
      return { fresh, movedUp: levelUpOf(result.level_before, result.level_after) !== null };
    },
    forSuccess(input: Omit<LevelUpSuccessInput, "translate">): LevelUpSuccess {
      return levelUpSuccess({ ...input, translate: levelsTranslate(t) });
    },
  };
}
