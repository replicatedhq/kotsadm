import pg from "pg";

import { Params } from "../server/params";
import { ReplicatedError } from "../server/errors";

export class BackupStore {
  constructor(
    private readonly pool: pg.Pool
  ) {}

  async getKotsBackupSpec(appId: string, sequence: number): Promise<string> {
    const q = `
      SELECT backup_spec FROM app_version WHERE app_id = $1 AND sequence = $2
    `;

    const result = await this.pool.query(q, [appId, sequence]);

    if (result.rows.length === 0) {
      throw new ReplicatedError(`Unable to find Backup Spec with appId ${appId}`);
    }

    return result.rows[0].backup_spec;
  }
}
