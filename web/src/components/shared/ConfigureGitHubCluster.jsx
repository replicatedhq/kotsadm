import * as React from "react";
import { graphql, compose, withApollo } from "react-apollo";
import { withRouter, Link } from "react-router-dom";
import {
  githubUserOrgs,
  githubOrgRepos,
  githubRepoBranches,
  getGitHubInstallationId
} from "../../queries/GitHubQueries";
import {
  createNotification,
  updateNotification
} from "../../mutations/NotificationMutations";
import { createGitOpsCluster } from "../../mutations/ClusterMutations";
import Loader from "@src/components/shared/Loader";
import dayjs from "dayjs";
import find from "lodash/find";
import get from "lodash/get";
import Select from "react-select";

const NEW_ORG_LOGIN = "Install on another GitHub account";

export class ConfigureGitHub extends React.Component {
  constructor() {
    super();
    this.state = {
      id: null,
      org: null,
      orgs: [],
      repo: null,
      orgRepos: [],
      branch: null,
      repoBranches: [],
      saving: false,
      createSuccess: false,
      orgReposPage: 1,
      orgReposTotalCount: 0,
      repoBranchesPage: 1,
      orgsPage: 1,
      orgsLoading: false,
      reposLoading: false,
      branchesLoading: false
    };
  }

  componentDidUpdate(lastProps) {
    if (
      this.props.getGithubUserOrgs !== lastProps.getGithubUserOrgs &&
      this.props.getGithubUserOrgs.installationOrganizations
    ) {
      const NEW_INSTALLATION_ORG = { login: NEW_ORG_LOGIN };
      this.setState({
        orgs: [
          NEW_INSTALLATION_ORG,
          ...this.props.getGithubUserOrgs.installationOrganizations.installations
        ]
      });
    }
    if (this.props.integrationToManage) {
      if (
        this.props.getGithubUserOrgs !== lastProps.getGithubUserOrgs &&
        this.props.getGithubUserOrgs
      ) {
        const { owner: orgName } = this.props.integrationToManage;
        const installations = get(this.props, [
          "getGithubUserOrgs",
          "installationOrganizations",
          "installations"
        ]);
        const org = find(installations, ["login", orgName]);
        this.setState({
          org,
          orgReposPage: 1,
          repoBranchesPage: 1
        });
        this.populateReposAndBranches(this.props.integrationToManage);
      }
    }
  }

  componentDidMount() {
    const { getGithubUserOrgs } = this.props;
    if (getGithubUserOrgs && getGithubUserOrgs.installationOrganizations) {
      const NEW_INSTALLATION_ORG = { login: NEW_ORG_LOGIN };
      this.setState({
        orgs: [
          NEW_INSTALLATION_ORG,
          ...getGithubUserOrgs.installationOrganizations.installations
        ]
      });
    }
  }

  populateReposAndBranches = async integration => {
    const { owner: orgName, repo: repoName, branch: branchName } = integration;
    const { data: orgData } = await this.getOrgRepos(orgName);
    const repo = find(orgData.orgRepos.repos, { name: repoName });
    // TODO: repo is sometimes undefined because the repo may not be on the frist page we get back.
    const { data: repoData } = await this.getRepoBranches(orgName, repoName);
    const branch = find(repoData.repoBranches, { name: branchName });

    this.setState({
      repo,
      branch,
      orgRepos: orgData.orgRepos.repos,
      orgReposTotalCount: orgData.orgRepos.totalCount,
      repoBranches: repoData.repoBranches
    });
  };

  handleCreateClick = async () => {
    const { org = {}, repo = {}, branch = {}, installationId } = this.state;
    const gitOpsRef = { owner: org.login, repo: repo.name, branch: branch.name };
    this.setState({ createClusterLoading: true });

    await this.props
      .createGitOpsCluster(this.props.clusterTitle, installationId, gitOpsRef)
      .then(() => {
        this.setState({ createClusterLoading: false });
        if (
          this.props.submitCallback &&
          typeof this.props.submitCallback === "function"
        ) {
          return this.props.submitCallback();
        }
        this.setState({ createSuccess: true });
      })
      .catch(() => this.setState({ createClusterLoading: false }));
  };

