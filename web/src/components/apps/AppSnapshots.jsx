import React, { Component } from "react";
import { graphql, compose, withApollo } from "react-apollo";
import { Link, withRouter } from "react-router-dom"
import Helmet from "react-helmet";
import AppSnapshotsRow from "./AppSnapshotRow";
import ScheduleSnapshotForm from "../shared/ScheduleSnapshotForm";
import Modal from "react-modal";
import { listSnapshots } from "../../queries/SnapshotQueries";
import { manualSnapshot } from "../../mutations/SnapshotMutations";
import "../../scss/components/snapshots/AppSnapshots.scss";

class AppSnapshots extends Component {
  
  state = {
    displayScheduleSnapshotModal: false
  };

  toggleScheduleSnapshotModal = () => {
    this.setState({ displayScheduleSnapshotModal: !this.state.displayScheduleSnapshotModal });
  }

  startManualSnapshot = () => {
    console.log("start a manual snapshot!");
    const { app } = this.props;
    this.props.manualSnapshot(app.id)
      .then(response => {
        console.log(response);
      })
      .catch(err => {
        console.log(err);
        err.graphQLErrors.map(({ msg }) => {
          this.setState({
            message: msg,
            messageType: "error"
          });
        });
      })
      .finally(() => {

      });
  }

  handleScheduleSubmit = () => {
    console.log("schedule mutation to be implemented");
  }

  checkForVelero = () => {
    console.log("implement check for velero");
  }

  render() {
    const {
      displayScheduleSnapshotModal
    } = this.state;
    const { app, snapshots } = this.props;
    const appTitle = app.name;
    const veleroInstalled = true;

    if (!veleroInstalled) {
      return (
        <div className="container flex-column flex1 u-overflow--auto u-paddingTop--30 u-paddingBottom--20 justifyContent--center alignItems--center">
          <div className="flex-column u-textAlign--center AppSnapshotsEmptyState--wrapper">
            <p className="u-fontSize--largest u-fontWeight--bold u-color--tundora u-marginBottom--10">Configure application snapshots</p>
            <p className="u-fontSize--normal u-fontWeight--normal u-color--dustyGray u-lineHeight--normal u-marginBottom--30">Snapshots are enabled for {appTitle || "your application"} however you need to install Velero before you will be able to capture any snapshots. After installing Velero on your cluster click the button below so that kotsadm can pick it up and you can begin creating applicaiton snapshots.</p>
            <div className="u-textAlign--center">
              <button className="btn primary blue" onClick={this.checkForVelero}>Check for Velero</button>
            </div>
          </div>
        </div>
      )
    }

    if (!snapshots.loading && !snapshots?.listSnapshots?.length) {
      return (
        <div className="container flex-column flex1 u-overflow--auto u-paddingTop--30 u-paddingBottom--20 justifyContent--center alignItems--center">
          <div className="flex-column u-textAlign--center AppSnapshotsEmptyState--wrapper">
            <p className="u-fontSize--largest u-fontWeight--bold u-color--tundora u-marginBottom--10">No snapshots have been made</p>
            <p className="u-fontSize--normal u-fontWeight--normal u-color--dustyGray u-lineHeight--normal u-marginBottom--30">There have been no snapshots made for {appTitle || "your application"} yet. You can manually trigger snapshots or you can set up automatic snapshots to be made on a custom schedule.</p>
            <div className="flex justifyContent--center">
              <div className="flex-auto u-marginRight--20">
                <button className="btn secondary blue" onClick={this.startManualSnapshot}>Start a snapshot</button>
              </div>
              <div className="flex-auto">
                <Link to={`/app/${app.slug}/snapshots/schedule`} className="btn primary blue">Schedule snapshots</Link>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="container flex-column flex1 u-overflow--auto u-paddingTop--30 u-paddingBottom--20 alignItems--center">
        <Helmet>
          <title>{`${appTitle} Snapshots`}</title>
        </Helmet>
        <div className="AppSnapshots--wrapper flex1 flex-column u-width--full">
          <div className="flex flex-auto alignItems--flexStart justifyContent--spaceBetween">
            <p className="u-fontWeight--bold u-color--tuna u-fontSize--larger u-lineHeight--normal u-marginBottom--10">Snapshots</p>
            <div className="flex">
              <Link to={`/app/${app.slug}/snapshots/settings`} className="replicated-link u-fontSize--small u-fontWeight--bold u-marginRight--20 flex alignItems--center"><span className="icon snapshotSettingsIcon u-marginRight--5" />Settings</Link>
              <Link to={`/app/${app.slug}/snapshots/schedule`} className="replicated-link u-fontSize--small u-fontWeight--bold u-marginRight--20 flex alignItems--center"><span className="icon snapshotScheduleIcon u-marginRight--5" />Schedule</Link>
              <button type="button" className="btn primary blue" onClick={this.startManualSnapshot}>Start a snapshot</button>
            </div>
          </div>
          {snapshots?.listSnapshots && snapshots?.listSnapshots?.map((snapshot) => (
            <AppSnapshotsRow key={`snapshot-${snapshot.name}-${snapshot.started}`} snapshot={snapshot} appSlug={app.slug} />
          ))
          }
        </div>
        {displayScheduleSnapshotModal &&
          <Modal
            isOpen={displayScheduleSnapshotModal}
            onRequestClose={this.toggleScheduleSnapshotModal}
            shouldReturnFocusAfterClose={false}
            contentLabel="Schedule snapshot modal"
            ariaHideApp={false}
            className="ScheduleSnapshotModal--wrapper MediumSize Modal"
          >
            <div className="Modal-body">
              <ScheduleSnapshotForm
                onSubmit={this.handleScheduleSubmit}
              />
              <div className="u-marginTop--10 flex">
                <button onClick={this.toggleScheduleSnapshotModal} className="btn secondary blue u-marginRight--10">Cancel</button>
                <button onClick={this.scheduleSnapshot} className="btn primary blue">Save</button>
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
  graphql(listSnapshots, {
    name: "snapshots",
    options: ({ match }) => {
      const slug = match.params.slug;
      return {
        variables: { slug },
        fetchPolicy: "no-cache"
      }
    }
  }),
  graphql(manualSnapshot, {
    props: ({ mutate }) => ({
      manualSnapshot: (appId) =>  mutate({ variables: { appId } })
    })
  })
)(AppSnapshots);
