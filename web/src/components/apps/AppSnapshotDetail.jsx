import React, { Component } from "react";
import { graphql, compose, withApollo } from "react-apollo";
import { Link, withRouter } from "react-router-dom";
import filter from "lodash/filter";
import Loader from "../shared/Loader";
import { snapshotDetail } from "../../queries/SnapshotQueries";

class AppSnapshotDetail extends Component {
  state = {
  };

  preSnapshotScripts() {
    return filter(this.props.snapshotDetail?.snapshotDetail?.hooks, (hook) => {
      return hook.phase === "pre";
    });
  }

  postSnapshotScripts() {
    return filter(this.props.snapshotDetail?.snapshotDetail?.hooks, (hook) => {
      return hook.phase === "post";
    });
  }

  render() {
    const { app, snapshotDetail } = this.props;

    if (snapshotDetail?.loading) {
      return (
        <div className="flex-column flex1 alignItems--center justifyContent--center">
          <Loader size="60" />
        </div>)
    }

    return (
      <div className="container flex-column flex1 u-overflow--auto u-paddingTop--30 u-paddingBottom--20">
        <p className="u-marginBottom--30 u-fontSize--small u-color--tundora u-fontWeight--medium">
          <Link to={`/app/${app?.slug}/snapshots`} className="replicated-link">Snapshots</Link>
          <span className="u-color--dustyGray"> > </span>
          {snapshotDetail?.snapshotDetail.name}
        </p>
        <div className="flex justifyContent--spaceBetween alignItems--center u-paddingBottom--30 u-borderBottom--gray">
          <div className="flex-column u-lineHeight--normal">
            <p className="u-fontSize--larger u-fontWeight--bold u-color--tuna u-marginBottom--5">[{snapshotDetail?.snapshotDetail.name}]</p>
            <p className="u-fontSize--normal u-fontWeight--normal u-color--dustyGray">Total size: <span className="u-fontWeight--bold u-color--doveGray">[{snapshotDetail?.snapshotDetail.volumeSizeHuman}]</span></p>
          </div>
          <div className="flex-column u-lineHeight--normal u-textAlign--right">
            <p className="u-fontSize--normal u-fontWeight--normal u-marginBottom--5">Status: <span className={`status-indicator ${snapshotDetail?.snapshotDetail.status.toLowerCase()} u-marginLeft--5`}>[{snapshotDetail?.snapshotDetail.status}]</span></p>
            <div className="u-fontSize--small"><span className="u-marginRight--5">{`[${snapshotDetail?.snapshotDetail.warnings ? snapshotDetail?.snapshotDetail.warnings.length : 0} warnings]`}</span><span className="replicated-link">Download logs</span></div>
          </div>
        </div>

        <div className="flex-column flex-auto u-marginTop--30 u-marginBottom--40">
          <p className="u-fontSize--larger u-fontWeight--bold u-color--tuna u-marginBottom--10">Snapshot timeline</p>
          <div className="flex1 u-border--gray u-padding--15">
            Graph is here
          </div>
        </div>

        <div className="flex flex-auto u-marginBottom--30">
          <div className="flex-column flex1 u-marginRight--20">
            <div className="dashboard-card-wrapper flex1">
              <p className="u-fontSize--larger u-color--tuna u-fontWeight--bold u-lineHeight--bold u-paddingBottom--10 u-marginBottom--10 u-borderBottom--gray">Volumes</p>
              {snapshotDetail?.snapshotDetail?.volumes?.map((volume) => (
                <div className="flex flex1" key={volume.name}>
                  <div className="flex1">
                    <p>{volume.name}</p>
                    <p>Size: {volume.doneBytesHuman}/{volume.sizeBytesHuman}</p>
                  </div>
                  <div className="flex-column flex1 allignItems--center justifyContent--flexEnd">
                    <div>
                      <span className={`status-indicator success`}>[Successful]</span>
                    </div>
                  </div>
                </div>
              ))
              }
            </div>
          </div>
          <div className="flex-column flex1 u-marginLeft--20">
            <div className="dashboard-card-wrapper flex1">
              <p className="u-fontSize--larger u-color--tuna u-fontWeight--bold u-lineHeight--bold u-paddingBottom--10 u-marginBottom--10 u-borderBottom--gray">Pre-snapshot scripts</p>
              <ul>
                {this.preSnapshotScripts().map((hook, i) => (
                  // stdout and stderr may have newlines. errors and warnings arrays are also available on hook object.
                  <li key={i}>Namespace: {hook.namespace} Pod: {hook.podName}, Container: {hook.containerName}, Hook Name: {hook.hookName}, Command: {hook.command}, Stdout: {hook.stdout}, Stderr: {hook.Stderr}, Started: {hook.started}, Finished: {hook.finished}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-auto u-marginBottom--30">
          <div className="flex-column flex1 u-marginRight--20">
            <div className="dashboard-card-wrapper flex1">
              <p className="u-fontSize--larger u-color--tuna u-fontWeight--bold u-lineHeight--bold u-paddingBottom--10 u-marginBottom--10 u-borderBottom--gray">Namespaces</p>
              {snapshotDetail?.snapshotDetail?.namespaces?.map((namespace) => (
                <div className="flex flex1 u-borderBottom--gray" key={namespace}>
                  <div className="flex1 u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--bold u-paddingBottom--10 u-paddingTop--10 u-paddingLeft--20">
                    <p>{namespace}</p>
                  </div>
                </div>
              ))
              }
            </div>
          </div>
          <div className="flex-column flex1 u-marginLeft--20">
            <div className="dashboard-card-wrapper flex1">
              <p className="u-fontSize--larger u-color--tuna u-fontWeight--bold u-lineHeight--bold u-paddingBottom--10 u-marginBottom--10 u-borderBottom--gray">Warnings</p>
            </div>
          </div>
        </div>

      </div>
    );
  }
}

export default compose(
  withApollo,
  withRouter,
  graphql(snapshotDetail, {
    name: "snapshotDetail",
    options: ({ match }) => {
      const slug = match.params.slug;
      const id = match.params.id;
      return {
        variables: { slug, id },
        fetchPolicy: "no-cache"
      }
    }
  })
)(AppSnapshotDetail);