  handleInstallGitHubApp = () => {
    const exp = new Date(
      dayjs()
        .add(30, "m")
        .toDate()
    );
    // Set cookie with current location, expires 30 mins from current time
    document.cookie = `appRedirect=/cluster/create?configure=1&name=${
      this.props.clusterTitle
    }; expires=${exp.toUTCString()}; path=/`;
    window.location.replace(window.env.GITHUB_INSTALL_URL);
  };

  renderInstallWarning = () => {
    return (
      <div className="Warning flex justifyContent--spaceBetween alignItems--center u-marginTop--20">
        <div className="flex1 flex-column">
          <p className="u-fontSize--small u-color--tuna u-fontWeight--medium u-lineHeight--normal">
            Oops! Looks like you do not have the Replicated Ship app installed.
          </p>
          <p className="u-fontSize--small u-color--dustyGray u-fontWeight--medium u-lineHeight--normal">
            In order to connect to GitHub you need to have the app installed to your
            GitHub account.
          </p>
        </div>
        <div className="flex-auto u-marginLeft--10">
          <button onClick={this.handleInstallGitHubApp} className="btn primary">
            Install GitHub App
          </button>
        </div>
      </div>
    );
  };

  getOrgRepos = (org, page = 1) =>
    this.props.client
      .query({
        query: githubOrgRepos,
        variables: { org, page }
      })
      .catch();

  getInstallId = () => {
    return this.props.client
      .query({
        query: getGitHubInstallationId
      })
      .catch();
  };

  getRepoBranches = (org, repo, page = 1) =>
    this.props.client
      .query({
        query: githubRepoBranches,
        variables: { owner: org, repo, page }
      })
      .catch();

  onOrgChange = async org => {
    const { login: orgName } = org;
    if (orgName === NEW_ORG_LOGIN) {
      return this.handleInstallGitHubApp();
    }
    this.setState({ orgsLoading: true });

    const { data: orgData } = await this.getOrgRepos(orgName);
    const { data: installIdData } = await this.getInstallId();
    const gitHubMeta = JSON.parse(installIdData.getGitHubInstallationId);
    const installationId = gitHubMeta[orgName.toLowerCase()];
    this.setState({
      org,
      repo: null,
      branch: null,
      orgRepos: get(orgData, ["orgRepos", "repos"], []),
      orgReposTotalCount: orgData.orgRepos.totalCount,
      repoBranches: [],
      installationId,
      orgsLoading: false
    });
    if (this.props.gatherGitHubData) {
      this.props.gatherGitHubData("owner", orgName);
    }
  };

  onRepoChange = async repo => {
    const { name: repoName } = repo;
    const { org } = this.state;
    const defaultBranch = get(repo, "default_branch", "master");
    this.setState({ reposLoading: true });

    const { data: repoData } = await this.getRepoBranches(org.login, repoName);
    const branch = find(repoData.repoBranches, { name: defaultBranch }) || null;
    this.setState({
      repo,
      repoBranches: repoData.repoBranches,
      branch,
      reposLoading: false
    });
    if (this.props.gatherGitHubData) {
      this.props.gatherGitHubData("repo", repo.name);
    }
  };

  onBranchChange = branch => {
    this.setState({ branch });
    if (this.props.gatherGitHubData) {
      this.props.gatherGitHubData("branch", branch.name);
    }
  };

  onRootPathChange = e => {
    const { value } = e.target;
    this.setState({ rootPath: value });
  };

  handleModalClose = () => {
    this.setState({
      org: null,
      orgRepos: [],
      repo: null,
      repoBranches: [],
      branch: null,
      rootPath: "",
      createSuccess: false,
      orgReposPage: 1,
      repoBranchesPage: 1,
      orgsPage: 1
    });
    this.props.toggle();
  };

