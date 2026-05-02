#!/usr/bin/env node
import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const CATEGORIES = [
  { name: 'LLM & NLP',             description: 'Large language models, text generation, language understanding, NLP tasks', color: 'blue',   order: 1 },
  { name: 'Reasoning & Planning',  description: 'Chain-of-thought, multi-step reasoning, task planning, world modeling',     color: 'violet', order: 2 },
  { name: 'Agents & Tool Use',     description: 'LLM agents, tool calling, function use, autonomous agents, ReAct',          color: 'amber',  order: 3 },
  { name: 'Computer Vision',       description: 'Image recognition, detection, segmentation, visual representations',        color: 'cyan',   order: 4 },
  { name: 'Multimodal',            description: 'Vision-language models, image-text alignment, cross-modal learning',        color: 'orange', order: 5 },
  { name: 'Generative Models',     description: 'Diffusion models, GANs, VAEs, flow-based models, image/video generation',  color: 'rose',   order: 6 },
  { name: 'Graph Learning',        description: 'Graph neural networks, GCN, graph transformers, molecular graphs',          color: 'emerald',order: 7 },
  { name: 'Reinforcement Learning',description: 'RL, policy gradient, RLHF, reward learning, offline RL',                   color: 'amber',  order: 8 },
  { name: 'Federated Learning',    description: 'Distributed training, privacy-preserving ML, edge learning',               color: 'blue',   order: 9 },
  { name: 'Scientific ML',         description: 'AI for science, materials, chemistry, physics-informed ML, drug discovery', color: 'emerald',order: 10 },
  { name: 'Robotics',              description: 'Robot learning, manipulation, locomotion, sim-to-real transfer',            color: 'cyan',   order: 11 },
  { name: 'Efficiency & Systems',  description: 'Model compression, quantization, inference optimization, training efficiency', color: 'violet', order: 12 },
  { name: 'Alignment & Safety',    description: 'AI safety, RLHF, preference learning, bias, fairness, interpretability',  color: 'rose',   order: 13 },
  { name: 'Benchmarks & Surveys',  description: 'Benchmark datasets, evaluation frameworks, survey papers',                 color: 'blue',   order: 14 },
]

// Map old messy category names → new clean ones
const MIGRATION_MAP = {
  ':brain: Planning':              'Reasoning & Planning',
  ':rocket: Tool Use':             'Agents & Tool Use',
  ':arrows_counterclockwise: Feedback Learning': 'Reinforcement Learning',
  ':gift: Surveys':                'Benchmarks & Surveys',
  ':jigsaw: Composition':          'LLM & NLP',
  ':world_map: World Modeling':    'Reasoning & Planning',
  ':bar_chart: Benchmarks':        'Benchmarks & Surveys',
  'applications to robotics, autonomy, planning': 'Robotics',
  'This Repository vs. Others':    'Benchmarks & Surveys',
}

async function main() {
  console.log('📋 Seeding categories...')
  for (const cat of CATEGORIES) {
    await sql`
      INSERT INTO "Category" (id, "createdAt", name, description, color, "order")
      VALUES (
        gen_random_uuid(),
        NOW(),
        ${cat.name},
        ${cat.description},
        ${cat.color},
        ${cat.order}
      )
      ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        color = EXCLUDED.color,
        "order" = EXCLUDED."order"
    `
    console.log(`  ✅ ${cat.name}`)
  }

  console.log('\n🔧 Migrating old category names...')
  for (const [oldName, newName] of Object.entries(MIGRATION_MAP)) {
    const result = await sql`
      UPDATE "Paper" SET category = ${newName} WHERE category = ${oldName}
    `
    if (result.length > 0 || result.count > 0) {
      console.log(`  "${oldName}" → "${newName}"`)
    }
  }

  console.log('\n📊 Final category counts:')
  const counts = await sql`
    SELECT category, COUNT(*) as count
    FROM "Paper"
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY count DESC
  `
  counts.forEach(r => console.log(`  ${r.category}: ${r.count}`))

  console.log('\n✅ Done!')
  process.exit(0)
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
