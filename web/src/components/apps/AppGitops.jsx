import React, { Component } from "react";
import { graphql, compose, withApollo } from "react-apollo";
import Helmet from "react-helmet";
import url from "url";
import CodeSnippet from "@src/components/shared/CodeSnippet";
import { testGitOpsConnection } from "../../mutations/AppsMutations";

import "../../scss/components/gitops/GitOpsSettings.scss";

const SERVICES = [
  {
    value: "github",
    label: "GitHub",
  },
  {
    value: "github_enterprise",
    label: "GitHub Enterprise",
  },
  {
    value: "gitlab",
    label: "GitLab",
  },
  {
    value: "gitlab_enterprise",
    label: "GitLab Enterprise",
  },
  {
    value: "bitbucket",
    label: "Bitbucket",
  },
  {
    value: "bitbucket_server",
    label: "Bitbucket Server",
  },
  {
    value: "other",
    label: "Other",
  }
]

class AppGitops extends Component {
  constructor(props) {
    super(props);

    let ownerRepo = "";
    if (props.app?.downstreams && props.app.downstreams.length > 0) {
      const gitops = props.app.downstreams[0].gitops;
      const parsed = url.parse(gitops?.uri);
      ownerRepo = parsed.path.slice(1);  // remove the "/"
    }

    this.state = {
      ownerRepo,
      testingConnection: false
    }
  }

  renderIcons = (service) => {
    if (service) {
      return <span className={`icon gitopsService--${service.value}`} />;
    } else {
      return;
    }
  }

  getLabel = (service, label) => {
    return (
      <div style={{ alignItems: "center", display: "flex" }}>
        <span style={{ fontSize: 18, marginRight: "10px" }}>{this.renderIcons(service)}</span>
        <span style={{ fontSize: 14 }}>{label}</span>
      </div>
    );
  }

  handleTestConnection = async () => {
    this.setState({ testingConnection: true });
    const appId = this.props.app?.id;
    let clusterId;
    if (this.props.app?.downstreams && this.props.app.downstreams.length > 0) {
      clusterId = this.props.app.downstreams[0].cluster.id;
    }

    try {
      await this.props.testGitOpsConnection(appId, clusterId);
      this.setState({ testingConnection: false });
      this.props.refetch();
    } catch (err) {
      this.setState({ testingConnection: false });
      console.log(err);
    }
  }
  
  goToTroubleshootPage = () => {
    const { app, history } = this.props;
    history.push(`/app/${app.slug}/troubleshoot`);
  }

  updateGitOpsSettings = () => {
    this.props.history.push(`/gitops`);
  }

  render() {
    const { app } = this.props;
    const appTitle = app.name;

    if (!app.downstreams || app.downstreams.length === 0) {
      return (
        <div />
      );
    }

    if (this.props.app.downstreams.length !== 1) {
      return (
        <div>This feature is only available for applications that have exactly 1 downstream.</div>
      );
    }

    const gitops = app.downstreams[0].gitops;

    const {
      ownerRepo,
      testingConnection,
    } = this.state;

    const selectedService = SERVICES.find((service) => {
      return service.value === gitops?.provider;
    });

    const isGitlab = selectedService?.value === "gitlab" || selectedService?.value === "gitlab_enterprise";
    const isBitbucket = selectedService?.value === "bitbucket" || selectedService?.value === "bitbucket_server";

    const gitUri = gitops?.uri;
    const deployKey = gitops?.deployKey;

    let addKeyUri = `${gitUri}/settings/keys/new`;
    if (isGitlab) {
      addKeyUri = `${gitUri}/-/settings/repository`;
    } else if (isBitbucket) {
      const owner = ownerRepo.split("/").length && ownerRepo.split("/")[0];
      addKeyUri = `https://bitbucket.org/account/user/${owner}/ssh-keys/`;
    }

    const gitopsIsConnected = gitops.enabled && gitops.isConnected;

    return (
      <div className="GitOpsSettings--wrapper container flex-column u-overflow--auto u-paddingBottom--20 alignItems--center">
        <Helmet>
          <title>{`${appTitle} GitOps`}</title>
        </Helmet>

        <div className="GitOpsSettings">
          <div className={`flex u-marginTop--30 justifyContent--center alignItems--center ${gitopsIsConnected ? "u-marginBottom--30" : "u-marginBottom--20"}`}>
            {app.iconUri
              ? <div style={{ backgroundImage: `url(${app.iconUri})` }} className="appIcon u-position--relative" />
              : <span className="icon onlyAirgapBundleIcon" />
            }
            <span className="icon onlyNoConnectionIcon u-marginLeft--10" />
            <span className="icon github-icon u-marginLeft--10" />
          </div>

          {gitopsIsConnected ?
            <div className="u-textAlign--center u-marginLeft--auto u-marginRight--auto">
              <p className="u-fontSize--largest u-fontWeight--bold u-color--tundora u-lineHeight--normal u-marginBottom--10">GitOps for {appTitle}</p>
              <p className="u-fontSize--normal u-color--dustyGray u-lineHeight--normal u-marginBottom--30">
                When an update is available for Sentry Enteprise, the Admin Console will commit the fully<br/>rendered and deployable YAML to /sentry-enterprise/rendered.yaml in the master branch of<br/>the replicatedhq/gitops-deploy repo on github.com.
              </p>
              <div className="flex justifyContent--center">
                <button className="btn secondary red u-marginRight--10" onClick={this.disableGitOps}>Disable GitOps</button>
                <button className="btn secondary lightBlue" onClick={this.updateGitOpsSettings}>Update GitOps Settings</button>
              </div>
            </div>
            :
            <div>
              <div className="GitopsSettings-noRepoAccess">
                <p className="title">Unable to access the repository</p>
                <p className="sub">Please check that the deploy key is added and has write access</p>
              </div>

              <div className="u-marginBottom--30">
                <p className="u-fontSize--large u-fontWeight--bold u-color--tundora u-lineHeight--normal u-marginBottom--5">
                  Deployment key
                </p>
                <p className="u-fontSize--normal u-fontWeight--normal u-color--dustyGray u-marginBottom--15">
                  Copy this deploy key to the
                  <a className="replicated-link" href={addKeyUri} target="_blank" rel="noopener noreferrer"> repo settings page.</a>
                </p>
                <CodeSnippet
                  canCopy={true}
                  copyText="Copy key"
                  onCopyText={<span className="u-color--chateauGreen">Deploy key has been copied to your clipboard</span>}>
                  {deployKey}
                </CodeSnippet>
              </div>

              <div className="flex">
                <button className={`btn secondary u-marginRight--10 ${testingConnection ? "is-disabled" : "lightBlue"}`} onClick={this.handleTestConnection}>{testingConnection ? "Testing connection" : "Try again"}</button>
                <button className="btn primary blue" onClick={this.goToTroubleshootPage}>Troubleshoot</button>
              </div>
            </div>
          }
        </div>
      </div>
    );
  }
}

export default compose(
  withApollo,
  graphql(testGitOpsConnection, {
    props: ({ mutate }) => ({
      testGitOpsConnection: (appId, clusterId) => mutate({ variables: { appId, clusterId } })
    })
  }),
)(AppGitops);
