import React, { Component } from "react";
import { graphql, compose, withApollo } from "react-apollo";
import { Link, withRouter } from "react-router-dom";
import MonacoEditor from "react-monaco-editor";
import Modal from "react-modal";
import filter from "lodash/filter";
import Loader from "../shared/Loader";
import { snapshotDetail } from "../../queries/SnapshotQueries";

class AppSnapshotDetail extends Component {
  state = {
    showOutputForPreScripts: false,
    preScriptOutput: "",
    selectedTab: "stdout",
    showAllVolumes: false,
    showAllPreSnapshotScripts: false
  };

  preSnapshotScripts = () => {
    return filter(this.props.snapshotDetail?.snapshotDetail?.hooks, (hook) => {
      return hook.phase === "pre";
    });
  }

  postSnapshotScripts = () => {
    return filter(this.props.snapshotDetail?.snapshotDetail?.hooks, (hook) => {
      return hook.phase === "post";
    });
  }

  toggleShowAllPreScripts = () => {
    this.setState({ showAllPreSnapshotScripts: !this.state.showAllPreSnapshotScripts });
  }

  toggleShowAllVolumes = () => {
    this.setState({ showAllVolumes: !this.state.showAllVolumes });
  }

  toggleOutputForPreScripts = output => {
    if (this.state.toggleOutputForPreScripts) {
      this.setState({ showOutputForPreScripts: false, preScriptOutput: "" });
    } else {
      this.setState({ showOutputForPreScripts: true, preScriptOutput: output });
    }
  }

  renderOutputTabs = () => {
    const { selectedTab } = this.state;
    const tabs = ["stdout", "stderr"];
    return (
      <div className="flex action-tab-bar u-marginTop--10">
        {tabs.map(tab => (
          <div className={`tab-item blue ${tab === selectedTab && "is-active"}`} key={tab} onClick={() => this.setState({ selectedTab: tab })}>
            {tab}
          </div>
        ))}
      </div>
    );
  }

