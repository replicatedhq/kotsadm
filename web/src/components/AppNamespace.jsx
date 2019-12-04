import * as React from "react";
import { graphql, compose, withApollo } from "react-apollo";
import { withRouter } from "react-router-dom";
import { Helmet } from "react-helmet";
import { uploadAppNamespace } from "../mutations/AppsMutations";
import { getKotsLicenseData } from "../queries/AppsQueries";

import "../scss/components/troubleshoot/UploadSupportBundleModal.scss";
import "../scss/components/Login.scss";

class AppNamespace extends React.Component {
  state = {
    uploadingNamespace: false,
    namespace: "",
  }

  submitNamespace = async () => {
    const { history, data } = this.props;
    const { namespace } = this.state;

    this.setState({ uploadingNamespace: true });
    try {
      await this.props.uploadAppNamespace(data.getKotsLicenseData.slug, namespace);
      this.setState({ uploadingNamespace: false });
      if (data.getKotsLicenseData?.isAirgap) {
        if (data.getKotsLicenseData?.needsRegistry) {
          history.replace(`/${data.getKotsLicenseData.slug}/airgap`);
        } else {
          history.replace(`/${data.getKotsLicenseData.slug}/airgap-bundle`);
        }
        return;
      }

      if (data.getKotsLicenseData?.isConfigurable) {
        history.replace(`/${data.getKotsLicenseData.slug}/config`);
        return;
      }

      if (data.getKotsLicenseData?.hasPreflight) {
        history.replace("/preflight");
        return;
      }

      // No airgap, config or preflight? Go to the kotsApp detail view that was just uploaded
      if (data.getKotsLicenseData) {
        history.replace(`/app/${data.getKotsLicenseData.slug}`);
      }
    } catch (err) {
      this.setState({ uploadingNamespace: false });
      console.log(err)
    }
  }

  render() {
    const {
      appName,
      logo,
      fetchingMetadata,
    } = this.props;

    return (
      <div className="UploadLicenseFile--wrapper container flex-column flex1 u-overflow--auto Login-wrapper justifyContent--center alignItems--center">
        <Helmet>
          <title>{`${appName ? `${appName} Admin Console` : "Admin Console"}`}</title>
        </Helmet>
        <div className="LoginBox-wrapper u-flexTabletReflow flex-auto">
          <div className="flex-auto flex-column login-form-wrapper secure-console justifyContent--center">
            <div className="flex-column alignItems--center">
              {logo
              ? <span className="icon brand-login-icon" style={{ backgroundImage: `url(${logo})` }} />
              : !fetchingMetadata ? <span className="icon kots-login-icon" />
              : <span style={{ width: "60px", height: "60px" }} />
              }
              <p className="u-marginTop--10 u-paddingTop--5 u-fontSize--header u-color--tuna u-fontWeight--bold">Install {appName ? appName : "application"}</p>
              <p className="u-marginTop--10 u-marginTop--5 u-fontSize--large u-textAlign--center u-fontWeight--medium u-lineHeight--normal u-color--dustyGray">
                {appName ? appName : "Your application"} can be installed into any namespace on this cluster. It's recommended to install every application into it's own&nbsp;namespace.
              </p>
              <div className="u-marginTop--30 u-textAlign--left flex1 flex-column u-width--full">
                <p className="u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Namespace</p>
                <input type="text" className="Input" placeholder="Application namespace" value={this.state.namespace} disabled={!this.state.namespace.length || this.state.uploadingNamespace} onChange={(e) => this.setState({ namespace: e.target.value })} />
              </div>
            </div>
            <div className="u-marginTop--10">
              <button type="button" className="btn primary u-marginTop--10" onClick={this.submitNamespace} disabled={this.state.uploadingNamespace}>{this.state.uploadingNamespace ? "Setting namespace" : "Set namespace"}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default compose(
  withRouter,
  withApollo,
  graphql(getKotsLicenseData, {
    options: props => {
      const { match } = props;
      return {
        variables: {
          slug: match.params.slug
        }
      }
    }
  }),
  graphql(uploadAppNamespace, {
    props: ({ mutate }) => ({
      uploadAppNamespace: (slug, namespace) => mutate({ variables: { slug, namespace } })
    })
  })
)(AppNamespace);
