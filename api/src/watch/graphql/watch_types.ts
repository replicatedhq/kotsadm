const TestProc = `
type TestProc {
	displayname: String
	command: String
	timeout: Int
	argFields: [String]
	args: [String]
	runOnSave: String
	when: String
}
`;

const ConfigChildItem = `
  type ConfigChildItem {
    name: String!
    title: String
    recommended: Boolean
    default: String
    value: String
  }
`;

const ConfigItem = `
  type ConfigItem {
    name: String
    title: String
    helpText: String
    recommended: Boolean
    default: String
    value: String
    multiValue: [String]
    readOnly: Boolean
    writeOnce: Boolean
    when: String
    type: String
    multiple: Boolean
    hidden: Boolean
    position: Int
    affix: String
    required: Boolean
    testProc: TestProc
    isExcludedFromSupport: Boolean
    filters: [String]
    items: [ConfigChildItem]
  }
`;

const ConfigGroup = `
  type ConfigGroup {
    name: String!
    title: String
    description: String
    testProc: TestProc
    when: String
    filters: [String]
    items: [ConfigItem]
  }
`;

const Watch = `
  type Watch {
    id: ID
    stateJSON: String
    watchName: String
    slug: String
    watchIcon: String
    lastUpdated: String
    createdOn: String
    contributors: [Contributor]
    notifications: [Notification]
    features: [Feature]
    cluster: Cluster
    watches: [Watch]
    currentVersion: Version
    pendingVersions: [Version]
    pastVersions: [Version]
    currentVersion: Version
    parentWatch: Watch
    metadata: String
    config: [ConfigGroup]
  }
`;

const Version = `
  type Version {
    title: String!
    status: String!
    createdOn: String!
    sequence: Int
    pullrequestNumber: Int
  }
`

const VersionDetail = `
  type VersionDetail {
    title: String
    status: String
    createdOn: String
    sequence: Int
    pullrequestNumber: Int
    rendered: String
  }
`
const StateMetadata = `
  type StateMetadata {
    name: String
    icon: String
    version: String
  }
`;

const Contributor = `
  type Contributor {
    id: ID
    createdAt: String
    githubId: Int
    login: String
    avatar_url: String
  }
`;

export default [
  ConfigChildItem,
  ConfigItem,
  ConfigGroup,
  TestProc,
  Watch,
  StateMetadata,
  Contributor,
  Version,
  VersionDetail,
];
