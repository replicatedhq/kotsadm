
import React from "react";

export default function ActiveDownstreamVersionRow(props) {
  return (
    <div className="flex flex-auto ActiveDownstreamVersionRow--wrapper">
      <div className="flex-column flex1">
        <div className="flex flex-auto alignItems--center u-fontWeight--bold u-color--tuna">
          <p className="u-fontSize--largest u-color--tuna u-lineHeight--normal u-fontWeight--bold u-marginRight--10">{props.snapshotTitle}</p>
        </div>
        <div className="flex flex-auto alignItems--center u-marginTop--5">
          <div className="flex flex1 alignItems--center">
            <p className="u-fontSize--normal u-color--doveGray u-fontWeight--bold u-lineHeight--normal u-marginRight--20"><span className="u-fontWeight--normal u-color--dustyGray">Started:</span> Mar 6, 2018 12:00 PM</p>
            <p className="u-fontSize--normal u-color--doveGray u-fontWeight--bold u-lineHeight--normal u-marginRight--20"><span className="u-fontWeight--normal u-color--dustyGray">Finished:</span> Mar 6, 2018 12:01 PM</p>
            <span className={`status-indicator success`}>Successful</span>
          </div>
          <div className="flex-auto">
            <span className="u-fontSize--normal u-fontWeight--medium u-color--chestnut u-textDecoration--underlineOnHover">Delete</span>
          </div>
        </div>
      </div>
    </div>
  )

}