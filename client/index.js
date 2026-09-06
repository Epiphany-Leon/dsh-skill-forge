import { useCallback, useEffect, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/client/components/ForgeQueue.tsx
const STATUS_LABELS$1 = {
	created: "已创建",
	triggering: "触发评估中",
	trigger_skipped: "触发跳过",
	extracting: "提取方法论",
	extraction_failed: "提取失败",
	generating: "生成技能中",
	generation_failed: "生成失败",
	verifying: "验证中",
	iterating: "迭代优化中",
	auditing: "安全审计中",
	audit_failed: "审计未通过",
	pending_approval: "待审核",
	rejected: "已拒绝",
	active: "已激活",
	failed: "失败",
	cancelled: "已取消"
};
const STATUS_COLORS = {
	created: "#94a3b8",
	triggering: "#60a5fa",
	trigger_skipped: "#94a3b8",
	extracting: "#60a5fa",
	extraction_failed: "#f87171",
	generating: "#a78bfa",
	generation_failed: "#f87171",
	verifying: "#fbbf24",
	iterating: "#f59e0b",
	auditing: "#fb923c",
	audit_failed: "#f87171",
	pending_approval: "#22c55e",
	rejected: "#ef4444",
	active: "#10b981",
	failed: "#ef4444",
	cancelled: "#94a3b8"
};
function ForgeQueue({ runs, onApprove, onCancel, onRetry }) {
	if (runs.length === 0) return /* @__PURE__ */ jsxs("div", {
		className: "sf-empty",
		children: [/* @__PURE__ */ jsx("p", { children: "暂无锻造任务" }), /* @__PURE__ */ jsx("p", {
			className: "sf-empty-hint",
			children: "在对话中说「把这次对话炼成技能」即可开始"
		})]
	});
	return /* @__PURE__ */ jsx("div", {
		className: "sf-queue",
		children: runs.map((run) => /* @__PURE__ */ jsxs("div", {
			className: "sf-queue-item",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "sf-queue-header",
					children: [/* @__PURE__ */ jsx("span", {
						className: "sf-queue-title",
						children: run.generatedSkill?.frontmatter.name || run.sourceSummary.substring(0, 30) || "未命名技能"
					}), /* @__PURE__ */ jsx("span", {
						className: "sf-status-dot",
						style: { backgroundColor: STATUS_COLORS[run.status] },
						title: STATUS_LABELS$1[run.status]
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "sf-queue-meta",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "sf-status-label",
							style: { color: STATUS_COLORS[run.status] },
							children: STATUS_LABELS$1[run.status]
						}),
						run.currentIteration > 0 && /* @__PURE__ */ jsxs("span", {
							className: "sf-iteration",
							children: [
								"迭代 ",
								run.currentIteration,
								"/",
								run.maxIterations
							]
						}),
						/* @__PURE__ */ jsx("span", {
							className: "sf-time",
							children: new Date(run.createdAt).toLocaleTimeString()
						})
					]
				}),
				run.failureReason && /* @__PURE__ */ jsxs("div", {
					className: "sf-failure-reason",
					children: [run.failureReason.message, run.failureReason.detail && /* @__PURE__ */ jsxs("span", {
						className: "sf-failure-detail",
						children: [": ", run.failureReason.detail.substring(0, 60)]
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "sf-queue-actions",
					children: [
						run.status === "pending_approval" && /* @__PURE__ */ jsx("button", {
							className: "sf-btn sf-btn-primary",
							onClick: () => onApprove(run),
							children: "审核"
						}),
						run.status === "failed" && /* @__PURE__ */ jsx("button", {
							className: "sf-btn sf-btn-secondary",
							onClick: () => onRetry(run.id),
							children: "重试"
						}),
						[
							"created",
							"triggering",
							"extracting",
							"generating",
							"verifying",
							"iterating",
							"auditing"
						].includes(run.status) && /* @__PURE__ */ jsx("button", {
							className: "sf-btn sf-btn-ghost",
							onClick: () => onCancel(run.id),
							children: "取消"
						})
					]
				})
			]
		}, run.id))
	});
}
//#endregion
//#region src/client/components/SkillLibrary.tsx
/**
* SkillLibrary —— 技能库组件
*/
const STATUS_LABELS = {
	draft: "草稿",
	pending_review: "待审核",
	active: "已激活",
	archived: "已归档",
	deprecated: "已弃用"
};
function SkillLibrary({ skills, onArchive, onUnarchive }) {
	const [filter, setFilter] = useState("all");
	const [search, setSearch] = useState("");
	const filtered = skills.filter((s) => {
		if (filter !== "all" && s.status !== filter) return false;
		if (search && !s.frontmatter.name.toLowerCase().includes(search.toLowerCase()) && !s.frontmatter.description?.toLowerCase().includes(search.toLowerCase())) return false;
		return true;
	});
	if (skills.length === 0) return /* @__PURE__ */ jsxs("div", {
		className: "sf-empty",
		children: [/* @__PURE__ */ jsx("p", { children: "技能库为空" }), /* @__PURE__ */ jsx("p", {
			className: "sf-empty-hint",
			children: "锻造出的技能会出现在这里"
		})]
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "sf-skills",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "sf-skills-toolbar",
			children: [/* @__PURE__ */ jsx("input", {
				type: "text",
				className: "sf-search",
				placeholder: "搜索技能...",
				value: search,
				onChange: (e) => setSearch(e.target.value)
			}), /* @__PURE__ */ jsxs("select", {
				className: "sf-filter",
				value: filter,
				onChange: (e) => setFilter(e.target.value),
				children: [
					/* @__PURE__ */ jsxs("option", {
						value: "all",
						children: [
							"全部 (",
							skills.length,
							")"
						]
					}),
					/* @__PURE__ */ jsxs("option", {
						value: "active",
						children: [
							"已激活 (",
							skills.filter((s) => s.status === "active").length,
							")"
						]
					}),
					/* @__PURE__ */ jsxs("option", {
						value: "archived",
						children: [
							"已归档 (",
							skills.filter((s) => s.status === "archived").length,
							")"
						]
					}),
					/* @__PURE__ */ jsxs("option", {
						value: "draft",
						children: [
							"草稿 (",
							skills.filter((s) => s.status === "draft").length,
							")"
						]
					})
				]
			})]
		}), /* @__PURE__ */ jsx("div", {
			className: "sf-skill-list",
			children: filtered.map((skill) => /* @__PURE__ */ jsxs("div", {
				className: "sf-skill-item",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "sf-skill-header",
						children: [/* @__PURE__ */ jsx("span", {
							className: "sf-skill-name",
							children: skill.frontmatter.name
						}), /* @__PURE__ */ jsx("span", {
							className: `sf-skill-status sf-status-${skill.status}`,
							children: STATUS_LABELS[skill.status]
						})]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "sf-skill-desc",
						children: skill.frontmatter.description
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-skill-meta",
						children: [
							/* @__PURE__ */ jsxs("span", { children: ["v", skill.version] }),
							/* @__PURE__ */ jsxs("span", { children: [
								"调用 ",
								skill.usageCount,
								" 次"
							] }),
							skill.verificationScore !== void 0 && /* @__PURE__ */ jsxs("span", { children: [
								"验证分 ",
								(skill.verificationScore * 100).toFixed(0),
								"%"
							] })
						]
					}),
					skill.frontmatter.tags && skill.frontmatter.tags.length > 0 && /* @__PURE__ */ jsx("div", {
						className: "sf-skill-tags",
						children: skill.frontmatter.tags.map((tag, i) => /* @__PURE__ */ jsx("span", {
							className: "sf-tag",
							children: tag
						}, i))
					}),
					/* @__PURE__ */ jsx("div", {
						className: "sf-skill-actions",
						children: skill.status === "active" ? /* @__PURE__ */ jsx("button", {
							className: "sf-btn sf-btn-ghost",
							onClick: () => onArchive(skill.id),
							children: "归档"
						}) : skill.status === "archived" ? /* @__PURE__ */ jsx("button", {
							className: "sf-btn sf-btn-secondary",
							onClick: () => onUnarchive(skill.id),
							children: "恢复"
						}) : null
					})
				]
			}, skill.id))
		})]
	});
}
//#endregion
//#region src/client/components/ForgeStats.tsx
function ForgeStats({ skills, runs }) {
	const totalSkills = skills.length;
	const activeSkills = skills.filter((s) => s.status === "active").length;
	const archivedSkills = skills.filter((s) => s.status === "archived").length;
	const totalUsage = skills.reduce((sum, s) => sum + s.usageCount, 0);
	const successRate = runs.length > 0 ? (runs.filter((r) => r.status === "active" || r.status === "pending_approval").length / runs.length * 100).toFixed(1) : "0.0";
	const avgIterations = runs.filter((r) => r.currentIteration > 0).length > 0 ? (runs.reduce((sum, r) => sum + r.currentIteration, 0) / runs.filter((r) => r.currentIteration > 0).length).toFixed(1) : "0";
	const weekAgo = Date.now() - 6048e5;
	const recentSkills = skills.filter((s) => s.createdAt > weekAgo).length;
	const recentRuns = runs.filter((r) => r.createdAt > weekAgo).length;
	return /* @__PURE__ */ jsxs("div", {
		className: "sf-stats",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "sf-stat-grid",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "sf-stat-card",
						children: [/* @__PURE__ */ jsx("div", {
							className: "sf-stat-value",
							children: activeSkills
						}), /* @__PURE__ */ jsx("div", {
							className: "sf-stat-label",
							children: "已激活技能"
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-stat-card",
						children: [/* @__PURE__ */ jsx("div", {
							className: "sf-stat-value",
							children: totalSkills
						}), /* @__PURE__ */ jsx("div", {
							className: "sf-stat-label",
							children: "总技能数"
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-stat-card",
						children: [/* @__PURE__ */ jsx("div", {
							className: "sf-stat-value",
							children: totalUsage
						}), /* @__PURE__ */ jsx("div", {
							className: "sf-stat-label",
							children: "总调用次数"
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-stat-card",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "sf-stat-value",
							children: [successRate, "%"]
						}), /* @__PURE__ */ jsx("div", {
							className: "sf-stat-label",
							children: "锻造成功率"
						})]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "sf-stat-section",
				children: [
					/* @__PURE__ */ jsx("h4", { children: "本周数据" }),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-stat-row",
						children: [/* @__PURE__ */ jsx("span", { children: "新增技能" }), /* @__PURE__ */ jsxs("span", {
							className: "sf-stat-accent",
							children: ["+", recentSkills]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-stat-row",
						children: [/* @__PURE__ */ jsx("span", { children: "锻造任务" }), /* @__PURE__ */ jsxs("span", {
							className: "sf-stat-accent",
							children: [recentRuns, " 次"]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-stat-row",
						children: [/* @__PURE__ */ jsx("span", { children: "平均迭代轮数" }), /* @__PURE__ */ jsxs("span", {
							className: "sf-stat-accent",
							children: [avgIterations, " 轮"]
						})]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "sf-stat-section",
				children: [
					/* @__PURE__ */ jsx("h4", { children: "技能状态分布" }),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-stat-row",
						children: [/* @__PURE__ */ jsx("span", { children: "已激活" }), /* @__PURE__ */ jsx("span", { children: activeSkills })]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-stat-row",
						children: [/* @__PURE__ */ jsx("span", { children: "已归档" }), /* @__PURE__ */ jsx("span", { children: archivedSkills })]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-stat-row",
						children: [/* @__PURE__ */ jsx("span", { children: "草稿/待审核" }), /* @__PURE__ */ jsx("span", { children: totalSkills - activeSkills - archivedSkills })]
					})
				]
			}),
			archivedSkills > 5 && /* @__PURE__ */ jsxs("div", {
				className: "sf-stat-tip",
				children: [
					"💡 已归档技能较多，可以考虑用",
					/* @__PURE__ */ jsx("strong", { children: "饕餮融合" }),
					"将同类技能合并优化"
				]
			}),
			activeSkills > 30 && /* @__PURE__ */ jsx("div", {
				className: "sf-stat-tip sf-stat-warning",
				children: "⚠️ 活跃技能超过 30 个，可能影响召回效果。建议整理或使用达尔文优化提升质量。"
			})
		]
	});
}
//#endregion
//#region src/client/components/ApprovalModal.tsx
/**
* ApprovalModal —— 人工审核弹窗
*
* Gate 6：展示技能详情，用户选择批准/拒绝。
* 拒绝时有预设理由 + 自定义文本。
*/
const REJECTION_REASONS = [
	{
		key: "quality",
		label: "质量不达标",
		desc: "内容太水/不准确/不完整"
	},
	{
		key: "useless",
		label: "不实用",
		desc: "场景太窄/日常用不上"
	},
	{
		key: "security",
		label: "有安全隐患",
		desc: "危险操作/隐私泄露"
	},
	{
		key: "duplicate",
		label: "与已有技能重复",
		desc: "功能重叠"
	},
	{
		key: "unclear",
		label: "看不懂",
		desc: "描述含糊/逻辑混乱"
	},
	{
		key: "format",
		label: "格式有问题",
		desc: "结构乱/缺字段"
	}
];
function ApprovalModal({ run, onApprove, onReject, onClose }) {
	const [selectedReasons, setSelectedReasons] = useState([]);
	const [customText, setCustomText] = useState("");
	const [showSkillBody, setShowSkillBody] = useState(false);
	const skill = run.generatedSkill;
	const verification = run.verificationResult;
	const audit = run.auditResult;
	const toggleReason = (key) => {
		setSelectedReasons((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
	};
	const handleReject = () => {
		if (selectedReasons.length === 0 && !customText.trim()) {
			alert("请至少选择一个拒绝理由或填写自定义说明");
			return;
		}
		onReject(selectedReasons, customText.trim());
	};
	return /* @__PURE__ */ jsx("div", {
		className: "sf-modal-overlay",
		onClick: onClose,
		children: /* @__PURE__ */ jsxs("div", {
			className: "sf-modal",
			onClick: (e) => e.stopPropagation(),
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "sf-modal-header",
					children: [/* @__PURE__ */ jsx("h3", { children: "🔍 技能审核" }), /* @__PURE__ */ jsx("button", {
						className: "sf-close-btn",
						onClick: onClose,
						children: "×"
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "sf-modal-body",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "sf-skill-preview",
							children: [
								/* @__PURE__ */ jsx("h4", { children: skill?.frontmatter.name || "未命名技能" }),
								/* @__PURE__ */ jsx("p", {
									className: "sf-skill-desc",
									children: skill?.frontmatter.description
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "sf-skill-when",
									children: [/* @__PURE__ */ jsx("strong", { children: "适用场景：" }), skill?.frontmatter.whenToUse]
								}),
								skill?.frontmatter.tags && skill.frontmatter.tags.length > 0 && /* @__PURE__ */ jsx("div", {
									className: "sf-skill-tags",
									children: skill.frontmatter.tags.map((tag, i) => /* @__PURE__ */ jsx("span", {
										className: "sf-tag",
										children: tag
									}, i))
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "sf-collapsible",
							children: [/* @__PURE__ */ jsxs("button", {
								className: "sf-collapse-btn",
								onClick: () => setShowSkillBody(!showSkillBody),
								children: [showSkillBody ? "▼" : "▶", " 查看技能正文"]
							}), showSkillBody && /* @__PURE__ */ jsx("div", {
								className: "sf-skill-body",
								children: /* @__PURE__ */ jsx("pre", { children: skill?.body })
							})]
						}),
						verification && /* @__PURE__ */ jsxs("div", {
							className: "sf-verification-card",
							children: [
								/* @__PURE__ */ jsx("h5", { children: "✅ 验证结果" }),
								/* @__PURE__ */ jsxs("div", {
									className: "sf-verification-stats",
									children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("span", {
										className: "sf-stat-value",
										children: [
											verification.passedTests,
											"/",
											verification.totalTests
										]
									}), /* @__PURE__ */ jsx("span", {
										className: "sf-stat-label",
										children: "测试通过"
									})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("span", {
										className: "sf-stat-value",
										children: [(verification.overallScore * 100).toFixed(0), "%"]
									}), /* @__PURE__ */ jsx("span", {
										className: "sf-stat-label",
										children: "总体得分"
									})] })]
								}),
								verification.failedTests > 0 && /* @__PURE__ */ jsxs("div", {
									className: "sf-failed-tests",
									children: ["失败的测试：", /* @__PURE__ */ jsx("ul", { children: verification.testResults.filter((r) => !r.passed).slice(0, 3).map((r) => /* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: r.testName }), r.error && /* @__PURE__ */ jsxs("span", { children: [" — ", r.error.substring(0, 50)] })] }, r.testId)) })]
								})
							]
						}),
						audit && /* @__PURE__ */ jsxs("div", {
							className: `sf-audit-card ${audit.dangers.length > 0 ? "sf-audit-danger" : audit.warnings.length > 0 ? "sf-audit-warning" : "sf-audit-ok"}`,
							children: [
								/* @__PURE__ */ jsx("h5", { children: "🛡️ 安全审计" }),
								audit.dangers.length > 0 && /* @__PURE__ */ jsxs("div", {
									className: "sf-audit-dangers",
									children: [/* @__PURE__ */ jsxs("strong", { children: [
										"⚠️ 危险项 (",
										audit.dangers.length,
										")："
									] }), /* @__PURE__ */ jsx("ul", { children: audit.dangers.map((d, i) => /* @__PURE__ */ jsx("li", { children: d }, i)) })]
								}),
								audit.warnings.length > 0 && /* @__PURE__ */ jsxs("div", {
									className: "sf-audit-warnings",
									children: [/* @__PURE__ */ jsxs("strong", { children: [
										"⚠️ 警告 (",
										audit.warnings.length,
										")："
									] }), /* @__PURE__ */ jsx("ul", { children: audit.warnings.map((w, i) => /* @__PURE__ */ jsx("li", { children: w }, i)) })]
								}),
								audit.dangers.length === 0 && audit.warnings.length === 0 && /* @__PURE__ */ jsx("p", {
									className: "sf-audit-clean",
									children: "✓ 未发现安全问题"
								}),
								audit.duplicateOf && /* @__PURE__ */ jsxs("p", {
									className: "sf-audit-duplicate",
									children: [
										"⚠️ 可能与现有技能重复（相似度 ",
										(audit.similarityScore * 100).toFixed(0),
										"%）"
									]
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "sf-forge-info",
							children: [
								/* @__PURE__ */ jsxs("span", { children: ["来源：", run.triggerMode === "manual" ? "手动触发" : "自动触发"] }),
								/* @__PURE__ */ jsxs("span", { children: [
									"迭代：",
									run.currentIteration,
									"/",
									run.maxIterations
								] }),
								/* @__PURE__ */ jsxs("span", { children: [
									"ID：",
									run.id.substring(0, 20),
									"..."
								] })
							]
						}),
						selectedReasons.length > 0 || customText ? /* @__PURE__ */ jsxs("div", {
							className: "sf-rejection-section",
							children: [
								/* @__PURE__ */ jsx("h5", { children: "❌ 拒绝理由" }),
								/* @__PURE__ */ jsx("div", {
									className: "sf-reason-grid",
									children: REJECTION_REASONS.map((reason) => /* @__PURE__ */ jsxs("label", {
										className: `sf-reason-item ${selectedReasons.includes(reason.key) ? "selected" : ""}`,
										children: [/* @__PURE__ */ jsx("input", {
											type: "checkbox",
											checked: selectedReasons.includes(reason.key),
											onChange: () => toggleReason(reason.key)
										}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
											className: "sf-reason-label",
											children: reason.label
										}), /* @__PURE__ */ jsx("div", {
											className: "sf-reason-desc",
											children: reason.desc
										})] })]
									}, reason.key))
								}),
								/* @__PURE__ */ jsx("textarea", {
									className: "sf-custom-reason",
									placeholder: "自定义拒绝理由（可选）...",
									value: customText,
									onChange: (e) => setCustomText(e.target.value),
									rows: 2
								})
							]
						}) : null
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "sf-modal-footer",
					children: [
						/* @__PURE__ */ jsx("button", {
							className: "sf-btn sf-btn-ghost",
							onClick: onClose,
							children: "取消"
						}),
						/* @__PURE__ */ jsx("button", {
							className: "sf-btn sf-btn-danger",
							onClick: handleReject,
							children: "拒绝"
						}),
						/* @__PURE__ */ jsx("button", {
							className: "sf-btn sf-btn-primary",
							onClick: onApprove,
							children: "✓ 批准入库"
						})
					]
				})
			]
		})
	});
}
//#endregion
//#region src/client/components/SkillForgePanel.tsx
/**
* SkillForgePanel —— 右侧面板主组件
*
* 三个 Tab：锻造队列 / 技能库 / 统计
*/
function SkillForgePanel() {
	const [activeTab, setActiveTab] = useState("queue");
	const [runs, setRuns] = useState([]);
	const [skills, setSkills] = useState([]);
	const [selectedRun, setSelectedRun] = useState(null);
	const [showApproval, setShowApproval] = useState(false);
	const fetchData = useCallback(async () => {
		try {
			const forgeRuns = await window.dsh?.remote?.skillForge?.getForgeQueue?.(20);
			if (forgeRuns) setRuns(forgeRuns);
			const skillList = await window.dsh?.remote?.skillForge?.getSkillLibrary?.();
			if (skillList) setSkills(skillList);
		} catch (err) {
			console.error("[skill-forge] Failed to fetch data:", err);
		}
	}, []);
	useEffect(() => {
		fetchData();
		const interval = setInterval(fetchData, 5e3);
		return () => clearInterval(interval);
	}, [fetchData]);
	useEffect(() => {
		const handleEvent = (event) => {
			console.log("[skill-forge] Event:", event.detail);
			fetchData();
		};
		window.addEventListener("skill-forge:status-changed", handleEvent);
		window.addEventListener("skill-forge:completed", handleEvent);
		window.addEventListener("skill-forge:failed", handleEvent);
		return () => {
			window.removeEventListener("skill-forge:status-changed", handleEvent);
			window.removeEventListener("skill-forge:completed", handleEvent);
			window.removeEventListener("skill-forge:failed", handleEvent);
		};
	}, [fetchData]);
	const handleApprove = async (runId) => {
		try {
			await window.dsh?.remote?.skillForge?.approveSkill?.(runId);
			setShowApproval(false);
			setSelectedRun(null);
			fetchData();
		} catch (err) {
			console.error("[skill-forge] Approve failed:", err);
		}
	};
	const handleReject = async (runId, reasons, customText) => {
		try {
			await window.dsh?.remote?.skillForge?.rejectSkill?.(runId, reasons, customText);
			setShowApproval(false);
			setSelectedRun(null);
			fetchData();
		} catch (err) {
			console.error("[skill-forge] Reject failed:", err);
		}
	};
	const pendingCount = runs.filter((r) => r.status === "pending_approval").length;
	return /* @__PURE__ */ jsxs("div", {
		className: "sf-panel",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "sf-panel-header",
				children: [/* @__PURE__ */ jsx("h3", { children: "🔨 Skill Forge" }), /* @__PURE__ */ jsxs("span", {
					className: "sf-pending-badge",
					style: { display: pendingCount ? "inline-block" : "none" },
					children: [pendingCount, " 待审核"]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "sf-tabs",
				children: [
					/* @__PURE__ */ jsxs("button", {
						className: `sf-tab ${activeTab === "queue" ? "active" : ""}`,
						onClick: () => setActiveTab("queue"),
						children: ["锻造队列", pendingCount > 0 && /* @__PURE__ */ jsx("span", {
							className: "sf-tab-badge",
							children: pendingCount
						})]
					}),
					/* @__PURE__ */ jsxs("button", {
						className: `sf-tab ${activeTab === "skills" ? "active" : ""}`,
						onClick: () => setActiveTab("skills"),
						children: [
							"技能库 (",
							skills.length,
							")"
						]
					}),
					/* @__PURE__ */ jsx("button", {
						className: `sf-tab ${activeTab === "stats" ? "active" : ""}`,
						onClick: () => setActiveTab("stats"),
						children: "统计"
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "sf-tab-content",
				children: [
					activeTab === "queue" && /* @__PURE__ */ jsx(ForgeQueue, {
						runs,
						onApprove: (run) => {
							setSelectedRun(run);
							setShowApproval(true);
						},
						onCancel: (runId) => {
							window.dsh?.remote?.skillForge?.cancelForge?.(runId);
							fetchData();
						},
						onRetry: (runId) => {
							window.dsh?.remote?.skillForge?.retryForge?.(runId);
							fetchData();
						}
					}),
					activeTab === "skills" && /* @__PURE__ */ jsx(SkillLibrary, {
						skills,
						onArchive: (id) => {
							window.dsh?.remote?.skillForge?.archiveSkill?.(id);
							fetchData();
						},
						onUnarchive: (id) => {
							window.dsh?.remote?.skillForge?.unarchiveSkill?.(id);
							fetchData();
						}
					}),
					activeTab === "stats" && /* @__PURE__ */ jsx(ForgeStats, {
						skills,
						runs
					})
				]
			}),
			showApproval && selectedRun && /* @__PURE__ */ jsx(ApprovalModal, {
				run: selectedRun,
				onApprove: () => handleApprove(selectedRun.id),
				onReject: (reasons, text) => handleReject(selectedRun.id, reasons, text),
				onClose: () => {
					setShowApproval(false);
					setSelectedRun(null);
				}
			})
		]
	});
}
//#endregion
//#region src/client/components/SkillForgeSettings.tsx
/**
* SkillForgeSettings —— 设置页组件
*
* 在 DSH 设置页中注册的配置面板。
*/
function SkillForgeSettings() {
	const [config, setConfig] = useState(null);
	const [saving, setSaving] = useState(false);
	useEffect(() => {
		const loadConfig = async () => {
			try {
				const cfg = await window.dsh?.remote?.skillForge?.getConfig?.();
				if (cfg) setConfig(cfg);
			} catch (err) {
				console.error("[skill-forge] Failed to load config:", err);
			}
		};
		loadConfig();
	}, []);
	const updateConfig = async (updates) => {
		setConfig((prev) => ({
			...prev,
			...updates
		}));
		setSaving(true);
		try {
			await window.dsh?.remote?.skillForge?.updateConfig?.(updates);
		} catch (err) {
			console.error("[skill-forge] Failed to save config:", err);
		} finally {
			setTimeout(() => setSaving(false), 500);
		}
	};
	if (!config) return /* @__PURE__ */ jsx("div", {
		className: "sf-settings-loading",
		children: "加载中..."
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "sf-settings",
		children: [
			/* @__PURE__ */ jsx("h3", { children: "🔨 Skill Forge 设置" }),
			/* @__PURE__ */ jsxs("div", {
				className: "sf-settings-section",
				children: [
					/* @__PURE__ */ jsx("h4", { children: "安全等级" }),
					/* @__PURE__ */ jsx("p", {
						className: "sf-settings-desc",
						children: "控制自动生成技能的审核严格程度"
					}),
					/* @__PURE__ */ jsx("div", {
						className: "sf-radio-group",
						children: [
							{
								value: "strict",
								label: "严格",
								desc: "所有技能必须人工审核"
							},
							{
								value: "normal",
								label: "正常",
								desc: "高质量+低风险技能自动入库，其余审核"
							},
							{
								value: "permissive",
								label: "宽松",
								desc: "验证通过即自动入库，仅高危拦截"
							},
							{
								value: "auto",
								label: "全自动",
								desc: "完全不拦截（不推荐）"
							}
						].map((opt) => /* @__PURE__ */ jsxs("label", {
							className: `sf-radio-item ${config.securityLevel === opt.value ? "selected" : ""}`,
							children: [/* @__PURE__ */ jsx("input", {
								type: "radio",
								name: "securityLevel",
								value: opt.value,
								checked: config.securityLevel === opt.value,
								onChange: () => updateConfig({ securityLevel: opt.value })
							}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("strong", { children: opt.label }), /* @__PURE__ */ jsx("p", { children: opt.desc })] })]
						}, opt.value))
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "sf-settings-section",
				children: [
					/* @__PURE__ */ jsx("h4", { children: "自动触发" }),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-setting-row",
						children: [/* @__PURE__ */ jsxs("label", { children: [/* @__PURE__ */ jsx("input", {
							type: "checkbox",
							checked: config.autoTrigger,
							onChange: (e) => updateConfig({ autoTrigger: e.target.checked })
						}), "启用自动锻造触发"] }), /* @__PURE__ */ jsx("span", {
							className: "sf-settings-desc",
							children: "对话结束时自动检测是否值得锻造"
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-setting-row",
						children: [
							/* @__PURE__ */ jsx("label", { children: "触发置信度阈值" }),
							/* @__PURE__ */ jsx("input", {
								type: "range",
								min: "0.3",
								max: "0.95",
								step: "0.05",
								value: config.triggerThreshold,
								onChange: (e) => updateConfig({ triggerThreshold: parseFloat(e.target.value) })
							}),
							/* @__PURE__ */ jsxs("span", {
								className: "sf-value",
								children: [(config.triggerThreshold * 100).toFixed(0), "%"]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "sf-settings-section",
				children: [
					/* @__PURE__ */ jsx("h4", { children: "迭代优化" }),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-setting-row",
						children: [/* @__PURE__ */ jsx("label", { children: "最大迭代轮数" }), /* @__PURE__ */ jsx("input", {
							type: "number",
							min: "0",
							max: "10",
							value: config.maxIterations,
							onChange: (e) => updateConfig({ maxIterations: parseInt(e.target.value) || 0 })
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-setting-row",
						children: [
							/* @__PURE__ */ jsx("label", { children: "验证通过阈值" }),
							/* @__PURE__ */ jsx("input", {
								type: "range",
								min: "0.5",
								max: "1.0",
								step: "0.05",
								value: config.verificationPassThreshold,
								onChange: (e) => updateConfig({ verificationPassThreshold: parseFloat(e.target.value) })
							}),
							/* @__PURE__ */ jsxs("span", {
								className: "sf-value",
								children: [(config.verificationPassThreshold * 100).toFixed(0), "%"]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "sf-settings-section",
				children: [
					/* @__PURE__ */ jsx("h4", { children: "技能库" }),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-setting-row",
						children: [/* @__PURE__ */ jsx("label", { children: "技能数量提醒阈值" }), /* @__PURE__ */ jsx("input", {
							type: "number",
							min: "10",
							max: "100",
							value: config.skillCountAlertThreshold,
							onChange: (e) => updateConfig({ skillCountAlertThreshold: parseInt(e.target.value) || 30 })
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-setting-row",
						children: [
							/* @__PURE__ */ jsx("label", { children: "Token 预算占比" }),
							/* @__PURE__ */ jsx("input", {
								type: "range",
								min: "0.05",
								max: "0.3",
								step: "0.05",
								value: config.tokenBudgetRatio,
								onChange: (e) => updateConfig({ tokenBudgetRatio: parseFloat(e.target.value) })
							}),
							/* @__PURE__ */ jsxs("span", {
								className: "sf-value",
								children: [(config.tokenBudgetRatio * 100).toFixed(0), "%"]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "sf-settings-section",
				children: [
					/* @__PURE__ */ jsx("h4", { children: "闲时锻造（Dreaming）" }),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-setting-row",
						children: [/* @__PURE__ */ jsxs("label", { children: [/* @__PURE__ */ jsx("input", {
							type: "checkbox",
							checked: config.enableDreaming,
							onChange: (e) => updateConfig({ enableDreaming: e.target.checked })
						}), "启用闲时锻造"] }), /* @__PURE__ */ jsx("span", {
							className: "sf-settings-desc",
							children: "定时批量回顾和整理技能库"
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "sf-setting-row",
						children: [/* @__PURE__ */ jsx("label", { children: "调度时间（cron）" }), /* @__PURE__ */ jsx("input", {
							type: "text",
							value: config.dreamingSchedule,
							onChange: (e) => updateConfig({ dreamingSchedule: e.target.value }),
							disabled: !config.enableDreaming
						})]
					})
				]
			}),
			saving && /* @__PURE__ */ jsx("div", {
				className: "sf-save-indicator",
				children: "已保存 ✓"
			})
		]
	});
}
//#endregion
//#region src/client/index.tsx
const SkillForgePanelComponent = SkillForgePanel;
const SkillForgeSettingsComponent = SkillForgeSettings;
var client_default = {
	name: "dsh-skill-forge-client",
	components: {
		SkillForgePanel,
		SkillForgeSettings
	}
};
//#endregion
export { SkillForgePanelComponent, SkillForgeSettingsComponent, client_default as default };
