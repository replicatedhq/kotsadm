
/* global
  it
*/

import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import * as Pact from "@pact-foundation/pact";
import { Matchers } from "@pact-foundation/pact";

import { getKotsDownstreamHistory, getKotsDownstreamHistoryRaw } from "../../../queries/AppsQueries";
import { getShipClient, createSessionToken } from "../utils";

chai.use(chaiAsPromised);
const expect = chai.expect;

export default () => {
  it("gets downstream version history for a kots app that has release notes", async done => {

    await global.provider.addInteraction(getKotsDownstreamHistoryInteraction);
    const result = await getShipClient("kots-release-notes-user-session").mutate({
      mutation: getKotsDownstreamHistory,
      variables: {
        clusterSlug: "kots-release-notes-cluster-slug",
        upstreamSlug: "kots-release-notes-app-slug"
      },
    });
    const{ data } = result;
    console.log
    expect(data.getKotsDownstreamHistory[0].title).to.equal("my-other-awesome-version-2");
    expect(data.getKotsDownstreamHistory[0].status).to.equal("pending");
    expect(typeof data.getKotsDownstreamHistory[0].createdOn).to.equal("string");
    expect(data.getKotsDownstreamHistory[0].sequence).to.equal(1);
    expect(data.getKotsDownstreamHistory[0].releaseNotes).to.equal("");
    expect(typeof data.getKotsDownstreamHistory[0].preflightResult).to.equal("string");
    expect(typeof data.getKotsDownstreamHistory[0].preflightResultCreatedAt).to.equal("string");

    expect(data.getKotsDownstreamHistory[1].releaseNotes).to.equal("# Release Notes Markdown Text");


    global.provider.verify().then(() => done());

  });

  const getKotsDownstreamHistoryInteraction = new Pact.GraphQLInteraction()
    .uponReceiving("A query to get kots downstream version history that has release notes")
    .withRequest({
      path: "/graphql",
      method: "POST",
      headers: {
        "Authorization": createSessionToken("kots-release-notes-user-session"),
        "Content-Type": "application/json",
      }
    })
    .withOperation("getKotsDownstreamHistory")
    .withQuery(getKotsDownstreamHistoryRaw)
    .withVariables({
      clusterSlug: "kots-release-notes-cluster-slug",
      upstreamSlug: "kots-release-notes-app-slug"
    })
    .willRespondWith({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        data: {
          getKotsDownstreamHistory: [
            {
              "title": "my-other-awesome-version-2",
              "status": "pending",
              "createdOn": "Fri Apr 19 2019 01:23:45 GMT+0000 (UTC)",
              "sequence": 1,
              "releaseNotes": "",
              "deployedAt": "Fri Apr 19 2019 01:23:45 GMT+0000 (UTC)",
              "preflightResult": Matchers.like("string"),
              "preflightResultCreatedAt": "Fri Apr 19 2019 01:23:45 GMT+0000 (UTC)"
            },
            {
              "title": "my-other-awesome-version",
              "status": "pending",
              "createdOn": "Fri Apr 19 2019 01:23:45 GMT+0000 (UTC)",
              "sequence": 0,
              "releaseNotes": "# Release Notes Markdown Text",
              "deployedAt": "Fri Apr 19 2019 01:23:45 GMT+0000 (UTC)",
              "preflightResult": Matchers.like("string"),
              "preflightResultCreatedAt": "Fri Apr 19 2019 01:23:45 GMT+0000 (UTC)"
            }

          ],
        },
      },
    });
};