  handleMenuScrollToBottomOrgs = async () => {
    const { orgs, orgsPage } = this.state;
    const { getGithubUserOrgs } = this.props;

    // add one for the new org installation
    if (orgs.length < getGithubUserOrgs.installationOrganizations.totalCount + 1) {
      this.setState({ orgsLoading: true });
      const newOrgsPage = orgsPage + 1;
      const { data } = await this.props.client.query({
        query: githubUserOrgs,
        variables: { page: newOrgsPage }
      });
      this.setState({
        orgsPage: newOrgsPage,
        orgs: [...orgs, ...data.installationOrganizations.installations],
        orgsLoading: false
      });
    }
  };

  handleMenuScrollToBottomRepos = async () => {
    const { orgReposPage, org, orgRepos, orgReposTotalCount } = this.state;

    if (orgRepos.length < orgReposTotalCount) {
      this.setState({ reposLoading: true });
      const newOrgReposPage = orgReposPage + 1;
      const { data } = await this.getOrgRepos(org.login, newOrgReposPage);
      this.setState({
        orgReposPage: newOrgReposPage,
        orgRepos: [...orgRepos, ...data.orgRepos.repos],
        reposLoading: false
      });
    }
  };

  handleMenuScrollToBottomBranches = async () => {
    const { repoBranches, org, repo, repoBranchesPage } = this.state;
    const { login: orgLogin } = org;
    const { name: repoName } = repo;
    this.setState({ branchesLoading: true });
    const newRepoBranchPage = repoBranchesPage + 1;
    const { data } = await this.getRepoBranches(orgLogin, repoName, newRepoBranchPage);
    this.setState({
      repoBranchesPage: newRepoBranchPage,
      orgRepos: [...repoBranches, ...data.repoBranches.branches],
      branchesLoading: false
    });
  };

