import * as React from "react";
import MonacoEditor from "react-monaco-editor"; 
import { Link } from "react-router-dom";

class PreChecksPage extends React.Component {

  render() {
    const valueFromAPI = `* cluster-resources cannot run: action "list" is not allowed on resource "Namespace" at the cluster scope
* cluster-resources cannot run: action "list" is not allowed on resource "Node" at the cluster scope
* cluster-resources cannot run: action "list" is not allowed on resource "CustomResourceDefinition" at the cluster scope
* cluster-resources cannot run: action "list" is not allowed on resource "StorageClasses" at the cluster scope
* secret cannot run: action "get" is not allowed on resource "Secret" in the "office" namespace
* logs/app=example cannot run: action "list" is not allowed on resource "Pod" in the "office" namespace
* logs/app=example cannot run: action "get" is not allowed on resource "Pod" in the "office" namespace
* run/ping-google cannot run: action "create" is not allowed on resource "Pod" in the "office" namespace
* exec/redis-cli-version cannot run: action "list" is not allowed on resource "Pod" in the "office" namespace
* exec/redis-cli-version cannot run: action "get" is not allowed on resource "Pod" in the "office" namespace
* exec/redis-server-version cannot run: action "list" is not allowed on resource "Pod" in the "office" namespace
* exec/redis-server-version cannot run: action "get" is not allowed on resource "Pod" in the "office" namespace
* exec/admin-api cannot run: action "list" is not allowed on resource "Pod" in the "office" namespace
* exec/admin-api cannot run: action "get" is not allowed on resource "Pod" in the "office" namespace
* copy/app=example cannot run: action "list" is not allowed on resource "Pod" in the "office" namespace
* copy/app=example cannot run: action "get" is not allowed on resource "Pod" in the "office" namespace
* exec/kotsadm-postgres-db cannot run: action "list" is not allowed on resource "Pod" in the "office" namespace
* exec/kotsadm-postgres-db cannot run: action "get" is not allowed on resource "Pod" in the "office" namespace
* logs/kotsadm-api cannot run: action "list" is not allowed on resource "Pod" in the "office" namespace
* logs/kotsadm-api cannot run: action "get" is not allowed on resource "Pod" in the "office" namespace
    `;
    return (
      <div className="flex flex1 flex-column">
        <div className="flex flex1 u-height--full u-width--full u-marginTop--5 u-marginBottom--20">
          <div className="flex-column u-width--full u-overflow--hidden">
            <div className="flex-column flex flex1 u-padding--20">
              <p className="u-fontSize--larger u-fontWeight--bold u-color--tuna">Pre-Checks for {this.props.appTitle || "your application"}</p>
              <p className="u-marginTop--10 u-marginBottom--10 u-fontSize--normal u-lineHeight--normal u-color--dustyGray u-fontWeight--normal">Some resources that are required for preflight checks to pass were forbidden. We recommend granting access to these resources before proceeding</p>
              <div className="flex-column flex flex1 monaco-editor-wrapper u-border--gray">
                <MonacoEditor
                  language="bash"
                  value={valueFromAPI}
                  height="100%"
                  width="100%"
                  options={{
                    readOnly: true,
                    contextmenu: false,
                    minimap: {
                      enabled: false
                    },
                    scrollBeyondLastLine: false,
                  }}
                />
              </div>
              <div className="u-marginTop--30">
                <Link to="/preflight" className="btn primary blue">Run preflight checks anyways</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default PreChecksPage;