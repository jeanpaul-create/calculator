import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/auth'
import { z } from 'zod'

const ALL_SETTING_KEYS = [
  'vat_pct_basis_pts',
  'min_margin_basis_pts',
  'pv_accessories_bps',
  'pv_frais_supp_bps',
  'pv_transport_bps',
  'pv_labor_panel_rappen',
  'pv_labor_inverter_rappen',
  'pv_raccordement_mat_rappen',
  'pv_raccordement_labor_rappen',
  'pv_pm_fixed_rappen',
  'pv_admin_fixed_rappen',
  'pv_sales_overhead_bps',
  'pv_profit_appro_bps',
  'pv_profit_constr_bps',
  'bat_pm_bps',
  'bat_admin_bps',
  'bat_profit_bps',
  'mount_tuile_rappen',
  'mount_ardoise_rappen',
  'mount_bac_acier_rappen',
  'mount_plat_rappen',
  'mount_slope_medium_bps',
  'mount_slope_steep_bps',
]

const UpdateSettingsSchema = z.object({
  vat_pct_basis_pts: z.number().int().min(0).max(3000).optional(),
  min_margin_basis_pts: z.number().int().min(0).max(9999).optional(),
  pv_accessories_bps: z.number().int().min(0).optional(),
  pv_frais_supp_bps: z.number().int().min(0).optional(),
  pv_transport_bps: z.number().int().min(0).optional(),
  pv_labor_panel_rappen: z.number().int().min(0).optional(),
  pv_labor_inverter_rappen: z.number().int().min(0).optional(),
  pv_raccordement_mat_rappen: z.number().int().min(0).optional(),
  pv_raccordement_labor_rappen: z.number().int().min(0).optional(),
  pv_pm_fixed_rappen: z.number().int().min(0).optional(),
  pv_admin_fixed_rappen: z.number().int().min(0).optional(),
  pv_sales_overhead_bps: z.number().int().min(0).max(9999).optional(),
  pv_profit_appro_bps: z.number().int().min(0).optional(),
  pv_profit_constr_bps: z.number().int().min(0).optional(),
  bat_pm_bps: z.number().int().min(0).optional(),
  bat_admin_bps: z.number().int().min(0).optional(),
  bat_profit_bps: z.number().int().min(0).optional(),
  mount_tuile_rappen: z.number().int().min(0).optional(),
  mount_ardoise_rappen: z.number().int().min(0).optional(),
  mount_bac_acier_rappen: z.number().int().min(0).optional(),
  mount_plat_rappen: z.number().int().min(0).optional(),
  mount_slope_medium_bps: z.number().int().min(0).max(9999).optional(),
  mount_slope_steep_bps: z.number().int().min(0).max(9999).optional(),
})

// GET /api/settings — returns all settings (any authenticated user can read)
export async function GET(_req: NextRequest) {
  try {
    await requireAuth()

    const settings = await prisma.setting.findMany({
      where: { key: { in: ALL_SETTING_KEYS } },
    })

    const result = Object.fromEntries(
      settings.map((s) => [s.key, parseInt(s.value)])
    )

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT /api/settings — admin only
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()

    const body = await req.json()
    const data = UpdateSettingsSchema.parse(body)

    await Promise.all(
      Object.entries(data)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) =>
          prisma.setting.upsert({
            where: { key },
            update: { value: String(value) },
            create: { key, value: String(value) },
          })
        )
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
