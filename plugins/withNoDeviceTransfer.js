// Keeps Android from copying the app's data to another phone in a direct
// phone-to-phone transfer (by cable or Wi-Fi), which "allowBackup": false
// does not stop on some makes of phone for apps that target Android 12 or
// later. Decided by the user on 2026-10-30: signed out, the app keeps nothing
// beyond the phone (AGENTS.md, Lessons).
//
// It writes res/xml/data_extraction_rules.xml, which excludes every storage
// domain from both cloud backup and device transfer (a section left out or
// empty would allow everything), and points android:dataExtractionRules in
// the manifest at it. Android 11 and older read only allowBackup, which
// already stops both there.
const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const RULES_NAME = 'data_extraction_rules';

// Every place an app keeps files, in both of Android's storages. Android walks
// each domain from its own folder, so excluding root alone does not cover
// files/ or databases/: each is listed.
const DOMAINS = [
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
];

const excludes = DOMAINS.map((domain) => `    <exclude domain="${domain}" path="." />`).join('\n');

const RULES_XML = `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by plugins/withNoDeviceTransfer.js: nothing is backed up or transferred. -->
<data-extraction-rules>
  <cloud-backup>
${excludes}
  </cloud-backup>
  <device-transfer>
${excludes}
  </device-transfer>
</data-extraction-rules>
`;

// The manifest (as config plugins give it) pointing at the rules.
function setDataExtractionRules(androidManifest) {
  const application = androidManifest.manifest.application?.[0];
  if (!application) throw new Error('withNoDeviceTransfer: the manifest has no <application>.');
  application.$['android:dataExtractionRules'] = `@xml/${RULES_NAME}`;
  return androidManifest;
}

// Writes the rules into the generated android/ folder (platformProjectRoot).
function writeRulesFile(platformProjectRoot) {
  const dir = path.join(platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${RULES_NAME}.xml`), RULES_XML);
}

function withNoDeviceTransfer(config) {
  const withRules = withDangerousMod(config, [
    'android',
    (cfg) => {
      writeRulesFile(cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);
  return withAndroidManifest(withRules, (cfg) => {
    setDataExtractionRules(cfg.modResults);
    return cfg;
  });
}

module.exports = withNoDeviceTransfer;
module.exports.DOMAINS = DOMAINS;
module.exports.RULES_XML = RULES_XML;
module.exports.setDataExtractionRules = setDataExtractionRules;
module.exports.writeRulesFile = writeRulesFile;
