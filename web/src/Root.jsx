import { hot } from "react-hot-loader/root";
import React, { Component } from "react";
import { createBrowserHistory } from "history";
import { Switch, Route, Redirect, Router } from "react-router-dom";
import { ApolloProvider } from "react-apollo";
import { Helmet } from "react-helmet";
import Modal from "react-modal";
import Login from "./components/Login";
import Signup from "./components/Signup";
import GitHubAuth from "./components/github_auth/GitHubAuth";
import GitHubInstall from "./components/github_install/GitHubInstall";
import GitOps from "././components/clusters/GitOps";
import PreflightResultPage from "./components/PreflightResultPage";
import AppConfig from "./components/apps/AppConfig";
import AppDetailPage from "./components/apps/AppDetailPage";
import ClusterNodes from "./components/apps/ClusterNodes";
import ClusterScope from "./components/clusterscope/ClusterScope";
import UnsupportedBrowser from "./components/static/UnsupportedBrowser";
import NotFound from "./components/static/NotFound";
import { Utilities } from "./utilities/utilities";
import { ShipClientGQL } from "./ShipClientGQL";
import SecureAdminConsole from "./components/SecureAdminConsole";

import { ping, getKotsMetadata, listApps } from "@src/queries/AppsQueries";
import Footer from "./components/shared/Footer";
import NavBar from "./components/shared/NavBar";

// Import Ship Init component CSS first
import "@replicatedhq/ship-init/dist/styles.css";
import "./scss/index.scss";
import UploadLicenseFile from "./components/UploadLicenseFile";
import UploadAirgapBundle from "./components/UploadAirgapBundle";
import connectHistory from "./services/matomo";

const INIT_SESSION_ID_STORAGE_KEY = "initSessionId";

let browserHistory = createBrowserHistory();
let history = connectHistory(browserHistory);

/**
 * Create our GraphQL Client
 */
const GraphQLClient = ShipClientGQL(
  window.env.GRAPHQL_ENDPOINT,
  window.env.REST_ENDPOINT,
  () => Utilities.getToken()
);

class ProtectedRoute extends Component {
  render() {
    const redirectURL = window.env.DISABLE_KOTS
      ? `/login?next=${this.props.location.pathname}${this.props.location.search}`
      : `/secure-console?next=${this.props.location.pathname}${this.props.location.search}`;

    return (
      <Route path={this.props.path} render={(innerProps) => {
        if (Utilities.isLoggedIn()) {
          if (this.props.component) {
            return <this.props.component {...innerProps} />;
          }
          return this.props.render(innerProps);
        }
        return <Redirect to={redirectURL} />;
      }} />
    );
  }
}

const ThemeContext = React.createContext({
  setThemeState: () => {},
  getThemeState: () => ({}),
  clearThemeState: () => {}
});

class Root extends Component {
  state = {
    listApps: [],
    appLogo: null,
    selectedAppName: null,
    appNameSpace: null,
    fetchingMetadata: false,
    initSessionId: Utilities.localStorageEnabled()
      ? localStorage.getItem(INIT_SESSION_ID_STORAGE_KEY)
      : "",
    themeState: {
      navbarLogo: null,
    },
    rootDidInitialWatchFetch: false,
    connectionTerminated: false,
    seconds: 9,
  };
  /**
   * Sets the Theme State for the whole application
   * @param {Object} newThemeState - Object to set for new theme state
   * @param {Function} callback - callback to run like in setState()'s callback
   */
  setThemeState = (newThemeState, callback) => {
    this.setState({
      themeState: { ...newThemeState }
    }, callback);
  }

  /**
   * Gets the current theme state of the app
   * @return {Object}
   */
  getThemeState = () => {
    return this.state.themeState;
  }

  /**
   * Clears the current theme state to nothing
   */
  clearThemeState = () => {
    /**
     * Reference object to a blank theme state
     */
    const EMPTY_THEME_STATE = {
      navbarLogo: null,
    };

    this.setState({
      themeState: { ...EMPTY_THEME_STATE }
    });
  }

  handleActiveInitSession = (initSessionId) => {
    if (Utilities.localStorageEnabled()) {
      localStorage.setItem(INIT_SESSION_ID_STORAGE_KEY, initSessionId)
    }
    this.setState({ initSessionId })
  }

