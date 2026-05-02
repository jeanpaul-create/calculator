/**
 * AI-powered project parser — turns free-text descriptions into structured
 * quote drafts.
 *
 *   Input:  "Famille Müller à Yverdon, toit en tuile, 10 kWp avec batterie"
 *   Output: { items: [{productId, quantity}], roofType: 'tuile', ... }
 *
 * Approach:
 *   - Anthropic Claude with tool_use to constrain output to a typed schema
 *   - Catalog passed as a SYSTEM prompt with cache_control: { type: "ephemeral" }
 *     so repeated calls within 5 min reuse the cached catalog tokens
 *     (≈ 70-90% cost reduction vs uncached)
 *   - Result is validated against the live catalog before being returned —
 *     no hallucinated product IDs reach the form
 */

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import type { ProductCategory } from '@prisma/client'

// Model: the project's CLAUDE.md uses sonnet 4.7; configurable via env.
// Keep sonnet (not opus) — this is structured extraction, not deep reasoning.
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5-20250929'
const MAX_TOKENS = 1024

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AiParseInput {
  scenarioType: 'PV' | 'PAC'
  description: string
}

export interface AiParseItem {
  productId: string
  productName: string // for UI display
  quantity: number
  category: ProductCategory
}

export interface AiParseResult {
  scenarioType: 'PV' | 'PAC'
  items: AiParseItem[]
  customerInfo: {
    name?: string
    siteAddress?: string
    annualConsumptionKwh?: number
  }
  /** PV-only — undefined for PAC */
  roofType?: 'tuile' | 'ardoise' | 'bac_acier' | 'plat'
  /** PV-only — undefined for PAC */
  roofSlope?: 'simple' | 'moyen' | 'complexe'
  /** Free-text notes the AI thought relevant but couldn't structure */
  notes?: string
  /** Issues the AI flagged (e.g. "no inverter matched, please check") */
  warnings: string[]
  /** Total input + output tokens — for monitoring cost */
  tokensUsed: number
}

// ─── Catalog snapshot ─────────────────────────────────────────────────────────

interface CatalogProduct {
  id: string
  name: string
  description: string | null
  category: ProductCategory
  costRappen: number
  powerWp: number | null
}

async function fetchCatalog(scenarioType: 'PV' | 'PAC'): Promise<CatalogProduct[]> {
  const pvCategories: ProductCategory[] = [
    'PANEL', 'INVERTER', 'BATTERY', 'MOUNTING', 'ACCESSORY', 'EV_CHARGER',
  ]
  const pacCategories: ProductCategory[] = [
    'PAC_MACHINE', 'PAC_ACCESSORY', 'PAC_ELECTRICITE', 'PAC_MACONNERIE',
    'PAC_ISOLATION', 'PAC_CITERNE', 'PAC_CONDUITE', 'PAC_MONTAGE', 'PAC_ADMIN',
  ]
  const categories = scenarioType === 'PAC' ? pacCategories : pvCategories
  return prisma.product.findMany({
    where: { active: true, category: { in: categories } },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      costRappen: true,
      powerWp: true,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })
}

function formatCatalogForPrompt(products: CatalogProduct[]): string {
  // Compact format — one line per product. Token-efficient.
  return products
    .map((p) => {
      const power = p.powerWp ? ` ${p.powerWp}Wp` : ''
      const chf = (p.costRappen / 100).toFixed(2)
      return `${p.id} | ${p.category} | ${p.name}${power} | CHF ${chf}`
    })
    .join('\n')
}

// ─── Prompt construction ──────────────────────────────────────────────────────

const SYSTEM_INTRO = `You are an assistant for a Swiss solar / heat-pump sales rep. The rep describes a customer project in free text (French or German); you propose a list of products from the rep's catalog that match the description.

Output rules:
- Use ONLY product IDs that appear in the catalog. Never invent IDs.
- For a 10 kWp PV system: pick panels totaling ~10000 Wp (typically 20-22 panels of 460-500 Wp). Pick a matching inverter (similar kW rating).
- For PAC: pick ONE machine (heat pump unit). Add accessories, mounting/montage, electrical, and admin items as a typical install would need.
- If the rep mentions a battery, add one. If they mention an EV/borne, add an EV charger.
- If the rep mentions kWh consumption, include it in customerInfo.annualConsumptionKwh.
- For PV roofType: tuile (most common), ardoise, bac_acier (metal), plat. For roofSlope: simple (≤30°), moyen (30-45°), complexe (>45°).
- If you can't find a good match for something the rep wants, add a warning instead of guessing.
- Be conservative — if unsure, leave it out and add a warning.

Always call the propose_quote_items tool with your structured response.`

