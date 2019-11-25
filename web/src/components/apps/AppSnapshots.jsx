import React, { Component } from "react";
// import { graphql, compose, withApollo } from "react-apollo";
import Helmet from "react-helmet";
import AppSnapshotsRow from "./AppSnapshotRow";
import "../../scss/components/gitops/GitOpsSettings.scss";

export default class AppSnapshots extends Component {
  

  render() {
    const { app } = this.props;
    const appTitle = app.name;
    
    return (
      <div className="container flex-column flex1 u-overflow--auto u-paddingTop--30 u-paddingBottom--20 alignItems--center">
        <Helmet>
          <title>{`${appTitle} Snapshots`}</title>
        </Helmet>
        <div className="AppSnapshots--wrapper flex1 flex-column u-width--full">
          <div className="flex flex-auto alignItems--flexStart justifyContent--spaceBetween">
            <p className="u-fontWeight--bold u-color--tuna u-fontSize--larger u-lineHeight--normal u-marginBottom--10">Snapshots</p>
            <div className="flex">
              <button type="button" className="btn secondary gray u-marginRight--10">Scehdule snapshots</button>
              <button type="button" className="btn primary blue">Start a snapshot</button>
            </div>
          </div>
          <div>
            <AppSnapshotsRow snapshotTitle="Sentry Enterprise v.482" />
            <AppSnapshotsRow snapshotTitle="Sentry Enterprise v.480" />
          </div>
        </div>
      </div>
    );
  }
}

// export default compose(
//   withApollo,
//   graphql(testGitOpsConnection, {
//     props: ({ mutate }) => ({
//       testGitOpsConnection: (appId, clusterId) => mutate({ variables: { appId, clusterId } })
//     })
//   }),
//   graphql(updateAppGitOps, {
//     props: ({ mutate }) => ({
//       updateAppGitOps: (appId, clusterId, gitOpsInput) => mutate({ variables: { appId, clusterId, gitOpsInput } })
//     })
//   }),
// )(AppSnapshots);
