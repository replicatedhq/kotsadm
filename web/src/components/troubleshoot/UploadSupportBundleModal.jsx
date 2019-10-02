import * as React from "react";
import Clipboard from "clipboard";
import { Link } from "react-router-dom";
import isEmpty from "lodash/isEmpty";
import Dropzone from "react-dropzone";
import randomstring from "randomstring";

import "../../scss/components/troubleshoot/UploadSupportBundleModal.scss";

class UploadSupportBundleModal extends React.Component {
  constructor() {
    super();
    this.state = {
      successState: false,
      fileUploading: false,
      newBundleId: "",
      supportBundle: {},
    };
  }

  uploadAndAnalyze = async () => {
    try {
      const { watch } = this.props;
      const { newBundleId } = this.state;
      const bundleId = newBundleId !== "" ? newBundleId : randomstring.generate({ capitalization: "lowercase" });
      const uploadBundleUrl = `${window.env.TROUBLESHOOT_ENDPOINT}/${watch.id}/${bundleId}`;

      this.setState({ fileUploading: true, newBundleId: bundleId });

      const response = await fetch(uploadBundleUrl, {
        method: "PUT",
        body: this.state.supportBundle,
        headers: {
          "Content-Type": "application/tar+gzip",
        },
      });
      const analyzedBundle = await response.json();

      this.setState({ fileUploading: false });
      if (this.props.submitCallback && typeof this.props.submitCallback === "function") {
        this.props.submitCallback(analyzedBundle.id);
      }
    } catch (err) {
      this.setState({ fileUploading: false });
    }
  }

  onDrop = (files) => {
    this.setState({ supportBundle: files[0] });
  }

  showCopyToast(message, didCopy) {
    this.setState({
      showToast: didCopy,
      copySuccess: didCopy,
      copyMessage: message
    });
    setTimeout(() => {
      this.setState({
        showToast: false,
        copySuccess: false,
        copyMessage: ""
      });
    }, 3000);
  }

  instantiateCopyAction() {
    let clipboard = new Clipboard(".copy-command");
    clipboard.on("success", () => {
      this.showCopyToast("Command has been copied to your clipboard", true);
    });
    clipboard.on("error", () => {
      this.showCopyToast("Unable to copy, select the text and use 'Command/Ctl + C'", false);
    });
  }

  componentDidMount() {
    this.instantiateCopyAction();
  }

  openReplicatedSupportBundleLink = () => {
    let page = window.open("https://help.replicated.com/docs/native/packaging-an-application/support-bundle/", "_blank");
    page.focus();
    return false;
  }

  render() {
    const { successState, newBundleId, supportBundle, fileUploading } = this.state;
    const hasFile = supportBundle && !isEmpty(supportBundle);

    return (
      <div className="console">
        <div id="UploadSupportBundleModal">
          {successState ?
            <div className="UploadSuccess-wrapper u-textAlign--center">
              <div className="analysis-illustration-wrapper u-marginBottom--20">
                <div className="icon u-analyzingBundleIcon u-position--relative">
                  <div className="icon u-analyzingBundleMagnifyingGlassIcon magifying-glass-animate"></div>
                </div>
              </div>
              <p className="u-fontSize--largest u-fontWeight--bold u-lineHeight--default u-color--tuna u-marginBottom--normal">Your bundle has been uploaded!</p>
              <p className="u-fontSize--normal u-fontWeight--normal u-lineHeight--normal u-color--dustyGray">We've begun and analysis of your support bundle. Check out the analysis page for a breakdown of this support bundle</p>
              <div className="button-wrapper">
                <Link to={`/troubleshoot/analyze/${newBundleId}`} className="btn primary">View bundle analysis</Link>
              </div>
            </div>
            :
            <div>
              <p className="u-fontSize--largest u-fontWeight--bold u-lineHeight--default u-color--tuna u-marginBottom--small">
                Upload a support bundle
              </p>
              <p className="u-fontSize--normal u-fontWeight--medium u-lineHeight--normal u-color--dustyGray">
                Upload a support bundle from your environment to visually analyze the server and receive insights about the server, the network and your application.
              </p>
              <div className="u-marginTop--20">
                <div>
                  <div className={`FileUpload-wrapper ${hasFile ? "has-file" : ""}`}>
                    <Dropzone
                      className="Dropzone-wrapper"
                      accept="application/gzip, .gz"
                      onDropAccepted={this.onDrop}
                      multiple={false}
                    >
                      {hasFile ?
                        <p className="u-fontSize--normal u-fontWeight--medium">{supportBundle.name}</p>
                        :
                        <div className="u-textAlign--center">
                          <span className="icon u-TarFileIcon u-marginBottom--20"></span>
                          <p className="u-fontSize--normal u-color--dustyGray u-fontWeight--medium u-lineHeight--normal">Drag your bundle here or <span className="u-color--astral u-fontWeight--medium u-textDecoration--underlineOnHover">choose a file to upload</span></p>
                          <p className="u-fontSize--normal u-color--dustyGray u-fontWeight--normal u-lineHeight--normal u-marginTop--small">This file can be any
                              <span className="u-fontWeight--medium u-color--astral u-textDecoration--underlineOnHover" onClick={this.openReplicatedSupportBundleLink}> Replicated Support Bundle </span>
                          </p>
                        </div>
                      }
                    </Dropzone>
                  </div>
                  <div className="u-marginTop--normal">
                    <div className="FormButton-wrapper flex justifyContent--center">
                      <button
                        type="button"
                        className="btn secondary flex-auto"
                        onClick={this.uploadAndAnalyze}
                        disabled={fileUploading || !hasFile}
                      >
                        {fileUploading ? "Uploading" : "Upload support bundle"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    );
  }
}

export default UploadSupportBundleModal;
