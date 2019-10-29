import React, { Component } from "react";
import { ShipConfigRenderer } from "@replicatedhq/ship-init";
import { compose, withApollo, graphql } from "react-apollo";
import { withRouter } from "react-router-dom";
import PropTypes from "prop-types";
import classNames from "classnames";

import Loader from "../shared/Loader";
import { getKotsConfigGroups, getKotsApp } from "../../queries/AppsQueries";
import { updateAppConfig } from "../../mutations/AppsMutations";

import "../../scss/components/watches/WatchConfig.scss";

class AppConfig extends Component {
  static propTypes = {
    app: PropTypes.object
  }

  constructor(props) {
    super(props);

    this.state = {
      configGroups: [],
      savingConfig: false
    }
  }

  componentWillMount() {
    const { app, history } = this.props;
    if (app && !app.isConfigurable) { // url entered manually - redirect
      history.replace(`/app/${app.slug}`);
    }
  }

  componentDidUpdate(lastProps) {
    const { getKotsConfigGroups } = this.props.getKotsConfigGroups;
    if (getKotsConfigGroups && getKotsConfigGroups !== lastProps.getKotsConfigGroups.getKotsConfigGroups) {
      this.setState({ configGroups: getKotsConfigGroups });
    }
    if (this.props.getKotsApp) {
      const { getKotsApp } = this.props.getKotsApp;
      if (getKotsApp && !getKotsApp.isConfigurable) { // url entered manually - redirect
        this.props.history.replace(`/app/${getKotsApp.slug}`);
      }
    }
  }

  handleSave = () => {
    this.setState({ savingConfig: true });

    const { match, app, fromLicenseFlow, history, getKotsApp } = this.props;
    const sequence = match.params.sequence || app.currentSequence;
    const slug = match.params.slug || app.slug;

    this.props.client.mutate({
      mutation: updateAppConfig,
      variables: {
        slug: slug,
        sequence: sequence,
        configGroups: this.state.configGroups,
        createNewVersion: !fromLicenseFlow
      },
    })
      .then(() => {
        if (this.props.refreshAppData) {
          this.props.refreshAppData();
        }
        if (fromLicenseFlow) {
          if (getKotsApp?.getKotsApp?.hasPreflight) {
            history.replace("/preflight");
          } else {
            history.replace(`/app/${slug}`);
          }
        }
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        this.setState({ savingConfig: false });
      });
  }

  render() {
    const { configGroups, savingConfig } = this.state;
    const { fromLicenseFlow, getKotsApp } = this.props;

    if (!configGroups.length || getKotsApp?.loading) {
      return (
        <div className="flex-column flex1 alignItems--center justifyContent--center">
          <Loader size="60" />
        </div>
      );
    }

    return (
      <div className={classNames("flex1 flex-column u-overflow--auto u-padding--20 justifyContent--flexStart alignItems--center", { "justifyContent--center": fromLicenseFlow })}>
        <div className="ConfigOuterWrapper flex u-padding--15" >
          <div className="ConfigInnerWrapper flex1 u-padding--15">
            <div className="flex1">
              <ShipConfigRenderer groups={configGroups} />
            </div>
          </div>
        </div>
        <button className="btn secondary green u-marginTop--20" disabled={savingConfig} onClick={this.handleSave}>{savingConfig ? "Saving" : fromLicenseFlow ? "Continue" : "Save config"}</button>
      </div>
    )
  }
}

export default withRouter(compose(
  withApollo,
  withRouter,
  graphql(getKotsConfigGroups, {
    name: "getKotsConfigGroups",
    options: ({ match, app }) => {
      const sequence = match.params.sequence || app.currentSequence;
      const slug = match.params.slug || app.slug;
      return {
        variables: {
          slug: slug,
          sequence: sequence,
        },
        fetchPolicy: "no-cache"
      }
    }
  }),
  graphql(getKotsApp, {
    name: "getKotsApp",
    skip: ({ app }) => app !== undefined,
    options: ({ match }) => {
      const slug = match.params.slug;
      return {
        variables: {
          slug: slug,
        },
        fetchPolicy: "no-cache"
      }
    }
  }),
)(AppConfig));
