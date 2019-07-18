import React, { Component } from "react";
import Helmet from "react-helmet";

import {
  Utilities,
  getReadableLicenseType,
  isLicenseOutOfDate,
  getEntitlementSpecFromState
} from "@src/utilities/utilities";

import { graphql, compose, withApollo } from "react-apollo";
import { getWatchLicense, getLatestWatchLicense } from "@src/queries/WatchQueries";
import { syncWatchLicense } from "@src/mutations/WatchMutations";

class WatchLicense extends Component {

  constructor(props) {
    super(props);

    this.state = {
      watchLicense: null,
      latestWatchLicense: null,
      syncing: false,
      syncingError: ""
    }
  }

  // TODO: switch tabs, nothing appears?
  componentDidUpdate(lastProps) {
    if (this.props.getWatchLicense !== lastProps.getWatchLicense && this.props.getWatchLicense) {
      const { getWatchLicense } = this.props.getWatchLicense;
      if (getWatchLicense) {
        this.setState({ watchLicense: getWatchLicense });
      }
    }
    if (this.props.getLatestWatchLicense !== lastProps.getLatestWatchLicense && this.props.getLatestWatchLicense) {
      const { getLatestWatchLicense } = this.props.getLatestWatchLicense;
      if (getLatestWatchLicense) {
        this.setState({ latestWatchLicense: getLatestWatchLicense });
      }
    }
  }

  syncWatchLicense = () => {
    this.setState({ syncing: true });
    // TODO: remove static license
    const { watch } = this.props;
    this.props.syncWatchLicense(watch.id, "meOqgwZf1jSPHjjjAc-G0w74sFHDKXgN", getEntitlementSpecFromState(watch.stateJSON))
    .then(response => {
      this.setState({ watchLicense: response.data.syncWatchLicense });
    })
    .catch(err => {
      console.log(err);
      this.setState({ syncingError: err });
    })
    .finally(() => {
      this.setState({ syncing: false });
    });
  }

  render() {
    const { watchLicense, latestWatchLicense } = this.state;

    // TODO: LOADER HERE
    if (!watchLicense || !latestWatchLicense) {
      return null;
    }

    const { watch } = this.props;
    const createdAt = Utilities.dateFormat(watchLicense.createdAt, "MMM D, YYYY");
    const licenseType = getReadableLicenseType(watchLicense.type);
    const assignedReleaseChannel = watchLicense.channel;
    const expiresAt = watchLicense.expiresAt ? "Never" : Utilities.dateFormat(watchLicense.expiresAt, "MMM D, YYYY");
    const isOutOfDate = isLicenseOutOfDate(watchLicense, latestWatchLicense);

    return (
      <div className="flex justifyContent--center">
        <Helmet>
          <title>{`${watch.watchName} License`}</title>
        </Helmet>
        <div className="LicenseDetails--wrapper u-textAlign--left u-paddingRight--20 u-paddingLeft--20">
          <p className="u-fontWeight--bold u-color--tuna u-fontSize--larger u-marginBottom--20 u-paddingBottom--5 u-lineHeight--normal">License details</p>
          <div className="u-color--tundora u-fontSize--normal u-fontWeight--medium">
            <div className="flex u-marginBottom--20">
              <p className="u-marginRight--10">Assigned release channel:</p>
              <p className="u-fontWeight--bold u-color--tuna">{assignedReleaseChannel}</p>
            </div>
            <div className="flex u-marginBottom--20">
              <p className="u-marginRight--10">Created:</p>
              <p className="u-fontWeight--bold u-color--tuna">{createdAt}</p>
            </div>
            <div className="flex u-marginBottom--20">
              <p className="u-marginRight--10">Expires:</p>
              <p className="u-fontWeight--bold u-color--tuna">{expiresAt}</p>
            </div>
            <div className="flex u-marginBottom--20">
              <p className="u-marginRight--10">License Type:</p>
              <p className="u-fontWeight--bold u-color--tuna">{licenseType}</p>
            </div>
            {watchLicense.entitlements && watchLicense.entitlements.map(entitlement => {
              return (
                <div key={entitlement.key} className="flex u-marginBottom--20">
                  <p className="u-marginRight--10">{entitlement.name}</p>
                  <p className="u-fontWeight--bold u-color--tuna">{entitlement.value}</p>
                </div>
              );
            })}
            <button className="btn secondary green u-marginTop--20" disabled={!isOutOfDate} onClick={() => this.syncWatchLicense(watch)}>Sync License</button>
          </div>
        </div>
      </div>
    );
  }
}

export default compose(
  withApollo,
  graphql(getWatchLicense, {
    name: "getWatchLicense",
    options: props => {
      return {
        variables: {
          watchId: props.watch.id,
          entitlementSpec: getEntitlementSpecFromState(props.watch.stateJSON)
        }
      };
    }
  }),
  graphql(getLatestWatchLicense, {
    name: "getLatestWatchLicense",
    options: props => {
      return {
        variables: {
          // TODO: remove static license
          licenseId: "meOqgwZf1jSPHjjjAc-G0w74sFHDKXgN",
          entitlementSpec: getEntitlementSpecFromState(props.watch.stateJSON)
        }
      };
    }
  }),
  graphql(syncWatchLicense, {
    props: ({ mutate }) => ({
      syncWatchLicense: (watchId, licenseId, entitlementSpec) => mutate({ variables: { watchId, licenseId, entitlementSpec } })
    })
  })
)(WatchLicense);

