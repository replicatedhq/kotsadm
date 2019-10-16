import React, { Component } from "react";
import Helmet from "react-helmet";

import {
  // isKotsLicenseOutOfDate,
  getLicenseExpiryDate,
} from "@src/utilities/utilities";

import { graphql, compose, withApollo } from "react-apollo";
import { getAppLicense/*, getLatestAppLicense*/ } from "@src/queries/AppsQueries";
import { syncAppLicense } from "@src/mutations/AppsMutations";
import Loader from "../shared/Loader";

class AppLicense extends Component {

  constructor(props) {
    super(props);

    this.state = {
      appLicense: null,
      latestAppLicense: null,
      syncing: false,
      syncingError: ""
    }
  }

  componentDidMount() {
    const { getAppLicense } = this.props.getAppLicense;
    if (getAppLicense) {
      this.setState({ appLicense: getAppLicense });
    }
  }

  componentDidUpdate(lastProps) {
    // current license
    if (this.props.getAppLicense !== lastProps.getAppLicense && this.props.getAppLicense) {
      const { getAppLicense } = this.props.getAppLicense;
      if (getAppLicense) {
        this.setState({ appLicense: getAppLicense });
      }
    }
    // latest license
    // if (this.props.getLatestAppLicense !== lastProps.getLatestAppLicense && this.props.getLatestAppLicense) {
    //   const { getLatestAppLicense } = this.props.getLatestAppLicense;
    //   if (getLatestAppLicense) {
    //     this.setState({ latestAppLicense: getLatestAppLicense });
    //   }
    // }
  }

  syncAppLicense = () => {
    this.setState({ syncing: true, syncingError: "" });
    const { app } = this.props;

    const licenseId = "uxqTWosxLTYwLqC1mk_EAbpHnds8x_Fw"; // FIX THIS!

    this.props.syncAppLicense(app.id, licenseId)
      .then(response => {
        this.setState({ appLicense: response.data.syncAppLicense });
      })
      .catch(err => {
        console.log(err);
        err.graphQLErrors.map(({ message }) => {
          this.setState({ syncingError: message });
        });
      })
      .finally(() => {
        this.setState({ syncing: false });
      });
  }

  render() {
    const { appLicense/*, latestAppLicense*/, syncing, syncingError } = this.state;

    if (!appLicense/* || !latestAppLicense*/) {
      return (
        <div className="flex-column flex1 alignItems--center justifyContent--center">
          <Loader size="60" />
        </div>
      );
    }

    const { app } = this.props;

    const expiresAt = getLicenseExpiryDate(appLicense);
    const isOutOfDate = false; // isKotsLicenseOutOfDate(appLicense, latestAppLicense);

    return (
      <div className="flex justifyContent--center">
        <Helmet>
          <title>{`${app.name} License`}</title>
        </Helmet>
        <div className="LicenseDetails--wrapper u-textAlign--left u-paddingRight--20 u-paddingLeft--20">
          <div className="flex u-marginBottom--20 u-paddingBottom--5 u-marginTop--20 alignItems--center">
            <p className="u-fontWeight--bold u-color--tuna u-fontSize--larger u-lineHeight--normal u-marginRight--10">License details</p>
            {isOutOfDate && <p className="u-fontWeight--bold u-color--orange">Outdated</p>}
          </div>
          <div className="u-color--tundora u-fontSize--normal u-fontWeight--medium">
            <div className="flex u-marginBottom--20">
              <p className="u-marginRight--10">Expires:</p>
              <p className="u-fontWeight--bold u-color--tuna">{expiresAt}</p>
            </div>
            {appLicense.entitlements?.map(entitlement => {
              return (
                <div key={entitlement.key} className="flex u-marginBottom--20">
                  <p className="u-marginRight--10">{entitlement.title}</p>
                  <p className="u-fontWeight--bold u-color--tuna">{entitlement.value}</p>
                </div>
              );
            })}
            <button className="btn secondary green u-marginBottom--10" disabled={syncing} onClick={() => this.syncAppLicense(app)}>{syncing ? "Syncing" : "Sync License"}</button>
            {syncingError && <p className="u-fontWeight--bold u-color--red u-fontSize--small u-position--absolute">{syncingError}</p>}
          </div>
        </div>
      </div>
    );
  }
}

export default compose(
  withApollo,
  graphql(getAppLicense, {
    name: "getAppLicense",
    options: props => {
      return {
        variables: {
          appId: props.app.id
        },
        fetchPolicy: "no-cache"
      };
    }
  }),
  // graphql(getLatestAppLicense, {
  //   name: "getLatestAppLicense",
  //   options: () => {
  //     const licenseId = "uxqTWosxLTYwLqC1mk_EAbpHnds8x_Fw"; // FIX THIS!
  //     return {
  //       variables: {
  //         licenseId
  //       },
  //       fetchPolicy: "no-cache"
  //     };
  //   }
  // }),
  graphql(syncAppLicense, {
    props: ({ mutate }) => ({
        syncAppLicense: (appId, licenseId) => mutate({ variables: { appId, licenseId } })
    })
  })
)(AppLicense);
