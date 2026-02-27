# MinimalistVisualDesign

极简主义视觉内容设计 Skill。五阶段透明化工作流，将任何输入内容转化为具有强烈视觉冲击力的极简主义现代网页设计，每一步产出独立文件，可分步审核迭代。

## 安装

```bash
npx skills add https://github.com/Cedaric/minimalist-visual-design-skill
```

### 手动安装

```bash
git clone https://github.com/Cedaric/minimalist-visual-design-skill.git ~/.claude/skills/minimalist-visual-design
```

## 目录结构

```
minimalist-visual-design/
├── SKILL.md                              # 主入口（身份 + 公理 + 工作流路由 + 执行协议）
├── phases/
│   ├── 01_content_analysis.md            # 阶段一：深度内容解析
│   ├── 02_architecture_planning.md       # 阶段二：智能架构规划
│   ├── 03_creative_directives.md         # 阶段三：创意指令生成
│   ├── 04_page_implementation.md         # 阶段四：逐页 HTML 实现
│   └── 05_consolidation.md              # 阶段五：合并与交付
├── templates/
│   └── consolidated_template.html        # 合并模板（含导航 JS 逻辑）
└── output/                               # 运行时产出目录
    └── pages/
```

## 使用方式

安装完成后，向 AI 助手提供内容并触发设计即可。典型请求：

```
请用 MinimalistVisualDesign 处理以下内容：

[粘贴内容]
```

AI 助手将按五个阶段依次执行，每个阶段的产出写入 `output/` 目录：

| 阶段 | 产出文件 | 说明 |
|------|---------|------|
| 一：深度内容解析 | `output/01_content_analysis.md` | 信息密度 + 质量评估 + 编辑策略 |
| 二：智能架构规划 | `output/02_architecture_plan.md` | WCU 计算 + 分页裁决 + 内容分配 |
| 三：创意指令生成 | `output/03_creative_directives.md` | 色彩/字体/布局 + 逐页视觉指令 |
| 四：逐页 HTML 实现 | `output/pages/cover.html` | 封面独立页 |
|                    | `output/pages/page1.html` ... | 内容页独立页 |
| 五：合并交付 | `output/final_presentation.html` | 最终合并产物（含导航） |

## 设计理念

本 Skill 融合日本设计哲学（留白、高桥法）、瑞士平面设计（网格系统、功能主义）和高端杂志排版（节奏感、不对称平衡），遵循三大不可违背的核心公理：

1. **内容完整性** — 绝不以设计理由删减内容
2. **绝对可读性** — 正文 ≥ 20px，行高 ≥ 1.8
3. **秩序优先于冲击** — 冲击力源于秩序中的变化，而非混乱

五个阶段的递进逻辑：

1. **解析**（读其魂）— 解构内容的核心、结构与价值
2. **架构**（立其骨）— 量化认知负荷，规划多页面叙事结构
3. **创意**（绘其图）— 为每一页生成定制化的视觉指令
4. **实现**（成其形）— 将创意指令精确转化为 HTML 代码
5. **交付**（合其体）— 合并为可交互的单文件演示

## 许可

MIT
