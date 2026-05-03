export interface CategoryGroup {
  label: string
  color: string  // tailwind color key
  items: string[]
}

export const CATEGORY_TAXONOMY: CategoryGroup[] = [
  {
    label: 'Core AI / Machine Learning',
    color: 'blue',
    items: [
      'Machine Learning', 'Deep Learning', 'Representation Learning',
      'Self-Supervised Learning', 'Reinforcement Learning', 'Probabilistic Machine Learning',
      'Causal Learning', 'Graph Machine Learning', 'Federated Learning',
      'Continual Learning', 'AutoML',
    ],
  },
  {
    label: 'Large Language Models and NLP',
    color: 'violet',
    items: [
      'Natural Language Processing', 'Large Language Models', 'Foundation Models',
      'Prompt Engineering', 'Instruction Tuning', 'Fine-tuning',
      'Retrieval-Augmented Generation', 'Question Answering', 'Text Summarization',
      'Information Extraction', 'Machine Translation', 'Dialogue Systems', 'AI Agents',
    ],
  },
  {
    label: 'Computer Vision and Multimodal AI',
    color: 'cyan',
    items: [
      'Computer Vision', 'Image Classification', 'Object Detection',
      'Segmentation', 'Vision Transformers', 'Image Generation',
      'Video Understanding', 'Multimodal Learning', 'Vision-Language Models',
      'OCR / Document AI',
    ],
  },
  {
    label: 'Generative AI',
    color: 'pink',
    items: [
      'Diffusion Models', 'GANs', 'VAEs',
      'Text-to-Image Generation', 'Text-to-Video Generation', 'Audio Generation',
      'Synthetic Data Generation', 'Generative Design',
    ],
  },
  {
    label: 'AI Infrastructure and Systems',
    color: 'slate',
    items: [
      'MLOps', 'Model Serving', 'Model Compression',
      'Quantization', 'Edge AI', 'Distributed Training',
      'GPU Optimization', 'AI Safety Infrastructure', 'Data Pipelines',
      'Vector Databases', 'Knowledge Graphs',
    ],
  },
  {
    label: 'Trustworthy and Responsible AI',
    color: 'amber',
    items: [
      'Explainable AI', 'Fairness', 'Bias Detection',
      'Privacy-Preserving AI', 'AI Safety', 'Robustness',
      'Adversarial Machine Learning', 'Human-AI Interaction', 'AI Ethics', 'Model Evaluation',
    ],
  },
  {
    label: 'AI for Science and Engineering',
    color: 'emerald',
    items: [
      'AI for Materials', 'AI for Electronics', 'AI for Energy',
      'AI for Chemistry', 'AI for Biology', 'AI for Medicine',
      'AI for Robotics', 'AI for Smart Grid', 'AI for Transportation', 'AI for Climate',
    ],
  },
  {
    label: 'AI for Business and Society',
    color: 'orange',
    items: [
      'AI for Finance', 'AI for Education', 'AI for Healthcare',
      'AI for LegalTech', 'AI for Cybersecurity', 'AI for E-commerce',
      'AI for Recommendation Systems', 'AI for Social Good', 'AI Governance', 'AI Policy',
    ],
  },
  {
    label: 'Data and Evaluation',
    color: 'rose',
    items: [
      'Benchmark Datasets', 'Evaluation Metrics', 'Leaderboards',
      'Reproducibility', 'Data Curation', 'Data Annotation',
      'Dataset Bias', 'Experimental Design', 'Ablation Studies', 'Benchmarking Frameworks',
    ],
  },
]

// Flat list of all categories (for dropdowns, selects, etc.)
export const ALL_CATEGORIES: string[] = CATEGORY_TAXONOMY.flatMap(g => g.items)

// Color maps for badge styling
export const GROUP_ACCENT: Record<string, string> = {
  blue:    'text-blue-400   bg-blue-500/10   border-blue-500/20',
  violet:  'text-violet-400 bg-violet-500/10 border-violet-500/20',
  cyan:    'text-cyan-400   bg-cyan-500/10   border-cyan-500/20',
  pink:    'text-pink-400   bg-pink-500/10   border-pink-500/20',
  slate:   'text-slate-400  bg-slate-500/10  border-slate-500/20',
  amber:   'text-amber-400  bg-amber-500/10  border-amber-500/20',
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  orange:  'text-orange-400 bg-orange-500/10 border-orange-500/20',
  rose:    'text-rose-400   bg-rose-500/10   border-rose-500/20',
}
