import React, { Component } from "react";
import classNames from "classnames";
import { withRouter } from "react-router-dom";
import { compose, withApollo, graphql } from "react-apollo";
import Helmet from "react-helmet";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import Modal from "react-modal";
import moment from "moment";
import find from "lodash/find";
import Loader from "../shared/Loader";
import MarkdownRenderer from "@src/components/shared/MarkdownRenderer";

import { getKotsDownstreamHistory } from "../../queries/AppsQueries";

// import { isSingleTenant } from "../../utilities/utilities";
import "@src/scss/components/watches/WatchVersionHistory.scss";
dayjs.extend(relativeTime);

class AppVersionHistory extends Component {
  state = {
    viewReleaseNotes: false
  }

  showReleaseNotes = () => {
    this.setState({
      viewReleaseNotes: true
    });
  }

  hideReleaseNotes = () => {
    this.setState({
      viewReleaseNotes: false
    });
  }

  getVersionDiffSummary = version => {
    if (!version.diffSummary || version.diffSummary === "") {
      return null;
    }
    try {
      return JSON.parse(version.diffSummary);
    } catch(err) {
      return null;
    }
  }

  render() {
    const {
      app,
      checkingForUpdates,
      checkingUpdateText,
      errorCheckingUpdate,
      handleAddNewCluster,
      data
    } = this.props;

    const { viewReleaseNotes } = this.state;

    if (!app) {
      return null;
    }

    if (data.loading) {
      return (
        <div className="flex-column flex1 alignItems--center justifyContent--center">
          <Loader size="60" />
        </div>
      );
    }

    let updateText = <p className="u-marginTop--10 u-fontSize--small u-color--dustyGray u-fontWeight--medium">Last checked {dayjs(app.lastUpdateCheck).fromNow()}</p>;
    if (errorCheckingUpdate) {
      updateText = <p className="u-marginTop--10 u-fontSize--small u-color--chestnut u-fontWeight--medium">Error checking for updates, please try again</p>
    } else if (checkingForUpdates) {
      updateText = <p className="u-marginTop--10 u-fontSize--small u-color--dustyGray u-fontWeight--medium">{checkingUpdateText}</p>
    } else if (!app.lastUpdateCheck) {
      updateText = null;
    }

    const isAirgap = app.isAirgap;
    
    const downstream = app.downstreams.length && app.downstreams[0];
    const currentDownstreamVersion = downstream?.currentVersion;
    const versionHistory = data?.getKotsDownstreamHistory?.length ? data.getKotsDownstreamHistory : [];

    return (
      <div className="flex-column flex1 u-position--relative u-overflow--auto u-padding--20">
        <Helmet>
          <title>{`${app.name} Version History`}</title>
        </Helmet>
        <div className="flex flex-auto alignItems--center justifyContent--center u-marginTop--10 u-marginBottom--30">
          <div className="upstream-version-box-wrapper flex">
            <div className="flex flex1">
              {app.iconUri &&
                <div className="flex-auto u-marginRight--10">
                  <div className="watch-icon" style={{ backgroundImage: `url(${app.iconUri})` }}></div>
                </div>
              }
              <div className="flex1 flex-column">
                <p className="u-fontSize--34 u-fontWeight--bold u-color--tuna">
                  {app.currentVersion ? app.currentVersion.title : "---"}
                </p>
                <p className="u-fontSize--large u-fontWeight--medium u-marginTop--5 u-color--nevada">{app.currentVersion ? "Current upstream version" : "No deployments have been made"}</p>
                <p className="u-marginTop--10 u-fontSize--small u-color--dustyGray u-fontWeight--medium">
                  {app?.currentVersion?.deployedAt && `Released on ${dayjs(app.currentVersion.deployedAt).format("MMMM D, YYYY")}`}
                  {app?.currentVersion?.releaseNotes && <span className={classNames("release-notes-link", { "u-paddingLeft--5": app?.currentVersion?.deployedAt})} onClick={this.showReleaseNotes}>Release Notes</span>}
                </p>
              </div>
            </div>
            {!app.cluster &&
              <div className="flex-auto flex-column alignItems--center justifyContent--center">
                {checkingForUpdates
                  ? <Loader size="32" />
                  : <button className="btn secondary green" onClick={isAirgap ? this.props.onUploadNewVersion : this.props.onCheckForUpdates}>{isAirgap ? "Upload new version" : "Check for updates"}</button>
                }
                {updateText}
              </div>
            }
          </div>
        </div>
        <div className="flex-column flex1 u-overflow--hidden">
          <div className="flex1 u-overflow--auto">
            {versionHistory.length ?
              <div className="flex-column alignItems--center">
                {/* Active downstream */}
                <fieldset className="DeployedDownstreamVersion">
                  <legend className="u-marginLeft--20 u-color--tuna u-fontWeight--bold u-paddingLeft--5 u-paddingRight--5">Deployed Version</legend>
                  <table className="DownstreamVersionsTable">
                    <thead>
                      <tr key="header">
                        <th>Environment</th>
                        <th>Received</th>
                        <th>Upstream</th>
                        <th>Sequence</th>
                        <th>Source</th>
                        <th>Deployed</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{downstream.name}</td>
                        <td>{moment(currentDownstreamVersion.createdOn).format("MM/DD/YY hh:mm a")}</td>
                        <td>{currentDownstreamVersion.title}</td>
                        <td>{currentDownstreamVersion.sequence}</td>
                        <td>{currentDownstreamVersion.source}</td>
                        <td>{currentDownstreamVersion.deployedAt ? moment(currentDownstreamVersion.createdOn).format("MM/DD/YY hh:mm a") : ""}</td>
                      </tr>
                    </tbody>
                  </table>
                </fieldset>

                {/* Downstream version history */}
                <table className="DownstreamVersionsTable">
                  <thead className="separator">
                    <tr key="header">
                      <th>Environment</th>
                      <th>Received</th>
                      <th>Upstream</th>
                      <th>Sequence</th>
                      <th>Source</th>
                      <th>Deployed</th>
                      <th></th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versionHistory.map((version) => {
                      const isCurrentVersion = version.sequence === downstream.currentVersion?.sequence;
                      const isPendingVersion = find(downstream.pendingVersions, { sequence: version.sequence });
                      const isPastVersion = find(downstream.pastVersions, { sequence: version.sequence });
                      const diffSummary = this.getVersionDiffSummary(version);
                      return (
                        <tr key={version.sequence}>
                          <td>{downstream.name}</td>
                          <td>{moment(version.createdOn).format("MM/DD/YY hh:mm a")}</td>
                          <td>{version.title}</td>
                          <td>{version.sequence}</td>
                          <td>
                            {version.source}
                            {diffSummary && (
                              diffSummary.filesChanged > 0 ?
                              <div>
                                <span className="DiffSummary files">{diffSummary.filesChanged} files changed </span>
                                <span className="DiffSummary lines-added">+{diffSummary.linesAdded} </span>
                                <span className="DiffSummary lines-removed">-{diffSummary.linesRemoved}</span>
                              </div>
                              :
                              <span className="DiffSummary files"><br/>No changes</span>
                            )}
                          </td>
                          <td>{version.deployedAt ? moment(version.createdOn).format("MM/DD/YY hh:mm a") : ""}</td>
                          <td className="link">Edit config</td>
                          <td>
                            {!(isPastVersion && !app.allowRollback) && 
                              <button className={`btn ${isPastVersion ? "secondary gray" : "primary green"}`} disabled={isCurrentVersion}>
                                {isPendingVersion ? "Deploy" : isCurrentVersion ? "Deployed" : "Rollback"}
                              </button>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              :
              <div className="flex-column flex1">
                <div className="EmptyState--wrapper flex-column flex1">
                  <div className="EmptyState flex-column flex1 alignItems--center justifyContent--center">
                    <div className="flex alignItems--center justifyContent--center">
                      <span className="icon ship-complete-icon-gh"></span>
                      <span className="deployment-or-text">OR</span>
                      <span className="icon ship-medium-size"></span>
                    </div>
                    <div className="u-textAlign--center u-marginTop--10">
                      <p className="u-fontSize--largest u-color--tuna u-lineHeight--medium u-fontWeight--bold u-marginBottom--10">No active downstreams</p>
                      <p className="u-fontSize--normal u-color--dustyGray u-lineHeight--medium u-fontWeight--medium">{app.name} has no downstream deployment clusters yet. {app.name} must be deployed to a cluster to get version histories.</p>
                    </div>
                    <div className="u-marginTop--20">
                      <button className="btn secondary" onClick={handleAddNewCluster}>Add a deployment cluster</button>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
        <Modal
          isOpen={viewReleaseNotes}
          onRequestClose={this.hideReleaseNotes}
          contentLabel="Release Notes"
          ariaHideApp={false}
          className="Modal LargeSize"
        >
          <div className="flex-column">
            <MarkdownRenderer>
              {app?.currentVersion?.releaseNotes || "No release notes for this version"}
            </MarkdownRenderer>
          </div>
          <div className="flex u-marginTop--10 u-marginLeft--10 u-marginBottom--10">
            <button className="btn primary" onClick={this.hideReleaseNotes}>Close</button>
          </div>
        </Modal>
      </div>
    );
  }
}

export default compose(
  withApollo,
  withRouter,
  graphql(getKotsDownstreamHistory, {
    skip: ({ app }) => {
      return !app.downstreams || !app.downstreams.length;
    },
    options: ({ match, app }) => {
      const downstream = app.downstreams[0];
      return {
        variables: {
          upstreamSlug: match.params.slug,
          clusterSlug: downstream.cluster.slug,
        },
        fetchPolicy: "no-cache"
      }
    }
  }),
)(AppVersionHistory);