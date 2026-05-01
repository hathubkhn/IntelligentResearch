// ─── 3-layer research filter ────────────────────────────────────────────────

export interface FilterOption {
  label: string
  keywords: string // comma-separated search terms for this option
}

export const AI_METHODS: FilterOption[] = [
  { label: 'LLM',                    keywords: 'large language model, LLM, GPT, instruction tuning, in-context learning, chain of thought' },
  { label: 'LLM Agent',              keywords: 'LLM agent, tool use, autonomous agent, planning, ReAct, function calling' },
  { label: 'RAG',                    keywords: 'retrieval augmented generation, RAG, dense retrieval, knowledge retrieval' },
  { label: 'GNN',                    keywords: 'graph neural network, GNN, GCN, graph attention, message passing, graph transformer' },
  { label: 'Diffusion Model',        keywords: 'diffusion model, score matching, DDPM, denoising, latent diffusion, flow matching' },
  { label: 'Vision Transformer',     keywords: 'vision transformer, ViT, CLIP, image-text, visual encoder, image representation' },
  { label: 'Reinforcement Learning', keywords: 'reinforcement learning, RL, policy gradient, reward, PPO, MCTS, offline RL' },
  { label: 'Foundation Model',       keywords: 'foundation model, pre-training, fine-tuning, transfer learning, self-supervised' },
  { label: 'Multimodal',             keywords: 'multimodal, vision language, image text alignment, cross-modal, VLM' },
  { label: 'Federated Learning',     keywords: 'federated learning, distributed training, privacy-preserving, edge learning' },
  { label: 'Bayesian Methods',       keywords: 'Bayesian optimization, Gaussian process, uncertainty quantification, probabilistic' },
  { label: 'PINN',                   keywords: 'physics-informed neural network, PINN, physics-constrained, PDE, scientific ML' },
  { label: 'GAN',                    keywords: 'generative adversarial network, GAN, image generation, adversarial training' },
  { label: 'Contrastive Learning',   keywords: 'contrastive learning, self-supervised, SimCLR, MoCo, representation learning' },
  { label: 'NAS / AutoML',           keywords: 'neural architecture search, NAS, AutoML, hyperparameter optimization, efficient architecture' },
]

export const APPLICATION_DOMAINS: FilterOption[] = [
  { label: 'Electronics & EDA',        keywords: 'circuit design, EDA, VLSI, PCB, netlist, timing analysis, placement routing, logic synthesis' },
  { label: 'Power Systems',            keywords: 'power grid, energy forecasting, load prediction, grid stability, renewable energy, smart grid, EV charging' },
  { label: 'Semiconductor',            keywords: 'semiconductor, wafer inspection, lithography, chip manufacturing, defect detection, process control' },
  { label: 'Materials Science',        keywords: 'material property prediction, crystal structure, alloy, high-entropy, materials discovery' },
  { label: 'Chemistry & Drug',         keywords: 'molecular generation, drug discovery, protein, retrosynthesis, reaction prediction, drug design' },
  { label: 'Bioinformatics',           keywords: 'genomics, single cell, gene expression, protein structure, AlphaFold, RNA, transcriptomics' },
  { label: 'Robotics',                 keywords: 'robot learning, manipulation, locomotion, sim-to-real, robot control, dexterous hand' },
  { label: 'Climate & Energy',         keywords: 'climate modeling, weather forecasting, carbon emission, renewable, energy efficiency' },
  { label: 'Healthcare & Imaging',     keywords: 'medical imaging, radiology, pathology, clinical, diagnosis, healthcare, CT, MRI, histology' },
  { label: 'Civil Engineering',        keywords: 'structural health monitoring, civil infrastructure, bridge, concrete, earthquake, construction' },
  { label: 'Manufacturing',           keywords: 'industrial AI, predictive maintenance, quality control, manufacturing process, digital twin, Industry 4.0' },
  { label: 'Finance',                  keywords: 'financial forecasting, risk assessment, trading, portfolio, anomaly detection finance, credit scoring' },
]

export const RESEARCH_TASKS: FilterOption[] = [
  { label: 'Property Prediction',      keywords: 'property prediction, regression, property estimation, material prediction, molecular property' },
  { label: 'Optimization',             keywords: 'combinatorial optimization, black-box optimization, constrained optimization, multi-objective' },
  { label: 'Design Generation',        keywords: 'generative design, inverse design, structure generation, molecule generation, layout generation' },
  { label: 'Defect / Fault Detection', keywords: 'defect detection, anomaly detection, fault diagnosis, inspection, outlier detection, surface defect' },
  { label: 'Control & Planning',       keywords: 'control, planning, model predictive control, policy learning, real-time control, adaptive control' },
  { label: 'Simulation Acceleration',  keywords: 'surrogate model, emulation, fast simulation, proxy model, physics surrogate, neural simulator' },
  { label: 'Inverse Design',           keywords: 'inverse problem, inverse design, backward mapping, structure from property, topology optimization' },
  { label: 'Experiment Planning',      keywords: 'active learning, Bayesian experimental design, scientific discovery automation, lab automation, experiment selection' },
  { label: 'Anomaly Detection',        keywords: 'anomaly detection, out-of-distribution, novelty detection, one-class classification' },
  { label: 'Classification',           keywords: 'classification, recognition, detection, segmentation, identification, categorization' },
  { label: 'Forecasting',              keywords: 'time series forecasting, sequence prediction, temporal modeling, future prediction' },
  { label: 'Causal Discovery',         keywords: 'causal inference, causal discovery, counterfactual, intervention, causal graph' },
]

