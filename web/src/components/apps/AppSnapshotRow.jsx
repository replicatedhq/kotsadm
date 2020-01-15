
import React from "react";
import { Link } from "react-router-dom";
import { Utilities, formatByteSize } from "../../utilities/utilities";
import dayjs from "dayjs";
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
dayjs.extend(isSameOrAfter)


export default function ActiveDownstreamVersionRow(props) {
  const { snapshot } = props;
  const isExpired = dayjs(new Date()).isSameOrAfter(snapshot.expires);
  return (
    <div className={`flex flex-auto ActiveDownstreamVersionRow--wrapper alignItems--center ${isExpired && "is-expired"}`}>
      <div className="flex-column flex1">
        <div className="flex flex-auto alignItems--center u-fontWeight--bold u-color--tuna">
          <p className={`u-fontSize--largest ${isExpired ? "u-color--dustyGray" : "u-color--tuna"} u-lineHeight--normal u-fontWeight--bold u-marginRight--10`}>{snapshot.name}</p>
          {!isExpired && <Link className="replicated-link u-marginLeft--5 u-fontSize--small" to={`/app/${props.appSlug}/snapshots/1`}>View</Link>}
        </div>
        <div className="flex flex-auto alignItems--center u-marginTop--5">
          <div className="flex flex1 alignItems--center">
            <p className="u-fontSize--normal u-color--doveGray u-fontWeight--bold u-lineHeight--normal u-marginRight--20"><span className="u-fontWeight--normal u-color--dustyGray">Started:</span> {Utilities.dateFormat(snapshot.started, "MMM D, YYYY h:mm A")}</p>
            <p className="u-fontSize--normal u-color--doveGray u-fontWeight--bold u-lineHeight--normal u-marginRight--20"><span className="u-fontWeight--normal u-color--dustyGray">Finished:</span> {Utilities.dateFormat(snapshot.finished, "MMM D, YYYY h:mm A")}</p>
            <div>
              <span className={`status-indicator success`}>Successful</span>
            </div>
          </div>
        </div>
        <div className="flex flex-auto alignItems--center u-marginTop--5">
          <div className="flex flex1 alignItems--center">
            <p className="u-fontSize--normal u-color--doveGray u-fontWeight--bold u-lineHeight--normal u-marginRight--20"><span className="u-fontWeight--normal u-color--dustyGray">Volumes included:</span> {snapshot.volumeSuccessCount}/{snapshot.volumeCount}</p>
            <p className="u-fontSize--normal u-color--doveGray u-fontWeight--bold u-lineHeight--normal u-marginRight--20"><span className="u-fontWeight--normal u-color--dustyGray">Backup size:</span> {snapshot.volumeSizeHuman}</p>
          </div>
        </div>
      </div>
      {!isExpired &&
        <div className="flex-auto">
          <span className="u-fontSize--normal u-fontWeight--medium u-color--royalBlue u-textDecoration--underlineOnHover u-marginRight--20">Restore</span>
          <span className="u-fontSize--normal u-fontWeight--medium u-color--chestnut u-textDecoration--underlineOnHover">Delete</span>
        </div>
      }
    </div>
  )

}