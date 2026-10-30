// plugins/withNoDeviceTransfer.js (decided by the user on 2026-10-30): with
// "allowBackup": false, Android must not copy the app's data in a
// phone-to-phone transfer either. Prebuild runs the plugin on the build
// machine; these check what it writes.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { XML } from 'expo/config-plugins';

import withNoDeviceTransfer from '../plugins/withNoDeviceTransfer';

const { DOMAINS, RULES_XML, setDataExtractionRules, writeRulesFile } = withNoDeviceTransfer;

it('points the application at the rules', () => {
  const manifest = { manifest: { application: [{ $: { 'android:name': '.MainApplication' } }] } };

  setDataExtractionRules(manifest);

  expect(manifest.manifest.application[0].$['android:dataExtractionRules']).toBe('@xml/data_extraction_rules');
});

it('excludes every storage domain from cloud backup and from device transfer', async () => {
  const rules = (await XML.parseXMLAsync(RULES_XML))['data-extraction-rules'];

  for (const section of ['cloud-backup', 'device-transfer']) {
    const excluded = rules[section][0].exclude.map((rule) => rule.$);
    expect(excluded).toEqual(DOMAINS.map((domain) => ({ domain, path: '.' })));
    // An include would turn the excludes into "only these".
    expect(rules[section][0].include).toBeUndefined();
  }
  // Each domain is walked from its own folder, so every one is listed.
  expect(DOMAINS).toEqual([
    'root',
    'file',
    'database',
    'sharedpref',
    'external',
    'device_root',
    'device_file',
    'device_database',
    'device_sharedpref',
  ]);
});

it('registers both changes with prebuild: the rules file and the manifest', () => {
  const config = withNoDeviceTransfer({ name: 'Park Yourself', slug: 'park-yourself' });

  expect(Object.keys(config.mods.android).sort()).toEqual(['dangerous', 'manifest']);
});

it('writes the rules where the manifest finds them', () => {
  const android = mkdtempSync(path.join(tmpdir(), 'no-device-transfer-'));
  try {
    writeRulesFile(android);

    expect(readFileSync(path.join(android, 'app/src/main/res/xml/data_extraction_rules.xml'), 'utf8')).toBe(RULES_XML);
  } finally {
    rmSync(android, { recursive: true, force: true });
  }
});
