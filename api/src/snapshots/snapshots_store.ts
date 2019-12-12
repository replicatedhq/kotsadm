import pg from "pg";
import _ from "lodash";
import { Params } from "../server/params";

export class SnapshotStore {
  constructor(
    private readonly pool: pg.Pool,
    private readonly params: Params,
  ) {
  }
}