  handleActiveInitSessionCompleted = () => {
    if (Utilities.localStorageEnabled()) {
      localStorage.removeItem(INIT_SESSION_ID_STORAGE_KEY);
    }
    this.setState({ initSessionId: "" });
  }

  refetchListApps = async () => {
    const apps = await GraphQLClient.query({
      query: listApps,
      fetchPolicy: "no-cache"
    }).catch( error => {
      throw error;
    });

    this.setState({
      listApps: apps.data.listApps.kotsApps,
      rootDidInitialWatchFetch: true
    });

    return apps.data.listApps.kotsApps;
  }

  fetchKotsAppMetadata = async () => {
    this.setState({ fetchingMetadata: true });
    const meta = await GraphQLClient.query({
      query: getKotsMetadata,
      fetchPolicy: "no-cache"
    }).catch( error => {
      this.setState({ fetchingMetadata: false });
      throw error;
    });
    if (meta.data.getKotsMetadata) {
      this.setState({
        appLogo: meta.data.getKotsMetadata.iconUri,
        selectedAppName: meta.data.getKotsMetadata.name,
        appNameSpace: meta.data.getKotsMetadata.namespace,
        isKurlEnabled: meta.data.getKotsMetadata.isKurlEnabled,
        fetchingMetadata: false
      });
    } else {
      this.setState({ fetchingMetadata: false });
    }
  }

  tick = () => {
    if (!this.state.connectionTerminated) {
      clearInterval(this.timer);
      return;
    }
    if (this.state.seconds > 0) {
      this.setState({ seconds: this.state.seconds - 1 });
    } else {
      this.setState({ seconds: 9 });
      clearInterval(this.timer);
    }
  }

  ping = async () => {
    this.timer = setInterval(this.tick, 1000);
    await GraphQLClient.query({
      query: ping,
      fetchPolicy: "no-cache"
    }).then(() => {
      this.setState({ connectionTerminated: false });
    }).catch(() => {
      this.setState({ connectionTerminated: true });
    });
  }

  onRootMounted = () => {
    if (!window.env.DISABLE_KOTS) {
      this.fetchKotsAppMetadata();
    }
    this.ping();

    if (Utilities.isLoggedIn()) {
      this.refetchListApps().then(listApps => {
        if (listApps.length > 0 && window.location.pathname === "/apps") {
          const { slug } = listApps[0];
          history.replace(`/app/${slug}`);
        }
      });
    }
  }

