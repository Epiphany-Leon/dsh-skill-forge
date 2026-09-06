/**
 * 样式表 —— 跟随 DSH 原生主题
 * 全局顶栏 + 右侧挤压式边栏
 * 所有颜色用 CSS 变量 + fallback，自动适配 DSH 深浅色
 */

export default `
/* ===== Theme Variables — 跟随 DSH =====
   使用 DSH 提供的 CSS 变量，没有就用浅色 fallback */

.sf-topbar,
.sf-right-sidebar,
.sf-file-explorer,
.sf-forge-panel {
  --sf-text: var(--foreground, #1F2329);
  --sf-subtext: var(--muted-foreground, #4B5563);
  --sf-border: var(--border, #E5E7EB);
  --sf-bg: var(--background, #FAFBFC);
  --sf-card: var(--card, #FFFFFF);
  --sf-accent: var(--accent, #3B82F6);
  --sf-accent-fg: var(--accent-foreground, #FFFFFF);
  --sf-muted: var(--muted, #F3F4F6);
  --sf-success: #10B981;
  --sf-warning: #F59E0B;
  --sf-error: #EF4444;
  --sf-radius: 8px;
  --sf-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* ===== 全局顶栏 ===== */

#sf-topbar-root {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 28px;
  z-index: 9999;
  background: var(--background, #FAFBFC);
  border-bottom: 1px solid var(--border, #E5E7EB);
}

.sf-topbar {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-family: var(--sf-font);
  font-size: 13px;
  color: var(--sf-text);
  user-select: none;
  background: transparent;
}

.sf-topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 120px;
}

.sf-topbar-traffic {
  display: flex;
  gap: 8px;
}

.sf-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}
.sf-dot-red { background: #ff5f57; }
.sf-dot-yellow { background: #febc2e; }
.sf-dot-green { background: #28c840; }

.sf-topbar-center {
  flex: 1;
  text-align: center;
}

.sf-topbar-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--sf-subtext);
}

.sf-topbar-right {
  display: flex;
  align-items: center;
  gap: 2px;
  width: 120px;
  justify-content: flex-end;
}

.sf-topbar-icon-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--sf-subtext);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
}
.sf-topbar-icon-btn:hover {
  background: var(--sf-muted);
  color: var(--sf-text);
}
.sf-topbar-icon-btn.active {
  background: var(--sf-muted);
  color: var(--sf-accent);
}

/* ===== 挤压式布局 ===== */

.sf-app-root {
  padding-top: 28px !important;
  padding-right: 0;
  transition: padding-right 0.2s ease;
  height: calc(100vh - 28px) !important;
  box-sizing: border-box;
}

/* ===== 右侧边栏 ===== */

#sf-rightsidebar-root {
  position: fixed;
  top: 28px;
  right: 0;
  bottom: 0;
  z-index: 9998;
  pointer-events: none;
}

#sf-rightsidebar-root > * {
  pointer-events: auto;
}

.sf-right-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--background, #FAFBFC);
  border-left: 1px solid var(--border, #E5E7EB);
  font-family: var(--sf-font);
  font-size: 13px;
  color: var(--sf-text);
  position: relative;
  overflow: hidden;
  animation: sf-slide-in 0.2s ease-out;
}

@keyframes sf-slide-in {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.sf-right-sidebar.dragging {
  user-select: none;
}

.sf-right-drag-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: col-resize;
  z-index: 10;
  transition: background 0.15s;
}
.sf-right-drag-handle:hover,
.sf-right-sidebar.dragging .sf-right-drag-handle {
  background: var(--sf-accent);
}

/* Right tabs */
.sf-right-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border, #E5E7EB);
  background: var(--sf-muted);
  flex-shrink: 0;
}

.sf-right-tab {
  flex: 1;
  padding: 8px 8px;
  border: none;
  background: transparent;
  color: var(--sf-subtext);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: inherit;
}
.sf-right-tab:hover {
  background: var(--sf-card);
  color: var(--sf-text);
}
.sf-right-tab.active {
  background: var(--sf-card);
  color: var(--sf-text);
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.sf-tab-icon {
  font-size: 14px;
}

/* Right content */
.sf-right-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* ===== 文件浏览器 ===== */

.sf-file-explorer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sf-explorer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border, #E5E7EB);
  background: var(--sf-muted);
}

.sf-explorer-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--sf-subtext);
}

.sf-icon-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--sf-subtext);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}
.sf-icon-btn:hover {
  background: var(--sf-card);
  color: var(--sf-text);
}
.sf-icon-btn.active {
  color: var(--sf-accent);
}

.sf-explorer-tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.sf-tree-node {
  width: 100%;
}

.sf-tree-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 12.5px;
  color: var(--sf-text);
  border-radius: 4px;
  transition: background 0.1s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sf-tree-item:hover {
  background: var(--sf-muted);
}

.sf-tree-caret {
  width: 12px;
  font-size: 10px;
  color: var(--sf-subtext);
  flex-shrink: 0;
  transition: transform 0.15s;
  display: inline-block;
}
.sf-tree-caret.expanded {
  transform: rotate(90deg);
}

.sf-tree-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.sf-tree-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== Forge 面板 ===== */

.sf-forge-panel {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sf-forge-stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.sf-stat-mini {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 10px 4px;
  text-align: center;
  transition: all 0.15s;
  user-select: none;
}
.sf-stat-mini:hover {
  border-color: var(--sf-accent);
  transform: translateY(-1px);
}
.sf-stat-mini.sf-stat-active {
  background: var(--sf-accent);
  border-color: var(--sf-accent);
}
.sf-stat-mini.sf-stat-active .sf-stat-num,
.sf-stat-mini.sf-stat-active .sf-stat-label,
.sf-stat-mini.sf-stat-active .sf-stat-icon {
  color: white;
}

.sf-stat-icon {
  font-size: 14px;
  margin-bottom: 2px;
}

.sf-stat-num {
  font-size: 18px;
  font-weight: 600;
  color: var(--sf-accent);
  line-height: 1.2;
}

.sf-stat-label {
  font-size: 10px;
  color: var(--sf-subtext);
  margin-top: 2px;
  font-weight: 500;
}

.sf-btn {
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
  font-family: inherit;
}

.sf-btn-primary {
  background: var(--sf-accent);
  color: var(--sf-accent-fg);
  border-color: var(--sf-accent);
}
.sf-btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}
.sf-btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sf-btn-secondary {
  background: var(--sf-muted);
  color: var(--sf-text);
  border-color: var(--border, #E5E7EB);
}
.sf-btn-secondary:hover {
  background: var(--border, #E5E7EB);
}

.sf-btn-ghost {
  background: transparent;
  color: var(--sf-subtext);
  border-color: transparent;
}
.sf-btn-ghost:hover {
  background: var(--sf-muted);
  color: var(--sf-text);
}

.sf-btn-full {
  width: 100%;
}

.sf-btn-sm {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
}

.sf-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--sf-subtext);
  margin-bottom: 8px;
}

.sf-forge-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sf-run-item {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 10px;
}

.sf-run-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.sf-run-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--sf-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.sf-status-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
  flex-shrink: 0;
}
.sf-status-pending_approval { background: var(--sf-accent); color: white; }
.sf-status-active { background: var(--sf-success); color: white; }
.sf-status-failed { background: var(--sf-error); color: white; }
.sf-status-extracting,
.sf-status-generating,
.sf-status-verifying,
.sf-status-refining,
.sf-status-auditing { background: var(--sf-warning); color: #1F2329; }
.sf-status-archived { background: var(--sf-muted); color: var(--sf-subtext); }
.sf-status-created { background: var(--sf-muted); color: var(--sf-subtext); }

.sf-run-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--sf-subtext);
  margin-bottom: 8px;
}

.sf-run-actions {
  display: flex;
  gap: 6px;
}

/* 失败详情 */
.sf-run-failure-detail {
  margin-top: 8px;
  padding: 10px;
  background: var(--sf-error-bg, #fef2f2);
  border: 1px solid var(--sf-error-border, #fecaca);
  border-radius: 6px;
  font-size: 12px;
  color: var(--sf-error-text, #991b1b);
  animation: sf-fade-in 0.2s ease;
}

@keyframes sf-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.sf-failure-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  line-height: 1.4;
}
.sf-failure-row:last-child {
  margin-bottom: 0;
}

.sf-failure-label {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--sf-error-text, #7f1d1d);
  min-width: 60px;
}

.sf-failure-code {
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 11px;
  padding: 1px 6px;
  background: var(--sf-error-code-bg, rgba(220, 38, 38, 0.1));
  color: var(--sf-error-text, #991b1b);
  border-radius: 4px;
}

/* 进行中的状态动画 */
.sf-run-item.sf-run-extracting .sf-status-tag,
.sf-run-item.sf-run-generating .sf-status-tag,
.sf-run-item.sf-run-verifying .sf-status-tag,
.sf-run-item.sf-run-refining .sf-status-tag,
.sf-run-item.sf-run-auditing .sf-status-tag,
.sf-run-item.sf-run-iterating .sf-status-tag {
  animation: sf-pulse 1.5s ease-in-out infinite;
}

@keyframes sf-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* ===== 技能列表项 ===== */
.sf-skill-item {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.sf-skill-item:hover {
  border-color: var(--sf-accent);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.sf-skill-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.sf-skill-item-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--sf-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sf-skill-item-version {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--sf-subtext);
  font-family: 'SF Mono', Menlo, monospace;
}

.sf-skill-item-desc {
  font-size: 11px;
  color: var(--sf-subtext);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 6px;
}

.sf-skill-item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.sf-tag-mini {
  font-size: 10px;
  color: var(--sf-accent);
  background: var(--sf-accent-bg, rgba(59, 130, 246, 0.1));
  padding: 1px 6px;
  border-radius: 4px;
}

/* 正文预览（卡片内） */
.sf-skill-item-preview {
  font-size: 11px;
  font-family: 'SF Mono', Menlo, monospace;
  color: var(--sf-subtext);
  background: var(--sf-muted, #F3F4F6);
  border-radius: 4px;
  padding: 6px 8px;
  margin-top: 6px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
}

/* 技能卡片 meta 行（质量分/使用次数/分类） */
.sf-skill-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--sf-border);
  font-size: 10.5px;
  color: var(--sf-subtext);
}
.sf-skill-quality {
  color: var(--sf-warning);
  font-weight: 600;
  font-family: 'SF Mono', Menlo, monospace;
}
.sf-skill-usage {
  color: var(--sf-accent);
  font-weight: 500;
}
.sf-skill-category {
  color: var(--sf-subtext);
  background: var(--sf-muted);
  padding: 1px 6px;
  border-radius: 4px;
}

/* ===== 搜索与筛选栏 ===== */
.sf-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.sf-search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--sf-card);
  border: 1px solid var(--sf-border);
  border-radius: 6px;
  padding: 4px 10px;
  transition: border-color 0.15s;
}
.sf-search-input-wrap:focus-within {
  border-color: var(--sf-accent);
}
.sf-search-icon {
  font-size: 12px;
  flex-shrink: 0;
}
.sf-search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--sf-text);
  font-family: inherit;
  outline: none;
  padding: 4px 0;
}
.sf-search-input::placeholder {
  color: var(--sf-subtext);
  opacity: 0.6;
}
.sf-search-clear {
  font-size: 10px;
  color: var(--sf-subtext);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  flex-shrink: 0;
  transition: all 0.15s;
}
.sf-search-clear:hover {
  background: var(--sf-muted);
  color: var(--sf-text);
}
.sf-search-sort {
  flex-shrink: 0;
  background: var(--sf-card);
  border: 1px solid var(--sf-border);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--sf-text);
  font-family: inherit;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
}
.sf-search-sort:hover {
  border-color: var(--sf-accent);
}
.sf-search-sort:focus {
  border-color: var(--sf-accent);
}

/* ===== 详情视图 ===== */
.sf-detail-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: sf-fade-in 0.2s ease;
}

.sf-detail-back {
  font-size: 12px;
  color: var(--sf-accent);
  cursor: pointer;
  user-select: none;
  padding: 4px 0;
}
.sf-detail-back:hover {
  text-decoration: underline;
}

.sf-skill-detail,
.sf-run-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sf-skill-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.sf-skill-detail-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--sf-text);
  line-height: 1.3;
}

.sf-skill-detail-subtitle {
  font-size: 11px;
  color: var(--sf-subtext);
  margin-top: -4px;
}

.sf-skill-detail-desc {
  font-size: 12px;
  color: var(--sf-text);
  line-height: 1.5;
  padding: 8px 10px;
  background: var(--sf-muted);
  border-radius: 6px;
}

.sf-skill-detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sf-tag {
  font-size: 11px;
  color: var(--sf-accent);
  background: var(--sf-accent-bg, rgba(59, 130, 246, 0.1));
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.sf-detail-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sf-detail-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-text);
}

.sf-detail-section-body {
  font-size: 12px;
  color: var(--sf-subtext);
  line-height: 1.5;
}

.sf-source-item {
  font-size: 11px;
  color: var(--sf-subtext);
  padding: 2px 0;
  font-family: 'SF Mono', Menlo, monospace;
}

.sf-skill-content {
  margin: 0;
  font-size: 11px;
  font-family: 'SF Mono', Menlo, monospace;
  line-height: 1.5;
  color: var(--sf-text);
  background: var(--sf-muted);
  padding: 10px;
  border-radius: 6px;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.sf-detail-actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--sf-border);
  padding-top: 12px;
}
.sf-detail-actions .sf-btn {
  flex: 1;
}

/* 质量分进度条 */
.sf-quality-bar {
  position: relative;
  height: 20px;
  background: var(--sf-muted);
  border-radius: 10px;
  overflow: hidden;
}
.sf-quality-bar-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--sf-success, #10b981);
  border-radius: 10px;
  transition: width 0.3s ease;
}
.sf-quality-bar-text {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 11px;
  font-weight: 600;
  color: var(--sf-text);
  mix-blend-mode: difference;
}
.sf-quality-bar-lg {
  height: 28px;
  border-radius: 14px;
}
.sf-quality-bar-lg .sf-quality-bar-text {
  font-size: 12px;
}

/* 统计网格 */
.sf-skill-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.sf-stat-cell {
  background: var(--sf-card);
  border: 1px solid var(--sf-border);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sf-stat-cell-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--sf-text);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sf-stat-cell-label {
  font-size: 10px;
  color: var(--sf-subtext);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* 版本历史 */
.sf-version-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sf-version-item {
  background: var(--sf-card);
  border: 1px solid var(--sf-border);
  border-radius: 8px;
  padding: 10px 12px;
  transition: border-color 0.15s;
}
.sf-version-item:hover {
  border-color: var(--sf-accent);
}
.sf-version-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.sf-version-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-accent);
  font-family: 'SF Mono', Menlo, monospace;
  background: var(--sf-accent-bg, rgba(59, 130, 246, 0.1));
  padding: 2px 8px;
  border-radius: 10px;
}
.sf-version-time {
  font-size: 10px;
  color: var(--sf-subtext);
  flex-shrink: 0;
}
.sf-version-changes {
  font-size: 11px;
  color: var(--sf-text);
  line-height: 1.5;
  margin-bottom: 4px;
}
.sf-version-note {
  font-size: 10.5px;
  color: var(--sf-subtext);
  line-height: 1.4;
  padding: 6px 8px;
  background: var(--sf-muted);
  border-radius: 4px;
  margin-bottom: 6px;
}
.sf-version-rollback {
  margin-top: 2px;
  align-self: flex-start;
}

/* ===== 版本 Diff 对比 ===== */
.sf-diff {
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 11px;
  border: 1px solid var(--sf-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--sf-card);
}
.sf-diff-line {
  padding: 1px 8px;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
}
.sf-diff-added {
  background: #dcfce7;
  color: #166534;
}
.sf-diff-removed {
  background: #fee2e2;
  color: #991b1b;
}
.sf-diff-unchanged {
  color: var(--sf-subtext);
}
.sf-diff-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.sf-diff-controls select {
  padding: 4px 8px;
  border: 1px solid var(--sf-border);
  border-radius: 6px;
  font-size: 12px;
  font-family: inherit;
  color: var(--sf-text);
  background: var(--sf-card);
  outline: none;
}
.sf-diff-controls select:focus {
  border-color: var(--sf-accent);
}
.sf-diff-select {
  padding: 4px 8px;
  border: 1px solid var(--sf-border);
  border-radius: 6px;
  font-size: 12px;
  font-family: inherit;
  color: var(--sf-text);
  background: var(--sf-card);
  outline: none;
  max-width: 120px;
}
.sf-diff-select:focus {
  border-color: var(--sf-accent);
}
.sf-diff-summary {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--sf-subtext);
  margin-bottom: 8px;
}
.sf-diff-summary-added {
  color: #166534;
  font-weight: 600;
}
.sf-diff-summary-removed {
  color: #991b1b;
  font-weight: 600;
}
.sf-diff-empty {
  text-align: center;
  padding: 16px;
  color: var(--sf-subtext);
  font-size: 12px;
}

/* 操作按钮栏 */
.sf-action-bar {
  display: flex;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--sf-border);
  flex-wrap: wrap;
}
.sf-action-bar .sf-btn {
  flex: 1;
  min-width: 80px;
  padding: 6px 10px;
  font-size: 12px;
}

/* 维度进度条 */
.sf-dimension-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sf-dimension-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sf-dimension-bar-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.sf-dimension-bar-label > span:first-child {
  color: var(--sf-text);
  font-weight: 500;
}
.sf-dimension-bar-score {
  color: var(--sf-subtext);
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 11px;
}
.sf-dimension-bar-track {
  height: 6px;
  background: var(--sf-muted);
  border-radius: 3px;
  overflow: hidden;
}
.sf-dimension-bar-fill {
  height: 100%;
  background: var(--sf-accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* 改进建议 */
.sf-suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sf-suggestion-item {
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  background: var(--sf-muted);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--sf-text);
}
.sf-suggestion-icon {
  flex-shrink: 0;
  font-size: 14px;
}
.sf-suggestion-text {
  flex: 1;
  color: var(--sf-text);
}

/* 迭代时间线 */
.sf-iteration-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
}
.sf-iteration-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
  position: relative;
}
.sf-iteration-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sf-iteration-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--sf-accent);
  background: var(--sf-accent-bg, rgba(59, 130, 246, 0.1));
  padding: 2px 8px;
  border-radius: 10px;
}
.sf-iteration-score {
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-success);
  font-family: 'SF Mono', Menlo, monospace;
}
.sf-iteration-changes {
  font-size: 11px;
  color: var(--sf-subtext);
  line-height: 1.4;
  padding-left: 2px;
}
.sf-iteration-connector {
  position: absolute;
  left: 28px;
  top: 100%;
  width: 2px;
  height: 8px;
  background: var(--sf-border);
}

/* 测试用例项 */
.sf-test-case-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sf-test-case-item {
  background: var(--sf-card);
  border: 1px solid var(--sf-border);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
}
.sf-test-case-item.sf-test-failed {
  border-color: var(--sf-error-border, #fecaca);
  background: var(--sf-error-bg, #fef2f2);
}
.sf-test-case-item.sf-test-passed {
  border-color: var(--sf-success-border, #a7f3d0);
}
.sf-test-case-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.sf-test-case-icon {
  flex-shrink: 0;
  font-weight: 700;
  font-size: 12px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--sf-success);
  color: white;
  font-size: 10px;
}
.sf-test-failed .sf-test-case-icon {
  background: var(--sf-error);
}
.sf-test-case-name {
  flex: 1;
  font-weight: 500;
  color: var(--sf-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sf-test-case-score {
  flex-shrink: 0;
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 11px;
  color: var(--sf-subtext);
}
.sf-test-case-meta {
  display: flex;
  gap: 10px;
  font-size: 10.5px;
  color: var(--sf-subtext);
  margin-bottom: 4px;
}
.sf-test-case-category {
  background: var(--sf-muted);
  padding: 1px 6px;
  border-radius: 4px;
}
.sf-test-case-duration {
  font-family: 'SF Mono', Menlo, monospace;
}
.sf-test-case-feedback {
  font-size: 11px;
  color: var(--sf-subtext);
  line-height: 1.4;
  padding: 4px 0;
}
.sf-test-case-issues {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed var(--sf-border);
}
.sf-test-issue {
  font-size: 11px;
  line-height: 1.4;
  color: var(--sf-text);
}
.sf-issue-severity {
  font-weight: 600;
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 10px;
}
.sf-issue-critical .sf-issue-severity { color: var(--sf-error); }
.sf-issue-major .sf-issue-severity { color: var(--sf-warning); }
.sf-issue-minor .sf-issue-severity { color: var(--sf-accent); }
.sf-issue-info .sf-issue-severity { color: var(--sf-subtext); }

/* 来源锻造链接 */
.sf-source-forge-link {
  font-size: 12px;
  color: var(--sf-text);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.sf-forge-link-id {
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 11px;
  color: var(--sf-accent);
  background: var(--sf-accent-bg, rgba(59, 130, 246, 0.1));
  padding: 1px 6px;
  border-radius: 4px;
}

/* 谱系追踪 */
.sf-lineage-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sf-lineage-origin {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sf-lineage-subtitle {
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-text);
  margin-bottom: 2px;
}
.sf-lineage-card {
  background: var(--sf-muted, #F3F4F6);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sf-lineage-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  line-height: 1.5;
}
.sf-lineage-label {
  color: var(--sf-subtext);
  min-width: 56px;
  flex-shrink: 0;
}
.sf-lineage-value {
  color: var(--sf-text);
  word-break: break-all;
}
.sf-lineage-derivations {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sf-lineage-derivation-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sf-lineage-derivation-card {
  background: var(--sf-muted, #F3F4F6);
  border-radius: 6px;
  padding: 8px 10px;
}
.sf-lineage-derivation-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-text);
  margin-bottom: 4px;
}
.sf-lineage-derivation-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.sf-lineage-tag {
  font-size: 10px;
  color: var(--sf-subtext);
  background: var(--sf-card, #FFFFFF);
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid var(--sf-border, #E5E7EB);
}
.sf-lineage-time {
  font-size: 10px;
  color: var(--sf-subtext);
}

/* 危险按钮 */
.sf-btn-danger {
  background: var(--sf-error, #ef4444);
  color: white;
  border: none;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.sf-btn-danger:hover {
  opacity: 0.9;
}

.sf-empty,
.sf-empty-small {
  text-align: center;
  padding: 24px 16px;
  color: var(--sf-subtext);
  font-size: 12px;
}
.sf-empty-small {
  padding: 16px 8px;
}

.sf-loading {
  text-align: center;
  padding: 20px;
  color: var(--sf-subtext);
  font-size: 12px;
}

/* Scrollbar */
.sf-right-content::-webkit-scrollbar,
.sf-explorer-tree::-webkit-scrollbar {
  width: 6px;
}
.sf-right-content::-webkit-scrollbar-track,
.sf-explorer-tree::-webkit-scrollbar-track {
  background: transparent;
}
.sf-right-content::-webkit-scrollbar-thumb,
.sf-explorer-tree::-webkit-scrollbar-thumb {
  background: var(--border, #E5E7EB);
  border-radius: 3px;
}
.sf-right-content::-webkit-scrollbar-thumb:hover,
.sf-explorer-tree::-webkit-scrollbar-thumb:hover {
  background: var(--sf-subtext);
}

/* ============================================================
   Settings Card —— DSH 风格设置页卡片
   ============================================================ */

.sf-settings-card {
  --sf-settings-text: var(--dsw-alias-label-primary, var(--sf-text, #1F2329));
  --sf-settings-secondary: var(--dsw-alias-label-secondary, #4B5563);
  --sf-settings-tertiary: var(--dsw-alias-label-tertiary, #6B7280);
  --sf-settings-border: var(--dsw-alias-border-l4, var(--sf-border, #E5E7EB));
  --sf-settings-border-l2: var(--dsw-alias-border-l2, #F0F0F0);
  --sf-settings-bg: var(--dsw-alias-bg-layer-3, var(--sf-card, #FFFFFF));
  --sf-settings-bg-2: var(--dsw-alias-bg-layer-2, var(--sf-bg, #FAFBFC));
  --sf-settings-muted: var(--dsw-alias-bg-module-platform, var(--sf-muted, #F3F4F6));
  --sf-settings-accent: var(--dsw-alias-brand-primary, var(--sf-accent, #3B82F6));
  --sf-settings-success: var(--dsw-alias-state-success, #10B981);
  --sf-settings-error: var(--dsw-alias-label-error, #EF4444);
  --sf-settings-radius: 16px;
  --sf-settings-radius-sm: 8px;
  --sf-settings-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

  background: var(--sf-settings-bg);
  border: 0.5px solid var(--sf-settings-border);
  border-radius: var(--sf-settings-radius);
  font-family: var(--sf-settings-font);
  color: var(--sf-settings-text);
  font-size: 13px;
  line-height: 1.5;
  overflow: hidden;
  transition: border-color 0.16s, background 0.16s;
}

.sf-settings-card:hover {
  border-color: var(--dsw-alias-label-dimmed, #9CA3AF);
}

/* 头部 */
.sf-settings-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 0.5px solid var(--sf-settings-border-l2);
}

.sf-settings-header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sf-settings-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--sf-settings-text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.sf-settings-icon {
  font-size: 16px;
  line-height: 1;
}

.sf-settings-subtitle {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--sf-settings-tertiary);
}

/* 保存状态 */
.sf-settings-save-status {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 17px;
  font-weight: 500;
  padding: 1px 10px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 0.2s, transform 0.2s;
}

.sf-save-saving {
  opacity: 1;
  transform: translateY(0);
  background: var(--sf-settings-muted);
  color: var(--sf-settings-secondary);
}

.sf-save-saved {
  opacity: 1;
  transform: translateY(0);
  background: rgba(16, 185, 129, 0.1);
  color: var(--sf-settings-success);
}

.sf-save-error {
  opacity: 1;
  transform: translateY(0);
  background: rgba(239, 68, 68, 0.1);
  color: var(--sf-settings-error);
}

/* 加载状态 */
.sf-settings-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  color: var(--sf-settings-tertiary);
  font-size: 13px;
}

.sf-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--sf-settings-muted);
  border-top-color: var(--sf-settings-accent);
  border-radius: 50%;
  animation: sf-spin 0.8s linear infinite;
  display: inline-block;
}

.sf-spinner-sm {
  width: 12px;
  height: 12px;
  border-width: 1.5px;
}

@keyframes sf-spin {
  to { transform: rotate(360deg); }
}

/* 主体 */
.sf-settings-body {
  padding: 4px 0;
}

/* 分区 */
.sf-settings-section {
  padding: 12px 20px;
}

.sf-settings-section + .sf-settings-section {
  border-top: 0.5px solid var(--sf-settings-border-l2);
}

.sf-section-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}

.sf-section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--sf-settings-text);
}

.sf-section-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--sf-settings-tertiary);
}

.sf-section-body {
  display: flex;
  flex-direction: column;
}

/* 设置行 */
.sf-setting-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
}

.sf-setting-row + .sf-setting-row {
  border-top: 0.5px solid var(--sf-settings-border-l2);
}

.sf-setting-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 2px;
}

.sf-setting-label {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--sf-settings-text);
}

.sf-setting-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--sf-settings-tertiary);
}

.sf-setting-control {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  max-width: 240px;
  width: 100%;
  justify-content: flex-end;
}

/* ===== 切换开关 ===== */
.sf-toggle {
  position: relative;
  width: 40px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: var(--sf-settings-muted);
  cursor: pointer;
  transition: background 0.2s ease;
  font: inherit;
}

.sf-toggle:focus-visible {
  outline: 2px solid var(--sf-settings-accent);
  outline-offset: 2px;
}

.sf-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease;
}

.sf-toggle-on {
  background: var(--sf-settings-accent);
}

.sf-toggle-on .sf-toggle-thumb {
  transform: translateX(16px);
}

.sf-toggle-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ===== 分段控件 ===== */
.sf-segmented {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 4px;
  background: var(--sf-settings-muted);
  border-radius: var(--sf-settings-radius-sm);
}

.sf-segmented-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--sf-settings-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}

.sf-segmented-item:hover {
  color: var(--sf-settings-text);
}

.sf-segmented-active {
  background: var(--sf-settings-bg);
  color: var(--sf-settings-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  font-weight: 500;
}

.sf-segmented-label {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
}

.sf-segmented-desc {
  font-size: 10.5px;
  line-height: 1.3;
  color: var(--sf-settings-tertiary);
  opacity: 0.8;
}

.sf-segmented-active .sf-segmented-desc {
  opacity: 1;
}

/* ===== 滑块 ===== */
.sf-slider-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 220px;
}

.sf-slider-track {
  position: relative;
  flex: 1;
  height: 4px;
  background: var(--sf-settings-muted);
  border-radius: 2px;
}

.sf-slider-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--sf-settings-accent);
  border-radius: 2px;
  pointer-events: none;
  transition: width 0.1s linear;
}

.sf-slider-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

/* 自定义滑块 thumb — 通过伪元素 + track 布局实现 */
.sf-slider-track::after {
  content: '';
  position: absolute;
  top: 50%;
  left: var(--sf-slider-pos, 0%);
  width: 16px;
  height: 16px;
  background: var(--sf-settings-bg);
  border: 2px solid var(--sf-settings-accent);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: left 0.1s linear;
}

.sf-slider-disabled {
  opacity: 0.4;
  pointer-events: none;
}

.sf-slider-value {
  flex-shrink: 0;
  min-width: 40px;
  text-align: right;
  font-size: 13px;
  font-weight: 500;
  color: var(--sf-settings-text);
  font-variant-numeric: tabular-nums;
}

/* ===== 数字输入 ===== */
.sf-number-input {
  display: flex;
  align-items: center;
  border: 0.5px solid var(--sf-settings-border);
  border-radius: var(--sf-settings-radius-sm);
  background: var(--sf-settings-bg);
  overflow: hidden;
  transition: border-color 0.15s;
}

.sf-number-input:focus-within {
  border-color: var(--sf-settings-accent);
}

.sf-number-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--sf-settings-secondary);
  font-size: 16px;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.sf-number-btn:hover:not(:disabled) {
  background: var(--sf-settings-muted);
  color: var(--sf-settings-text);
}

.sf-number-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.sf-number-field {
  width: 56px;
  height: 32px;
  border: none;
  border-left: 0.5px solid var(--sf-settings-border-l2);
  border-right: 0.5px solid var(--sf-settings-border-l2);
  background: transparent;
  color: var(--sf-settings-text);
  font: inherit;
  font-size: 13px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  outline: none;
  -moz-appearance: textfield;
}

.sf-number-field::-webkit-outer-spin-button,
.sf-number-field::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.sf-number-suffix {
  padding: 0 10px 0 8px;
  font-size: 12px;
  color: var(--sf-settings-tertiary);
}

.sf-number-disabled {
  opacity: 0.4;
  pointer-events: none;
}

/* ===== 文本输入 ===== */
.sf-text-input {
  width: 100%;
  max-width: 220px;
  height: 34px;
  padding: 0 12px;
  border: 0.5px solid var(--sf-settings-border);
  border-radius: var(--sf-settings-radius-sm);
  background: var(--sf-settings-bg);
  color: var(--sf-settings-text);
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.15s;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}

.sf-text-input:focus-visible {
  border-color: var(--sf-settings-accent);
}

.sf-text-input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ===== 文本域 ===== */
.sf-textarea {
  width: 100%;
  min-height: 120px;
  padding: 10px 12px;
  border: 0.5px solid var(--sf-settings-border);
  border-radius: var(--sf-settings-radius-sm);
  background: var(--sf-settings-bg);
  color: var(--sf-settings-text);
  font: inherit;
  font-size: 12.5px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}

.sf-textarea:focus-visible {
  border-color: var(--sf-settings-accent);
}

.sf-textarea::placeholder {
  color: var(--sf-settings-tertiary);
  opacity: 0.6;
}

/* ===== 响应式 ===== */
@media (max-width: 560px) {
  .sf-setting-row {
    flex-direction: column;
    gap: 8px;
  }
  .sf-setting-control {
    max-width: 100%;
    justify-content: flex-start;
  }
  .sf-segmented {
    grid-template-columns: repeat(2, 1fr);
  }
  .sf-settings-header {
    flex-direction: column;
  }
}

/* ============================================================
   Forge Toast — 对话内通知卡片
   ============================================================ */

.sf-toast-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 360px;
  pointer-events: none;
}

.sf-toast-container > * {
  pointer-events: auto;
}

.sf-toast {
  background: var(--sf-card, #fff);
  border: 1px solid var(--sf-border, #E5E7EB);
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  animation: sf-toast-slide-in 0.3s ease;
  min-width: 260px;
  font-family: var(--sf-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
}

.sf-toast-success { border-left: 3px solid var(--sf-success, #10B981); }
.sf-toast-error { border-left: 3px solid var(--sf-error, #EF4444); }
.sf-toast-info { border-left: 3px solid var(--sf-accent, #3B82F6); }

.sf-toast-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.sf-toast-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--sf-text, #1F2329);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sf-toast-close {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--sf-subtext, #4B5563);
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
  flex-shrink: 0;
  transition: background 0.15s;
}
.sf-toast-close:hover {
  background: var(--sf-muted, #F3F4F6);
  color: var(--sf-text, #1F2329);
}

.sf-toast-message {
  font-size: 12px;
  color: var(--sf-subtext, #4B5563);
  line-height: 1.4;
  margin-bottom: 10px;
}

.sf-toast-actions {
  display: flex;
  gap: 6px;
}
.sf-toast-actions .sf-btn {
  flex: 1;
}

@keyframes sf-toast-slide-in {
  from { opacity: 0; transform: translateX(40px) translateY(0); }
  to { opacity: 1; transform: translateX(0) translateY(0); }
}

/* 静音按钮 */
.sf-toast-mute-btn {
  align-self: flex-end;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--sf-border, #E5E7EB);
  background: var(--sf-card, #fff);
  border-radius: 14px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
}
.sf-toast-mute-btn:hover {
  background: var(--sf-muted, #F3F4F6);
  transform: scale(1.1);
}
.sf-toast-mute-btn.sf-toast-muted {
  opacity: 0.6;
}

/* ============================================================
   拒绝理由 Modal
   ============================================================ */

.sf-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  animation: sf-fade-in 0.2s ease;
}

.sf-modal {
  background: var(--sf-card, #FFFFFF);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  width: 400px;
  max-width: 90vw;
  overflow: hidden;
  animation: sf-slide-up 0.3s ease;
}

.sf-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--sf-border, #E5E7EB);
}

.sf-modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--sf-text, #1F2329);
}

.sf-modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--sf-subtext, #6B7280);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s;
}
.sf-modal-close:hover {
  background: var(--sf-muted, #F3F4F6);
  color: var(--sf-text, #1F2329);
}

.sf-modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sf-modal-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-text, #1F2329);
  margin-bottom: 4px;
}

.sf-reject-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sf-reject-option {
  padding: 6px 12px;
  border: 1px solid var(--sf-border, #E5E7EB);
  border-radius: 6px;
  background: var(--sf-card, #FFFFFF);
  color: var(--sf-text, #1F2329);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.sf-reject-option:hover {
  border-color: var(--sf-error, #EF4444);
  background: #FEF2F2;
}
.sf-reject-option-active {
  background: var(--sf-error, #EF4444);
  color: white;
  border-color: var(--sf-error, #EF4444);
}
.sf-reject-option-active:hover {
  background: #DC2626;
}

.sf-reject-textarea {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid var(--sf-border, #E5E7EB);
  border-radius: 6px;
  font-size: 12px;
  font-family: inherit;
  resize: vertical;
  min-height: 60px;
  background: var(--sf-card, #FFFFFF);
  color: var(--sf-text, #1F2329);
}
.sf-reject-textarea:focus {
  outline: none;
  border-color: var(--sf-accent, #3B82F6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}
.sf-reject-textarea::placeholder {
  color: var(--sf-subtext, #9CA3AF);
}

.sf-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--sf-border, #E5E7EB);
}

@keyframes sf-slide-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ============================================================
   编辑技能 Modal
   ============================================================ */

.sf-edit-modal {
  width: 560px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.sf-edit-modal .sf-modal-body {
  overflow-y: auto;
  flex: 1;
}

.sf-edit-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sf-edit-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--sf-border, #E5E7EB);
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  background: var(--sf-card, #FFFFFF);
  color: var(--sf-text, #1F2329);
  transition: border-color 0.15s;
}
.sf-edit-input:focus {
  outline: none;
  border-color: var(--sf-accent, #3B82F6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.sf-edit-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid var(--sf-border, #E5E7EB);
  border-radius: 6px;
  font-size: 12px;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  background: var(--sf-card, #FFFFFF);
  color: var(--sf-text, #1F2329);
  line-height: 1.5;
  transition: border-color 0.15s;
}
.sf-edit-textarea:focus {
  outline: none;
  border-color: var(--sf-accent, #3B82F6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}
.sf-edit-textarea::placeholder {
  color: var(--sf-subtext, #9CA3AF);
}

/* ============================================================
   统计仪表盘 Dashboard
   ============================================================ */

.sf-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.sf-dashboard-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sf-dashboard-section .sf-section-title {
  margin-bottom: 0;
}

/* 大数字卡片 */
.sf-dashboard-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.sf-stat-big-card {
  background: var(--sf-card, #fff);
  border: 1px solid var(--sf-border, #E5E7EB);
  border-radius: var(--sf-radius, 8px);
  padding: 14px 12px;
  text-align: center;
  transition: border-color 0.15s, transform 0.15s;
}
.sf-stat-big-card:hover {
  border-color: var(--sf-accent, #3B82F6);
  transform: translateY(-1px);
}

.sf-stat-big-num {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.sf-stat-big-label {
  font-size: 11px;
  color: var(--sf-subtext, #4B5563);
  font-weight: 500;
  margin-top: 4px;
}

/* 圆环图 */
.sf-donut-container {
  display: flex;
  align-items: center;
  gap: 20px;
}

.sf-donut-chart {
  width: 100px;
  height: 100px;
  flex-shrink: 0;
}

.sf-donut-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sf-donut-center {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--sf-card, #fff);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.sf-donut-percent {
  font-size: 16px;
  font-weight: 700;
  color: var(--sf-text, #1F2329);
  line-height: 1.1;
}

.sf-donut-sub {
  font-size: 10px;
  color: var(--sf-subtext, #4B5563);
}

.sf-donut-legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sf-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--sf-text, #1F2329);
}

.sf-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* 趋势柱状图 */
.sf-trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 80px;
  padding: 0 4px;
}

.sf-trend-bar-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.sf-trend-bar {
  width: 100%;
  max-width: 32px;
  background: var(--sf-accent, #3B82F6);
  border-radius: 3px 3px 0 0;
  min-height: 2px;
  margin-top: auto;
  transition: height 0.3s ease;
}

.sf-trend-label {
  font-size: 9px;
  color: var(--sf-subtext, #4B5563);
  white-space: nowrap;
}

/* 条形图 */
.sf-bar-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sf-bar-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sf-bar-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.sf-bar-cat-name {
  color: var(--sf-text, #1F2329);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.sf-bar-cat-count {
  color: var(--sf-subtext, #4B5563);
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 11px;
  flex-shrink: 0;
  margin-left: 8px;
}

.sf-bar-track {
  height: 6px;
  background: var(--sf-muted, #F3F4F6);
  border-radius: 3px;
  overflow: hidden;
}

.sf-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
  min-width: 2px;
}

/* ===== 输入框旁锻造按钮 ===== */

.sf-forge-input-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--border, #E5E7EB);
  background: var(--card, #FFFFFF);
  color: var(--subtext, #6B7280);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.15s;
  flex-shrink: 0;
  position: relative;
}
.sf-forge-input-btn:hover {
  background: var(--accent, #3B82F6);
  color: white;
  border-color: var(--accent, #3B82F6);
}
.sf-forge-input-btn:active {
  transform: scale(0.92);
}
.sf-forge-input-btn.sf-forge-loading {
  pointer-events: none;
  opacity: 0.6;
}

/* Tooltip */
.sf-forge-input-btn::after {
  content: '锻造技能';
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--foreground, #1F2329);
  color: var(--card, #FFFFFF);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}
.sf-forge-input-btn:hover::after {
  opacity: 1;
}

/* ===== 使用反馈 ===== */

.sf-feedback-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--sf-subtext);
}

.sf-feedback-stat {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.sf-feedback-score {
  font-weight: 600;
  color: var(--sf-accent);
}

.sf-feedback-buttons {
  display: flex;
  gap: 6px;
}

.sf-feedback-btn {
  flex: 1;
  text-align: center;
  padding: 6px 8px !important;
  border: 1px solid var(--border, #E5E7EB) !important;
  border-radius: 6px !important;
  background: var(--sf-card) !important;
  transition: all 0.15s !important;
}

.sf-feedback-btn:hover {
  border-color: var(--sf-accent) !important;
  color: var(--sf-accent) !important;
  transform: translateY(-1px);
}

.sf-feedback-thanks {
  font-size: 13px;
  color: var(--sf-success);
  font-weight: 500;
  padding: 4px 0;
}

/* ============================================================
   活跃度仪表盘补充样式
   ============================================================ */

/* 空状态 */
.sf-empty-text {
  font-size: 12px;
  color: var(--sf-subtext, #9CA3AF);
  text-align: center;
  padding: 16px 0;
}

/* 趋势图图例 */
.sf-trend-legend {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 8px;
}

.sf-trend-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--sf-subtext, #6B7280);
}

.sf-trend-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

/* 条形图质量分标注 */
.sf-bar-quality {
  font-size: 10px;
  color: var(--sf-subtext, #9CA3AF);
  text-align: right;
  margin-top: 2px;
  font-family: 'SF Mono', Menlo, monospace;
}

/* 时间线 */
.sf-timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  padding-left: 4px;
}

.sf-timeline::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: var(--sf-muted, #E5E7EB);
}

.sf-timeline-item {
  display: flex;
  gap: 10px;
  position: relative;
}

.sf-timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 3px;
  z-index: 1;
  background: var(--sf-muted, #E5E7EB);
  border: 2px solid var(--sf-card, #fff);
  box-shadow: 0 0 0 1px var(--sf-border, #E5E7EB);
}

.sf-timeline-dot-active,
.sf-timeline-dot-pending_approval {
  background: #10B981;
  box-shadow: 0 0 0 1px #10B981;
}

.sf-timeline-dot-failed,
.sf-timeline-dot-rejected,
.sf-timeline-dot-cancelled {
  background: #EF4444;
  box-shadow: 0 0 0 1px #EF4444;
}

.sf-timeline-dot-extracting,
.sf-timeline-dot-generating,
.sf-timeline-dot-verifying,
.sf-timeline-dot-iterating,
.sf-timeline-dot-auditing,
.sf-timeline-dot-created {
  background: #F59E0B;
  box-shadow: 0 0 0 1px #F59E0B;
  animation: sf-pulse 1.5s ease-in-out infinite;
}

@keyframes sf-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.sf-timeline-content {
  flex: 1;
  min-width: 0;
}

.sf-timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.sf-timeline-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--sf-text, #1F2329);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.sf-timeline-meta {
  font-size: 11px;
  color: var(--sf-subtext, #9CA3AF);
  margin-top: 2px;
}

.sf-timeline-score {
  font-weight: 500;
  font-family: 'SF Mono', Menlo, monospace;
}

/* 注入统计 */
.sf-inject-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sf-inject-stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.sf-inject-label {
  color: var(--sf-subtext, #6B7280);
}

.sf-inject-value {
  font-weight: 600;
  color: var(--sf-text, #1F2329);
  font-family: 'SF Mono', Menlo, monospace;
}

.sf-inject-progress {
  height: 8px;
  background: var(--sf-muted, #F3F4F6);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 4px;
}

.sf-inject-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #8B5CF6, #3B82F6);
  border-radius: 4px;
  transition: width 0.4s ease;
  min-width: 4px;
}

/* ============================================================
   达尔文模式（Darwin Optimizer）样式
   ============================================================ */

/* 子 Tab 栏（Forge 内部二级 Tab） */
.sf-sub-tabs {
  display: flex;
  gap: 2px;
  padding: 4px;
  background: var(--sf-muted);
  border-radius: 8px;
  margin-bottom: 8px;
}

.sf-sub-tab {
  flex: 1;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--sf-subtext);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.sf-sub-tab:hover {
  background: var(--sf-card);
  color: var(--sf-text);
}
.sf-sub-tab.sf-sub-tab-active {
  background: var(--sf-card);
  color: var(--sf-text);
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  font-weight: 600;
}

/* 达尔文技能卡片 */
.sf-darwin-skill-card {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.sf-darwin-skill-card:hover {
  border-color: var(--sf-accent);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.sf-darwin-skill-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.sf-darwin-skill-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--sf-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sf-darwin-overall-score {
  font-size: 14px;
  font-weight: 700;
  font-family: 'SF Mono', Menlo, monospace;
  flex-shrink: 0;
}
.sf-darwin-score-high { color: var(--sf-success, #10B981); }
.sf-darwin-score-mid { color: var(--sf-warning, #F59E0B); }
.sf-darwin-score-low { color: var(--sf-error, #EF4444); }

.sf-darwin-weakest-dim {
  font-size: 11px;
  color: var(--sf-subtext);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.sf-darwin-weakest-dim strong {
  color: var(--sf-error, #EF4444);
  font-weight: 600;
}

.sf-darwin-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--sf-subtext);
}

/* 10 维度得分条形图 */
.sf-dim-chart {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sf-dim-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sf-dim-bar-label {
  font-size: 11px;
  color: var(--sf-subtext);
  min-width: 90px;
  flex-shrink: 0;
  text-align: right;
}

.sf-dim-bar-track {
  flex: 1;
  height: 14px;
  background: var(--sf-muted);
  border-radius: 7px;
  overflow: hidden;
  position: relative;
}

.sf-dim-bar-fill {
  height: 100%;
  border-radius: 7px;
  transition: width 0.4s ease;
  background: linear-gradient(90deg, #3B82F6, #8B5CF6);
}
.sf-dim-bar-fill.sf-dim-good { background: linear-gradient(90deg, #10B981, #34D399); }
.sf-dim-bar-fill.sf-dim-mid { background: linear-gradient(90deg, #F59E0B, #FBBF24); }
.sf-dim-bar-fill.sf-dim-low { background: linear-gradient(90deg, #EF4444, #F87171); }

.sf-dim-bar-score {
  font-size: 10.5px;
  font-family: 'SF Mono', Menlo, monospace;
  color: var(--sf-text);
  min-width: 42px;
  text-align: right;
  flex-shrink: 0;
  font-weight: 600;
}

/* 优化历史时间线 */
.sf-darwin-timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  padding-left: 4px;
}

.sf-darwin-timeline::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: var(--sf-muted, #E5E7EB);
}

.sf-darwin-timeline-item {
  display: flex;
  gap: 10px;
  position: relative;
}

.sf-darwin-timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 3px;
  z-index: 1;
  background: var(--sf-muted);
  border: 2px solid var(--sf-card, #fff);
  box-shadow: 0 0 0 1px var(--sf-border, #E5E7EB);
}
.sf-darwin-timeline-dot.sf-dot-accepted {
  background: var(--sf-success, #10B981);
  box-shadow: 0 0 0 1px var(--sf-success, #10B981);
}
.sf-darwin-timeline-dot.sf-dot-rolledback {
  background: var(--sf-error, #EF4444);
  box-shadow: 0 0 0 1px var(--sf-error, #EF4444);
}

.sf-darwin-timeline-body {
  flex: 1;
  min-width: 0;
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: 6px;
  padding: 8px 10px;
}

.sf-darwin-timeline-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.sf-darwin-timeline-dim {
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-text);
}

.sf-darwin-timeline-delta {
  font-size: 11px;
  font-family: 'SF Mono', Menlo, monospace;
  font-weight: 600;
}
.sf-delta-up { color: var(--sf-success, #10B981); }
.sf-delta-down { color: var(--sf-error, #EF4444); }

.sf-darwin-timeline-desc {
  font-size: 11px;
  color: var(--sf-subtext);
  line-height: 1.4;
  margin-bottom: 4px;
}

.sf-darwin-timeline-meta {
  font-size: 10px;
  color: var(--sf-subtext);
  display: flex;
  justify-content: space-between;
}

/* 启动优化区域 */
.sf-darwin-start-panel {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sf-darwin-start-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--sf-text);
}

.sf-darwin-start-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sf-darwin-start-label {
  font-size: 11px;
  color: var(--sf-subtext);
  font-weight: 500;
}

.sf-darwin-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border, #E5E7EB);
  border-radius: 6px;
  background: var(--sf-bg, #FAFBFC);
  color: var(--sf-text);
  font-size: 12px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
}
.sf-darwin-select:focus {
  border-color: var(--sf-accent);
}

.sf-darwin-dim-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.sf-darwin-dim-chip {
  padding: 3px 8px;
  font-size: 10.5px;
  border: 1px solid var(--border, #E5E7EB);
  border-radius: 12px;
  background: transparent;
  color: var(--sf-subtext);
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.sf-darwin-dim-chip:hover {
  border-color: var(--sf-accent);
  color: var(--sf-accent);
}
.sf-darwin-dim-chip.sf-chip-active {
  background: var(--sf-accent);
  color: white;
  border-color: var(--sf-accent);
}

/* Auto approve 开关行 */
.sf-darwin-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sf-darwin-switch {
  position: relative;
  width: 36px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: var(--sf-muted);
  cursor: pointer;
  transition: background 0.2s ease;
}
.sf-darwin-switch.sf-switch-on {
  background: var(--sf-accent);
}
.sf-darwin-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  transition: transform 0.2s ease;
}
.sf-darwin-switch.sf-switch-on .sf-darwin-switch-thumb {
  transform: translateX(16px);
}

/* ============================================================
   饕餮模式（Taotie Fusion）样式
   ============================================================ */

/* 相似技能组卡片 */
.sf-taotie-group-card {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.sf-taotie-group-card:hover {
  border-color: #8B5CF6;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.1);
}

.sf-taotie-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.sf-taotie-group-sim {
  font-size: 12px;
  font-weight: 700;
  color: #8B5CF6;
  font-family: 'SF Mono', Menlo, monospace;
  background: rgba(139, 92, 246, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.sf-taotie-group-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.sf-taotie-group-skill {
  font-size: 11px;
  background: var(--sf-muted);
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--sf-text);
}

.sf-taotie-group-recommend {
  font-size: 10.5px;
  color: var(--sf-subtext);
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* 检测控制面板 */
.sf-taotie-detect-panel {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.sf-taotie-slider-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sf-taotie-slider-label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--sf-subtext);
  font-weight: 500;
}

.sf-taotie-slider-val {
  font-family: 'SF Mono', Menlo, monospace;
  color: var(--sf-text);
  font-weight: 600;
}

.sf-taotie-slider {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--sf-muted);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.sf-taotie-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--sf-accent);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.sf-taotie-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--sf-accent);
  cursor: pointer;
  border: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

/* 技能对比卡片 */
.sf-taotie-compare {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: stretch;
}

.sf-taotie-compare-card {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 10px;
}
.sf-taotie-compare-card.sf-target {
  border-color: #3B82F6;
}
.sf-taotie-compare-card.sf-source {
  border-color: #8B5CF6;
}

.sf-taotie-compare-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  margin-bottom: 4px;
}
.sf-target .sf-taotie-compare-label { color: #3B82F6; }
.sf-source .sf-taotie-compare-label { color: #8B5CF6; }

.sf-taotie-compare-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-text);
  margin-bottom: 6px;
  line-height: 1.3;
}

.sf-taotie-compare-score {
  font-size: 16px;
  font-weight: 700;
  font-family: 'SF Mono', Menlo, monospace;
  margin-bottom: 4px;
}
.sf-target .sf-taotie-compare-score { color: #3B82F6; }
.sf-source .sf-taotie-compare-score { color: #8B5CF6; }

.sf-taotie-compare-strengths {
  font-size: 10.5px;
  color: var(--sf-subtext);
  line-height: 1.4;
}

.sf-taotie-compare-vs {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--sf-subtext);
  background: var(--sf-muted);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  align-self: center;
  flex-shrink: 0;
}

/* 五阶段进度指示器 */
.sf-taotie-phases {
  display: flex;
  align-items: stretch;
  gap: 0;
  margin-bottom: 12px;
  position: relative;
}

.sf-taotie-phase {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  position: relative;
  text-align: center;
}

.sf-taotie-phase-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--sf-muted);
  border: 2px solid var(--sf-border, #E5E7EB);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--sf-subtext);
  z-index: 1;
  flex-shrink: 0;
  transition: all 0.3s ease;
}
.sf-taotie-phase.sf-phase-done .sf-taotie-phase-dot {
  background: var(--sf-success, #10B981);
  border-color: var(--sf-success, #10B981);
  color: white;
}
.sf-taotie-phase.sf-phase-active .sf-taotie-phase-dot {
  background: var(--sf-accent, #3B82F6);
  border-color: var(--sf-accent, #3B82F6);
  color: white;
  animation: sf-phase-pulse 1.5s ease-in-out infinite;
}

@keyframes sf-phase-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
}

.sf-taotie-phase-label {
  font-size: 10px;
  color: var(--sf-subtext);
  line-height: 1.2;
  font-weight: 500;
}
.sf-taotie-phase.sf-phase-done .sf-taotie-phase-label,
.sf-taotie-phase.sf-phase-active .sf-taotie-phase-label {
  color: var(--sf-text);
  font-weight: 600;
}

/* 阶段连接线 */
.sf-taotie-phase:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 20px;
  left: 60%;
  right: -40%;
  height: 2px;
  background: var(--sf-muted);
  z-index: 0;
}
.sf-taotie-phase.sf-phase-done:not(:last-child)::after {
  background: var(--sf-success, #10B981);
}

/* 融合建议列表 */
.sf-taotie-suggestions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sf-taotie-suggestion {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: 6px;
  padding: 8px 10px;
  border-left: 3px solid #8B5CF6;
}

.sf-taotie-suggestion-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-text);
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sf-taotie-priority-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 8px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.sf-priority-high { background: rgba(239, 68, 68, 0.1); color: #EF4444; }
.sf-priority-medium { background: rgba(245, 158, 11, 0.1); color: #F59E0B; }
.sf-priority-low { background: rgba(16, 185, 129, 0.1); color: #10B981; }

.sf-taotie-suggestion-desc {
  font-size: 11px;
  color: var(--sf-subtext);
  line-height: 1.4;
}

/* 模式库列表 */
.sf-pattern-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sf-pattern-card {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 10px 12px;
  transition: all 0.15s;
}
.sf-pattern-card:hover {
  border-color: #8B5CF6;
  transform: translateY(-1px);
}

.sf-pattern-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  gap: 8px;
}

.sf-pattern-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--sf-text);
}

.sf-pattern-meta {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.sf-pattern-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(139, 92, 246, 0.1);
  color: #8B5CF6;
  font-weight: 600;
}

.sf-pattern-desc {
  font-size: 11px;
  color: var(--sf-subtext);
  line-height: 1.4;
  margin-bottom: 6px;
}

.sf-pattern-footer {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--sf-subtext);
}

.sf-pattern-improvement {
  color: var(--sf-success, #10B981);
  font-weight: 600;
  font-family: 'SF Mono', Menlo, monospace;
}

/* 注入步骤列表 */
.sf-injection-steps {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sf-injection-step {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: 6px;
  padding: 8px 10px;
}

.sf-injection-step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--sf-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--sf-subtext);
  flex-shrink: 0;
}
.sf-injection-step.sf-step-retained .sf-injection-step-num {
  background: var(--sf-success, #10B981);
  color: white;
}
.sf-injection-step.sf-step-rolledback .sf-injection-step-num {
  background: var(--sf-error, #EF4444);
  color: white;
}

.sf-injection-step-body {
  flex: 1;
  min-width: 0;
}

.sf-injection-step-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-text);
  margin-bottom: 2px;
}

.sf-injection-step-desc {
  font-size: 10.5px;
  color: var(--sf-subtext);
  line-height: 1.3;
}

.sf-injection-step-delta {
  font-size: 11px;
  font-weight: 700;
  font-family: 'SF Mono', Menlo, monospace;
  flex-shrink: 0;
}

/* 空状态 */
.sf-empty-small {
  text-align: center;
  padding: 20px 0;
  font-size: 12px;
  color: var(--sf-subtext);
}

/* ============================================================
   CoEvo 共进化模式样式
   ============================================================ */

/* 双指标得分卡片 */
.sf-coevo-score-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 4px;
}

.sf-coevo-score-card {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.sf-coevo-skill-card {
  border-color: #10B981;
}

.sf-coevo-test-card {
  border-color: #F59E0B;
}

.sf-coevo-score-label {
  font-size: 11px;
  color: var(--sf-subtext);
  font-weight: 500;
}

.sf-coevo-score-value {
  font-size: 24px;
  font-weight: 700;
  font-family: 'SF Mono', Menlo, monospace;
  line-height: 1.2;
}

.sf-coevo-score-target {
  font-size: 10px;
  color: var(--sf-subtext);
  font-family: 'SF Mono', Menlo, monospace;
}

/* 三阶段进度指示器 */
.sf-coevo-phases {
  display: flex;
  align-items: stretch;
  gap: 0;
  margin-bottom: 8px;
  position: relative;
}

/* 待批准横幅 */
.sf-coevo-pending-banner {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--sf-radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sf-coevo-pending-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--sf-text);
}

.sf-coevo-pending-desc {
  font-size: 11px;
  color: var(--sf-subtext);
  line-height: 1.4;
}

.sf-coevo-pending-deltas {
  display: flex;
  gap: 12px;
  font-size: 11px;
  font-weight: 600;
  font-family: 'SF Mono', Menlo, monospace;
}

/* 单轮 meta 信息 */
.sf-coevo-round-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 10px;
  color: var(--sf-subtext);
  margin-top: 2px;
}

/* 测试用例列表 */
.sf-coevo-test-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sf-coevo-test-item {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: 6px;
  padding: 8px 10px;
}

.sf-coevo-test-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.sf-coevo-test-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.sf-coevo-test-type {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background: var(--sf-muted);
  color: var(--sf-subtext);
  flex-shrink: 0;
}

.sf-test-type-edge_case { background: rgba(59, 130, 246, 0.1); color: #3B82F6; }
.sf-test-type-counterexample { background: rgba(139, 92, 246, 0.1); color: #8B5CF6; }
.sf-test-type-fuzz { background: rgba(245, 158, 11, 0.1); color: #F59E0B; }
.sf-test-type-security_boundary { background: rgba(239, 68, 68, 0.1); color: #EF4444; }
.sf-test-type-cross_scenario { background: rgba(16, 185, 129, 0.1); color: #10B981; }
.sf-test-type-contradictory { background: rgba(236, 72, 153, 0.1); color: #EC4899; }

.sf-coevo-test-desc {
  font-size: 10.5px;
  color: var(--sf-subtext);
  line-height: 1.4;
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sf-coevo-test-meta {
  display: flex;
  gap: 10px;
  font-size: 10px;
  color: var(--sf-subtext);
}

.sf-coevo-test-more {
  text-align: center;
  font-size: 11px;
  color: var(--sf-subtext);
  padding: 6px 0;
}

/* 共进化简介卡片 */
.sf-coevo-intro {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 12px;
  margin-top: 12px;
}

.sf-coevo-intro-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-text);
  margin-bottom: 6px;
}

.sf-coevo-intro-text {
  font-size: 11px;
  color: var(--sf-subtext);
  line-height: 1.5;
  margin-bottom: 10px;
}

.sf-coevo-intro-phases {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.sf-coevo-intro-phase {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: var(--sf-text);
  font-weight: 500;
}

.sf-coevo-intro-icon {
  font-size: 20px;
}

.sf-coevo-intro-arrow {
  font-size: 16px;
  color: var(--sf-accent);
  font-weight: 700;
}

/* 运行记录卡片 */
.sf-coevo-run-card {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.sf-coevo-run-card:hover {
  border-color: var(--sf-accent);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.sf-coevo-run-scores {
  display: flex;
  gap: 16px;
  margin: 8px 0;
}

.sf-coevo-run-score {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.sf-coevo-run-score-label {
  color: var(--sf-subtext);
  font-weight: 500;
}

/* ============================================================
   Settings Gear & Quick Settings Panel
   ============================================================ */

/* 输入面板 */
.sf-orch-input-panel {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sf-orch-desc {
  font-size: 11px;
  color: var(--sf-subtext);
  line-height: 1.4;
  margin-top: -4px;
}

.sf-orch-textarea-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sf-orch-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border, #E5E7EB);
  border-radius: 6px;
  background: var(--sf-bg, #FAFBFC);
  color: var(--sf-text);
  font-size: 12px;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
  min-height: 80px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.sf-orch-textarea:focus {
  border-color: var(--sf-accent);
}
.sf-orch-textarea::placeholder {
  color: var(--sf-subtext);
  opacity: 0.6;
}

/* 模式选择 */
.sf-orch-mode-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sf-orch-mode-picker {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.sf-orch-mode-btn {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 6px;
  border: 1px solid var(--border, #E5E7EB);
  border-radius: 6px;
  background: transparent;
  color: var(--sf-subtext);
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  text-align: center;
}
.sf-orch-mode-btn:hover {
  border-color: var(--sf-accent);
  color: var(--sf-text);
}
.sf-orch-mode-btn.sf-orch-mode-active {
  background: var(--sf-accent);
  border-color: var(--sf-accent);
  color: white;
}

.sf-orch-mode-label {
  font-size: 12px;
  font-weight: 600;
}

.sf-orch-mode-desc {
  font-size: 10px;
  opacity: 0.8;
  line-height: 1.3;
}

/* 错误提示 */
.sf-orch-error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--sf-error, #EF4444);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.4;
}

/* 统计行 */
.sf-orch-stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.sf-orch-stat-item {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 10px 4px;
  text-align: center;
}

.sf-orch-stat-num {
  font-size: 16px;
  font-weight: 600;
  color: var(--sf-accent);
  line-height: 1.2;
}

.sf-orch-stat-label {
  font-size: 10px;
  color: var(--sf-subtext);
  margin-top: 2px;
  font-weight: 500;
}

/* 概览卡片 */
.sf-orch-summary-card {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sf-orch-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.sf-orch-summary-label {
  color: var(--sf-subtext);
  font-weight: 500;
}

.sf-orch-summary-value {
  color: var(--sf-text);
  font-weight: 600;
  font-family: 'SF Mono', Menlo, monospace;
}

/* 工作流 */
.sf-orch-workflow {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
}

.sf-orch-node {
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.sf-orch-node:hover {
  border-color: var(--sf-accent);
  transform: translateX(2px);
}
.sf-orch-node.sf-orch-node-expanded {
  border-color: var(--sf-accent);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}
.sf-orch-node.sf-orch-node-unmatched {
  opacity: 0.75;
}

.sf-orch-node-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
}

.sf-orch-node-order {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--sf-accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}
.sf-orch-node-unmatched .sf-orch-node-order {
  background: var(--sf-muted);
  color: var(--sf-subtext);
}

.sf-orch-node-body {
  flex: 1;
  min-width: 0;
}

.sf-orch-node-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--sf-text);
  line-height: 1.3;
  margin-bottom: 4px;
}

.sf-orch-node-skill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
}

.sf-orch-node-skill-name {
  color: var(--sf-subtext);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sf-orch-node-skill-score {
  color: var(--sf-success);
  font-weight: 600;
  font-family: 'SF Mono', Menlo, monospace;
  flex-shrink: 0;
}

.sf-orch-node-no-skill {
  font-size: 11px;
  color: var(--sf-subtext);
  font-style: italic;
}

.sf-orch-node-caret {
  font-size: 8px;
  color: var(--sf-subtext);
  flex-shrink: 0;
  margin-top: 4px;
  transition: transform 0.15s;
}

/* 节点详情（展开） */
.sf-orch-node-detail {
  padding: 0 10px 10px 44px;
  border-top: 1px solid var(--sf-muted);
  margin-top: 0;
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sf-orch-node-desc {
  font-size: 11.5px;
  color: var(--sf-text);
  line-height: 1.5;
}

.sf-orch-node-meta {
  display: flex;
  gap: 12px;
  font-size: 10.5px;
  color: var(--sf-subtext);
  flex-wrap: wrap;
}

.sf-orch-node-match {
  background: var(--sf-muted);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sf-orch-match-title {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--sf-subtext);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sf-orch-match-reason {
  font-size: 11px;
  color: var(--sf-text);
  line-height: 1.4;
}

.sf-orch-match-scores {
  display: flex;
  gap: 12px;
  font-size: 10.5px;
  color: var(--sf-subtext);
  font-family: 'SF Mono', Menlo, monospace;
}

.sf-orch-node-deps {
  font-size: 10.5px;
  color: var(--sf-subtext);
  font-style: italic;
}

/* 节点连接线 */
.sf-orch-node-connector {
  width: 2px;
  height: 12px;
  background: var(--sf-muted);
  margin-left: 21px;
}

/* 执行指南 */
.sf-orch-guide-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 12px;
  font-weight: 500;
  color: var(--sf-text);
}
.sf-orch-guide-toggle:hover {
  border-color: var(--sf-accent);
  background: var(--sf-muted);
}

.sf-orch-guide-caret {
  font-size: 10px;
  color: var(--sf-subtext);
}

.sf-orch-guide-content {
  margin-top: 8px;
  background: var(--sf-card);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--sf-radius);
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.sf-orch-guide-pre {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--sf-text);
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* ============================================================
   Settings Gear & Quick Settings Panel
   ============================================================ */

.sf-right-tabs-left {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.sf-right-tabs-right {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-right: 4px;
}

.sf-settings-gear {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--sf-subtext);
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.sf-settings-gear:hover {
  color: var(--sf-text);
  background: var(--sf-hover-bg);
}

.sf-settings-gear.active {
  color: var(--sf-accent);
  background: var(--sf-accent-bg);
}

/* 快速设置面板 */
.sf-settings-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--sf-sidebar-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 100;
  display: flex;
  flex-direction: column;
  animation: sfSettingsSlideIn 0.2s ease;
  border-left: 1px solid var(--sf-border);
}

@keyframes sfSettingsSlideIn {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.sf-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--sf-border);
  flex-shrink: 0;
}

.sf-settings-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--sf-text);
}

.sf-settings-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--sf-subtext);
  cursor: pointer;
  border-radius: 6px;
  font-size: 20px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sf-settings-close:hover {
  color: var(--sf-text);
  background: var(--sf-hover-bg);
}

.sf-settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}

.sf-settings-group {
  padding: 8px 16px;
}

.sf-settings-group-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--sf-subtext);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  padding-left: 2px;
}

.sf-setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px;
  gap: 12px;
}

.sf-setting-item-label {
  font-size: 13px;
  color: var(--sf-text);
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.sf-setting-item-desc {
  font-size: 11px;
  color: var(--sf-subtext);
  font-weight: 400;
}

/* 轻量版 Toggle */
.sf-quick-toggle {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  border: none;
  background: var(--sf-border);
  cursor: pointer;
  position: relative;
  transition: background 0.2s ease;
  flex-shrink: 0;
  padding: 0;
}

.sf-quick-toggle.on {
  background: var(--sf-accent);
}

.sf-quick-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.sf-quick-toggle.on .sf-quick-toggle-thumb {
  transform: translateX(16px);
}

.sf-setting-select {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--sf-border);
  background: var(--sf-input-bg);
  color: var(--sf-text);
  font-size: 12px;
  cursor: pointer;
}

.sf-settings-footer {
  padding: 12px 16px;
  font-size: 11px;
  color: var(--sf-subtext);
  text-align: center;
  border-top: 1px solid var(--sf-border);
  margin-top: auto;
}

.sf-settings-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--sf-subtext);
  font-size: 13px;
}

/* 功能概览 */
.sf-settings-overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 12px 20px;
  background: var(--sf-settings-bg-2);
  border-bottom: 0.5px solid var(--sf-settings-border-l2);
}

.sf-overview-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--sf-settings-bg);
  border: 0.5px solid var(--sf-settings-border);
  border-radius: 10px;
}

.sf-overview-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.sf-overview-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sf-overview-label {
  font-weight: 600;
  font-size: 12px;
  color: var(--sf-settings-text);
}

.sf-overview-desc {
  font-size: 11px;
  color: var(--sf-settings-secondary);
  line-height: 1.3;
}

/* 错误状态 */
.sf-settings-error {
  display: flex;
  gap: 12px;
  padding: 24px 20px;
  align-items: flex-start;
}

.sf-error-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.sf-error-content {
  flex: 1;
}

.sf-error-content h4 {
  margin: 0 0 6px 0;
  font-size: 14px;
  color: var(--sf-settings-error);
}

.sf-error-content p {
  margin: 0 0 4px 0;
  font-size: 13px;
  color: var(--sf-settings-secondary);
}

.sf-error-hint {
  font-size: 12px !important;
  color: var(--sf-settings-tertiary) !important;
  margin-top: 8px !important;
}

/* 分区标题带图标 */
.sf-section-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sf-section-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.sf-section-collapse-icon {
  font-size: 12px;
  color: var(--sf-settings-tertiary);
  transition: transform 0.15s ease;
}

.sf-settings-section.collapsed .sf-section-collapse-icon {
  transform: rotate(-90deg);
}

/* 底部信息 */
.sf-settings-footer {
  padding: 12px 20px;
  border-top: 0.5px solid var(--sf-settings-border-l2);
  text-align: center;
  font-size: 12px;
  color: var(--sf-settings-tertiary);
  background: var(--sf-settings-bg-2);
}

.sf-settings-footer a {
  color: var(--sf-settings-accent);
  text-decoration: none;
}

.sf-settings-footer a:hover {
  text-decoration: underline;
}

/* 描述文字 */
.sf-section-desc {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: var(--sf-settings-secondary);
  line-height: 1.5;
}

/* ===== Dreaming 闲时锻造 ===== */

.sf-dreaming-status-card {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(99, 102, 241, 0.05));
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: var(--sf-radius);
  padding: 16px;
  margin: 12px;
}

.sf-dreaming-status-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.sf-dreaming-status-icon {
  font-size: 32px;
  line-height: 1;
  flex-shrink: 0;
}

.sf-dreaming-status-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--sf-text);
  margin-bottom: 2px;
}

.sf-dreaming-status-sub {
  font-size: 12px;
  color: var(--sf-subtext);
}

.sf-dreaming-progress-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.sf-dreaming-progress-bar {
  flex: 1;
  height: 6px;
  background: var(--sf-muted);
  border-radius: 3px;
  overflow: hidden;
}

.sf-dreaming-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #8B5CF6, #6366F1);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.sf-dreaming-progress-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-subtext);
  flex-shrink: 0;
  min-width: 36px;
  text-align: right;
}

.sf-dreaming-actions {
  display: flex;
  gap: 8px;
}

/* 六阶段进度指示器 */
.sf-dreaming-phases {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  padding: 8px 0;
}

.sf-dreaming-phase {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  text-align: center;
}

.sf-dreaming-phase-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--sf-muted);
  color: var(--sf-subtext);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.sf-dreaming-phase.sf-phase-done .sf-dreaming-phase-dot {
  background: var(--sf-success);
  color: white;
}

.sf-dreaming-phase.sf-phase-active .sf-dreaming-phase-dot {
  background: linear-gradient(135deg, #8B5CF6, #6366F1);
  color: white;
  animation: sf-dreaming-pulse 1.5s ease-in-out infinite;
}

@keyframes sf-dreaming-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(139, 92, 246, 0); }
}

.sf-dreaming-phase-label {
  font-size: 10px;
  color: var(--sf-subtext);
  line-height: 1.2;
  max-width: 100%;
  word-break: keep-all;
}

.sf-dreaming-phase.sf-phase-done .sf-dreaming-phase-label,
.sf-dreaming-phase.sf-phase-active .sf-dreaming-phase-label {
  color: var(--sf-text);
  font-weight: 500;
}

/* 阶段间连接线 */
.sf-dreaming-phase:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 14px;
  left: calc(50% + 14px);
  right: calc(-50% + 14px);
  height: 2px;
  background: var(--sf-muted);
}

.sf-dreaming-phase.sf-phase-done:not(:last-child)::after {
  background: var(--sf-success);
}

/* 统计网格 */
.sf-dreaming-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

/* 健康报告 */
.sf-dreaming-health-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.sf-dreaming-health-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: var(--sf-card);
  border: 1px solid var(--sf-border);
  border-radius: 6px;
}

.sf-dreaming-health-label {
  font-size: 12px;
  color: var(--sf-subtext);
}

.sf-dreaming-health-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--sf-text);
}

.sf-dreaming-health-quick {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sf-dreaming-health-quick .sf-dreaming-health-item {
  padding: 6px 10px;
}

/* 质量分布 */
.sf-dreaming-quality-dist {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sf-dreaming-dist-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sf-dreaming-dist-label {
  font-size: 12px;
  color: var(--sf-subtext);
  width: 40px;
  flex-shrink: 0;
}

.sf-dreaming-dist-track {
  flex: 1;
  height: 6px;
  background: var(--sf-muted);
  border-radius: 3px;
  overflow: hidden;
}

.sf-dreaming-dist-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.sf-dreaming-dist-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-text);
  width: 24px;
  text-align: right;
  flex-shrink: 0;
}

/* 改进目标 */
.sf-dreaming-targets {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sf-dreaming-target-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: var(--sf-card);
  border: 1px solid var(--sf-border);
  border-radius: 4px;
  font-size: 12px;
}

.sf-dreaming-target-name {
  color: var(--sf-text);
  font-weight: 500;
}

.sf-dreaming-target-priority {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 500;
}

/* 改进建议 */
.sf-dreaming-suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sf-dreaming-suggestion {
  padding: 10px;
  background: var(--sf-card);
  border: 1px solid var(--sf-border);
  border-radius: 6px;
}

.sf-dreaming-suggestion-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.sf-dreaming-suggestion-skill {
  font-size: 13px;
  font-weight: 600;
  color: var(--sf-text);
}

.sf-dreaming-suggestion-desc {
  font-size: 12px;
  color: var(--sf-subtext);
  line-height: 1.5;
}

/* 历史记录卡片 */
.sf-dreaming-history-card {
  background: var(--sf-card);
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius);
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sf-dreaming-history-card:hover {
  border-color: var(--sf-accent);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.sf-dreaming-history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.sf-dreaming-history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: var(--sf-subtext);
}

.sf-dreaming-history-step {
  margin-top: 6px;
  font-size: 12px;
  color: var(--sf-accent);
  font-style: italic;
}

`
