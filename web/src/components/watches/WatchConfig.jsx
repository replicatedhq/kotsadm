import React, { Component } from "react";
import { ShipConfigRenderer } from "@replicatedhq/ship-init";
import StateFileViewer from "../state/StateFileViewer";
import { createEditSession } from "@src/mutations/WatchMutations";
import { compose, withApollo } from "react-apollo";
import { withRouter } from "react-router-dom";

import "../../scss/components/watches/WatchConfig.scss";

class WatchConfig extends Component {
  constructor(props) {
    super(props);

    this.state = {
      preparingAppUpdate: false,
      errorCustomizingCluster: false
    }
  }

  handleEditWatchClick = watch => {
    this.setState({ preparingAppUpdate: true });

    this.props.client.mutate({
      mutation: createEditSession,
      variables: {
        watchId: watch.id,
      },
    })
      .then(({ data }) => {
        this.setState({ preparingAppUpdate: false });
        this.props.onActiveInitSession(data.createEditSession.id);
        this.props.history.push("/ship/edit");
      })
      .catch(() => {
        this.setState({ preparingAppUpdate: false });
      });
  }

  render() {
    const { watch } = this.props;
    const { preparingAppUpdate } = this.state;
    return (
      <div className="flex1 flex-column u-overflow--auto justifyContent--flexStart alignItems--center u-padding--20">
        <div className="ConfigOuterWrapper flex u-padding--15" >
          <div className="ConfigInnerWrapper flex1 u-padding--15">
            <div className="flex1 u-pointerEvents--none">
              {watch.config?.length ? <ShipConfigRenderer groups={watch.config} /> : <StateFileViewer watch={watch} />}
            </div>
          </div>
        </div>
        <button className="btn secondary green u-marginTop--20" disabled={preparingAppUpdate} onClick={() => this.handleEditWatchClick(watch)}>{preparingAppUpdate ? "Preparing" : "Edit application config"}</button>
      </div>
    )
  }
}

export default compose(withApollo, withRouter)(WatchConfig);