interface CallInput {
  scenarioType: 'PV' | 'PAC'
  description: string
  catalogText: string
}

async function callClaude(client: Anthropic, input: CallInput) {
  const tool: Anthropic.Tool = {
    name: 'propose_quote_items',
    description:
      'Propose a list of catalog items, customer info, and PV-only roof attributes for the quote draft.',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Catalog items to add to the quote.',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string', description: 'Catalog product ID (cuid).' },
              quantity: { type: 'integer', minimum: 1, description: 'Quantity of this product.' },
            },
            required: ['productId', 'quantity'],
          },
        },
        customerInfo: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            siteAddress: { type: 'string' },
            annualConsumptionKwh: { type: 'integer' },
          },
        },
        roofType: {
          type: 'string',
          enum: ['tuile', 'ardoise', 'bac_acier', 'plat'],
          description: 'PV-only. Omit for PAC.',
        },
        roofSlope: {
          type: 'string',
          enum: ['simple', 'moyen', 'complexe'],
          description: 'PV-only. Omit for PAC.',
        },
        notes: { type: 'string', description: 'Free-text notes the rep should see.' },
        warnings: {
          type: 'array',
          items: { type: 'string' },
          description: 'Issues the rep should review (missing match, ambiguity, etc.).',
        },
      },
      required: ['items', 'warnings'],
    },
  }

  return client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'propose_quote_items' },
    system: [
      // Static intro — cached
      {
        type: 'text',
        text: SYSTEM_INTRO,
        cache_control: { type: 'ephemeral' },
      },
      // Catalog snapshot — cached. Cache hit on every call within 5 min.
      {
        type: 'text',
        text: `\n\nCatalog (${input.scenarioType}):\n${input.catalogText}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Describe project (${input.scenarioType}):\n\n${input.description}`,
      },
    ],
  })
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function parseProjectDescription(
  input: AiParseInput
): Promise<AiParseResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY missing')
  }
  if (!input.description?.trim()) {
    throw new Error('Description is empty')
  }
  if (input.description.length > 2000) {
    throw new Error('Description too long (max 2000 chars)')
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const catalog = await fetchCatalog(input.scenarioType)
  if (catalog.length === 0) {
    throw new Error(`No active products for scenario type ${input.scenarioType}`)
  }
  const catalogText = formatCatalogForPrompt(catalog)

  const response = await callClaude(client, {
    scenarioType: input.scenarioType,
    description: input.description,
    catalogText,
  })

  // Find the tool_use block — single tool, single call
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
  )
  if (!toolUse) {
    throw new Error('No tool_use in response')
  }

  type ToolInput = {
    items?: { productId: string; quantity: number }[]
    customerInfo?: {
      name?: string
      siteAddress?: string
      annualConsumptionKwh?: number
    }
    roofType?: 'tuile' | 'ardoise' | 'bac_acier' | 'plat'
    roofSlope?: 'simple' | 'moyen' | 'complexe'
    notes?: string
    warnings?: string[]
  }
  const raw = toolUse.input as ToolInput

  // Validate every productId against the catalog. Drop unknowns (with a warning).
  const catalogById = new Map(catalog.map((p) => [p.id, p]))
  const items: AiParseItem[] = []
  const validationWarnings: string[] = []

  for (const item of raw.items ?? []) {
    const product = catalogById.get(item.productId)
    if (!product) {
      validationWarnings.push(
        `L'IA a proposé un produit inconnu (${item.productId}) — ignoré.`
      )
      continue
    }
    if (
      input.scenarioType === 'PV' &&
      product.category.startsWith('PAC_')
    ) {
      validationWarnings.push(
        `Produit PAC ${product.name} ignoré sur calculateur PV.`
      )
      continue
    }
    if (
      input.scenarioType === 'PAC' &&
      !product.category.startsWith('PAC_')
    ) {
      validationWarnings.push(
        `Produit PV ${product.name} ignoré sur calculateur PAC.`
      )
      continue
    }
    items.push({
      productId: product.id,
      productName: product.name,
      quantity: Math.max(1, Math.floor(item.quantity)),
      category: product.category,
    })
  }

  // Token accounting — usage breakdown when caching is in play
  const usage = response.usage as Anthropic.Usage & {
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  const tokensUsed =
    (usage.input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.output_tokens ?? 0)

  return {
    scenarioType: input.scenarioType,
    items,
    customerInfo: raw.customerInfo ?? {},
    roofType: input.scenarioType === 'PV' ? raw.roofType : undefined,
    roofSlope: input.scenarioType === 'PV' ? raw.roofSlope : undefined,
    notes: raw.notes,
    warnings: [...(raw.warnings ?? []), ...validationWarnings],
    tokensUsed,
  }
}
