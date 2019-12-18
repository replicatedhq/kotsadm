import React, { Component } from "react";
// import { graphql, compose, withApollo } from "react-apollo";
import { Link } from "react-router-dom"

export default class AppSnapshotDetail extends Component {
  state = {
  };

  render() {
    const { app } = this.props;
    return (
      <div className="container flex-column flex1 u-overflow--auto u-paddingTop--30 u-paddingBottom--20">
        <p className="u-marginBottom--30 u-fontSize--small u-color--tundora u-fontWeight--medium">
          <Link to={`/app/${app?.slug}/snapshots`} className="replicated-link">Snapshots</Link>
          <span className="u-color--dustyGray"> > </span>
          v.482 Manual Snapshot
        </p>
        <div className="flex justifyContent--spaceBetween alignItems--center u-paddingBottom--30 u-borderBottom--gray">
          <div className="flex-column u-lineHeight--normal">
            <p className="u-fontSize--larger u-fontWeight--bold u-color--tuna u-marginBottom--5">[v.482 Manual Snapshot]</p>
            <p className="u-fontSize--normal u-fontWeight--normal u-color--dustyGray">Total size: <span className="u-fontWeight--bold u-color--doveGray">[4TB]</span></p>
          </div>
          <div className="flex-column u-lineHeight--normal u-textAlign--right">
            <p className="u-fontSize--normal u-fontWeight--normal u-marginBottom--5">Status: <span className="status-indicator success u-marginLeft--5">[Successful]</span></p>
            <div className="u-fontSize--small"><span className="u-marginRight--5">[2 warnings]</span><span className="replicated-link">Download logs</span></div>
          </div>
        </div>

        <div className="flex1 u-marginTop--30 u-marginBottom--40">
          <p className="u-fontSize--larger u-fontWeight--bold u-color--tuna u-marginBottom--10">Snapshot timeline</p>
          <div className="u-border--gray u-padding--15">
            Graph is here
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