  render() {
    const { hideRootPath, integrationToManage } = this.props;
    const {
      orgs,
      orgRepos,
      repoBranches,
      createClusterLoading,
      createSuccess,
      org,
      repo,
      branch,
      rootPath,
      orgsLoading,
      reposLoading,
      branchesLoading
    } = this.state;

    const excludeShipBranches = repoBranches.filter(
      repo => !repo.name.includes("ship-")
    );
    const createPRDisabled = org === null || repo === null || branch === null;
    let content;
    if (createSuccess) {
      content = (
        <div className="flex-column flex1">
          <div className="flex-auto alignItems--center u-textAlign--center">
            <p className="u-fontSize--larger u-color--tuna u-fontWeight--bold u-lineHeight--normal">
              A cluster called {this.props.clusterTitle} has been created!
            </p>
          </div>
          <div className="flex flex1 u-marginTop--30 u-marginBottom--10">
            <div className="flex flex1 justifyContent--center alignItems--center">
              <Link to="/clusters" className="btn primary">
                View your clusters
              </Link>
            </div>
          </div>
        </div>
      );
    } else {
      content = (
        <div className="Form">
          {integrationToManage ? (
            <p className="u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10 u-marginTop--10">
              Edit your GitOps reference point
            </p>
          ) : (
            <div>
              <h2 className="u-fontSize--largest u-color--tuna u-fontWeight--bold u-lineHeight--normal">
                Deploy using GitHub
              </h2>
              <p className="u-fontSize--normal u-color--dustyGray u-lineHeight--normal u-marginBottom--10">
                To deploy with GitHub, we need to know where to save your assests.
              </p>
            </div>
          )}
          {!this.props.getGithubUserOrgs.loading && orgs.length === 0 ? (
            <div className="u-marginBottom--20">{this.renderInstallWarning()}</div>
          ) : null}
          <div className="flex flex1 u-marginBottom--30">
            <div className="flex flex1 flex-column u-marginRight--10">
              <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal">
                Owner
              </p>
              <p className="u-fontSize--small u-color--dustyGray u-lineHeight--normal u-marginBottom--10">
                Who will be the owner of this application?
              </p>
              <div className="u-position--relative">
                <Select
                  className="replicated-select-container"
                  classNamePrefix="replicated-select"
                  options={orgs}
                  getOptionLabel={org => org.login}
                  onMenuScrollToBottom={this.handleMenuScrollToBottomOrgs}
                  placeholder="Please select an owner"
                  onChange={this.onOrgChange}
                  value={org}
                  isOptionSelected={option => {
                    option.login === get(org, "login");
                  }}
                />
                {orgsLoading && (
                  <div className="select-loader">
                    <Loader size="25" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex1 flex-column u-marginLeft--10">
              <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal">
                Repository
              </p>
              <p className="u-fontSize--small u-color--dustyGray u-lineHeight--normal u-marginBottom--10">
                Which repo will the app be installed in?
              </p>
              <div className="u-position--relative">
                <Select
                  className="replicated-select-container"
                  classNamePrefix="replicated-select"
                  isDisabled={orgRepos.length === 0}
                  options={orgRepos}
                  getOptionLabel={orgRepo => orgRepo.name}
                  onMenuScrollToBottom={this.handleMenuScrollToBottomRepos}
                  placeholder={
                    org && orgRepos.length === 0
                      ? "Organization has no repositories"
                      : "Please select a repository"
                  }
                  onChange={this.onRepoChange}
                  value={repo}
                  isOptionSelected={option => {
                    option.name === get(repo, "name");
                  }}
                />
                {reposLoading && (
                  <div className="select-loader">
                    <Loader size="25" />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex1">
            <div className="flex flex1 flex-column u-marginRight--10">
              <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal">
                Branch
              </p>
              <p className="u-fontSize--small u-color--dustyGray u-lineHeight--normal u-marginBottom--10">
                If no branch is specified, master will be used.
              </p>
              <div className="u-position--relative">
                <Select
                  className="replicated-select-container"
                  classNamePrefix="replicated-select"
                  isDisabled={excludeShipBranches.length === 0}
                  options={excludeShipBranches}
                  getOptionLabel={excludeShipBranches => excludeShipBranches.name}
                  onMenuScrollToBottom={this.handleMenuScrollToBottomBranches}
                  placeholder={
                    org && orgRepos.length === 0
                      ? "Organization has no repositories"
                      : "Please select a branch"
                  }
                  value={branch}
                  onChange={this.onBranchChange}
                  isOptionSelected={option => {
                    option.name === get(branch, "name");
                  }}
                />
                {branchesLoading && (
                  <div className="select-loader">
                    <Loader size="25" />
                  </div>
                )}
              </div>
            </div>
            {hideRootPath ? (
              <div className="flex1 u-marginLeft--10"></div>
            ) : (
              <div className="flex flex1 flex-column u-marginLeft--10">
                <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal">
                  Path
                </p>
                <p className="u-fontSize--small u-color--dustyGray u-lineHeight--normal u-marginBottom--10">
                  In which directory will the deployment file live?
                </p>
                <input
                  type="text"
                  className="Input"
                  placeholder="/chartname"
                  value={rootPath}
                  onChange={e => {
                    this.onRootPathChange(e);
                  }}
                />
              </div>
            )}
          </div>
          {!integrationToManage && (
            <div className="flex flex1 justifyContent--flexEnd u-marginTop--20">
              <button
                onClick={this.handleCreateClick}
                className="btn primary"
                disabled={createClusterLoading || createPRDisabled}
              >
                {createClusterLoading
                  ? "Creating cluster"
                  : "Create deployment cluster"}
              </button>
            </div>
          )}
        </div>
      );
    }

    return content;
  }
}

export default compose(
  withRouter,
  withApollo,
  graphql(createGitOpsCluster, {
    props: ({ mutate }) => ({
      createGitOpsCluster: (title, installationId, gitOpsRef) =>
        mutate({ variables: { title, installationId, gitOpsRef } })
    })
  }),
  graphql(createNotification, {
    props: ({ mutate }) => ({
      createNotification: (watchId, webhook, email, pullRequest) =>
        mutate({ variables: { watchId, webhook, email, pullRequest } })
    })
  }),
  graphql(updateNotification, {
    props: ({ mutate }) => ({
      updateNotification: (watchId, notificationId, webhook, email, pullRequest) =>
        mutate({ variables: { watchId, notificationId, webhook, email, pullRequest } })
    })
  }),
  graphql(githubUserOrgs, {
    name: "getGithubUserOrgs",
    options: () => ({
      variables: { page: 1 }
    })
  })
)(ConfigureGitHub);
