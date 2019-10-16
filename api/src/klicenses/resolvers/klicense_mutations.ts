import { Context } from "../../context";
import { Stores } from "../../schema/stores";

export function KotsLicenseMutations(stores: Stores) {
  return {
    async syncAppLicense(root: any, { appId, licenseId }, context: Context) {
      return await stores.kotsLicenseStore.syncAppLicense(appId, licenseId);
    },
  }
}
