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
// Higher token budget needed: 3 proposals × ~30 line items + rationales.
const MAX_TOKENS = 3072

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

export type ProposalTier = 'essentiel' | 'recommande' | 'premium'

export interface AiProposal {
  /** Which tier this proposal represents (lower = cheaper, basic) */
  tier: ProposalTier
  /** Localized label shown on the dialog ("Essentiel", "Recommandé", "Premium") */
  label: string
  /** One-sentence rationale: why this configuration for this customer */
  rationale: string
  /** Catalog items for this tier */
  items: AiParseItem[]
  /** Per-proposal warnings (e.g. "no battery match for premium tier") */
  warnings: string[]
}

export interface AiParseResult {
  scenarioType: 'PV' | 'PAC'
  /** Up to 3 tier-labeled proposals. Single-element array allowed when the
   *  prompt is too narrow for 3 distinct tiers. */
  proposals: AiProposal[]
  /** Shared across all proposals — customer info doesn't change by tier */
  customerInfo: {
    name?: string
    siteAddress?: string
    annualConsumptionKwh?: number
  }
  /** PV-only — shared across proposals (roof doesn't change by tier) */
  roofType?: 'tuile' | 'ardoise' | 'bac_acier' | 'plat'
  /** PV-only — shared across proposals */
  roofSlope?: 'simple' | 'moyen' | 'complexe'
  /** Free-text notes the AI thought relevant but couldn't structure */
  notes?: string
  /** Global warnings — not specific to one proposal */
  globalWarnings: string[]
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

const SYSTEM_INTRO = `You are an assistant for a Swiss solar / heat-pump sales rep. The rep describes a customer project in free text (French or German); you generate UP TO THREE TIERED PROPOSALS so the rep can present options to the customer.

The three tiers (always use these exact tier IDs and French labels):
  - tier: "essentiel"   label: "Essentiel"    — cheapest viable. Smallest acceptable system, basic panels, no battery, no extras. The "minimum to deliver value" tier.
  - tier: "recommande"  label: "Recommandé"   — balanced default. Mid-range panels, sized to the customer's stated needs. Battery only if mentioned. Best price/performance.
  - tier: "premium"     label: "Premium"      — top-end. Highest-rated panels, larger system, battery + EV charger if applicable, premium accessories.

If the customer's stated needs only fit one tier (e.g. they said "give me a 5 kWp system, no battery"), return a single proposal in the "recommande" slot rather than padding three.

Each proposal needs:
  - tier (one of the three above)
  - label (the French label shown to the rep)
  - rationale: ONE short French sentence explaining why this tier fits ("Système le plus abordable", "Système équilibré pour 4500 kWh/an", "Maximisation autoconsommation + recharge VE").
  - items: array of {productId, quantity}. Use ONLY catalog IDs. Never invent.
  - warnings: per-tier issues (e.g. "Pas de batterie >7 kWh disponible au catalogue").

PV sizing rules:
  - For a 10 kWp PV system: panels totaling ~10000 Wp (typically 20-22 panels of 460-500 Wp). Match inverter kW rating to panel total.
  - "essentiel": 70-80% of stated kWp, cheapest panels in catalog
  - "recommande": exactly the stated kWp, mid-priced panels (450-485 Wp typical)
  - "premium": 110-120% of stated kWp, highest-Wp panels, add battery + EV charger
  - Don't include products from PAC categories (PAC_*) on a PV scenario.

PAC sizing rules:
  - All proposals: ONE PAC_MACHINE (heat pump unit). Different brands across tiers if the catalog allows.
  - "essentiel": cheapest machine matching the stated capacity, minimal accessories
  - "recommande": balanced machine, full standard install (machine + accessories + electricite + montage + admin)
  - "premium": top-tier brand, premium accessories, complete install
  - Don't include products from PV categories (PANEL/INVERTER/...) on a PAC scenario.

Customer info + roof attributes are SHARED across the three proposals (same site, same customer, same roof — only the equipment varies).

If the rep mentions kWh consumption: include in customerInfo.annualConsumptionKwh.
For PV roofType: tuile / ardoise / bac_acier / plat. For roofSlope: simple (≤30°) / moyen / complexe.

Always call the propose_three_quote_tiers tool.`

interface CallInput {
  scenarioType: 'PV' | 'PAC'
  description: string
  catalogText: string
}

async function callClaude(client: Anthropic, input: CallInput) {
  const tool: Anthropic.Tool = {
    name: 'propose_three_quote_tiers',
    description:
      'Propose up to three tier-labeled quote variants (Essentiel / Recommandé / Premium) based on the rep\'s description. Customer info and roof attributes are shared across tiers.',
    input_schema: {
      type: 'object',
      properties: {
        proposals: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          description:
            'One to three tier-differentiated proposals. Always include "recommande" if you only return one. When returning three, order them by tier: essentiel, recommande, premium.',
          items: {
            type: 'object',
            properties: {
              tier: {
                type: 'string',
                enum: ['essentiel', 'recommande', 'premium'],
              },
              label: {
                type: 'string',
                description: 'French display label: "Essentiel", "Recommandé", or "Premium"',
              },
              rationale: {
                type: 'string',
                description:
                  'One short French sentence explaining why this tier fits this customer.',
              },
              items: {
                type: 'array',
                description: 'Catalog items for this tier.',
                items: {
                  type: 'object',
                  properties: {
                    productId: {
                      type: 'string',
                      description: 'Catalog product ID (cuid).',
                    },
                    quantity: {
                      type: 'integer',
                      minimum: 1,
                    },
                  },
                  required: ['productId', 'quantity'],
                },
              },
              warnings: {
                type: 'array',
                items: { type: 'string' },
                description: 'Per-tier issues to surface to the rep.',
              },
            },
            required: ['tier', 'label', 'rationale', 'items', 'warnings'],
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
        notes: {
          type: 'string',
          description: 'Free-text notes for the rep (not tied to any single tier).',
        },
        globalWarnings: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Warnings about the prompt or extraction itself — not tier-specific.',
        },
      },
      required: ['proposals', 'globalWarnings'],
    },
  }

  return client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'propose_three_quote_tiers' },
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
    proposals?: {
      tier: ProposalTier
      label: string
      rationale: string
      items: { productId: string; quantity: number }[]
      warnings?: string[]
    }[]
    customerInfo?: {
      name?: string
      siteAddress?: string
      annualConsumptionKwh?: number
    }
    roofType?: 'tuile' | 'ardoise' | 'bac_acier' | 'plat'
    roofSlope?: 'simple' | 'moyen' | 'complexe'
    notes?: string
    globalWarnings?: string[]
  }
  const raw = toolUse.input as ToolInput

  // Validate every productId in every proposal against the catalog.
  const catalogById = new Map(catalog.map((p) => [p.id, p]))
  const globalWarnings: string[] = [...(raw.globalWarnings ?? [])]

  const proposals: AiProposal[] = (raw.proposals ?? []).map((p) => {
    const validatedItems: AiParseItem[] = []
    const proposalWarnings: string[] = [...(p.warnings ?? [])]

    for (const item of p.items ?? []) {
      const product = catalogById.get(item.productId)
      if (!product) {
        proposalWarnings.push(
          `Produit inconnu (${item.productId}) — ignoré.`
        )
        continue
      }
      if (input.scenarioType === 'PV' && product.category.startsWith('PAC_')) {
        proposalWarnings.push(
          `Produit PAC ${product.name} ignoré sur calculateur PV.`
        )
        continue
      }
      if (input.scenarioType === 'PAC' && !product.category.startsWith('PAC_')) {
        proposalWarnings.push(
          `Produit PV ${product.name} ignoré sur calculateur PAC.`
        )
        continue
      }
      validatedItems.push({
        productId: product.id,
        productName: product.name,
        quantity: Math.max(1, Math.floor(item.quantity)),
        category: product.category,
      })
    }

    return {
      tier: p.tier,
      label: p.label,
      rationale: p.rationale,
      items: validatedItems,
      warnings: proposalWarnings,
    }
  })

  // Sort tier order: essentiel → recommande → premium
  const tierOrder: Record<ProposalTier, number> = {
    essentiel: 0,
    recommande: 1,
    premium: 2,
  }
  proposals.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier])

  if (proposals.length === 0) {
    globalWarnings.push("Aucune proposition n'a pu être générée — réessayez avec plus de détails.")
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
    proposals,
    customerInfo: raw.customerInfo ?? {},
    roofType: input.scenarioType === 'PV' ? raw.roofType : undefined,
    roofSlope: input.scenarioType === 'PV' ? raw.roofSlope : undefined,
    notes: raw.notes,
    globalWarnings,
    tokensUsed,
  }
}
