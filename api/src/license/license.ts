import { Stores } from "../schema/stores";
import { Context } from "../context";
import { Entitlement } from './';
import * as _ from "lodash";


export class License {
  public channel: string;
  public createdAt: string;
  public expiresAt: string;
  public type: string;
  public entitlements?: Array<Entitlement>;

  public toSchema(root: any, stores: Stores, context: Context): any {
    return {
      ...this,
    };
  }
}
