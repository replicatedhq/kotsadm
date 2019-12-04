import * as React from "react";
import Select from "react-select";
import find from "lodash/find";
import classNames from "classnames";
import Loader from "../shared/Loader";
import { withRouter, Link } from "react-router-dom";
import { graphql, compose, withApollo } from "react-apollo";
import { listApps } from "@src/queries/AppsQueries";
import GitOpsFlowIllustration from "./GitOpsFlowIllustration";
import { setAppGitOps } from "@src/mutations/AppsMutations";
import "../../scss/components/gitops/GitOpsDeploymentManager.scss";

const STEPS = [
  {
    step: "setup",
    title: "Set up GitOps",
  },
  {
    step: "provider",
    title: "GitOps provider",
  },
  {
    step: "action",
    title: "GitOps action ",
  },
];
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
class GitOpsDeploymentManager extends React.Component {
  state = {
    step: "setup",
    ownerRepo: "",
    branch: "",
    path: "",
    hostname: "",
    services: SERVICES,
    selectedService: SERVICES[0],
    otherService: "",
    providerError: null,
    actionPath: "commit",
    containType: "single"
  }

  finishSetup = async () => {
    const { listAppsQuery } = this.props;
    const {
      selectedService,
      ownerRepo,
      branch,
      path,
      hostname,
      actionPath,
      otherService,
      containType
    } = this.state;

    const kotsApps = listAppsQuery.listApps?.kotsApps;
    const firstApp = kotsApps?.length ? kotsApps[0] : null;
    if (!firstApp) {
      console.log("no app");
      return;
    }

    const clusterId = firstApp.downstreams[0]?.cluster?.id;
    const isGitlab = selectedService?.value === "gitlab" || selectedService?.value === "gitlab_enterprise";
    const isBitbucket = selectedService?.value === "bitbucket" || selectedService?.value === "bitbucket_server";
    const serviceUri = isGitlab ? "gitlab.com" : isBitbucket ? "bitbucket.org" : "github.com";

    let gitOpsInput = new Object();
    gitOpsInput.provider = selectedService.value;
    gitOpsInput.uri = `https://${serviceUri}/${ownerRepo}`;
    gitOpsInput.owner = ownerRepo;
    gitOpsInput.branch = branch || "master";
    gitOpsInput.path = path;
    gitOpsInput.format = containType;
    gitOpsInput.action = actionPath;
    if (selectedService.value === "gitlab_enterprise" || selectedService.value === "github_enterprise") {
      gitOpsInput.hostname = hostname;
    }
    if (selectedService.value === "other") {
      gitOpsInput.otherServiceName = otherService;
    }

    try {
      await this.props.setAppGitOps(firstApp.id, clusterId, gitOpsInput);
      this.props.history.push(`/app/${firstApp.slug}/gitops`);
    } catch (error) {
      console.log(error);
    }
  }

  validStep = (step) => {
    const {
      selectedService,
      otherService,
      ownerRepo,
      hostname,
    } = this.state;

    this.setState({ providerError: null });
    if (step === "provider") {
      if (selectedService.value === "other" && !otherService.length) {
        this.setState({
          providerError: {
            field: "other"
          }
        });
        return false;
      }
      if (selectedService.value !== "other") {
        if (selectedService.value === "github_enterprise" && !hostname.length) {
          this.setState({
            providerError: {
              field: "hostname"
            }
          });
          return false;
        }
      }
    } else if (step === "action") {
      if (!ownerRepo.length) {
        this.setState({
          providerError: {
            field: "ownerRepo"
          }
        });
        return false;
      }
    }

    return true;
  }

