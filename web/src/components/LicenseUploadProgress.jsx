import React from "react"
import { withRouter } from "react-router-dom";
import { compose, withApollo, graphql} from "react-apollo";
import { getOnlineInstallStatus } from "../queries/AppsQueries";
import "@src/scss/components/AirgapUploadProgress.scss";

function LicenseUploadProgress(props) {
  const { getOnlineInstallStatus } = props.data;

  props.data?.startPolling(2000);

  const statusMsg = getOnlineInstallStatus?.currentMessage;

  let statusDiv = (
    <div
      className={`u-marginTop--20 u-color--dustyGray u-fontWeight--bold u-lineHeight--medium u-textAlign--center`}
    >
      {statusMsg} <br/>
      This may take a while depending on your network connection and size of your bundle
    </div>
  );

  return (
    <div className="AirgapUploadProgress--wrapper flex1 flex-column alignItems--center justifyContent--center">
      <div className="flex1 flex-column alignItems--center justifyContent--center u-color--tuna">
        <h1 className="u-fontSize--larger u-fontWeight--bold u-marginBottom--10">
          Installing your license
        </h1>
        {statusDiv}
      </div>
    </div>
  );
}

export default compose(
  withRouter,
  withApollo,
  graphql(getOnlineInstallStatus, {
    options: () => {
      return {
        fetchPolicy: "network-only"
      };
    }
  })
)(LicenseUploadProgress);
