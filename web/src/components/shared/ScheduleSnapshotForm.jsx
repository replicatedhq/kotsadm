import React, { Component } from "react";
import Select from "react-select";
import { getCronFrequency, getReadableCronDescriptor } from "../../utilities/utilities"
import "../../scss/components/shared/ScheduleSnapshotForm.scss";

const SCHEDULES = [
  {
    value: "hourly",
    label: "Hourly",
  },
  {
    value: "daily",
    label: "Daily",
  },
  {
    value: "weekly",
    label: "Weekly",
  },
  {
    value: "custom",
    label: "Custom",
  }
];

const TIMEOUTS = [
  {
    value: 10,
    label: "10 minutes",
  },
  {
    value: 30,
    label: "30 minutes",
  },
  {
    value: 1,
    label: "1 hour",
  },
  {
    value: 0,
    label: "Never",
  }
];

export default class ScheduleSnapshotForm extends Component {
  
  constructor () {
    super();
    this.state = {
      maxRetain: "4",
      autoEnabled: false,
      timeout: 10,
      selectedSchedule: "weekly",
      frequency: "0 0 12 ? * MON *",
      s3bucket: "",
      bucketRegion: "",
      bucketPrefix: "",
      bucketKeyId: "",
      bucketKeySecret: ""
    };
  }

  handleFormChange = (field, e) => {
    let nextState = {};
    if (field === "autoEnabled") {
      nextState[field] = e.target.checked;
    } else {
      nextState[field] = e.target.value;
    }
    this.setState(nextState, () => {
      if (field === "frequency") {
        this.getReadableCronExpression();
      }
    });
  }

  getReadableCronExpression = () => {
    const { frequency } = this.state;
    try {
      const readable = getReadableCronDescriptor(frequency);
      if (readable.includes("undefined")) {
        this.setState({ hasValidCron: false });
      } else {
        this.setState({ humanReadableCron: readable, hasValidCron: true });
      }
    } catch {
      this.setState({ hasValidCron: false });
    }
  }

  handleScheduleChange = (selectedSchedule) => {
    const frequency = getCronFrequency(selectedSchedule.value);
    this.setState({
      selectedSchedule: selectedSchedule.value,
      frequency
    }, () => {
      this.getReadableCronExpression();
    });
  }

  handleTimeoutChange = (timeout) => {
    this.setState({ timeout });
  }

  componentDidMount = () => {
    this.getReadableCronExpression();
  }

