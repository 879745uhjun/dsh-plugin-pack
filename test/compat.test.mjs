import assert from 'node:assert/strict'
import { test } from 'node:test'
import { diagnose, requiredDsh, summarize } from '../lib/compat.mjs'
import { compareVersions, satisfies } from '../lib/semver.mjs'

/** A plugin record shaped like the scanner's output. */
function plugin(overrides) {
  return { name: 'p', version: '1.0.0', enginesDsh: null, dependencies: {}, slots: [], takeover: false, repo: null, ...overrides }
}

test('satisfies handles the ranges DSH plugins use', () => {
  assert.equal(satisfies('0.2.3', '>=0.2.2-rc.1 <0.3.0'), true)
  assert.equal(satisfies('0.3.0', '>=0.2.2-rc.1 <0.3.0'), false)
  assert.equal(satisfies('0.2.2', '>=0.2.2 <0.2.3-0'), true)
  assert.equal(satisfies('0.2.3', '>=0.2.2 <0.2.3-0'), false)
  assert.equal(satisfies('0.4.10', '^0.4.6'), true)
  assert.equal(satisfies('0.5.0', '^0.4.6'), false)
})

test('compareVersions orders prereleases below releases', () => {
  assert.ok(compareVersions('0.2.2-rc.1', '0.2.2') < 0)
  assert.ok(compareVersions('0.2.10', '0.2.9') > 0)
})

test('diagnose flags a takeover slot as a blocker', () => {
  const diagnostics = diagnose({
    targetDsh: '0.2.4',
    plugins: [
      plugin({ name: 'dsh-quickbar', slots: ['sidebar.workspaces.session.row.action'], takeover: true }),
      plugin({ name: 'dsh-pin', slots: ['sidebar.workspaces.session.row.action'] }),
    ],
  })
  const blocker = diagnostics.find((item) => item.rule === 'slot.unique')
  assert.equal(blocker.level, 'BLOCKER')
  assert.match(blocker.location, /^slot:sidebar/)
  assert.match(blocker.actual, /dsh-quickbar@1\.0\.0 \(takeover\) \+ dsh-pin@1\.0\.0/)
  assert.equal(blocker.code, 'C-01')
})

test('diagnose warns when an engine range excludes the target', () => {
  const diagnostics = diagnose({
    targetDsh: '0.2.2',
    plugins: [plugin({ name: 'dsh-notepad', enginesDsh: '>=0.2.3 <0.3.0' })],
  })
  assert.equal(diagnostics[0].rule, 'engine.range')
  assert.equal(diagnostics[0].level, 'WARN')
  assert.equal(diagnostics[0].location, 'dsh-notepad@1.0.0 · package.json#engines.dsh')
})

test('diagnose blocks on an unsatisfied inter-plugin dependency', () => {
  const diagnostics = diagnose({
    targetDsh: '0.2.4',
    plugins: [
      plugin({ name: 'dsh-broadcast', dependencies: { 'dsh-boxes': '^0.5.0' } }),
      plugin({ name: 'dsh-boxes', version: '0.4.10' }),
    ],
  })
  const blocker = diagnostics.find((item) => item.rule === 'dep.version')
  assert.equal(blocker.level, 'BLOCKER')
  assert.match(blocker.actual, /dsh-boxes@0\.4\.10/)
})

test('diagnose reports a lagging version as info', () => {
  const diagnostics = diagnose({
    targetDsh: '0.2.4',
    latest: new Map([['owner/repo', '1.2.0']]),
    plugins: [plugin({ name: 'dsh-stars', version: '1.1.0', repo: 'owner/repo' })],
  })
  assert.equal(diagnostics[0].rule, 'version.latest')
  assert.equal(diagnostics[0].level, 'INFO')
  assert.match(diagnostics[0].expected, /v1\.2\.0/)
})

test('summarize counts levels and keeps generation possible', () => {
  const diagnostics = diagnose({
    targetDsh: '0.2.4',
    plugins: [
      plugin({ name: 'a', slots: ['sidebar.x.action'], takeover: true }),
      plugin({ name: 'b', slots: ['sidebar.x.action'] }),
    ],
  })
  const summary = summarize(diagnostics)
  assert.equal(summary.counts.BLOCKER, 1)
  assert.equal(summary.level, 'BLOCKER')
  assert.equal(summary.canGenerate, true)
})

test('requiredDsh takes the highest lower bound', () => {
  assert.equal(
    requiredDsh([
      plugin({ enginesDsh: '>=0.2.2-rc.1 <0.3.0' }),
      plugin({ enginesDsh: '>=0.2.3 <0.3.0' }),
    ]),
    '0.2.3',
  )
})