// ─── Venue tiers (for visual ranking) ───────────────────────────────────────

export const VENUE_TIERS: Record<string, 'gold' | 'silver' | 'bronze'> = {
  ICLR: 'gold', NeurIPS: 'gold', ICML: 'gold', CVPR: 'gold', ICCV: 'gold',
  ECCV: 'gold', ACL: 'gold', EMNLP: 'gold',
  COLM: 'silver', AISTATS: 'silver', UAI: 'silver', AAAI: 'silver',
  IJCAI: 'silver', KDD: 'silver', TMLR: 'silver',
}

// ─── Domain workspaces ───────────────────────────────────────────────────────

export interface SubTopic {
  label: string
  methods: string[]   // indices into AI_METHODS
  tasks: string[]     // indices into RESEARCH_TASKS
  extraKeywords?: string
}

export interface Workspace {
  id: string
  title: string
  tagline: string
  icon: string
  domain: string       // matches APPLICATION_DOMAINS label
  subtopics: SubTopic[]
  highlightVenues: string[]
  color: string
}

export const WORKSPACES: Workspace[] = [
  {
    id: 'electronics',
    title: 'AI for Electronics',
    tagline: 'EDA, power systems, semiconductor, circuit design automation',
    icon: '⚡',
    domain: 'Electronics & EDA',
    color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/20',
    highlightVenues: ['ICLR', 'NeurIPS', 'ICML', 'DAC', 'ICCAD'],
    subtopics: [
      { label: 'Power System Forecasting',     methods: ['GNN', 'Foundation Model'], tasks: ['Forecasting'] },
      { label: 'Fault Diagnosis',              methods: ['GNN', 'Contrastive Learning'], tasks: ['Defect / Fault Detection'] },
      { label: 'EV Charging Optimization',     methods: ['Reinforcement Learning'], tasks: ['Optimization', 'Control & Planning'] },
      { label: 'Circuit Design Automation',    methods: ['LLM', 'Reinforcement Learning'], tasks: ['Design Generation', 'Optimization'] },
      { label: 'Semiconductor Inspection',     methods: ['Vision Transformer', 'Diffusion Model'], tasks: ['Defect / Fault Detection'] },
      { label: 'Graph Learning for Circuits',  methods: ['GNN'], tasks: ['Property Prediction', 'Simulation Acceleration'], extraKeywords: 'netlist, timing, circuit graph, logic gate' },
    ],
  },
  {
    id: 'materials',
    title: 'AI for Materials',
    tagline: 'Crystal generation, molecular design, property prediction, lab automation',
    icon: '⚗️',
    domain: 'Materials Science',
    color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/20',
    highlightVenues: ['ICLR', 'NeurIPS', 'ICML', 'Nature MI'],
    subtopics: [
      { label: 'Material Property Prediction', methods: ['GNN', 'Foundation Model'], tasks: ['Property Prediction'] },
      { label: 'Crystal Structure Generation', methods: ['Diffusion Model', 'GNN'], tasks: ['Design Generation', 'Inverse Design'] },
      { label: 'Molecular Design',             methods: ['Diffusion Model', 'GNN', 'LLM'], tasks: ['Design Generation', 'Optimization'] },
      { label: 'Microscopy Image Analysis',    methods: ['Vision Transformer', 'Contrastive Learning'], tasks: ['Classification', 'Defect / Fault Detection'] },
      { label: 'Synthesis Route Planning',     methods: ['LLM', 'GNN'], tasks: ['Experiment Planning'] },
      { label: 'Battery & Catalyst Discovery', methods: ['Bayesian Methods', 'GNN'], tasks: ['Property Prediction', 'Experiment Planning'], extraKeywords: 'battery, catalyst, electrolyte, lithium, DFT' },
    ],
  },
  {
    id: 'bioinformatics',
    title: 'AI for BioInformatics',
    tagline: 'Protein structure, genomics, single-cell, drug discovery',
    icon: '🧬',
    domain: 'Bioinformatics',
    color: 'from-green-500/20 to-emerald-500/20 border-green-500/20',
    highlightVenues: ['ICLR', 'NeurIPS', 'ICML'],
    subtopics: [
      { label: 'Protein Structure & Function', methods: ['Foundation Model', 'GNN'], tasks: ['Property Prediction'] },
      { label: 'Genomics & Gene Expression',   methods: ['Contrastive Learning', 'Foundation Model'], tasks: ['Classification', 'Causal Discovery'] },
      { label: 'Single-cell Analysis',         methods: ['Diffusion Model', 'GNN'], tasks: ['Classification', 'Design Generation'] },
      { label: 'Drug Discovery',               methods: ['Diffusion Model', 'GNN', 'LLM'], tasks: ['Design Generation', 'Property Prediction'] },
    ],
  },
  {
    id: 'robotics',
    title: 'AI for Robotics',
    tagline: 'Embodied AI, manipulation, locomotion, sim-to-real',
    icon: '🤖',
    domain: 'Robotics',
    color: 'from-purple-500/20 to-violet-500/20 border-purple-500/20',
    highlightVenues: ['ICLR', 'NeurIPS', 'ICML', 'CoRL', 'IROS'],
    subtopics: [
      { label: 'Robot Manipulation',           methods: ['LLM Agent', 'Reinforcement Learning'], tasks: ['Control & Planning'] },
      { label: 'Locomotion & Navigation',      methods: ['Reinforcement Learning', 'Foundation Model'], tasks: ['Control & Planning'] },
      { label: 'Sim-to-Real Transfer',         methods: ['Diffusion Model', 'Reinforcement Learning'], tasks: ['Simulation Acceleration'] },
      { label: 'Vision-Language for Robots',   methods: ['Multimodal', 'LLM Agent'], tasks: ['Control & Planning', 'Classification'] },
    ],
  },
  {
    id: 'climate',
    title: 'AI for Climate',
    tagline: 'Weather forecasting, carbon, renewable energy, earth science',
    icon: '🌍',
    domain: 'Climate & Energy',
    color: 'from-teal-500/20 to-sky-500/20 border-teal-500/20',
    highlightVenues: ['ICLR', 'NeurIPS', 'ICML'],
    subtopics: [
      { label: 'Weather & Climate Modeling',   methods: ['Foundation Model', 'GNN'], tasks: ['Forecasting', 'Simulation Acceleration'] },
      { label: 'Renewable Energy Forecasting', methods: ['Foundation Model', 'GNN'], tasks: ['Forecasting'] },
      { label: 'Carbon Footprint & Emissions', methods: ['Foundation Model'], tasks: ['Property Prediction', 'Causal Discovery'] },
    ],
  },
  {
    id: 'healthcare',
    title: 'AI for Healthcare',
    tagline: 'Medical imaging, clinical NLP, diagnostics, trial design',
    icon: '🏥',
    domain: 'Healthcare & Imaging',
    color: 'from-rose-500/20 to-pink-500/20 border-rose-500/20',
    highlightVenues: ['ICLR', 'NeurIPS', 'ICML', 'MICCAI'],
    subtopics: [
      { label: 'Medical Image Analysis',       methods: ['Vision Transformer', 'Diffusion Model'], tasks: ['Classification', 'Defect / Fault Detection'] },
      { label: 'Clinical NLP',                 methods: ['LLM', 'RAG'], tasks: ['Classification', 'Causal Discovery'] },
      { label: 'Drug & Trial Design',          methods: ['Bayesian Methods', 'GNN'], tasks: ['Experiment Planning', 'Design Generation'] },
    ],
  },
]

