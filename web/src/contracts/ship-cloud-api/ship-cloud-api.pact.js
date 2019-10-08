import listClusters from "./contracts/list-clusters";
import createShipCluster from "./contracts/create-ship-cluster";
import createGitOpsCluster from "./contracts/create-gitops-cluster";
import createMidstreamWatch from "./contracts/create-midstream-watch";
import listWatchesShipCluster from "./contracts/list-watches-ship-cluster";
import createInitSession from "./contracts/create-init-session";
import getWatchVersion from "./contracts/get-watch-version";
import listImageWatches from "./contracts/list-image-watches";
import getWatchVersionGitOpsCluster from "./contracts/get-watch-version-gitops-cluster";
import shipauthSignup from "./contracts/shipauth-signup";
import updateWatch from "./contracts/update-watch";
import deleteWatch from "./contracts/delete-watch";
import duplicateSlugCheck from "./contracts/duplicate-slug-check";
import getKotsAppCheck from "./contracts/get-kots-app";
import getWatchContributors from "./contracts/get-watch-contributors";
import getKotsPreflightResult from "./contracts/get-kots-preflight-result";
import getLatestKotsPreflightResult from "./contracts/get-latest-kots-preflight-result";
import deployKotsVersion from "./contracts/deploy-kots-version";
import getKotsDownstreamHistory from "./contracts/get-kots-downstream-history";
import getKotsDownstreamHistoryReleaseNotes from "./contracts/get-kots-downstream-history-release-notes";
// import getWatchVersionGitOps from "./contracts/get-watch-version-gitops-cluster";

describe("ShipAPI GraphQL Pact", () => {

  describe("solo-account:listClusters", () => listClusters() );
  describe("solo-account:createShipCluster", () => createShipCluster() );
  describe("solo-account:createGitOpsCluster", () => createGitOpsCluster() );
  describe("solo-account:createMidstreamWatch", () => createMidstreamWatch() );
  describe("solo-account:createInitSession", () => createInitSession() );
  describe("solo-account:getWatchVersion", () => getWatchVersion() );
  describe("duplicate-slug-check", () => duplicateSlugCheck() );

  // describe("solo-account:listImageWatches", () => listImageWatches() );
  describe("get-kots-app", () => getKotsAppCheck());
  describe("get-kots-preflight-result", () => getKotsPreflightResult());
  describe("get-latest-kots-preflight-result", () => getLatestKotsPreflightResult());
  describe("deploy-kots-version", () => deployKotsVersion());
  describe("get-kots-downstream-history", () => getKotsDownstreamHistory());
  describe("get-kots-downstream-history-release-notes", () => getKotsDownstreamHistoryReleaseNotes());
  describe("single-user:updateWatch", () => updateWatch() );
  // describe("single-user:deleteWatch", () => deleteWatch() );

  // describe("ship-cluster-account:listWatches", () => listWatchesShipCluster() );

  // describe("auth:shipAuthSignup", () => shipauthSignup() );
  // describe("ship-cluster-account:listWatches", () => listWatchesShipCluster() );
  // describe("gitops-cluster-account:getWatchVersion", () => getWatchVersionGitOpsCluster() );
  describe("get-watch-contributors", () => getWatchContributors() );

});
