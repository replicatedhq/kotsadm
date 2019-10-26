import React from "react";
import CodeSnippet from "./shared/CodeSnippet";

import "@src/scss/components/AirgapStaticError";

export default function AirgapStaticError() {
  return (
    <div className="AirgapStaticError--wrapper Login-wrapper flex-column u-height--full u-width--full justifyContent--center alignItems--center">
      <div className="AirgapStaticError--content flex-column">
        <p className="u-color--tuna u-marginBottom--20 u-lineHeight--medium">
          There was an error uploading your airgap bundle. Please run the following command in a terminal window to generate a support bundle. Give this information to your support rep.
        </p>
        <CodeSnippet language="bash" canCopy={true}>
          {`kubectl support-bundle https://kots.io`}
        </CodeSnippet>
        <p className="u-color--tuna u-marginTop--20 u-lineHeight--medium">
          You will need the <code>support-bundle</code> plugin from krew. You can install it with the following command:
        </p>
        <CodeSnippet language="bash" canCopy={true}>
          kubectl krew install support-bundle
        </CodeSnippet>
      </div>
    </div>
  );
}
