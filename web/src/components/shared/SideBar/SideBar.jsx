import React, { Component, Fragment } from "react";
import classNames from "classnames";
import PropTypes from "prop-types";

import Loader from "@src/components/shared/Loader";
import "@src/scss/components/shared/SideBar.scss";

class SideBar extends Component {
  state = {
    /** @type {Array<JSX>} items - Used only in aggressive mode. Keep items in state derived from props */
    items: [],

    /** @type {Boolean} didReceiveData - Used only in aggressive mode. Set to true if data has been received */
    didReceiveData: false
  }

  static propTypes = {
    /** @type {String} className to use for styling */
    className: PropTypes.string,

    /** @type {Array<JSX>} array of JSX elements to render */
    items: PropTypes.array.isRequired,

    /** @type {Boolean} if true, only show loading for initial mount, and not subsequent loads */
    aggressive: PropTypes.bool
  }

  static defaultProps = {
    items: [],
    aggressive: false
  }

  /**
   * Not a fan of using this, but we are in a use case where we **must**
   * preserve the data within the list by deriving the current state
   * via props passed in.
   */
  static getDerivedStateFromProps(props, state) {
    const { items, aggressive, loading } = props;

    // This approach only runs when the component is set to aggressive mode
    if (aggressive) {

      // Change nothing if we're loading
      if (loading) {
        return null;
      }

      // Update items in state if items are truthy
      if (items.length) {
        return {
          items
        };
      }
    }
    return null;
  }

  componentDidMount() {
    const { aggressive, items } = this.props;
    if (aggressive) {
      this.setState({ items });
    }
  }

  componentDidUpdate() {
    const { items, aggressive } = this.props;
    const { didReceiveData } = this.state;

    // In aggressive mode, we want the loader to show if no data has been
    // received while we're waiting for the initial data.
    // When we receive data, set the didReceiveData state to `true`.
    if (aggressive && items.length && !didReceiveData) {
      this.setState({
        didReceiveData: true
      });
    }
  }

  render() {
    const { className, items, loading, aggressive } = this.props;
    const { didReceiveData } = this.state;
    const centeredLoader = (
      <div className="flex-column flex1 alignItems--center justifyContent--center u-minHeight--full sidebar">
        <Loader size="60" />
      </div>
    );

    // If we're loading and not aggressive/got data, return a loader
    if (loading && (!aggressive || !didReceiveData)) {
      return centeredLoader;
    }

    // If we're not aggressive and there's zero items, don't render anything
    if (items.length < 2 && !aggressive) {
      return null;
    }

    const renderItems = (jsx, idx) => <Fragment key={idx}>{jsx}</Fragment>;

    return (
      <div className={classNames("sidebar u-minHeight--full", className)}>
        <div className="flex-column u-width--full u-overflow--auto">
          {aggressive
            ? this.state.items.map(renderItems)
            : this.props.items.map(renderItems)
          }
        </div>
      </div>
    );
  }
}

export default SideBar;