  render() {
    const { showOutputForPreScripts, selectedTab, preScriptOutput, showAllVolumes, showAllPreSnapshotScripts } = this.state;
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
              <p className="u-fontSize--larger u-color--tuna u-fontWeight--bold u-lineHeight--bold u-paddingBottom--10 u-borderBottom--gray">Volumes</p>
              {snapshotDetail?.snapshotDetail?.volumes?.slice(0, 3).map((volume) => (
                <div className="flex flex1 u-borderBottom--gray" key={volume.name}>
                  <div className="flex1 u-paddingBottom--10 u-paddingTop--10 u-paddingLeft--10">
                    <p className="flex1 u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--bold">{volume.name}</p>
                    <p className="u-fontSize--normal u-color--doveGray u-fontWeight--bold u-lineHeight--normal u-marginRight--20">Size:
                    <span className="u-fontWeight--normal u-color--dustyGray"> {volume.doneBytesHuman}/{volume.sizeBytesHuman} </span>
                    </p>
                  </div>
                </div>
              ))}
              {snapshotDetail?.snapshotDetail?.volumes?.length > 3 &&
                <div className="flex flex1 justifyContent--center">
                  <span className="replicated-link u-fontSize--normal u-paddingTop--20" onClick={() => this.toggleShowAllVolumes()}>Show all {snapshotDetail?.snapshotDetail?.volumes?.length} volumes</span>
                </div>
              }
            </div>
          </div>
          <div className="flex-column flex1 u-marginLeft--20">
            <div className="dashboard-card-wrapper flex1">
              <p className="u-fontSize--larger u-color--tuna u-fontWeight--bold u-lineHeight--bold u-paddingBottom--10 u-borderBottom--gray">Pre-snapshot scripts</p>
              {this.preSnapshotScripts().slice(0, 3).map((hook, i) => (
                <div className="flex flex1 u-borderBottom--gray" key={`${hook.hookName}-${i}`}>
                  <div className="flex1 u-paddingBottom--15 u-paddingTop--15 u-paddingLeft--10">
                    <p className="flex1 u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--bold">{hook.hookName}</p>
                    <span className="replicated-link u-fontSize--small" onClick={() => this.toggleOutputForPreScripts(hook)}> View output </span>
                  </div>
                </div>
              ))}
              {this.preSnapshotScripts().length > 3 &&
                <div className="flex flex1 justifyContent--center">
                  <span className="replicated-link u-fontSize--normal u-paddingTop--20" onClick={() => this.toggleShowAllPreScripts()}>Show all {this.preSnapshotScripts().length} scripts</span>
                </div>
              }
            </div>
          </div>
        </div>

        <div className="flex flex-auto u-marginBottom--30">
          <div className="flex-column flex1 u-marginRight--20">
            <div className="dashboard-card-wrapper flex1">
              <p className="u-fontSize--larger u-color--tuna u-fontWeight--bold u-lineHeight--bold u-paddingBottom--10 u-borderBottom--gray">Namespaces</p>
              {snapshotDetail?.snapshotDetail?.namespaces?.map((namespace) => (
                <div className="flex flex1 u-borderBottom--gray" key={namespace}>
                  <div className="flex1">
                    <p className="u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--bold u-paddingBottom--10 u-paddingTop--10 u-paddingLeft--10">{namespace}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-column flex1 u-marginLeft--20">
            <div className="dashboard-card-wrapper flex1">
              <p className="u-fontSize--larger u-color--tuna u-fontWeight--bold u-lineHeight--bold u-paddingBottom--10 u-marginBottom--10 u-borderBottom--gray">Warnings</p>
            </div>
          </div>
        </div>

        {showOutputForPreScripts && preScriptOutput &&
          <Modal
            isOpen={showOutputForPreScripts}
            onRequestClose={() => this.toggleOutputForPreScripts()}
            shouldReturnFocusAfterClose={false}
            contentLabel="View logs"
            ariaHideApp={false}
            className="Modal logs-modal"
          >
            <div className="Modal-body flex flex1 flex-column">
              {!selectedTab ?
                <div className="flex-column flex1 alignItems--center justifyContent--center">
                  <Loader size="60" />
                </div>
                :
                <div className="flex-column flex1">
                  {this.renderOutputTabs()}
                  <div className="flex-column flex1 u-border--gray monaco-editor-wrapper">
                    <MonacoEditor
                      language="json"
                      value={preScriptOutput[selectedTab]}
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
                </div>
              }
              <div className="u-marginTop--20 flex">
                <button type="button" className="btn primary blue" onClick={() => this.toggleOutputForPreScripts()}>Ok, got it!</button>
              </div>
            </div>
          </Modal>
        }
        {showAllVolumes &&
          <Modal
            isOpen={showAllVolumes}
            onRequestClose={this.toggleShowAllVolumes}
            shouldReturnFocusAfterClose={false}
            contentLabel="Show more"
            ariaHideApp={false}
            className="MediumSize Modal"
          >
            <div className="Modal-body flex-column flex1">
              <p className="u-fontSize--larger u-color--tuna u-fontWeight--bold u-lineHeight--bold u-paddingBottom--10 u-borderBottom--gray">Volumes</p>
              {snapshotDetail?.snapshotDetail?.volumes?.map((volume) => (
                <div className="flex flex1 u-borderBottom--gray" key={volume.name}>
                  <div className="flex1 u-paddingBottom--10 u-paddingTop--10 u-paddingLeft--10">
                    <p className="flex1 u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--bold">{volume.name}</p>
                    <p className="u-fontSize--normal u-color--doveGray u-fontWeight--bold u-lineHeight--normal u-marginRight--20">Size:
                    <span className="u-fontWeight--normal u-color--dustyGray"> {volume.doneBytesHuman}/{volume.sizeBytesHuman} </span>
                    </p>
                  </div>
                </div>
              ))}
              <div className="u-marginTop--10 flex">
                <button onClick={() => this.toggleShowAllVolumes()} className="btn primary blue">Ok, got it!</button>
              </div>
            </div>
          </Modal>
        }
        {showAllPreSnapshotScripts &&
          <Modal
            isOpen={showAllPreSnapshotScripts}
            onRequestClose={this.toggleShowAllPreScripts}
            shouldReturnFocusAfterClose={false}
            contentLabel="Show more"
            ariaHideApp={false}
            className="MediumSize Modal"
          >
            <div className="Modal-body flex-column flex1">
              <p className="u-fontSize--larger u-color--tuna u-fontWeight--bold u-lineHeight--bold u-paddingBottom--10 u-borderBottom--gray">Pre-snapshot scripts</p>
              {this.preSnapshotScripts().map((hook, i) => (
                <div className="flex flex1 u-borderBottom--gray" key={`${hook.hookName}-${i}`}>
                  <div className="flex1 u-paddingBottom--10 u-paddingTop--10 u-paddingLeft--10">
                    <p className="flex1 u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--bold">{hook.hookName}</p>
                    <span className="replicated-link u-fontSize--small" onClick={() => this.toggleOutputForPreScripts(hook)}> View output </span>
                  </div>
                </div>
              ))}
              <div className="u-marginTop--10 flex">
                <button onClick={() => this.toggleShowAllPreScripts()} className="btn primary blue">Ok, got it!</button>
              </div>
            </div>
          </Modal>
        }

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
