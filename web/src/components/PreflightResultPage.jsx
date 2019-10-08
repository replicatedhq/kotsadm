import React, { Component } from "react";
import { Link } from "react-router-dom";
import { graphql, compose } from "react-apollo";
import { withRouter } from "react-router-dom";
import Modal from "react-modal";

import { getKotsPreflightResult, getLatestKotsPreflightResult } from "@src/queries/AppsQueries";
import { deployKotsVersion } from "@src/mutations/AppsMutations";
import Loader from "./shared/Loader";
import PreflightRenderer from "./PreflightRenderer";

class PreflightResultPage extends Component {
  state = {
    showSkipModal: false,
    showWarningModal: false
  }

  deployKotsDownstream = () => {
    // deploying downstream when NOT IN license flow
    const { makeCurrentVersion, match, data, history } = this.props;
    const gqlData = data.getKotsPreflightResult || data.getLatestKotsPreflightResult;
    const upstreamSlug = match.params.slug;

    const sequence = parseInt(match.params.sequence, 10);
    makeCurrentVersion(upstreamSlug, sequence, gqlData.clusterSlug).then(() => {
      history.push(`/app/${match.params.slug}/downstreams/${match.params.downstreamSlug}/version-history`);
    });
  }

  hasPreflightIssues = preflightResult => {
    try {
      const results = JSON.parse(preflightResult).results;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.isFail || result.isWarn) {
          return true;
        }
      }
      return false;
    } catch(err) {
      return true;
    }
  }

  onContinue = async (force = null) => {
    // deploying downstream when IN license flow
    try {
      const { data, history, match } = this.props;
      const preflightResultData = data.getKotsPreflightResult || data.getLatestKotsPreflightResult;

      if (this.hasPreflightIssues(preflightResultData?.result)) {
        if (force) {
          await this.props.deployKotsVersion(preflightResultData.appSlug, 0, preflightResultData.clusterSlug);
        } else {
          this.showWarningModal();
          return;
        }
      }

      if (match.params.downstreamSlug) {
        history.push(`/app/${preflightResultData.appSlug}/downstreams/${match.params.downstreamSlug}/version-history`);
      } else {
        history.push(`/app/${preflightResultData.appSlug}`);
      }
    } catch(error) {
      console.log(error);
    }
  }

  showSkipModal = () => {
    this.setState({
      showSkipModal: true
    })
  }

  hideSkipModal = () => {
    this.setState({
      showSkipModal: false
    });
  }

  showWarningModal = () => {
    this.setState({
      showWarningModal: true
    })
  }

  hideWarningModal = () => {
    this.setState({
      showWarningModal: false
    });
  }

  render() {
    const { data, match } = this.props;
    const { showSkipModal, showWarningModal } = this.state;
    const isLoading = data.loading;

    // No cluster slug is present if coming from the license upload view
    const isLicenseFlow = !match.params.clusterSlug;
    const preflightResultData = isLoading
      ? null
      : data.getKotsPreflightResult || data.getLatestKotsPreflightResult;
    const hasData = preflightResultData?.result;

    if (hasData) {
      data.stopPolling();
      if (showSkipModal) {
        this.hideSkipModal();
      }
    }

    return (
      <div className="flex-column flex1">
        <div className="flex1 u-overflow--auto">
          <div className="PreflightChecks--wrapper flex u-paddingTop--30 u-overflow--hidden">
            <div className="u-minWidth--full u-minHeight--full">
              <p className="u-fontSize--header u-color--tuna u-fontWeight--bold">
                Preflight checks
              </p>
              <p className="u-fontWeight--medium u-lineHeight--more u-marginTop--5 u-marginBottom--10">
                Preflight checks are designed to be run against a target cluster before installing an application. Preflights are simply a different set of collectors + analyzers. These checks are optional but are recommended to ensure that the application you install will work properly.
              </p>
              {(isLoading || !hasData) && (
                <div className="flex-column justifyContent--center alignItems--center u-minHeight--full u-minWidth--full">
                  <Loader size="60" />
                </div>
              )}
              {hasData && (
                <div className="flex-column">
                  <PreflightRenderer
                    className="u-marginTop--20"
                    onDeployClick={this.deployKotsDownstream}
                    results={preflightResultData.result}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        {hasData && !isLicenseFlow && (
          <div className="flex-auto flex justifyContent--flexEnd">
            <button
              type="button"
              className="btn primary u-marginRight--30 u-marginBottom--15"
              onClick={this.deployKotsDownstream}
            >
              Create Downstream Cluster
          </button>
          </div>
        )}
        {hasData && isLicenseFlow && (
          <div className="flex-auto flex justifyContent--flexEnd">
            <button
              type="button"
              className="btn primary u-marginRight--30 u-marginBottom--15"
              onClick={() => this.onContinue(false)}
            >
              Continue
            </button>
          </div>
        )}
        {!hasData && (
          <div className="flex-auto flex justifyContent--flexEnd">
            <button
              type="button"
              className="btn primary u-marginRight--30 u-marginBottom--15"
              onClick={this.showSkipModal}
            >
              Skip
            </button>
          </div>
        )}

        <Modal
          isOpen={showSkipModal}
          onRequestClose={this.hideSkipModal}
          shouldReturnFocusAfterClose={false}
          contentLabel="Skip preflight checks"
          ariaHideApp={false}
          className="Modal"
        >
          <div className="Modal-body">

            <p className="u-fontSize--normal u-color--dustyGray u-lineHeight--normal u-marginBottom--20">Skipping preflight checks will not cancel them. They will continue to run in the background. Do you want to continue to the {preflightResultData?.appSlug} dashboard? </p>
            <div className="u-marginTop--10 flex justifyContent--flexEnd">
              <Link to={`/app/${preflightResultData?.appSlug}`}>
                <button type="button" className="btn green primary">Go to Dashboard</button>
              </Link>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showWarningModal}
          onRequestClose={this.hideWarningModal}
          shouldReturnFocusAfterClose={false}
          contentLabel="Preflight shows some issues"
          ariaHideApp={false}
          className="Modal"
        >
          <div className="Modal-body">

            <p className="u-fontSize--normal u-color--dustyGray u-lineHeight--normal u-marginBottom--20">Preflight is showing some issues, are you sure you want to continue?</p>
            <div className="u-marginTop--10 flex justifyContent--flexEnd">
              <button type="button" className="btn secondary" onClick={this.hideWarningModal}>Cancel</button>
              <button type="button" className="btn green primary u-marginLeft--10" onClick={() => this.onContinue(true)}>Deploy and continue</button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }
}

export default compose(
  withRouter,
  graphql(getKotsPreflightResult, {
    skip: props => {
      const { match } = props;
      return !match.params.downstreamSlug;
    },
    options: props => {
      const { match } = props;

      return {
        pollInterval: 2000,
        variables: {
          appSlug: match.params.slug,
          clusterSlug: match.params.downstreamSlug,
          sequence: match.params.sequence
        }
      };
    }
  }),
  graphql(getLatestKotsPreflightResult, {
    skip: props => {
      const { match } = props;

      return !!match.params.downstreamSlug;
    },
    options: () => {
      return {
        pollInterval: 2000
      }
    }
  }),
  graphql(deployKotsVersion, {
    props: ({ mutate }) => ({
      deployKotsVersion: (upstreamSlug, sequence, clusterSlug) => mutate({ variables: { upstreamSlug, sequence, clusterSlug } })
    })
  }),
)(PreflightResultPage);
