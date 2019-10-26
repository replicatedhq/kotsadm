import React from "react";
import CodeSnippet from "./shared/CodeSnippet";

export default function AirgapStaticError() {
  return (
    <div className="AirgapStaticError--wrapper u-height--full justifyContent--center alignItems--center">
      <div className="AirgapStaticError--content">
        <p>
          There was an error uploading your airgap bundle. Please run the following command in a terminal window to generate a support bundle.
        </p>
        <CodeSnippet language="bash" canCopy={true}>
          {`kubectl support-bundle https://kots.io`}
        </CodeSnippet>
      </div>
    </div>
  );
}
