const Entitlement = `
  type Entitlement {
    key: String
    value: String
    name: String
  }
`;

const License = `
type License {
  channel: String
  createdAt: String
  expiresAt: String
  type: String,
  entitlements: [Entitlement]
}`;

export default [
  Entitlement,
  License,
];
