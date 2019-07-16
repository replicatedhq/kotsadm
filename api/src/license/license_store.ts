import * as pg from "pg";
import * as _ from "lodash";
import * as yaml from "js-yaml";
import { Params } from "../server/params";
import { ReplicatedError } from "../server/errors";
import { License } from "./";
import { Entitlement } from './';

export class LicenseStore {
  constructor(
    private readonly pool: pg.Pool,
    private readonly params: Params,
  ) {
  }

  public async getLatestLicense(watchId: string): Promise<any> {
    
  }

  public getEntitlementsFromState(stateJSON: string): Array<Entitlement> {
    try {
      const doc = yaml.safeLoad(stateJSON);
      const entitlements = doc.v1.upstreamContents.appRelease.entitlements;
      const entitlementSpec = yaml.safeLoad(doc.v1.upstreamContents.appRelease.entitlementSpec);

      const entitlementsWithNames: Array<Entitlement> = [];
      entitlements.values.forEach(entitlement => {
        const spec: any = _.find(entitlementSpec, ["key", entitlement.key]);
        entitlementsWithNames.push({
          key: entitlement.key,
          value: entitlement.value,
          name: spec.name
        });
      });
      return entitlementsWithNames;
    } catch (err) {
      return [];
    }
  }
}
