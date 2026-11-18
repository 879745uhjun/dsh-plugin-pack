/**
 * dsh-plugin-pack — browser half.
 *
 * One page in the centre column, opened from its own sidebar entry. Three tabs:
 * pack (choose plugins, build a .dshpack), compatibility (C-xx diagnostics with
 * location/expected/actual) and import (preflight then install a built pack).
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-pack',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useState } = React

    const PANEL_ID = 'plugin-pack'
    const STATE_URL = '/plugin-pack/state'
    const CREATE_URL = '/plugin-pack/create'
    const INSTALL_URL = '/plugin-pack/install'
    const LATEST_URL = '/plugin-pack/latest'
    const RESTORE_URL = '/plugin-pack/restore'

    const CSS = [
      '.pp{display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary,#e8e8ec);',
      '  font:13px/1.45 "Segoe UI","Microsoft YaHei UI","Microsoft YaHei",system-ui,sans-serif;background:var(--dsw-alias-bg-layer-1,#151518)}',
      '.pp-head{padding:20px 24px 0}',
      '.pp-title{font-size:22px;font-weight:650;margin:0}',
      '.pp-sub{margin:4px 0 0;font-size:12px;color:var(--dsw-alias-label-tertiary,#76767f)}',
      '.pp-tabs{display:flex;gap:4px;margin-top:14px;border-bottom:1px solid var(--dsw-alias-border-l2,#2b2b32)}',
      '.pp-tab{height:32px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;font-size:12.5px;cursor:pointer;',
      '  color:var(--dsw-alias-label-tertiary,#76767f);background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px}',
      '.pp-tab.on{color:var(--dsw-alias-label-primary,#ececef);border-bottom-color:#4b8bf5;font-weight:600}',
      '.pp-badge{font-size:10px;padding:0 6px;height:16px;display:inline-flex;align-items:center;border-radius:20px;',
      '  background:var(--dsw-alias-bg-layer-2,#25252b);color:var(--dsw-alias-label-secondary,#a7a7b0)}',
      '.pp-body{flex:1;min-height:0;display:flex;gap:14px;padding:16px 24px 20px}',
      '.pp-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px;min-height:0}',
      '.pp-aside{width:290px;flex:0 0 290px;display:flex;flex-direction:column;gap:10px;min-height:0}',
      '.pp-card{background:var(--dsw-alias-bg-layer-2,#1f1f24);border:1px solid var(--dsw-alias-border-l2,#2b2b32);',
      '  border-radius:12px;overflow:hidden;display:flex;flex-direction:column;min-height:0}',
      '.pp-card-h{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,#2b2b32);font-weight:600;font-size:12.5px}',
      '.pp-card-b{padding:10px 12px;display:flex;flex-direction:column;gap:8px;min-height:0}',
      '.pp-banner{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;font-size:11.5px;',
      '  border:1px solid rgba(238,178,68,.35);background:rgba(238,178,68,.1);color:var(--dsw-alias-label-secondary,#a7a7b0)}',
      '.pp-table{width:100%;border-collapse:collapse;table-layout:fixed}',
      '.pp-table th{height:28px;text-align:left;font-size:10.5px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;',
      '  color:var(--dsw-alias-label-tertiary,#76767f);padding:0 8px;border-bottom:1px solid var(--dsw-alias-border-l2,#2b2b32)}',
      '.pp-table td{height:44px;padding:0 8px;border-bottom:1px solid var(--dsw-alias-border-l2,#232329);vertical-align:middle}',
      '.pp-name{font-size:11.5px;font-weight:600;font-family:"Cascadia Mono",Consolas,monospace}',
      '.pp-meta{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#76767f);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.pp-cb{width:15px;height:15px;border-radius:4px;border:1px solid var(--dsw-alias-border-l3,#4a4a55);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;color:#fff}',
      '.pp-cb.on{background:#4b8bf5;border-color:#4b8bf5}',
      '.pp-pill{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 8px;border-radius:20px;font-size:10.5px;border:1px solid transparent;white-space:nowrap}',
      '.pp-ok{color:#3ecf8e;background:rgba(62,207,142,.12);border-color:rgba(62,207,142,.28)}',
      '.pp-warn{color:#eeb244;background:rgba(238,178,68,.12);border-color:rgba(238,178,68,.3)}',
      '.pp-bad{color:#f4736f;background:rgba(244,115,111,.12);border-color:rgba(244,115,111,.3)}',
      '.pp-info{color:#6ea6ff;background:rgba(75,139,245,.12);border-color:rgba(75,139,245,.3)}',
      '.pp-mono{font-family:"Cascadia Mono",Consolas,monospace;font-size:10.5px}',
      '.pp-btn{height:30px;padding:0 11px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#3a3a43);',
      '  background:var(--dsw-alias-bg-layer-2,#25252b);color:var(--dsw-alias-label-primary,#ececef);font:inherit;font-size:12px;cursor:pointer}',
      '.pp-btn.pp-primary{background:#4b8bf5;border-color:#4b8bf5;color:#fff;font-weight:500}',
      '.pp-btn:disabled{opacity:.5;cursor:default}',
      '.pp-input{height:30px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#2b2b32);background:var(--dsw-alias-bg-layer-1,#151518);',
      '  color:inherit;padding:0 9px;font:inherit;font-size:12px;width:100%;box-sizing:border-box}',
      '.pp-field{display:flex;flex-direction:column;gap:4px}',
      '.pp-field label{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#76767f)}',
      '.pp-kv{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--dsw-alias-label-tertiary,#76767f)}',
      '.pp-kv b{color:var(--dsw-alias-label-secondary,#a7a7b0);font-weight:500}',
      '.pp-diag{border:1px solid var(--dsw-alias-border-l2,#2b2b32);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-layer-2,#1f1f24)}',
      '.pp-diag-h{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600}',
      '.pp-diag-row{display:grid;grid-template-columns:34px 1fr;gap:2px 10px;margin-top:7px;font-size:11px}',
      '.pp-diag-k{color:var(--dsw-alias-label-tertiary,#76767f)}',
      '.pp-diag-v{color:var(--dsw-alias-label-secondary,#a7a7b0)}',
      '.pp-loc{color:#6ea6ff;word-break:break-all}',
      '.pp-empty{padding:40px;text-align:center;color:var(--dsw-alias-label-tertiary,#76767f);font-size:12px}',
      '.pp-note{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#76767f);line-height:1.5}',
      '.pp-err{color:#f4736f;font-size:11.5px}',
      '.pp-row{display:flex;align-items:center;gap:6px}',
      '.pp-up{color:#eeb244;font-size:10px;margin-left:4px;font-family:"Cascadia Mono",Consolas,monospace}',
      '.pp-seg{display:inline-flex;border:1px solid var(--dsw-alias-border-l2,#3a3a43);border-radius:7px;overflow:hidden}',
      '.pp-seg span{padding:2px 8px;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#76767f);cursor:pointer}',
      '.pp-seg span.on{background:#4b8bf5;color:#fff}',
      '.pp-scroll{overflow:auto;min-height:0}',
    ].join('')

    const LEVEL_CLASS = { BLOCKER: 'pp-bad', WARN: 'pp-warn', INFO: 'pp-info', PASS: 'pp-ok' }
    const ACTION_CLASS = { add: 'pp-ok', replace: 'pp-info', skip: 'pp-badge', blocked: 'pp-bad', downgrade: 'pp-warn' }
    const ACTION_LABEL = { add: '新增', replace: '覆盖', skip: '跳过', blocked: '冲突', downgrade: '降级' }

    function fmtBytes(bytes) {
      if (!bytes) return '0 B'
      if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
      return (bytes / 1024 / 1024).toFixed(1) + ' MB'
    }

    /** True when version a is newer than version b (dotted numerics only). */
    function isNewer(a, b) {
      const left = String(a ?? '').replace(/^v/, '').split('.').map(Number)
      const right = String(b ?? '').replace(/^v/, '').split('.').map(Number)
      for (let i = 0; i < 3; i += 1) {
        const l = left[i] ?? 0
        const r = right[i] ?? 0
        if (l !== r) return l > r
      }
      return false
    }

    function shortSlot(slot) {
      const parts = slot.split('.')
      return parts.length > 3 ? '…' + parts.slice(-2).join('.') : slot
    }

    function checkbox(on, onClick) {
      return h('span', { key: 'cb', className: on ? 'pp-cb on' : 'pp-cb', onClick, role: 'checkbox', 'aria-checked': on }, on ? '✓' : '')
    }

    function packTab(props) {
      const { state, selection, toggle, packName, setPackName, version, setVersion, onCreate, busy, result, latest, latestNote, onCheckLatest } = props
      const rank = { BLOCKER: 3, WARN: 2, INFO: 1, PASS: 0 }
      const levelOf = new Map()
      for (const item of state.diagnostics ?? []) {
        for (const name of item.plugins ?? []) {
          const current = levelOf.get(name)
          if (!current || rank[item.level] > rank[current]) levelOf.set(name, item.level)
        }
      }
      const status = (name) => {
        const level = levelOf.get(name)
        if (level === 'BLOCKER') return ['pp-bad', '冲突']
        if (level === 'WARN') return ['pp-warn', '警告']
        if (level === 'INFO') return ['pp-info', '提示']
        return ['pp-ok', '兼容']
      }

      const chosen = state.plugins.filter((plugin) => selection.has(plugin.name))
      const total = chosen.reduce((sum, plugin) => sum + (plugin.size ?? 0), 0)
      const outdatedCount = chosen.filter((plugin) => latest[plugin.name] && isNewer(latest[plugin.name], plugin.version)).length

      const rows = state.plugins.map((plugin) => {
        const pair = status(plugin.name)
        const on = selection.has(plugin.name)
        const meta = plugin.slots.length ? plugin.slots.map(shortSlot).join(' · ') : (plugin.kind === 'linked' ? '本地 link' : plugin.kind)
        return h('tr', { key: plugin.name },
          h('td', null, checkbox(on, () => toggle(plugin.name))),
          h('td', null, h('div', { className: 'pp-name' }, plugin.name), h('div', { className: 'pp-meta' }, meta)),
          h('td', null,
            h('span', { className: 'pp-mono' }, plugin.version ?? '?'),
            latest[plugin.name] && isNewer(latest[plugin.name], plugin.version)
              ? h('span', { className: 'pp-up' }, '↑ ' + latest[plugin.name])
              : null),
          h('td', null, h('span', { className: 'pp-mono', style: { whiteSpace: 'nowrap', fontSize: '10px' } }, plugin.enginesDsh ?? '-')),
          h('td', null, h('span', { className: 'pp-pill ' + pair[0] }, pair[1])))
      })

      const table = h('table', { className: 'pp-table' },
        h('colgroup', null,
          h('col', { style: { width: '36px' } }),
          h('col', null),
          h('col', { style: { width: '70px' } }),
          h('col', { style: { width: '152px' } }),
          h('col', { style: { width: '86px' } })),
        h('thead', null, h('tr', null,
          h('th', null, ''), h('th', null, '插件'), h('th', null, '版本'), h('th', null, '兼容范围'), h('th', null, '状态'))),
        h('tbody', null, rows))

      const header = h('div', { className: 'pp-card-h' }, '插件清单',
        h('span', { className: 'pp-badge' }, String(state.plugins.length)),
        h('span', { className: 'pp-note', style: { marginLeft: 'auto' } }, '目标 DSH ' + (state.targetDsh ?? '-')))

      const banner = (state.summary?.counts?.BLOCKER ?? 0) > 0
        ? h('div', { className: 'pp-banner' },
            '⚠ ' + state.summary.counts.BLOCKER + ' 个阻断、' + state.summary.counts.WARN + ' 个警告；到「兼容性」看具体位置')
        : null

      const aside = h('div', { className: 'pp-aside' },
        h('div', { className: 'pp-card' },
          h('div', { className: 'pp-card-h' }, '包设置'),
          h('div', { className: 'pp-card-b' },
            h('div', { className: 'pp-field' }, h('label', null, '包名'),
              h('input', { className: 'pp-input', value: packName, onChange: (event) => setPackName(event.target.value) })),
            h('div', { className: 'pp-field' }, h('label', null, '包版本'),
              h('input', { className: 'pp-input', value: version, onChange: (event) => setVersion(event.target.value) })),
            h('div', { className: 'pp-kv' }, h('span', null, '最新版本'),
              h('button', { className: 'pp-btn', disabled: busy, onClick: onCheckLatest }, busy ? '检查中…' : '检查更新')),
            h('div', { className: 'pp-note' }, latestNote ?? '读取 GitHub tag，只用于版本提示与清单锁定'))),
        h('div', { className: 'pp-card' },
          h('div', { className: 'pp-card-h' }, '摘要'),
          h('div', { className: 'pp-card-b' },
            h('div', { className: 'pp-kv' }, h('span', null, '已选'), h('b', null, chosen.length + ' / ' + state.plugins.length)),
            h('div', { className: 'pp-kv' }, h('span', null, '解压后'), h('b', null, fmtBytes(total))),
            h('div', { className: 'pp-kv' }, h('span', null, '阻断 / 警告'),
              h('b', null, (state.summary?.counts?.BLOCKER ?? 0) + ' / ' + (state.summary?.counts?.WARN ?? 0))),
            h('div', { className: 'pp-kv' }, h('span', null, '可升级'),
              h('b', null, String(outdatedCount))))),
        h('div', { className: 'pp-card', style: { flex: 1 } },
          h('div', { className: 'pp-card-h' }, '生成'),
          h('div', { className: 'pp-card-b' },
            h('button', {
              className: 'pp-btn pp-primary',
              disabled: busy || chosen.length === 0,
              onClick: () => onCreate(chosen.map((plugin) => plugin.name)),
            }, busy ? '打包中…' : '生成 .dshpack'),
            h('div', { className: 'pp-note' }, '写到 .dsh/plugin-packs/，不覆盖已装插件'),
            result && result.file ? h('div', { className: 'pp-note' },
              h('div', null, '✔ ' + result.file),
              h('div', null, result.plugins + ' 插件 · ' + fmtBytes(result.bytes) + ' · ' + result.files + ' 文件')) : null,
            result && result.error ? h('div', { className: 'pp-err' }, result.error) : null)))

      return h('div', { className: 'pp-body' },
        h('div', { className: 'pp-main' }, banner,
          h('div', { className: 'pp-card', style: { flex: 1 } }, header, h('div', { className: 'pp-scroll' }, table))),
        aside)
    }

    function compatTab(state) {
      const diagnostics = state.diagnostics ?? []
      if (diagnostics.length === 0) {
        return h('div', { className: 'pp-empty' }, '没有发现问题：' + state.plugins.length + ' 个插件互相兼容')
      }
      const cards = diagnostics.map((item) => h('div', { key: item.code, className: 'pp-diag' },
        h('div', { className: 'pp-diag-h' },
          h('span', { className: 'pp-mono', style: { color: 'var(--dsw-alias-label-tertiary,#76767f)' } }, item.code),
          h('span', { className: 'pp-pill ' + LEVEL_CLASS[item.level] }, item.level),
          h('span', { className: 'pp-mono' }, item.rule)),
        h('div', { className: 'pp-diag-row' },
          h('span', { className: 'pp-diag-k' }, '定位'),
          h('span', { className: 'pp-diag-v pp-mono pp-loc' }, item.location),
          h('span', { className: 'pp-diag-k' }, '期望'),
          h('span', { className: 'pp-diag-v' }, item.expected),
          h('span', { className: 'pp-diag-k' }, '实际'),
          h('span', { className: 'pp-diag-v' }, item.actual))))

      const rules = h('div', { className: 'pp-card', style: { flex: 1 } },
        h('div', { className: 'pp-card-h' }, '规则'),
        h('div', { className: 'pp-card-b', style: { gap: '7px', fontSize: '10.5px', color: 'var(--dsw-alias-label-tertiary,#76767f)' } },
          h('div', null, h('span', { className: 'pp-mono' }, 'slot.unique'), ' 同一 UI 座位被多个插件注册'),
          h('div', null, h('span', { className: 'pp-mono' }, 'engine.range'), ' 插件 engines.dsh 不覆盖目标版本'),
          h('div', null, h('span', { className: 'pp-mono' }, 'dep.version'), ' 依赖的最低版本不被满足'),
          h('div', null, h('span', { className: 'pp-mono' }, 'version.latest'), ' 落后于 GitHub 最新 tag')))

      return h('div', { className: 'pp-body' },
        h('div', { className: 'pp-main pp-scroll', style: { gap: '8px' } }, cards),
        h('div', { className: 'pp-aside' }, rules))
    }

    function importTab(props) {
      const { state, onPreflight, onInstall, onRestore, busy, plan, choices, setChoices } = props
      const list = state.packs ?? []
      if (list.length === 0) return h('div', { className: 'pp-empty' }, '还没有生成过插件包；到「打包台」生成一个')

      const rows = list.map((pack) => h('tr', { key: pack.file },
        h('td', null,
          h('div', { className: 'pp-name' }, pack.name + ' ' + pack.version),
          h('div', { className: 'pp-meta' }, pack.file)),
        h('td', null, h('span', { className: 'pp-mono' }, fmtBytes(pack.bytes))),
        h('td', null, h('span', { className: 'pp-mono' }, String(pack.plugins))),
        h('td', null, h('div', { className: 'pp-row' },
          h('button', { className: 'pp-btn', disabled: busy, onClick: () => onPreflight(pack.file) }, '预检'),
          h('button', { className: 'pp-btn pp-primary', disabled: busy, onClick: () => onInstall(pack.file) }, '安装')))))

      const table = h('table', { className: 'pp-table' },
        h('colgroup', null,
          h('col', null), h('col', { style: { width: '80px' } }),
          h('col', { style: { width: '70px' } }), h('col', { style: { width: '150px' } })),
        h('thead', null, h('tr', null, h('th', null, '包'), h('th', null, '大小'), h('th', null, '插件'), h('th', null, '操作'))),
        h('tbody', null, rows))

      const conflictNames = new Set((plan?.conflicts ?? []).flatMap((item) => item.plugins ?? []))
      const planRows = plan && plan.actions
        ? plan.actions.map((action) => {
            const needsChoice = (conflictNames.has(action.name) || action.action === 'downgrade') && action.action !== 'skip'
            const choice = choices[action.name] ?? 'skip'
            const control = needsChoice
              ? h('span', { className: 'pp-seg' }, ['skip', 'overwrite', 'abort'].map((key) => h('span', {
                  key,
                  className: choice === key ? 'on' : '',
                  onClick: () => setChoices({ ...choices, [action.name]: key }),
                }, key === 'skip' ? '跳过' : key === 'overwrite' ? '覆盖' : '中止')))
              : h('span', { className: 'pp-pill ' + (ACTION_CLASS[action.action] ?? 'pp-badge') }, ACTION_LABEL[action.action] ?? action.action)
            return h('div', { key: action.name, className: 'pp-kv' },
              h('span', { className: 'pp-mono', title: action.installedVersion ? '本机 ' + action.installedVersion : '' }, action.name),
              h('b', null, control))
          })
        : [h('div', { key: 'hint', className: 'pp-note' }, '点「预检」看每个插件的动作，再决定是否安装')]
      const planError = plan && plan.error ? h('div', { key: 'error', className: 'pp-err' }, '预检失败：' + plan.error) : null
      const verifyNote = plan && plan.verification
        ? h('div', { key: 'verify', className: 'pp-note', style: { marginTop: '6px' } },
            plan.verification.ok
              ? '✔ 校验通过（' + plan.verification.checked + ' 个文件）'
              : '⚠ 校验不一致，已拒绝写入：' + plan.verification.mismatch.slice(0, 3).join('；'))
        : null
      const lockNote = plan && plan.lock
        ? h('div', { key: 'lock', className: 'pp-note', style: { marginTop: '8px' } },
            plan.lock.ok ? '✔ pnpm-lock.yaml 已同步' : '⚠ lockfile 未同步：' + plan.lock.error)
        : null
      const restoreNote = plan && plan.restored
        ? h('div', { key: 'restored', className: 'pp-note', style: { marginBottom: '6px', color: '#3ecf8e' } },
            '已回滚：放回 ' + (plan.restored.join(', ') || '-') + '；移除 ' + (plan.removed.join(', ') || '-'))
        : null
      const planContent = planError
        ? [planError]
        : plan && plan.restored
          ? [restoreNote]
          : plan && (plan.conflicts ?? []).length
          ? [h('div', { key: 'conflicts', className: 'pp-note', style: { color: '#eeb244', marginBottom: '6px' } },
              '冲突：' + plan.conflicts.map((item) => item.location.replace('slot:', '')).join('、')), ...planRows]
          : planRows

      const backupRows = (state.backups ?? []).length
        ? state.backups.map((backup) => h('div', { key: backup.stamp, className: 'pp-kv' },
            h('span', { className: 'pp-mono', title: backup.pack + ' ' + backup.version }, backup.stamp),
            h('span', null,
              h('b', null, backup.actions + ' 项'),
              h('button', {
                className: 'pp-btn',
                style: { height: '22px', marginLeft: '6px', fontSize: '10.5px' },
                disabled: busy,
                onClick: () => onRestore(backup.stamp),
              }, '回滚'))))
        : [h('div', { key: 'none', className: 'pp-note' }, '还没有安装备份')]

      const backupCard = h('div', { className: 'pp-card' },
        h('div', { className: 'pp-card-h' }, '安装备份', h('span', { className: 'pp-badge' }, String((state.backups ?? []).length))),
        h('div', { className: 'pp-card-b', style: { maxHeight: '170px', overflow: 'auto' } }, backupRows))

      const planCard = h('div', { className: 'pp-card', style: { flex: 1 } },
        h('div', { className: 'pp-card-h' }, '预检结果'),
        h('div', { className: 'pp-card-b pp-scroll' }, planContent),
        verifyNote,
        lockNote)

      return h('div', { className: 'pp-body' },
        h('div', { className: 'pp-main' },
          h('div', { className: 'pp-card', style: { flex: 1 } },
            h('div', { className: 'pp-card-h' }, '已生成的包', h('span', { className: 'pp-badge' }, String(list.length))),
            h('div', { className: 'pp-scroll' }, table))),
        h('div', { className: 'pp-aside' }, planCard, backupCard))
    }

    function PluginPackPage() {
      const [state, setState] = useState(null)
      const [error, setError] = useState(null)
      const [tab, setTab] = useState('pack')
      const [busy, setBusy] = useState(false)
      const [result, setResult] = useState(null)
      const [plan, setPlan] = useState(null)
      const [selection, setSelection] = useState(new Set())
      const [packName, setPackName] = useState('dsh-toolkit')
      const [version, setVersion] = useState('1.0.0')
      const [latest, setLatest] = useState({})
      const [latestNote, setLatestNote] = useState(null)
      const [choices, setChoices] = useState({})

      const load = useCallback(async () => {
        try {
          const response = await fetch(STATE_URL, { headers: { accept: 'application/json' } })
          const payload = await response.json()
          if (!payload.ok) throw new Error(payload.error ?? 'state failed')
          // The page never lists itself: it is the tool, not pack content.
          payload.plugins = payload.plugins.filter((plugin) => plugin.name !== 'dsh-plugin-pack')
          setState(payload)
          setSelection((previous) => {
            if (previous.size > 0) return previous
            // Local (linked) plugins are the author's own; registry bundles such
            // as dsh-ops are large and belong to the app, so they start unselected.
            const linked = payload.plugins.filter((plugin) => plugin.kind === 'linked')
            return new Set((linked.length > 0 ? linked : payload.plugins).map((plugin) => plugin.name))
          })
        } catch (cause) {
          setError(cause.message)
        }
      }, [])

      useEffect(() => { void load() }, [load])

      const toggle = useCallback((name) => {
        setSelection((previous) => {
          const next = new Set(previous)
          if (next.has(name)) next.delete(name)
          else next.add(name)
          return next
        })
      }, [])

      const create = useCallback(async (select) => {
        setBusy(true)
        setResult(null)
        try {
          const response = await fetch(CREATE_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: packName, version, select, align: Object.keys(latest).length > 0, latest }),
          })
          const payload = await response.json()
          if (!payload.ok) throw new Error(payload.error ?? 'create failed')
          setResult(payload)
          await load()
        } catch (cause) {
          setResult({ error: cause.message })
        } finally {
          setBusy(false)
        }
      }, [packName, version, load])

      const post = useCallback(async (body) => {
        const response = await fetch(INSTALL_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        return response.json()
      }, [])

      const preflight = useCallback(async (file) => {
        setBusy(true)
        try {
          const payload = await post({ file, dryRun: true })
          if (!payload.ok) throw new Error(payload.error ?? 'preflight failed')
          setPlan(payload)
          setChoices({})
        } catch (cause) {
          setPlan({ actions: [], error: cause.message })
        } finally {
          setBusy(false)
        }
      }, [post])

      const install = useCallback(async (file) => {
        setBusy(true)
        try {
          const skip = Object.keys(choices).filter((name) => choices[name] === 'skip')
          const overwrite = Object.keys(choices).filter((name) => choices[name] === 'overwrite')
          const abort = Object.values(choices).includes('abort')
          const payload = await post({ file, dryRun: false, skip, overwrite, abort })
          if (!payload.ok) throw new Error(payload.error ?? 'install failed')
          setPlan(payload)
          await load()
        } catch (cause) {
          setPlan({ actions: [], error: cause.message })
        } finally {
          setBusy(false)
        }
      }, [post, load, choices])

      const restore = useCallback(async (stamp) => {
        setBusy(true)
        try {
          const response = await fetch(RESTORE_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ stamp }),
          })
          const payload = await response.json()
          if (!payload.ok) throw new Error(payload.error ?? 'restore failed')
          setPlan({ actions: [], restored: payload.restored ?? [], removed: payload.removed ?? [] })
          await load()
        } catch (cause) {
          setPlan({ actions: [], error: cause.message })
        } finally {
          setBusy(false)
        }
      }, [load])

      const checkLatest = useCallback(async () => {
        setBusy(true)
        setLatestNote('正在读取 GitHub tag…')
        try {
          const response = await fetch(LATEST_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ select: [...selection] }),
          })
          const payload = await response.json()
          if (!payload.ok) throw new Error(payload.error ?? 'latest failed')
          setLatest(payload.latest ?? {})
          const found = Object.keys(payload.latest ?? {}).length
          const failed = payload.errors?.length ?? 0
          setLatestNote(found === 0 && failed > 0
            ? '无法连接 GitHub（' + failed + ' 个仓库均失败），版本提示暂不可用'
            : found + ' 个仓库已查 · ' + failed + ' 个失败')
        } catch (cause) {
          setLatestNote('检查失败：' + cause.message)
        } finally {
          setBusy(false)
        }
      }, [selection])

      if (error) return h('div', { className: 'pp' }, h('div', { className: 'pp-empty pp-err' }, '无法读取插件信息：' + error))
      if (!state) return h('div', { className: 'pp' }, h('div', { className: 'pp-empty' }, '正在扫描 profile…'))

      const blockers = state.summary?.counts?.BLOCKER ?? 0
      const head = h('div', { className: 'pp-head' },
        h('h1', { className: 'pp-title' }, '插件包'),
        h('p', { className: 'pp-sub' },
          state.profile.dir + ' · 目标 DSH ' + (state.targetDsh ?? '-') + ' · ' + state.plugins.length + ' 个第三方插件'),
        h('div', { className: 'pp-tabs' },
          h('button', { className: tab === 'pack' ? 'pp-tab on' : 'pp-tab', onClick: () => setTab('pack') }, '打包台'),
          h('button', { className: tab === 'compat' ? 'pp-tab on' : 'pp-tab', onClick: () => setTab('compat') },
            '兼容性', blockers > 0 ? h('span', { className: 'pp-badge' }, String(blockers)) : null),
          h('button', { className: tab === 'import' ? 'pp-tab on' : 'pp-tab', onClick: () => setTab('import') }, '导入')))

      const body = tab === 'pack'
        ? packTab({
            state, selection, toggle, packName, setPackName, version, setVersion, onCreate: create, busy, result,
            latest, latestNote, onCheckLatest: checkLatest,
          })
        : tab === 'compat'
          ? compatTab(state)
          : importTab({ state, onPreflight: preflight, onInstall: install, onRestore: restore, busy, plan, choices, setChoices })

      return h('div', { className: 'pp' }, head, body)
    }

    function PanelIcon() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none' },
        h('path', { d: 'M8 1.8 13.8 4.9v6.2L8 14.2 2.2 11.1V4.9L8 1.8Z', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linejoin': 'round' }),
        h('path', { d: 'm2.5 5 5.5 3 5.5-3', stroke: 'currentColor', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement('style')
          style.setAttribute('data-plugin-css', 'dsh-plugin-pack/PluginPack.css')
          style.textContent = CSS
          document.head.appendChild(style)
          return () => style.remove()
        }, 'plugin-pack: styles')

        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, PluginPackPage))

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 7,
          label: () => '插件包',
        }, PanelIcon))
      },
    }
  },
})
