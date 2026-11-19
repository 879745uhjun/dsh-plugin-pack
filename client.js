/**
 * dsh-plugin-pack — browser half.
 *
 * One page in the centre column, opened from its own sidebar entry. Three tabs:
 * pack, compatibility and import. Every visible string goes through the Client
 * locale service (en/zh); colours are DSH theme tokens.
 */
window.__ModuleLoader__.load({
  // The module id must match the package name: the loader keys registration and
  // locale scoping off it, so a scoped package needs its scoped id.
  id: '@879745uhjun/dsh-plugin-pack',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useState } = React

    const NS = 'plugin-pack'
    const PANEL_ID = 'plugin-pack'
    const STATE_URL = '/plugin-pack/state'
    const CREATE_URL = '/plugin-pack/create'
    const INSTALL_URL = '/plugin-pack/install'
    const LATEST_URL = '/plugin-pack/latest'
    const RESTORE_URL = '/plugin-pack/restore'

    const STRINGS = {
      en: {
        'panel': 'Plugin packs',
        'title': 'Plugin packs',
        'tab.pack': 'Pack',
        'tab.compat': 'Compatibility',
        'tab.import': 'Import',
        'card.plugins': 'Plugins',
        'card.settings': 'Pack settings',
        'card.summary': 'Summary',
        'card.build': 'Build',
        'field.name': 'Pack name',
        'field.version': 'Pack version',
        'field.latest': 'Latest versions',
        'btn.check': 'Check updates',
        'btn.checking': 'Checking…',
        'btn.build': 'Build .dshpack',
        'btn.building': 'Building…',
        'kv.selected': 'Selected',
        'kv.unpacked': 'Unpacked',
        'kv.findings': 'Blockers / warnings',
        'kv.outdated': 'Outdated',
        'note.target': 'Target DSH',
        'note.output': 'Writes under .dsh/plugin-packs; installed plugins are not touched',
        'note.latestHint': 'Reads git tags: the local checkout first, GitHub as a fallback',
        'note.offline': 'GitHub unreachable',
        'status.ok': 'Compatible',
        'status.warn': 'Warning',
        'status.bad': 'Conflict',
        'status.info': 'Info',
        'action.add': 'Add',
        'action.replace': 'Replace',
        'action.skip': 'Skip',
        'action.downgrade': 'Downgrade',
        'action.blocked': 'Conflict',
        'th.choose': '',
        'th.plugin': 'Plugin',
        'th.version': 'Version',
        'th.engine': 'Engine range',
        'th.status': 'Status',
        'card.rules': 'Rules',
        'card.packs': 'Built packs',
        'card.preflight': 'Preflight',
        'card.backups': 'Install backups',
        'th.pack': 'Pack',
        'th.size': 'Size',
        'th.plugins': 'Plugins',
        'th.ops': 'Actions',
        'btn.preflight': 'Preflight',
        'btn.install': 'Install',
        'btn.restore': 'Roll back',
        'hint.preflight': 'Run a preflight to see what each plugin would do',
        'hint.noPacks': 'No pack yet — build one on the Pack tab',
        'hint.noBackups': 'No install backup yet',
        'note.verifyOk': 'Checksums verified',
        'note.verifyBad': 'Checksums do not match; nothing was written',
        'note.lockOk': 'pnpm-lock.yaml refreshed',
        'note.lockBad': 'lockfile not refreshed',
        'note.restored': 'Rolled back',
        'note.conflicts': 'Conflicts',
        'err.state': 'Cannot read the plugin list',
        'err.preflight': 'Preflight failed',
        'err.checked': 'repositories checked',
        'err.failed': 'failed',
        'rule.slot': 'Two plugins register the same UI seat',
        'rule.engine': 'A plugin engine range misses the target DSH',
        'rule.dep': 'A dependency floor is not met',
        'rule.locale': 'Two plugins share one locale namespace',
        'rule.version': 'Behind the newest git tag',
        'rule.platform': 'The pack was built on another platform',
        'slot.trailing': 'session row trailing',
        'slot.action': 'session row action',
        'slot.menu': 'context menu',
        'slot.main': 'main page',
        'slot.overlay': 'overlay',
        'slot.tool': 'agent tool',
        'loading': 'Scanning the profile…',
      },
      zh: {
        'panel': '插件包',
        'title': '插件包',
        'tab.pack': '打包台',
        'tab.compat': '兼容性',
        'tab.import': '导入',
        'card.plugins': '插件清单',
        'card.settings': '包设置',
        'card.summary': '摘要',
        'card.build': '生成',
        'field.name': '包名',
        'field.version': '包版本',
        'field.latest': '最新版本',
        'btn.check': '检查更新',
        'btn.checking': '检查中…',
        'btn.build': '生成 .dshpack',
        'btn.building': '打包中…',
        'kv.selected': '已选',
        'kv.unpacked': '解压后',
        'kv.findings': '阻断 / 警告',
        'kv.outdated': '可升级',
        'note.target': '目标 DSH',
        'note.output': '写到 .dsh/plugin-packs，不动已安装插件',
        'note.latestHint': '读 git tag：优先本地检出，GitHub 仅作回退',
        'note.offline': '无法连接 GitHub',
        'status.ok': '兼容',
        'status.warn': '警告',
        'status.bad': '冲突',
        'status.info': '提示',
        'action.add': '新增',
        'action.replace': '覆盖',
        'action.skip': '跳过',
        'action.downgrade': '降级',
        'action.blocked': '冲突',
        'th.choose': '',
        'th.plugin': '插件',
        'th.version': '版本',
        'th.engine': '兼容范围',
        'th.status': '状态',
        'card.rules': '规则',
        'card.packs': '已生成的包',
        'card.preflight': '预检结果',
        'card.backups': '安装备份',
        'th.pack': '包',
        'th.size': '大小',
        'th.plugins': '插件',
        'th.ops': '操作',
        'btn.preflight': '预检',
        'btn.install': '安装',
        'btn.restore': '回滚',
        'hint.preflight': '点「预检」看每个插件的动作，再决定是否安装',
        'hint.noPacks': '还没有生成过插件包；到「打包台」生成一个',
        'hint.noBackups': '还没有安装备份',
        'note.verifyOk': '校验通过',
        'note.verifyBad': '校验不一致，已拒绝写入',
        'note.lockOk': 'pnpm-lock.yaml 已同步',
        'note.lockBad': 'lockfile 未同步',
        'note.restored': '已回滚',
        'note.conflicts': '冲突',
        'err.state': '无法读取插件信息',
        'err.preflight': '预检失败',
        'err.checked': '个仓库已查',
        'err.failed': '个失败',
        'rule.slot': '同一 UI 座位被多个插件注册',
        'rule.engine': '插件 engines.dsh 不覆盖目标版本',
        'rule.dep': '依赖的最低版本不被满足',
        'rule.locale': '两个插件共用同一 locale 命名空间',
        'rule.version': '落后于最新 git tag',
        'rule.platform': '包在另一个平台上构建',
        'slot.trailing': '会话行尾部',
        'slot.action': '会话行操作位',
        'slot.menu': '右键菜单',
        'slot.main': '主页面',
        'slot.overlay': '浮层',
        'slot.tool': 'Agent 工具',
        'loading': '正在扫描 profile…',
      },
    }

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
    const STATUS = [
      ['BLOCKER', 'pp-bad', 'status.bad'],
      ['WARN', 'pp-warn', 'status.warn'],
      ['INFO', 'pp-info', 'status.info'],
    ]
    const ACTION_CLASS = { add: 'pp-ok', replace: 'pp-info', skip: 'pp-badge', blocked: 'pp-bad', downgrade: 'pp-warn' }
    const ACTION_KEY = { add: 'action.add', replace: 'action.replace', skip: 'action.skip', blocked: 'action.blocked', downgrade: 'action.downgrade' }
    const SLOT_LABEL = {
      trailing: 'slot.trailing',
      action: 'slot.action',
      menu: 'slot.menu',
      main: 'slot.main',
      overlay: 'slot.overlay',
      tool: 'slot.tool',
    }

    function fmtBytes(bytes) {
      if (!bytes) return '0 B'
      if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
      return (bytes / 1024 / 1024).toFixed(1) + ' MB'
    }

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
      const { state, selection, toggle, packName, setPackName, version, setVersion, onCreate, busy, result, latest, latestNote, onCheckLatest, t } = props
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
        const row = STATUS.find((entry) => entry[0] === level)
        return row ? [row[1], t(row[2])] : ['pp-ok', t('status.ok')]
      }

      const chosen = state.plugins.filter((plugin) => selection.has(plugin.name))
      const total = chosen.reduce((sum, plugin) => sum + (plugin.size ?? 0), 0)
      const outdatedCount = chosen.filter((plugin) => latest[plugin.name] && isNewer(latest[plugin.name], plugin.version)).length

      const rows = state.plugins.map((plugin) => {
        const pair = status(plugin.name)
        const on = selection.has(plugin.name)
        const meta = plugin.slots.length ? plugin.slots.map(shortSlot).join(' · ') : (plugin.kind === 'linked' ? 'link' : plugin.kind)
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
          h('th', null, t('th.choose')), h('th', null, t('th.plugin')), h('th', null, t('th.version')), h('th', null, t('th.engine')), h('th', null, t('th.status')))),
        h('tbody', null, rows))

      const header = h('div', { className: 'pp-card-h' }, t('card.plugins'),
        h('span', { className: 'pp-badge' }, String(state.plugins.length)),
        h('span', { className: 'pp-note', style: { marginLeft: 'auto' } }, t('note.target') + ' ' + (state.targetDsh ?? '-')))

      const banner = (state.summary?.counts?.BLOCKER ?? 0) > 0
        ? h('div', { className: 'pp-banner' },
            '⚠ ' + state.summary.counts.BLOCKER + ' / ' + state.summary.counts.WARN + ' ' + t('kv.findings'))
        : null

      const aside = h('div', { className: 'pp-aside' },
        h('div', { className: 'pp-card' },
          h('div', { className: 'pp-card-h' }, t('card.settings')),
          h('div', { className: 'pp-card-b' },
            h('div', { className: 'pp-field' }, h('label', null, t('field.name')),
              h('input', { className: 'pp-input', value: packName, onChange: (event) => setPackName(event.target.value) })),
            h('div', { className: 'pp-field' }, h('label', null, t('field.version')),
              h('input', { className: 'pp-input', value: version, onChange: (event) => setVersion(event.target.value) })),
            h('div', { className: 'pp-kv' }, h('span', null, t('field.latest')),
              h('button', { className: 'pp-btn', disabled: busy, onClick: onCheckLatest }, busy ? t('btn.checking') : t('btn.check'))),
            h('div', { className: 'pp-note' }, latestNote ?? t('note.latestHint')))),
        h('div', { className: 'pp-card' },
          h('div', { className: 'pp-card-h' }, t('card.summary')),
          h('div', { className: 'pp-card-b' },
            h('div', { className: 'pp-kv' }, h('span', null, t('kv.selected')), h('b', null, chosen.length + ' / ' + state.plugins.length)),
            h('div', { className: 'pp-kv' }, h('span', null, t('kv.unpacked')), h('b', null, fmtBytes(total))),
            h('div', { className: 'pp-kv' }, h('span', null, t('kv.findings')),
              h('b', null, (state.summary?.counts?.BLOCKER ?? 0) + ' / ' + (state.summary?.counts?.WARN ?? 0))),
            h('div', { className: 'pp-kv' }, h('span', null, t('kv.outdated')), h('b', null, String(outdatedCount))))),
        h('div', { className: 'pp-card', style: { flex: 1 } },
          h('div', { className: 'pp-card-h' }, t('card.build')),
          h('div', { className: 'pp-card-b' },
            h('button', {
              className: 'pp-btn pp-primary',
              disabled: busy || chosen.length === 0,
              onClick: () => onCreate(chosen.map((plugin) => plugin.name)),
            }, busy ? t('btn.building') : t('btn.build')),
            h('div', { className: 'pp-note' }, t('note.output')),
            result && result.file ? h('div', { className: 'pp-note' },
              h('div', null, '✔ ' + result.file),
              h('div', null, result.plugins + ' · ' + fmtBytes(result.bytes) + ' · ' + result.files)) : null,
            result && result.error ? h('div', { className: 'pp-err' }, result.error) : null)))

      return h('div', { className: 'pp-body' },
        h('div', { className: 'pp-main' }, banner,
          h('div', { className: 'pp-card', style: { flex: 1 } }, header, h('div', { className: 'pp-scroll' }, table))),
        aside)
    }

    function compatTab(props) {
      const { state, t } = props
      const diagnostics = state.diagnostics ?? []
      if (diagnostics.length === 0) {
        return h('div', { className: 'pp-empty' }, t('status.ok') + ' · ' + state.plugins.length)
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
        h('div', { className: 'pp-card-h' }, t('card.rules')),
        h('div', { className: 'pp-card-b', style: { gap: '7px', fontSize: '10.5px', color: 'var(--dsw-alias-label-tertiary,#76767f)' } },
          h('div', null, h('span', { className: 'pp-mono' }, 'slot.unique'), ' ' + t('rule.slot')),
          h('div', null, h('span', { className: 'pp-mono' }, 'engine.range'), ' ' + t('rule.engine')),
          h('div', null, h('span', { className: 'pp-mono' }, 'dep.version'), ' ' + t('rule.dep')),
          h('div', null, h('span', { className: 'pp-mono' }, 'locale.key'), ' ' + t('rule.locale')),
          h('div', null, h('span', { className: 'pp-mono' }, 'version.latest'), ' ' + t('rule.version')),
          h('div', null, h('span', { className: 'pp-mono' }, 'runtime.platform'), ' ' + t('rule.platform'))))

      return h('div', { className: 'pp-body' },
        h('div', { className: 'pp-main pp-scroll', style: { gap: '8px' } }, cards),
        h('div', { className: 'pp-aside' }, rules))
    }

    function importTab(props) {
      const { state, onPreflight, onInstall, onRestore, busy, plan, choices, setChoices, t } = props
      const list = state.packs ?? []
      if (list.length === 0) return h('div', { className: 'pp-empty' }, t('hint.noPacks'))

      const rows = list.map((pack) => h('tr', { key: pack.file },
        h('td', null,
          h('div', { className: 'pp-name' }, pack.name + ' ' + pack.version),
          h('div', { className: 'pp-meta' }, pack.file)),
        h('td', null, h('span', { className: 'pp-mono' }, fmtBytes(pack.bytes))),
        h('td', null, h('span', { className: 'pp-mono' }, String(pack.plugins))),
        h('td', null, h('div', { className: 'pp-row' },
          h('button', { className: 'pp-btn', disabled: busy, onClick: () => onPreflight(pack.file) }, t('btn.preflight')),
          h('button', { className: 'pp-btn pp-primary', disabled: busy, onClick: () => onInstall(pack.file) }, t('btn.install'))))))

      const table = h('table', { className: 'pp-table' },
        h('colgroup', null,
          h('col', null), h('col', { style: { width: '80px' } }),
          h('col', { style: { width: '70px' } }), h('col', { style: { width: '150px' } })),
        h('thead', null, h('tr', null, h('th', null, t('th.pack')), h('th', null, t('th.size')), h('th', null, t('th.plugins')), h('th', null, t('th.ops')))),
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
                }, key === 'skip' ? t('action.skip') : key === 'overwrite' ? t('action.replace') : '✕')))
              : h('span', { className: 'pp-pill ' + (ACTION_CLASS[action.action] ?? 'pp-badge') }, t(ACTION_KEY[action.action] ?? 'action.skip'))
            return h('div', { key: action.name, className: 'pp-kv' },
              h('span', { className: 'pp-mono', title: action.installedVersion ? '→ ' + action.installedVersion : '' }, action.name),
              h('b', null, control))
          })
        : [h('div', { key: 'hint', className: 'pp-note' }, t('hint.preflight'))]

      const planError = plan && plan.error ? h('div', { key: 'error', className: 'pp-err' }, t('err.preflight') + '：' + plan.error) : null
      const restoreNote = plan && plan.restored
        ? h('div', { key: 'restored', className: 'pp-note', style: { marginBottom: '6px', color: '#3ecf8e' } },
            t('note.restored') + ': +' + (plan.restored.join(', ') || '-') + ' -' + (plan.removed.join(', ') || '-'))
        : null
      const planContent = planError
        ? [planError]
        : plan && plan.restored
          ? [restoreNote]
          : plan && (plan.conflicts ?? []).length
            ? [h('div', { key: 'conflicts', className: 'pp-note', style: { color: '#eeb244', marginBottom: '6px' } },
                t('note.conflicts') + '：' + plan.conflicts.map((item) => item.location.replace('slot:', '')).join('、')), ...planRows]
            : planRows

      const verifyNote = plan && plan.verification
        ? h('div', { key: 'verify', className: 'pp-note', style: { marginTop: '6px' } },
            plan.verification.ok
              ? '✔ ' + t('note.verifyOk') + ' (' + plan.verification.checked + ')'
              : '⚠ ' + t('note.verifyBad') + '：' + plan.verification.mismatch.slice(0, 3).join('；'))
        : null
      const lockNote = plan && plan.lock
        ? h('div', { key: 'lock', className: 'pp-note', style: { marginTop: '8px' } },
            plan.lock.ok ? '✔ ' + t('note.lockOk') : '⚠ ' + t('note.lockBad') + '：' + plan.lock.error)
        : null

      const backupRows = (state.backups ?? []).length
        ? state.backups.map((backup) => h('div', { key: backup.stamp, className: 'pp-kv' },
            h('span', { className: 'pp-mono', title: backup.pack + ' ' + backup.version }, backup.stamp),
            h('span', null,
              h('b', null, backup.actions + ' ·'),
              h('button', {
                className: 'pp-btn',
                style: { height: '22px', marginLeft: '6px', fontSize: '10.5px' },
                disabled: busy,
                onClick: () => onRestore(backup.stamp),
              }, t('btn.restore')))))
        : [h('div', { key: 'none', className: 'pp-note' }, t('hint.noBackups'))]

      const backupCard = h('div', { className: 'pp-card' },
        h('div', { className: 'pp-card-h' }, t('card.backups'), h('span', { className: 'pp-badge' }, String((state.backups ?? []).length))),
        h('div', { className: 'pp-card-b', style: { maxHeight: '170px', overflow: 'auto' } }, backupRows))

      const planCard = h('div', { className: 'pp-card', style: { flex: 1 } },
        h('div', { className: 'pp-card-h' }, t('card.preflight')),
        h('div', { className: 'pp-card-b pp-scroll' }, planContent),
        verifyNote,
        lockNote)

      return h('div', { className: 'pp-body' },
        h('div', { className: 'pp-main' },
          h('div', { className: 'pp-card', style: { flex: 1 } },
            h('div', { className: 'pp-card-h' }, t('card.packs'), h('span', { className: 'pp-badge' }, String(list.length))),
            h('div', { className: 'pp-scroll' }, table))),
        h('div', { className: 'pp-aside' }, planCard, backupCard))
    }

    function PluginPackPage(props) {
      const { t } = props
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
          payload.plugins = payload.plugins.filter((plugin) => plugin.name !== 'dsh-plugin-pack')
          setState(payload)
          setSelection((previous) => {
            if (previous.size > 0) return previous
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
      }, [packName, version, latest, load])

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
        setLatestNote(t('btn.checking'))
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
          setLatestNote(
            found === 0 && failed > 0
              ? t('note.offline') + ' (' + failed + ')'
              : found + ' ' + t('err.checked') + ' · ' + failed + ' ' + t('err.failed'),
          )
        } catch (cause) {
          setLatestNote(cause.message)
        } finally {
          setBusy(false)
        }
      }, [selection, t])

      if (error) return h('div', { className: 'pp' }, h('div', { className: 'pp-empty pp-err' }, t('err.state') + '：' + error))
      if (!state) return h('div', { className: 'pp' }, h('div', { className: 'pp-empty' }, t('loading')))

      const blockers = state.summary?.counts?.BLOCKER ?? 0
      const head = h('div', { className: 'pp-head' },
        h('h1', { className: 'pp-title' }, t('title')),
        h('p', { className: 'pp-sub' },
          state.profile.dir + ' · ' + t('note.target') + ' ' + (state.targetDsh ?? '-') + ' · ' + state.plugins.length),
        h('div', { className: 'pp-tabs' },
          h('button', { className: tab === 'pack' ? 'pp-tab on' : 'pp-tab', onClick: () => setTab('pack') }, t('tab.pack')),
          h('button', { className: tab === 'compat' ? 'pp-tab on' : 'pp-tab', onClick: () => setTab('compat') },
            t('tab.compat'), blockers > 0 ? h('span', { className: 'pp-badge' }, String(blockers)) : null),
          h('button', { className: tab === 'import' ? 'pp-tab on' : 'pp-tab', onClick: () => setTab('import') }, t('tab.import'))))

      const body = tab === 'pack'
        ? packTab({
            state, selection, toggle, packName, setPackName, version, setVersion, onCreate: create, busy, result,
            latest, latestNote, onCheckLatest: checkLatest, t,
          })
        : tab === 'compat'
          ? compatTab({ state, t })
          : importTab({ state, onPreflight: preflight, onInstall: install, onRestore: restore, busy, plan, choices, setChoices, t })

      return h('div', { className: 'pp' }, head, body)
    }

    function PanelIcon() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none' },
        h('path', { d: 'M8 1.8 13.8 4.9v6.2L8 14.2 2.2 11.1V4.9L8 1.8Z', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linejoin': 'round' }),
        h('path', { d: 'm2.5 5 5.5 3 5.5-3', stroke: 'currentColor', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        // A failing locale service must never cost the user the sidebar entry:
        // fall back to the built-in dictionary and keep registering the page.
        let t = (key) => (STRINGS.zh[key] ?? key)
        try {
          t = ctx.locale.bind(NS)
        } catch {
          /* keep the local fallback */
        }

        ctx.effect(() => {
          const style = document.createElement('style')
          style.setAttribute('data-plugin-css', 'dsh-plugin-pack/PluginPack.css')
          style.textContent = CSS
          document.head.appendChild(style)
          return () => style.remove()
        }, 'plugin-pack: styles')

        ctx.effect(() => {
          try {
            return ctx.locale.register(NS, STRINGS)
          } catch {
            return undefined
          }
        }, 'plugin-pack: dictionaries')

        const Page = (props) => h(PluginPackPage, Object.assign({}, props, { t }))

        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Page))

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 7,
          locale: NS,
          label: () => t('panel'),
        }, PanelIcon))
      },
    }
  },
})