  componentDidMount = async () => {
    this.onRootMounted();
    this.interval = setInterval(async () => await this.ping(), 10000);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  render() {
    const {
      themeState,
      listApps,
      rootDidInitialWatchFetch,
      connectionTerminated,
      seconds
    } = this.state;

    return (
      <div className="flex-column flex1">
        <Helmet>
          <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
          <meta httpEquiv="Pragma" content="no-cache" />
          <meta httpEquiv="Expires" content="0" />
        </Helmet>
        <ApolloProvider client={GraphQLClient}>
          <ThemeContext.Provider value={{
            setThemeState: this.setThemeState,
            getThemeState: this.getThemeState,
            clearThemeState: this.clearThemeState
          }}>
            <Router history={history}>
              <div className="flex-column flex1">
                <NavBar logo={themeState.navbarLogo || this.state.appLogo} refetchListApps={this.refetchListApps} fetchingMetadata={this.state.fetchingMetadata} isKurlEnabled={this.state.isKurlEnabled} />
                <div className="flex1 flex-column u-overflow--hidden">
                  <Switch>

                    <Route exact path="/" component={() => <Redirect to={Utilities.isLoggedIn() ? "/apps" : "/login"} />} />
                    <Route exact path="/crashz" render={() => {
                      const Crashz = () => {
                        throw new Error("Crashz!");
                      };
                      return <Crashz />;

                    }}/>
                    <Route exact path="/login" render={props => (<Login {...props} onLoginSuccess={this.refetchListApps} appName={this.state.selectedAppName} />) } />
                    <ProtectedRoute path="/preflight" render={props => <PreflightResultPage {...props} appName={this.state.selectedAppName} /> }/>
                    <ProtectedRoute exact path="/:slug/config" render={props => <AppConfig {...props} fromLicenseFlow={true} />} />
                    <Route exact path="/signup" component={Signup} />
                    <Route exact path="/secure-console" render={props => <SecureAdminConsole {...props} logo={this.state.appLogo} appName={this.state.selectedAppName} onLoginSuccess={this.refetchListApps} fetchingMetadata={this.state.fetchingMetadata} />} />
                    <ProtectedRoute exact path="/upload-license" render={props => <UploadLicenseFile {...props} logo={this.state.appLogo} appName={this.state.selectedAppName} fetchingMetadata={this.state.fetchingMetadata} onUploadSuccess={this.refetchListApps} />} />
                    <ProtectedRoute exact path="/:slug/airgap" render={props => <UploadAirgapBundle {...props} showRegistry={true} logo={this.state.appLogo} appName={this.state.selectedAppName} onUploadSuccess={this.refetchListApps} fetchingMetadata={this.state.fetchingMetadata} />} />
                    <ProtectedRoute exact path="/:slug/airgap-bundle" render={props => <UploadAirgapBundle {...props} showRegistry={false} logo={this.state.appLogo} appName={this.state.selectedAppName} onUploadSuccess={this.refetchListApps} fetchingMetadata={this.state.fetchingMetadata} />} />
                    <Route path="/auth/github" render={props => (<GitHubAuth {...props} refetchListApps={this.refetchListApps}/>)} />
                    <Route path="/install/github" component={GitHubInstall} />
                    <Route exact path="/clusterscope" component={ClusterScope} />
                    <Route path="/unsupported" component={UnsupportedBrowser} />
                    <ProtectedRoute path="/cluster/manage" render={(props) => <ClusterNodes {...props} appName={this.state.selectedAppName} />} />
                    <ProtectedRoute path="/gitops" render={(props) => <GitOps {...props} appName={this.state.selectedAppName} />} />
                    <ProtectedRoute
                      path="/apps"
                      render={
                        props => (
                          <AppDetailPage
                            {...props}
                            rootDidInitialAppFetch={rootDidInitialWatchFetch}
                            listApps={listApps}
                            refetchListApps={this.refetchListApps}
                            onActiveInitSession={this.handleActiveInitSession}
                            appNameSpace={this.state.appNameSpace}
                            appName={this.state.selectedAppName}
                          />
                        )
                      }
                    />
                    <ProtectedRoute
                      path="/app/:slug/:tab?"
                      render={
                        props => (
                          <AppDetailPage
                            {...props}
                            rootDidInitialAppFetch={rootDidInitialWatchFetch}
                            listApps={listApps}
                            refetchListApps={this.refetchListApps}
                            onActiveInitSession={this.handleActiveInitSession}
                            appNameSpace={this.state.appNameSpace}
                            appName={this.state.selectedAppName}
                          />
                        )
                      }
                    />
                    <Route component={NotFound} />
                  </Switch>
                </div>
                <div className="flex-auto Footer-wrapper u-width--full">
                  <Footer />
                </div>
              </div>
            </Router>
          </ThemeContext.Provider>
        </ApolloProvider>
        {connectionTerminated &&
          <Modal
            isOpen={connectionTerminated}
            onRequestClose={undefined}
            shouldReturnFocusAfterClose={false}
            contentLabel="Connection terminated modal"
            ariaHideApp={false}
            className="ConnectionTerminated--wrapper Modal DefaultSize"
          >
            <div className="Modal-body u-textAlign--center">
              <div className="flex u-marginTop--30 u-marginBottom--10 justifyContent--center">
                <span className="icon no-connection-icon" />
                {this.state.appLogo
                  ? <img width="60" height="60" className="u-marginLeft--10" src={this.state.appLogo} />
                  : <span className="icon onlyAirgapBundleIcon u-marginLeft--10" />
                }
              </div>
              <h2 className="u-fontSize--largest u-color--tuna u-fontWeight--bold u-lineHeight--normal u-userSelect--none">Cannot connect</h2>
              <p className="u-fontSize--normal u-fontWeight--medium u-color--dustyGray u-lineHeight--more u-marginTop--10 u-marginBottom--10 u-userSelect--none">We're unable to reach the API right now. Check to make sure your local server is running.</p>
              <div className="u-marginBottom--30">
                <span className="u-fontSize--normal u-fontWeight--bold u-color--tundora u-userSelect--none">Trying again in {`${seconds} second${seconds !== 1 ? "s" : ""}`}</span>
              </div>
            </div>
          </Modal>
        }
      </div>
    );
  }
}
export { ThemeContext };
export default hot(Root);
