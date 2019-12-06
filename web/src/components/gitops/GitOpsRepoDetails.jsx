import * as React from "react";
import PropTypes from "prop-types";
import "../../scss/components/gitops/GitOpsDeploymentManager.scss";

class GitOpsRepoDetails extends React.Component {
  static propTypes = {
    appName: PropTypes.string.isRequired,
    selectedService: PropTypes.object.isRequired,
    ownerRepo: PropTypes.string,
    branch: PropTypes.string,
    path: PropTypes.string,
    otherService: PropTypes.string,
    actionPath: PropTypes.string,
    containType: PropTypes.string,
  }

  static defaultProps = {
    ownerRepo: "",
    branch: "",
    path: "",
    otherService: "",
    actionPath: "commit",
    containType: "single"
  }

  constructor(props) {
    super(props);

    const {
      appName,
      selectedService,
      ownerRepo = "",
      branch = "",
      path = "",
      otherService = "",
      actionPath = "commit",
      containType = "single",
    } = this.props;

    this.state = {
      appName,
      selectedService,
      providerError: null,
      ownerRepo,
      branch,
      path,
      otherService,
      actionPath,
      containType,
    };
  }

  onActionTypeChange = (e) => {
    if (e.target.classList.contains("js-preventDefault")) { return }
    this.setState({ actionPath: e.target.value });
  }

  onFileContainChange = (e) => {
    if (e.target.classList.contains("js-preventDefault")) { return }
    this.setState({ containType: e.target.value });
  }

  isValid = () => {
    const { ownerRepo } = this.state;
    if (!ownerRepo.length) {
      this.setState({
        providerError: {
          field: "ownerRepo"
        }
      });
      return false;
    }
    return true;
  }

  onFinishSetup = () => {
    if (!this.isValid()) {
      return;
    }
    const repoDetails = { ...this.state };
    this.props.onFinishSetup(repoDetails);
  }

  render() {
    const {
      appName,
      selectedService,
      providerError,
      ownerRepo,
      branch,
      path,
      otherService,
      actionPath,
      containType,
    } = this.state;

    const provider = selectedService?.value;
    const isGitlab = provider === "gitlab" || provider === "gitlab_enterprise";
    const isBitbucket = provider === "bitbucket" || provider === "bitbucket_server";
    const serviceSite = isGitlab ? "gitlab.com" : isBitbucket ? "bitbucket.org" : "github.com";

    return (
      <div key={`action-active`} className="GitOpsDeploy--step u-textAlign--left">
          <div className="StepContent--widthRestrict">
            <p className="step-title">Enable GitOps for {appName}</p>

            <div className="flex flex1 u-marginBottom--30 u-marginTop--20">
              {provider !== "other" &&
                <div className="flex flex1 flex-column u-marginRight--20">
                  <p className="u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--normal">Owner &amp; Repository</p>
                  <p className="u-fontSize--normal u-color--dustyGray u-fontWeight--medium u-lineHeight--normal u-marginBottom--10">Where will the commit be made?</p>
                  <input type="text" className={`Input ${providerError?.field === "ownerRepo" && "has-error"}`} placeholder="owner/repository" value={ownerRepo} onChange={(e) => this.setState({ ownerRepo: e.target.value })} />
                  {providerError?.field === "ownerRepo" && <p className="u-fontSize--small u-marginTop--5 u-color--chestnut u-fontWeight--medium u-lineHeight--normal">A owner and repository must be provided</p>}
                </div>
              }
              {provider !== "other" &&
                <div className="flex flex1 flex-column u-marginRight--20">
                  <p className="u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--normal">Branch</p>
                  <p className="u-fontSize--normal u-color--dustyGray u-fontWeight--medium u-lineHeight--normal u-marginBottom--10">Master will be used by default.</p>
                  <input type="text" className={`Input`} placeholder="master" value={branch} onChange={(e) => this.setState({ branch: e.target.value })} />
                </div>
              }
              {provider !== "other" &&
                <div className="flex flex1 flex-column">
                  <p className="u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--normal">Path</p>
                  <p className="u-fontSize--normal u-color--dustyGray u-fontWeight--medium u-lineHeight--normal u-marginBottom--10">Where will the deployment file live?</p>
                  <input type="text" className={"Input"} placeholder="/my-path" value={path} onChange={(e) => this.setState({ path: e.target.value })} />
                </div>
              }
            </div>

            <p className="step-sub">When an update is available{appName ? ` to ${appName} ` : ""}, how should the updates YAML be delivered to&nbsp;{selectedService.label === "Other" ? otherService : serviceSite}?</p>
            <div className="flex flex1 u-marginTop--normal gitops-checkboxes justifyContent--center u-marginBottom--30">
              <div className="BoxedCheckbox-wrapper flex1 u-textAlign--left u-marginRight--10">
                <div className={`BoxedCheckbox flex-auto flex ${actionPath === "commit" ? "is-active" : ""}`}>
                  <input
                    type="radio"
                    className="u-cursor--pointer hidden-input"
                    id="commitOption"
                    checked={actionPath === "commit"}
                    defaultValue="commit"
                    onChange={this.onActionTypeChange}
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
                <div className={`BoxedCheckbox flex1 flex ${actionPath === "pullRequest" ? "is-active" : ""} is-disabled`}>
                  <input
                    type="radio"
                    className="u-cursor--pointer hidden-input"
                    id="pullRequestOption"
                    checked={actionPath === "pullRequest"}
                    defaultValue="pullRequest"
                    onChange={this.onActionTypeChange}
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
                <div className={`BoxedCheckbox flex1 flex ${containType === "single" ? "is-active" : ""}`}>
                  <input
                    type="radio"
                    className="u-cursor--pointer hidden-input"
                    id="singleOption"
                    checked={containType === "single"}
                    defaultValue="single"
                    onChange={this.onFileContainChange}
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
                <div className={`BoxedCheckbox flex1 flex ${containType === "fullFiles" ? "is-active" : ""} is-disabled`}>
                  <input
                    type="radio"
                    className="u-cursor--pointer hidden-input"
                    id="fullFilesOption"
                    checked={containType === "fullFiles"}
                    defaultValue="fullFiles"
                    onChange={this.onFileContainChange}
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
              <button className="btn primary blue" type="button" onClick={this.onFinishSetup}>Finish GitOps setup</button>
            </div>
          </div>
      </div>
    );
  }
}

export default GitOpsRepoDetails;
