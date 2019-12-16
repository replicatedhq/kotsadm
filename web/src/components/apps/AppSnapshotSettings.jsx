import React, { Component } from "react";
import Select from "react-select";
// import { graphql, compose, withApollo } from "react-apollo";
import { Link } from "react-router-dom"
import "../../scss/components/shared/SnapshotForm.scss";

const DESTINATIONS = [
  {
    value: "s3",
    label: "Amazon S3",
  },
  {
    value: "azure",
    label: "Azure Blob Storage",
  },
  {
    value: "gcs",
    label: "Google Cloud Storage",
  },
  {
    value: "s3-compatible",
    label: "Other S3-Compatible Storage",
  }
];

export default class AppSnapshotSchedule extends Component {
  state = {
    selectedDestination: "s3",
    s3bucket: "",
    bucketRegion: "",
    bucketPath: "",
    bucketEndpoint: "",
    useIam: false,
    bucketKeyId: "",
    bucketKeySecret: ""
  };

  handleFormChange = (field, e) => {
    let nextState = {};
    if (field === "useIam") {
      nextState[field] = e.target.checked;
    } else {
      nextState[field] = e.target.value;
    }
    this.setState(nextState);
  }

  handleDestinationChange = (retentionUnit) => {
    this.setState({ selectedDestination: retentionUnit });
  }

  render() {
    const { app } = this.props;
    const { useIam } = this.state;
    const selectedDestination = DESTINATIONS.find((d) => {
      return d.value === this.state.selectedDestination;
    });
    return (
      <div className="container flex-column flex1 u-overflow--auto u-paddingTop--30 u-paddingBottom--20 alignItems--center">
        <div className="snapshot-form-wrapper">
          <p className="u-marginBottom--30 u-fontSize--small u-color--tundora u-fontWeight--medium">
            <Link to={`/app/${app?.slug}/snapshots`} className="replicated-link">Snapshots</Link>
            <span className="u-color--dustyGray"> > </span>
            Settings
          </p>
          <form>
            <div className="flex1 u-marginBottom--30">
              <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Deduplication</p>
              <p className="u-fontSize--small u-color--dustyGray u-fontWeight--normal u-lineHeight--normal u-marginBottom--10">All data in your snapshots will be deduplicated. To learn more about how, <a className="replicated-link u-fontSize--small">check out our docs</a>.</p>
            </div>
            <div className="flex-column u-marginBottom--20">
              <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Destination</p>
              <div className="flex1">
                <Select
                  className="replicated-select-container"
                  classNamePrefix="replicated-select"
                  placeholder="Select unit"
                  options={DESTINATIONS}
                  isSearchable={false}
                  getOptionValue={(retentionUnit) => retentionUnit.label}
                  value={selectedDestination}
                  onChange={this.handleDestinationChange}
                  isOptionSelected={(option) => { option.value === selectedDestination }}
                />
              </div>
            </div>
            <div className="flex u-marginBottom--30">
              <div className="flex1 u-paddingRight--5">
                <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Bucket</p>
                <input type="text" className="Input" placeholder="Bucket name" value={this.state.s3bucket} onChange={(e) => { this.handleFormChange("s3bucket", e) }}/>
              </div>
              <div className="flex1 u-paddingLeft--5">
                <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Region</p>
                <input type="text" className="Input" placeholder="Bucket region" value={this.state.bucketRegion} onChange={(e) => { this.handleFormChange("bucketRegion", e) }}/>
              </div>
            </div>
            <div className="flex u-marginBottom--30">
              <div className="flex1 u-paddingRight--5">
                <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Path</p>
                <input type="text" className="Input" placeholder="/path/to/destination" value={this.state.bucketPath} onChange={(e) => { this.handleFormChange("bucketPath", e) }}/>
              </div>
              <div className="flex1 u-paddingLeft--5">
                <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Endpoint</p>
                <input type="text" className="Input" placeholder="endpoint" value={this.state.bucketEndpoint} onChange={(e) => { this.handleFormChange("bucketEndpoint", e) }}/>
              </div>
            </div>

            <div className="flex1 u-marginBottom--30">
              <div className="BoxedCheckbox-wrapper flex1 u-textAlign--left">
                <div className={`BoxedCheckbox flex-auto flex alignItems--center ${this.state.useIam ? "is-active" : ""}`}>
                  <input
                    type="checkbox"
                    className="u-cursor--pointer u-marginLeft--10"
                    id="useIam"
                    checked={this.state.useIam}
                    onChange={(e) => { this.handleFormChange("useIam", e) }}
                  />
                  <label htmlFor="useIam" className="flex1 flex u-width--full u-position--relative u-cursor--pointer u-userSelect--none">
                    <div className="flex1">
                      <p className="u-color--tuna u-fontSize--normal u-fontWeight--medium">Use IAM Role</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {useIam &&
              <div className="flex u-marginBottom--30">
                <div className="flex1 u-paddingRight--5">
                  <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Access Key ID</p>
                  <input type="text" className="Input" placeholder="key ID" value={this.state.bucketKeyId} onChange={(e) => { this.handleFormChange("bucketKeyId", e) }}/>
                </div>
                <div className="flex1 u-paddingLeft--5">
                  <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Secret Access Key</p>
                  <input type="text" className="Input" placeholder="access key" value={this.state.bucketKeySecret} onChange={(e) => { this.handleFormChange("bucketKeySecret", e) }}/>
                </div>
              </div>
            }

          </form>
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
