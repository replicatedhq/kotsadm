import { Context } from "../../context";
import { Stores } from "../../schema/stores";
import * as _ from "lodash";

export function LicenseQueries(stores: Stores) {
  return {
    async getLatestLicense(root: any, { watchId }, context: Context) {
      return {};
    },
  };
}
