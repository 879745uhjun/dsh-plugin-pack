import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createPluginPackTool } from '../index.js'

test('plugin_pack exposes a complete tool contract', () => {
  const tool = createPluginPackTool({ get: () => undefined })
  assert.equal(tool.name, 'plugin_pack')
  assert.ok(tool.description.length > 40)
  assert.deepEqual(tool.parameters.required, ['action'])
  assert.deepEqual(tool.parameters.properties.action.enum, ['state', 'create', 'inspect', 'install', 'restore'])
  assert.equal(typeof tool.execute, 'function')
  assert.equal(tool.output.schema.type, 'object')
})

test('plugin_pack rejects an unknown action without throwing', async () => {
  const tool = createPluginPackTool({ get: () => undefined })
  const result = await tool.execute({ action: 'nope' })
  assert.equal(result.ok, false)
  assert.match(result.error, /unknown action/)
})

test('plugin_pack requires a file for inspect', async () => {
  const tool = createPluginPackTool({ get: () => undefined })
  const result = await tool.execute({ action: 'inspect' })
  assert.equal(result.ok, false)
  assert.match(result.error, /file is required/)
})
