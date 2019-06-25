import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { getShipClient, createSessionToken } from "../utils";
import { updateWatch, updateWatchRaw } from "../../../mutations/WatchMutations";
import * as Pact from "@pact-foundation/pact";
import { Matchers } from "@pact-foundation/pact";

chai.use(chaiAsPromised);
const expect = chai.expect;

export default () => {
  it("updates a watch for single user", async done => {
    await global.provider.addInteraction(updateWatchInteraction);
    const result = await getShipClient("single-user-account-session-1").mutate({
      mutation: updateWatch,
      variables: {
        watchId: "single-user-watch-update-1",
        watchName: "Updated Single User Watch Update",
        iconUri:
          "http://ccsuppliersource.com/wp-content/uploads/2018/12/bigstock_online_update_11303201.jpg"
      }
    });
    expect(result.data.updateWatch.id).to.equal("single-user-watch-update-1");
    expect(result.data.updateWatch.watchName).to.equal(
      "Updated Single User Watch Update"
    );
    expect(result.data.updateWatch.watchIcon).to.equal(
      "http://ccsuppliersource.com/wp-content/uploads/2018/12/bigstock_online_update_11303201.jpg"
    );
    global.provider.verify().then(() => done());
  });
};

const updateWatchInteraction = new Pact.GraphQLInteraction()
  .uponReceiving("a mutation to update a watch for single user")
  .withRequest({
    path: "/graphql",
    method: "POST",
    headers: {
      Authorization: createSessionToken("single-user-account-session-1"),
      "Content-Type": "application/json"
    }
  })
  .withOperation("updateWatch")
  .withQuery(updateWatchRaw)
  .withVariables({
    watchId: "single-user-watch-update-1",
    watchName: "Updated Single User Watch Update",
    iconUri:
      "http://ccsuppliersource.com/wp-content/uploads/2018/12/bigstock_online_update_11303201.jpg"
  })
  .willRespondWith({
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: {
      data: {
        updateWatch: {
          id: "single-user-watch-update-1",
          slug: "single-user/single-user-watch-update-1",
          watchName: "Updated Single User Watch Update",
          watchIcon:
            "http://ccsuppliersource.com/wp-content/uploads/2018/12/bigstock_online_update_11303201.jpg",
          createdOn: Matchers.like("2019-04-10 12:34:56.789"),
          lastUpdated: Matchers.like("generated"),
          stateJSON: Matchers.like("string"),
          contributors: Matchers.like([
            {
              avatar_url: "string",
              createdAt: "0001-01-01T00:00:00Z",
              githubId: 1234,
              id: "string",
              login: "string"
            }
          ])
        }
      }
    }
  });
