import pg from "pg";
import request from "request-promise";
import { Params } from "../server/params";
import { ReplicatedError } from "../server/errors";
import { KLicense } from "./";
import { getLicenseInfoFromYaml } from "../util/utilities";

export class KotsLicenseStore {
  constructor(
    private readonly pool: pg.Pool,
    private readonly params: Params,
  ) {
  }

  public async getAppLicense(appId: string): Promise<KLicense> {
    try {
      // Get current app license
      const q = `select kots_license as license from app_version where app_id = $1`;
      const v: any[] = [appId];

      const result = await this.pool.query(q, v);
      if (result.rows.length === 0) {
        throw new ReplicatedError(`No license found for app with an ID of ${appId}`);
      }

      return getLicenseInfoFromYaml(result.rows[0].license);
    } catch (err) {
      throw new ReplicatedError(`Failed to get app license ${err}`);
    }
  }

  public async getLatestAppLicense(licenseId: string): Promise<KLicense> {
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
          kotsLicense (licenseId: $licenseId) {
            id
            createdAt
            expiresAt
            type
            channel
            entitlements {
              name
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

    return responseJson.data.kotsLicense;
  }

  public async syncAppLicense(appId: string, licenseId: string): Promise<KLicense> {
    try {
      const latestAppLicense = await this.getLatestAppLicense(licenseId);

      const q = `insert into app_license (app_id, license, license_updated_at) values($1, $2, $3)
      on conflict (app_id) do update set license = EXCLUDED.license, license_updated_at = EXCLUDED.license_updated_at`;
      const v: any[] = [appId, latestAppLicense, new Date()];

      await this.pool.query(q, v);

      return latestAppLicense;
    } catch (err) {
      throw new ReplicatedError("Error syncing license, please try again.");
    }
  }
}
