import React from "react";
import classNames from "classnames";
import { Link } from "react-router-dom";

export default function WatchSidebarItem(props) {
  const { className, watch } = props;
  const { watchIcon, watchName, pendingVersions } = watch;

  const [owner, slug] = watch.slug.split("/");

  const isBehind = pendingVersions?.length > 2 ? "2+" : pendingVersions.length;

  return (
    <div className={classNames("sidebar-link", className)}>
      <Link className="flex alignItems--center" to={`/watch/${owner}/${slug}`}>
        <span
          className="sidebar-link-icon"
          style={{ backgroundImage: `url(${watchIcon})` }}
        ></span>
        <div className="flex-column">
          <p className="u-color--tuna u-fontWeight--bold u-marginBottom--10">
            {watchName}
          </p>
          <div className="flex alignItems--center">
            <div
              className={classNames("icon", {
                "checkmark-icon": !isBehind,
                "exclamationMark-icon": isBehind
              })}
            />
            <span
              className={classNames(
                "u-marginLeft--5 u-fontSize--normal u-fontWeight--medium",
                {
                  "u-color--dustyGray": !isBehind,
                  "u-color--orange": isBehind
                }
              )}
            >
              {isBehind
                ? `${isBehind} ${
                    isBehind >= 2 || typeof isBehind === "string"
                      ? "versions"
                      : "version"
                  } behind`
                : "Up to date"}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