// ─── Keyword generation from filter selections ───────────────────────────────

export function buildKeywordsFromSelections(
  methods: string[],
  domains: string[],
  tasks: string[],
  extra = ''
): string {
  const parts: string[] = []

  for (const m of methods) {
    const opt = AI_METHODS.find(o => o.label === m)
    if (opt) parts.push(opt.keywords)
  }
  for (const d of domains) {
    const opt = APPLICATION_DOMAINS.find(o => o.label === d)
    if (opt) parts.push(opt.keywords)
  }
  for (const t of tasks) {
    const opt = RESEARCH_TASKS.find(o => o.label === t)
    if (opt) parts.push(opt.keywords)
  }
  if (extra.trim()) parts.push(extra.trim())

  return parts.join(', ')
}

// ─── Build keywords from a workspace subtopic ────────────────────────────────

export function buildWorkspaceKeywords(workspace: Workspace, subtopic?: SubTopic): string {
  const domainOpt = APPLICATION_DOMAINS.find(d => d.label === workspace.domain)
  const base = domainOpt ? [domainOpt.keywords] : []

  const target = subtopic ?? null
  if (target) {
    const methodKws = target.methods.flatMap(m => {
      const opt = AI_METHODS.find(o => o.label === m)
      return opt ? [opt.keywords] : []
    })
    const taskKws = target.tasks.flatMap(t => {
      const opt = RESEARCH_TASKS.find(o => o.label === t)
      return opt ? [opt.keywords] : []
    })
    const extra = target.extraKeywords ? [target.extraKeywords] : []
    return [...base, ...methodKws, ...taskKws, ...extra].join(', ')
  }

  // Use all subtopic keywords combined for the whole workspace
  const allKws = workspace.subtopics.flatMap(st => {
    const methodKws = st.methods.flatMap(m => {
      const opt = AI_METHODS.find(o => o.label === m)
      return opt ? [opt.keywords] : []
    })
    return methodKws
  })
  return [...base, ...allKws].join(', ')
}