  stepFrom = (from, to) => {
    if (this.validStep(from)) {
      this.setState({
        step: to
      });
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

  onActionTypeChange = (e) => {
    if (e.target.classList.contains("js-preventDefault")) { return }
    this.setState({ actionPath: e.target.value });
  }

  onFileContainChange = (e) => {
    if (e.target.classList.contains("js-preventDefault")) { return }
    this.setState({ containType: e.target.value });
  }

  handleServiceChange = (selectedService) => {
    this.setState({ selectedService });
  }

  renderGitOpsProviderSelector = (services, selectedService) => {
    return (
      <div className="flex flex1 flex-column u-marginRight--10">
        <p className="u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--normal">Which GitOps provider do you use?</p>
        <p className="u-fontSize--normal u-color--dustyGray u-fontWeight--medium u-lineHeight--normal u-marginBottom--10">If your provider is not listed, select “Other”.</p>
        <div className="u-position--relative">
          <Select
            className="replicated-select-container"
            classNamePrefix="replicated-select"
            placeholder="Select a GitOps service"
            options={services}
            isSearchable={false}
            getOptionLabel={(service) => this.getLabel(service, service.label)}
            getOptionValue={(service) => service.label}
            value={selectedService}
            onChange={this.handleServiceChange}
            isOptionSelected={(option) => { option.value === selectedService }}
          />
        </div>
      </div>
    );
  }

  renderHostName = (hostname, providerError) => {
    return (
      <div className="flex flex1 flex-column u-marginLeft--10">
        <p className="u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--normal">Hostname</p>
        <p className="u-fontSize--normal u-color--dustyGray u-fontWeight--medium u-lineHeight--normal u-marginBottom--10">Hostname of your Enterprise server.</p>
        <input type="text" className={`Input ${providerError?.field === "hostname" && "has-error"}`} placeholder="hostname" value={hostname} onChange={(e) => this.setState({ hostname: e.target.value })} />
        {providerError?.field === "hostname" && <p className="u-fontSize--small u-marginTop--5 u-color--chestnut u-fontWeight--medium u-lineHeight--normal">A hostname must be provided</p>}
      </div>
    );
  }

  renderActiveStep = (step) => {
    const {
      ownerRepo,
      branch,
      path,
      hostname,
      services,
      selectedService,
      otherService,
      providerError
    } = this.state;

    const isGitlab = selectedService?.value === "gitlab" || selectedService?.value === "gitlab_enterprise";
    const isBitbucket = selectedService?.value === "bitbucket" || selectedService?.value === "bitbucket_server";
    const serviceSite = isGitlab ? "gitlab.com" : isBitbucket ? "bitbucket.org" : "github.com";

    switch (step.step) {
      case "setup":
        return (
        <div key={`${step.step}-active`} className="GitOpsDeploy--step">
          <GitOpsFlowIllustration />
          <p className="step-title">Deploy using a GitOps workflow</p>
          <p className="step-sub">Connect a git version control system to this Admin Console. After setting this up, it will be<br/>possible to have all application updates (upstream updates, license updates, config changes)<br/>directly commited to any git repository and automatic deployments will be disabled.</p>
          <div>
            <button className="btn primary blue u-marginTop--10" type="button" onClick={() => this.stepFrom("setup", "provider")}>Get started</button>
          </div>
        </div>
      );
      case "provider":
        return (
          <div key={`${step.step}-active`} className="GitOpsDeploy--step u-textAlign--left">
            <p className="step-title">{step.title}</p>
            <p className="step-sub">Before the Admin Console can push changes to your Git repository, some information about your Git configuration is required.</p>
            <div className="flex-column u-textAlign--left u-marginBottom--30">
              <div className="flex flex1">
                {this.renderGitOpsProviderSelector(services, selectedService)}
                {selectedService?.value === "other" ?
                  <div className="flex flex1 flex-column u-marginLeft--10">
                    <p className="u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--normal">What GitOps service do you use?</p>
                    <p className="u-fontSize--normal u-color--dustyGray u-fontWeight--medium u-lineHeight--normal u-marginBottom--10">Not all services are supported.</p>
                    <input type="text" className={`Input ${providerError?.field === "other" && "has-error"}`} placeholder="What service would you like to use" value={otherService} onChange={(e) => this.setState({ otherService: e.target.value })} />
                    {providerError?.field === "other" && <p className="u-fontSize--small u-marginTop--5 u-color--chestnut u-fontWeight--medium u-lineHeight--normal">A GitOps service name must be provided</p>}
                  </div>
                : selectedService?.value === "github_enterprise" || selectedService?.value === "gitlab_enterprise"
                  ? this.renderHostName(hostname, providerError)
                  : <div className="flex flex1" />
                }
              </div>
            </div>
            <div>
              <button className="btn primary blue" type="button" onClick={() => this.stepFrom("provider", "action")}>Continue to deployment action</button>
            </div>
          </div>
        );
      case "action":
        return (
          <div key={`${step.step}-active`} className="GitOpsDeploy--step u-textAlign--left">
            <div className="StepContent--widthRestrict">
              <p className="step-title">Enable GitOps for {this.props.appName}</p>

              <div className="flex flex1 u-marginBottom--30 u-marginTop--20">
                {selectedService?.value !== "other" &&
                  <div className="flex flex1 flex-column u-marginRight--20">
                    <p className="u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--normal">Owner &amp; Repository</p>
                    <p className="u-fontSize--normal u-color--dustyGray u-fontWeight--medium u-lineHeight--normal u-marginBottom--10">Where will the commit be made?</p>
                    <input type="text" className={`Input ${providerError?.field === "ownerRepo" && "has-error"}`} placeholder="owner/repository" value={ownerRepo} onChange={(e) => this.setState({ ownerRepo: e.target.value })} />
                    {providerError?.field === "ownerRepo" && <p className="u-fontSize--small u-marginTop--5 u-color--chestnut u-fontWeight--medium u-lineHeight--normal">A owner and repository must be provided</p>}
                  </div>
                }
                {selectedService?.value !== "other" &&
                  <div className="flex flex1 flex-column u-marginRight--20">
                    <p className="u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--normal">Branch</p>
                    <p className="u-fontSize--normal u-color--dustyGray u-fontWeight--medium u-lineHeight--normal u-marginBottom--10">Master will be used by default.</p>
                    <input type="text" className={`Input`} placeholder="master" value={branch} onChange={(e) => this.setState({ branch: e.target.value })} />
                  </div>
                }
                {selectedService?.value !== "other" &&
                  <div className="flex flex1 flex-column">
                    <p className="u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--normal">Path</p>
                    <p className="u-fontSize--normal u-color--dustyGray u-fontWeight--medium u-lineHeight--normal u-marginBottom--10">Where will the deployment file live?</p>
                    <input type="text" className={"Input"} placeholder="/my-path" value={path} onChange={(e) => this.setState({ path: e.target.value })} />
                  </div>
                }
              </div>

              <p className="step-sub">When an update is available{this.props.appName ? ` to ${this.props.appName} ` : ""}, how should the updates YAML be delivered to&nbsp;{selectedService.label === "Other" ? otherService : serviceSite}?</p>
              <div className="flex flex1 u-marginTop--normal gitops-checkboxes justifyContent--center u-marginBottom--30">
                <div className="BoxedCheckbox-wrapper flex1 u-textAlign--left u-marginRight--10">
                  <div className={`BoxedCheckbox flex-auto flex ${this.state.actionPath === "commit" ? "is-active" : ""}`}>
                    <input
                      type="radio"
                      className="u-cursor--pointer hidden-input"
                      id="commitOption"
                      checked={this.state.actionPath === "commit"}
                      defaultValue="commit"
                      onChange={(e) => { this.onActionTypeChange(e) }}
                    />
                    <label htmlFor="commitOption" className="flex1 flex u-width--full u-position--relative u-cursor--pointer u-userSelect--none">
                      <div className="flex-auto">
                        <span className="icon clickable commitOptionIcon u-marginRight--10" />
                      </div>
                      <div className="flex1">
                        <p className="u-color--tuna u-fontSize--normal u-fontWeight--medium">Create a commit</p>
                        <p className="u-color--dustyGray u-fontSize--small u-fontWeight--medium u-marginTop--5">Automatic commits to repo</p>
                      </div>
                    </label>
                  </div>
                </div>
                <div className="BoxedCheckbox-wrapper flex1 u-textAlign--left u-marginLeft--10">
                  <div className={`BoxedCheckbox flex1 flex ${this.state.actionPath === "pullRequest" ? "is-active" : ""} is-disabled`}>
                    <input
                      type="radio"
                      className="u-cursor--pointer hidden-input"
                      id="pullRequestOption"
                      checked={this.state.actionPath === "pullRequest"}
                      defaultValue="pullRequest"
                      onChange={(e) => { this.onActionTypeChange(e) }}
                      disabled={true}
                    />
                    <label htmlFor="pullRequestOption" className="flex1 flex u-width--full u-position--relative u-cursor--pointer u-userSelect--none">
                      <div className="flex-auto">
                      <span className="icon pullRequestOptionIcon u-marginRight--10" />
                      </div>
                      <div className="flex1">
                        <p className="u-color--tuna u-fontSize--normal u-fontWeight--medium">Open a {isBitbucket ? "Merge" : "Pull"} Request</p>
                        <p className="u-color--dustyGray u-fontSize--small u-fontWeight--medium u-marginTop--5">Coming soon!</p>
                      </div>
                    </label>
                  </div>
                </div>
                <div className="BoxedCheckbox-wrapper flex1" />
              </div>

              <div className="u-marginBottom--10 u-textAlign--left">
                <p className="u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--normal">What content will it contain?</p>
                <p className="u-fontSize--normal u-color--dustyGray u-fontWeight--medium u-lineHeight--normal u-marginBottom--10">Your commit can include a single rendered yaml file or it’s full output.</p>
              </div>

              <div className="flex flex1 u-marginTop--normal gitops-checkboxes justifyContent--center u-marginBottom--30">
                <div className="BoxedCheckbox-wrapper flex1 u-textAlign--left u-marginRight--10">
                  <div className={`BoxedCheckbox flex1 flex ${this.state.containType === "single" ? "is-active" : ""}`}>
                    <input
                      type="radio"
                      className="u-cursor--pointer hidden-input"
                      id="singleOption"
                      checked={this.state.containType === "single"}
                      defaultValue="single"
                      onChange={(e) => { this.onFileContainChange(e) }}
                    />
                    <label htmlFor="singleOption" className="flex1 flex u-width--full u-position--relative u-cursor--pointer u-userSelect--none">
                      <div className="flex-auto">
                        <span className="icon clickable singleOptionIcon u-marginRight--10" />
                      </div>
                      <div className="flex1">
                        <p className="u-color--tuna u-fontSize--normal u-fontWeight--medium">Rendered YAML</p>
                        <p className="u-color--dustyGray u-fontSize--small u-fontWeight--medium u-marginTop--5">Apply using <span className="inline-code no-bg">kubectl apply -f</span></p>
                      </div>
                    </label>
                  </div>
                </div>
                <div className="BoxedCheckbox-wrapper flex1 u-textAlign--left u-marginLeft--10">
                  <div className={`BoxedCheckbox flex1 flex ${this.state.containType === "fullFiles" ? "is-active" : ""} is-disabled`}>
                    <input
                      type="radio"
                      className="u-cursor--pointer hidden-input"
                      id="fullFilesOption"
                      checked={this.state.containType === "fullFiles"}
                      defaultValue="fullFiles"
                      onChange={(e) => { this.onFileContainChange(e) }}
                      disabled={true}
                    />
                    <label htmlFor="fullFilesOption" className="flex1 flex u-width--full u-position--relative u-cursor--pointer u-userSelect--none">
                      <div className="flex-auto">
                      <span className="icon clickable fullFilesOptionIcon u-marginRight--10" />
                      </div>
                      <div className="flex1">
                        <p className="u-color--tuna u-fontSize--normal u-fontWeight--medium">Full Kustomizable Output</p>
                        <p className="u-color--dustyGray u-fontSize--small u-fontWeight--medium u-marginTop--5">Coming soon!</p>
                      </div>
                    </label>
                  </div>
                </div>
                <div className="BoxedCheckbox-wrapper flex1"></div>
              </div>

              <div>
                <button className="btn primary blue" type="button" onClick={this.finishSetup}>Finish GitOps setup</button>
              </div>
            </div>
          </div>
        );
      default:
        return <div key={`default-active`} className="GitOpsDeploy--step">default</div>;
    }
  }

  getGitOpsStatus = gitops => {
    if (gitops?.enabled && gitops?.isConnected) {
      return "Enabled, Working";
    }
    if (gitops?.enabled) {
      return "Enabled, Failing";
    }
    return "Not Enabled";
  }

  renderGitOpsStatusAction = (app, gitops) => {
    if (gitops?.enabled && gitops?.isConnected) {
      return null;
    }
    if (gitops?.enabled) {
      return <Link to={`/app/${app.slug}/troubleshoot`} className="gitops-status-link">Troubleshoot</Link>
    }
    return <Link to={`/app/${app.slug}`} className="gitops-status-link">Enable</Link>;
  }

  renderApps = () => {
    const { listAppsQuery } = this.props;
    const kotsApps = listAppsQuery.listApps?.kotsApps;
    return (
      <div>
        {kotsApps.map(app => {
          const downstream = app.downstreams?.length && app.downstreams[0];
          const gitops = downstream?.gitops;
          const gitopsEnabled = gitops?.enabled;
          const gitopsConnected = gitops?.isConnected;
          return (
            <div key={app.id} className="flex justifyContent--spaceBetween alignItems--center u-marginBottom--30">
              <div className="flex alignItems--center">
                <div style={{ backgroundImage: `url(${app.iconUri})` }} className="appIcon u-position--relative" />
                <p className="u-fontSize--large u-fontWeight--bold u-color--tundora u-marginLeft--10">{app.name}</p>
              </div>
              <div className="flex-column alignItems--flexEnd">
                <div className="flex alignItems--center u-marginBottom--5">
                  <div className={classNames("icon", {
                    "grayCircleMinus--icon": !gitopsEnabled && !gitopsConnected,
                    "error-small": gitopsEnabled && !gitopsConnected,
                    "checkmark-icon": gitopsEnabled && gitopsConnected
                    })}
                  />
                  <p className={classNames("u-fontSize--normal u-marginLeft--5", {
                    "u-color--dustyGray": !gitopsEnabled && !gitopsConnected,
                    "u-color--chestnut": gitopsEnabled && !gitopsConnected,
                    "u-color--chateauGreen": gitopsEnabled && gitopsConnected,
                  })}>
                    {this.getGitOpsStatus(gitops)}
                  </p>
                </div>
                {this.renderGitOpsStatusAction(app, gitops)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  renderConfiguredGitOps = () => {
    const { services, selectedService, hostname, providerError } = this.state;
    return (
      <div className="u-textAlign--center">
        <div className="ConfiguredGitOps--wrapper">
            <p className="u-fontSize--largest u-fontWeight--bold u-color--tundora u-lineHeight--normal u-marginBottom--30">Admin Console GitOps</p>
            <div className="flex u-marginBottom--20">
              {this.renderGitOpsProviderSelector(services, selectedService)}
              {this.renderHostName(hostname, providerError)}
            </div>
            <button className="btn secondary lightBlue u-marginBottom--30" onClick={this.updateSettings}>Update</button>
            <div className="separator" />
            {this.renderApps()}
        </div>
      </div>
    );
  }

  gitOpsIsConfigured = () => {
    const { listAppsQuery } = this.props;
    const kotsApps = listAppsQuery.listApps?.kotsApps;
    if (kotsApps) {
      const appIsConfigured = find(kotsApps, app => {
        const downstream = app.downstreams?.length && app.downstreams[0];
        return downstream?.gitops?.enabled;
      });
      return !!appIsConfigured;
    }
    return false;
  }

  render() {
    const { listAppsQuery } = this.props;
    if (listAppsQuery.loading) {
      return (
        <div className="flex-column flex1 alignItems--center justifyContent--center">
          <Loader size="60" />
        </div>
      );
    }

    const gitOpsIsConfigured = this.gitOpsIsConfigured();
    const activeStep = find(STEPS, { step: this.state.step });
    return (
      <div className="GitOpsDeploymentManager--wrapper flex-column flex1">
        {gitOpsIsConfigured ?
          this.renderConfiguredGitOps()
          :
          this.renderActiveStep(activeStep)
        }
      </div>
    );
  }
}

export default compose(
  withApollo,
  withRouter,
  graphql(listApps, {
    name: "listAppsQuery",
    options: () => ({
      fetchPolicy: "no-cache"
    })
  }),
  graphql(setAppGitOps, {
    props: ({ mutate }) => ({
      setAppGitOps: (appId, clusterId, gitOpsInput) => mutate({ variables: { appId, clusterId, gitOpsInput } })
    })
  }),
)(GitOpsDeploymentManager);