  render() {
    const { hasValidCron } = this.state;
    const selectedTimeout = TIMEOUTS.find((to) => {
      return to.value === this.state.timeout;
    });
    const selectedSchedule = SCHEDULES.find((schedule) => {
      return schedule.value === this.state.selectedSchedule;
    });


    return (
      <form>
        <h2 className="u-fontSize--largest u-color--tuna u-fontWeight--bold u-lineHeight--normal">Schedule a new snapshot</h2>
        <div className="flex-column flex1 u-marginTop--20">

          <div className="flex u-marginBottom--20">
            <div className="flex1 u-paddingRight--10">
              <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Max number of snapshots retained</p>
              <input type="text" className="Input" placeholder="4" value={this.state.maxRetain} onChange={(e) => { this.handleFormChange("maxRetain", e) }}/>
            </div>
            <div className="flex1 u-paddingLeft--10">
              <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Snapshot timeout</p>
              <Select
                className="replicated-select-container"
                classNamePrefix="replicated-select"
                placeholder="Select a max timeout"
                options={TIMEOUTS}
                isSearchable={false}
                getOptionValue={(timeout) => timeout.label}
                value={selectedTimeout}
                onChange={this.handleTimeoutChange}
                isOptionSelected={(option) => { option.value === selectedTimeout }}
              />
            </div>
          </div>

          <div className="flex u-marginBottom--20">
            <div className="flex1 u-paddingRight--10">
              <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Automatic snapshots</p>
              <div className="BoxedCheckbox-wrapper flex1 u-textAlign--left">
                <div className={`BoxedCheckbox flex-auto flex alignItems--center ${this.state.autoEnabled ? "is-active" : ""}`}>
                  <input
                    type="checkbox"
                    className="u-cursor--pointer u-marginLeft--10"
                    id="autoEnabled"
                    checked={this.state.autoEnabled}
                    onChange={(e) => { this.handleFormChange("autoEnabled", e) }}
                  />
                  <label htmlFor="autoEnabled" className="flex1 flex u-width--full u-position--relative u-cursor--pointer u-userSelect--none">
                    <div className="flex1">
                      <p className="u-color--tuna u-fontSize--normal u-fontWeight--medium">Enable automatic scheduled snapshots</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            {this.state.autoEnabled ?
              <div className="flex-column flex1 u-paddingLeft--10 u-position--relative">
                <div className="flex flex1">
                  <div className="flex1 u-paddingRight--5">
                    <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Schedule</p>
                    <Select
                      className="replicated-select-container"
                      classNamePrefix="replicated-select"
                      placeholder="Select an interval"
                      options={SCHEDULES}
                      isSearchable={false}
                      getOptionValue={(schedule) => schedule.label}
                      value={selectedSchedule}
                      onChange={this.handleScheduleChange}
                      isOptionSelected={(option) => { option.value === selectedSchedule }}
                    />
                  </div>
                  {this.state.selectedSchedule === "custom" &&
                    <div className="flex1 u-paddingLeft--5">
                      <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Cron expression</p>
                      <input type="text" className="Input" placeholder="0 0 12 ? * MON *" value={this.state.frequency} onChange={(e) => { this.handleFormChange("frequency", e) }}/>
                    </div>
                  }
                </div>
                {hasValidCron ?
                  <p className="cron-expression-text">{this.state.humanReadableCron}</p>
                :
                  <p className="cron-expression-text">Enter a valid Cron Expression <a className="replicated-link" href="" target="_blank" rel="noopener noreferrer">Get help</a></p>
                }
              </div>
            :
            <div className="flex1 u-paddingLeft--10"/>
            }
          </div>

        </div>

        <h2 className="u-fontSize--largest u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginTop--20">S3 config options</h2>
        <div className="flex-column flex1 u-marginTop--20">

          <div className="flex u-marginBottom--20">
            <div className="flex1 u-paddingRight--10">
              <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Bucket</p>
              <input type="text" className="Input" placeholder="Bucket name" value={this.state.s3bucket} onChange={(e) => { this.handleFormChange("s3bucket", e) }}/>
            </div>
            <div className="flex1 u-paddingRight--10">
              <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Region</p>
              <input type="text" className="Input" placeholder="Bucket region" value={this.state.bucketRegion} onChange={(e) => { this.handleFormChange("bucketRegion", e) }}/>
            </div>
            <div className="flex1 u-paddingLeft--10">
              <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Prefix <span className="optional-text">(optional)</span></p>
              <input type="text" className="Input" placeholder="Bucket prefix" value={this.state.bucketPrefix} onChange={(e) => { this.handleFormChange("bucketPrefix", e) }}/>
            </div>
          </div>

          <div className="flex u-marginBottom--20">
            <div className="flex1 u-paddingRight--10">
              <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Access key ID <span className="optional-text">(optional)</span></p>
              <input type="text" className="Input" placeholder="Bucket key Id" value={this.state.bucketKeyId} onChange={(e) => { this.handleFormChange("bucketKeyId", e) }}/>
            </div>
            <div className="flex1 u-paddingRight--10">
              <p className="u-fontSize--normal u-color--tuna u-fontWeight--bold u-lineHeight--normal u-marginBottom--10">Access key secret <span className="optional-text">(optional)</span></p>
              <input type="text" className="Input" placeholder="Bucket key secret" value={this.state.bucketKeySecret} onChange={(e) => { this.handleFormChange("bucketKeySecret", e) }}/>
            </div>
          </div>

        </div>

      </form>
    );
  }
}
