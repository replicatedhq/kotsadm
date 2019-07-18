import * as pg from "pg";
import * as _ from "lodash";
import * as yaml from "js-yaml";
import * as request from "request-promise";
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

  public async getWatchLicense(watchId: string, entitlementSpec: string): Promise<License> {
    try {
      // Get current watch license
      const q = `select * from watch_license where watch_id = $1`;
      const v: any[] = [watchId];

      const result = await this.pool.query(q, v);
      if (result.rows.length === 0) {
        throw new ReplicatedError("Not found");
      }
      const currentWatchLicense = JSON.parse(result.rows[0].license);
      currentWatchLicense.entitlements = this.getEntitlementsWithNames(currentWatchLicense.entitlements, entitlementSpec);

      return currentWatchLicense;
    } catch (err) {
      throw new ReplicatedError(`Failed to get latest watch license ${err}`);
    }
  }

  public async getLatestWatchLicense(licenseId: string, entitlementSpec: string): Promise<License> {
    // Get latest watch license
    const options = {
      method: "POST",
      uri: this.params.graphqlPremEndpoint,
      headers: {
        "User-Agent": "Replicated",
        "Authorization": `Basic ${new Buffer(licenseId + ":").toString('base64')}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        query: `query($licenseId: String) {
          latestWatchLicense (licenseId: $licenseId) {
            id
            createdAt
            expiresAt
            type
            channel
            entitlements {
              key
              value
            }
          }
        }`,
        variables: {
          licenseId
        }
      })
    };
    const response = await request(options);
    const responseJson = JSON.parse(response);

    const latestWatchLicense = responseJson.data.getLatestWatchLicense;
    latestWatchLicense.entitlements = this.getEntitlementsWithNames(latestWatchLicense.entitlements, entitlementSpec);

    return latestWatchLicense;
  }

  public async syncWatchLicense(watchId: string, licenseId: string, entitlementSpec: string): Promise<License> {
    try {
      const latestWatchLicense = await this.getLatestWatchLicense(licenseId, entitlementSpec);

      const q = `update watch_license set license = $1, license_updated_at = $2 where watch_id = $3`;
      const v: any[] = [latestWatchLicense, new Date(), watchId];

      await this.pool.query(q, v);

      return latestWatchLicense;
    } catch (err) {
      throw new ReplicatedError(err);
    }
  }

  public getEntitlementsWithNames(entitlements: Array<Entitlement>, entitlementSpec: string): Array<Entitlement> {
    try {
      const entitlementSpecJSON = yaml.safeLoad(entitlementSpec);

      const entitlementsWithNames: Array<Entitlement> = [];
      entitlements.forEach(entitlement => {
        const spec: any = _.find(entitlementSpecJSON, ["key", entitlement.key]);
        if (spec) {
          entitlementsWithNames.push({
            key: entitlement.key,
            value: entitlement.value,
            name: spec.name
          });
        }
      });
      return entitlementsWithNames;
    } catch (err) {
      console.log(err);
      return [];
    }
  }
}
