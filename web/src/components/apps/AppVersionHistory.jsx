import React, { Component } from "react";
import classNames from "classnames";
import { withRouter, Link } from "react-router-dom";
import { compose, withApollo, graphql } from "react-apollo";
import Helmet from "react-helmet";
import dayjs from "dayjs";
import MonacoEditor from "react-monaco-editor";
import relativeTime from "dayjs/plugin/relativeTime";
import Modal from "react-modal";
import moment from "moment";
import find from "lodash/find";
import map from "lodash/map";
import Loader from "../shared/Loader";
import MarkdownRenderer from "@src/components/shared/MarkdownRenderer";
import { Utilities } from "@src/utilities/utilities";

import { getKotsDownstreamHistory, getKotsDownstreamOutput } from "../../queries/AppsQueries";

import "@src/scss/components/watches/WatchVersionHistory.scss";
dayjs.extend(relativeTime);

class AppVersionHistory extends Component {
  state = {
    viewReleaseNotes: false,
    logsLoading: false,
    logs: null,
    selectedTab: null,
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
    } catch (err) {
      return null;
    }
  }

  renderSourceAndDiff = version => {
    const diffSummary = this.getVersionDiffSummary(version);
    return (
      <div>
        {version.source}
        {diffSummary && (
          diffSummary.filesChanged > 0 ?
            <div className="DiffSummary">
              <span className="files">{diffSummary.filesChanged} files changed </span>
              <span className="lines-added">+{diffSummary.linesAdded} </span>
              <span className="lines-removed">-{diffSummary.linesRemoved}</span>
            </div>
            :
            <div className="DiffSummary">
              <span className="files">No changes</span>
            </div>
        )}
      </div>
    );
  }

  renderVersionAction = version => {
    const { app } = this.props;
    const downstream = app.downstreams[0];
    const isCurrentVersion = version.sequence === downstream.currentVersion?.sequence;
    const isPendingVersion = find(downstream.pendingVersions, { sequence: version.sequence });
    const isPastVersion = find(downstream.pastVersions, { sequence: version.sequence });
    return (
      <div>
        {!(isPastVersion && !app.allowRollback) &&
          <button
            className={`btn ${isPastVersion ? "secondary gray" : "primary green"}`}
            disabled={isCurrentVersion}
            onClick={() => this.deployVersion(version)}
          >
            {isPendingVersion ?
              "Deploy" :
              isCurrentVersion ?
                "Deployed" :
                "Rollback"
            }
          </button>
        }
      </div>
    );
  }

  renderVersionStatus = version => {
    return (
      <div className="flex flex-column">
        <div className="flex alignItems--center">
          <div
            data-tip={`${version.title}-${version.sequence}`}
            data-for={`${version.title}-${version.sequence}`}
            className={classNames("icon", {
              "checkmark-icon": version.status === "deployed" || version.status === "merged",
              "exclamationMark--icon": version.status === "opened" || version.status === "pending" || version.status === "pending_preflight",
              "grayCircleMinus--icon": version.status === "closed",
              "error-small": version.status === "failed"
            })}
          />
          <span className={classNames("u-fontSize--small u-fontWeight--medium u-lineHeight--normal u-marginLeft--5", {
            "u-color--nevada": version.status === "deployed" || version.status === "merged",
            "u-color--orange": version.status === "opened" || version.status === "pending" || version.status === "pending_preflight",
            "u-color--dustyGray": version.status === "closed",
            "u-color--red": version.status === "failed"
          })}>
            {Utilities.toTitleCase(version.status === "pending_preflight" ? "pending" : version.status).replace("_", " ")}
          </span>
        </div>
        {version.status === "pending_preflight" && 
          <span className="flex u-paddingRight--5 u-fontSize--smaller alignItems--center">
            Preflights
            <Loader size="20" />
          </span>
        }
      </div>
    );
  }

  renderLogsTabs = () => {
    const { logs, selectedTab } = this.state;
    if (!logs) {
      return null;
    }
    const tabs = Object.keys(logs);
    return (
      <div className="flex action-tab-bar u-marginTop--10">
        {map(tabs, tab => (
          <div className={`tab-item blue ${tab === selectedTab && "is-active"}`} key={tab} onClick={() => this.setState({ selectedTab: tab })}>
            {tab}
          </div>
        ))}
      </div>
    );
  }

  deployVersion = version => {
    const { match, app } = this.props;
    const clusterSlug = app.downstreams?.length && app.downstreams[0].cluster?.slug;
    if (clusterSlug) {
      this.props.makeCurrentVersion(match.params.slug, version.sequence, clusterSlug);
    }
  }

  hideLogsModal = () => {
    this.setState({
      showLogsModal: false
    });
  }

  handleViewLogs = async version => {
    const { match, app } = this.props;
    const clusterSlug = app.downstreams?.length && app.downstreams[0].cluster?.slug;
    if (clusterSlug) {
      this.setState({ logsLoading: true, showLogsModal: true });
      this.props.client.query({
        query: getKotsDownstreamOutput,
        fetchPolicy: "no-cache",
        variables: {
          appSlug: match.params.slug,
          clusterSlug: clusterSlug,
          sequence: version.sequence
        }
      }).then(result => {
        const logs = result.data.getKotsDownstreamOutput;
        const selectedTab = Object.keys(logs)[0];
        this.setState({ logs, selectedTab, logsLoading: false });
      }).catch(err => {
        console.log(err);
        this.setState({ logsLoading: false });
      });
    }
  }

  render() {
    const {
      app,
      checkingForUpdates,
      checkingUpdateText,
      errorCheckingUpdate,
      handleAddNewCluster,
      data,
      match
    } = this.props;

    const { 
      viewReleaseNotes, 
      showLogsModal, 
      selectedTab, 
      logs, 
      logsLoading
    } = this.state;

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
        <div className="flex-column flex1">
          <div className="flex1">
            <div className="flex-column alignItems--center">
              {/* When no downstreams exit */}
              {!downstream &&
                <div className="flex-column flex1 u-marginBottom--30">
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

              {/* Active downstream */}
              {currentDownstreamVersion &&
                <fieldset className={`DeployedDownstreamVersion ${currentDownstreamVersion.status}`}>
                  <legend className="u-marginLeft--20 u-color--tuna u-fontWeight--bold u-paddingLeft--5 u-paddingRight--5">
                    Deployed Version{currentDownstreamVersion.status === "failed" && " (Failed)"}
                  </legend>
                  <table className="DownstreamVersionsTable full-width">
                    <thead>
                      <tr key="header">
                        <th>Environment</th>
                        <th>Received</th>
                        <th>Upstream</th>
                        <th width="11%">Sequence</th>
                        <th width="17%">Source</th>
                        <th>Deployed</th>
                        <th>Logs</th>
                        <th/>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{downstream.name}</td>
                        <td>{moment(currentDownstreamVersion.createdOn).format("MM/DD/YY hh:mm a")}</td>
                        <td>{currentDownstreamVersion.title}</td>
                        <td width="11%">{currentDownstreamVersion.sequence}</td>
                        <td width="17%">{currentDownstreamVersion.source}</td>
                        <td>{currentDownstreamVersion.deployedAt ? moment(currentDownstreamVersion.createdOn).format("MM/DD/YY hh:mm a") : ""}</td>
                        <td><button className="btn secondary u-marginRight--20" onClick={() => this.handleViewLogs(currentDownstreamVersion)}>View</button></td>
                        <td><Link className="link" to={`/app/${match.params.slug}/config`}>Edit config</Link></td>
                      </tr>
                    </tbody>
                  </table>
                </fieldset>
              }

              {/* Downstream version history */}
              {versionHistory.length &&
                <table className="DownstreamVersionsTable">
                  <thead className="separator">
                    <tr key="header">
                      <th>Environment</th>
                      <th>Received</th>
                      <th>Upstream</th>
                      <th width="11%">Sequence</th>
                      <th width="17%">Source</th>
                      <th>Deployed</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versionHistory.map((version) => (
                      <tr key={version.sequence}>
                        <td>{downstream.name}</td>
                        <td>{moment(version.createdOn).format("MM/DD/YY hh:mm a")}</td>
                        <td>{version.title}</td>
                        <td width="11%">{version.sequence}</td>
                        <td width="17%">{this.renderSourceAndDiff(version)}</td>
                        <td>{version.deployedAt ? moment(version.createdOn).format("MM/DD/YY hh:mm a") : ""}</td>
                        <td>{this.renderVersionStatus(version)}</td>
                        <td>{this.renderVersionAction(version)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            </div>
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

        <Modal
          isOpen={showLogsModal}
          onRequestClose={this.hideLogsModal}
          shouldReturnFocusAfterClose={false}
          contentLabel="View logs"
          ariaHideApp={false}
          className="Modal logs-modal"
        >
          <div className="Modal-body flex flex1">
            {!logs || !selectedTab || logsLoading ? (
              <div className="flex-column flex1 alignItems--center justifyContent--center">
                <Loader size="60" />
              </div>
            ) : (
                <div className="flex-column flex1">
                  {this.renderLogsTabs()}
                  <div className="flex-column flex1 u-border--gray monaco-editor-wrapper">
                    <MonacoEditor
                      language="json"
                      value={logs[selectedTab]}
                      height="100%"
                      width="100%"
                      options={{
                        readOnly: true,
                        contextmenu: false,
                        minimap: {
                          enabled: false
                        },
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </div>
                  <div className="u-marginTop--20 flex">
                    <button type="button" className="btn primary" onClick={this.hideLogsModal}>Ok, got it!</button>
                  </div>
                </div>
              )}
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