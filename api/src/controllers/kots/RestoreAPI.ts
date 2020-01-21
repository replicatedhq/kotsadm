import { BodyParams, Controller, Get, HeaderParams, Put, Req, Res } from "@tsed/common";
import BasicAuth from "basic-auth";
import Express from "express";
import { KotsAppStore } from "../../kots_app/kots_app_store";
import { ClusterStore } from "../../cluster";

interface ErrorResponse {
  error: {};
}

@Controller("/api/v1/undeploy")
export class RestoreAPI {
  @Put("/result")
  async putUndeployResult(
    @Req() request: Express.Request,
    @Res() response: Express.Response,
    @HeaderParams("Authorization") auth: string,
    @BodyParams("") body: any,
  ): Promise<any | ErrorResponse> {
    const credentials: BasicAuth.Credentials = BasicAuth.parse(auth);

    let cluster;
    try {
      cluster = await (request.app.locals.stores.clusterStore as ClusterStore).getFromDeployToken(credentials.pass);
    } catch (err) {
      // TODO error type
      response.status(401);
      return {};
    }

    const status = body.is_error ? "failed" : "completed";
    console.log(`Restore API set RestoreUndeployStatus = ${status} for app ${body.app_id}`);
    await (request.app.locals.stores.kotsAppStore as KotsAppStore).updateAppRestoreUndeployStatus(body.app_id, status);

    return {};
  }
}
