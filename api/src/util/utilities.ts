import yaml from "js-yaml";
import { KLicense, KEntitlement } from "../klicenses";

export function decodeBase64(data: string): string {
  const buffer = new Buffer(data, 'base64');
  return buffer.toString("ascii");
}

export function getPreflightResultState(preflightResults): string {
  const results = preflightResults.results;
  let resultState = "pass";
  for (const check of results) {
    if (check.isWarn) {
      resultState = "warn";
    } else if (check.isFail) {
      return "fail";
    }
  }
  return resultState;
}

export function getLicenseInfoFromYaml(licenseData): KLicense {
  const licenseJson = yaml.safeLoad(licenseData);
  const spec = licenseJson.spec;

  const license = new KLicense();
  license.id = spec.licenseID;
  license.expiresAt = spec.entitlements.expires_at.value;

  const entitlements: KEntitlement[] = [];
  const keys = Object.keys(spec.entitlements);
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    const entitlement = spec.entitlements[key];
    if (!entitlement.isHidden && key !== "expires_at") {
      entitlements.push({
        title: entitlement.title,
        value: entitlement.value,
        label: key,
      });
    }
  }
  license.entitlements = entitlements;

  return license;
}
