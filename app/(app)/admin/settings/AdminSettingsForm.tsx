'use client'

import { useState } from 'react'

interface AdminSettingsFormProps {
  vatBasisPts: number
  minMarginBasisPts: number
  // PV coefficients
  pvAccessoriesBps: number
  pvFraisSuppBps: number
  pvTransportBps: number
  pvLaborPanelRappen: number
  pvLaborInverterRappen: number
  pvRaccordementMatRappen: number
  pvRaccordementLaborRappen: number
  pvPmFixedRappen: number
  pvAdminFixedRappen: number
  pvSalesOverheadBps: number
  pvProfitApproBps: number
  pvProfitConstrBps: number
  // Battery/EV coefficients
  batPmBps: number
  batAdminBps: number
  batProfitBps: number
  // Mounting system
  mountTuileRappen: number
  mountArdoiseRappen: number
  mountBacAcierRappen: number
  mountPlatRappen: number
  mountSlopeMediumBps: number
  mountSlopeSteepBps: number
}

export default function AdminSettingsForm({
  vatBasisPts: initialVat,
  minMarginBasisPts: initialMinMargin,
  pvAccessoriesBps: initialPvAcc,
  pvFraisSuppBps: initialPvFraisSupp,
  pvTransportBps: initialPvTransport,
  pvLaborPanelRappen: initialPvLaborPanel,
  pvLaborInverterRappen: initialPvLaborInverter,
  pvRaccordementMatRappen: initialPvRaccMat,
  pvRaccordementLaborRappen: initialPvRaccLabor,
  pvPmFixedRappen: initialPvPm,
  pvAdminFixedRappen: initialPvAdmin,
  pvSalesOverheadBps: initialPvOverhead,
  pvProfitApproBps: initialPvProfitAppro,
  pvProfitConstrBps: initialPvProfitConstr,
  batPmBps: initialBatPm,
  batAdminBps: initialBatAdmin,
  batProfitBps: initialBatProfit,
  mountTuileRappen: initialMountTuile,
  mountArdoiseRappen: initialMountArdoise,
  mountBacAcierRappen: initialMountBacAcier,
  mountPlatRappen: initialMountPlat,
  mountSlopeMediumBps: initialMountSlopeMedium,
  mountSlopeSteepBps: initialMountSlopeSteep,
}: AdminSettingsFormProps) {
  const [vatPct, setVatPct] = useState((initialVat / 100).toFixed(2))
  const [minMarginPct, setMinMarginPct] = useState((initialMinMargin / 100).toFixed(1))

  // PV system coefficients
  const [pvAccPct, setPvAccPct] = useState((initialPvAcc / 100).toFixed(2))
  const [pvFraisSuppPct, setPvFraisSuppPct] = useState((initialPvFraisSupp / 100).toFixed(2))
  const [pvTransportPct, setPvTransportPct] = useState((initialPvTransport / 100).toFixed(2))
  const [pvLaborPanelChf, setPvLaborPanelChf] = useState((initialPvLaborPanel / 100).toFixed(2))
  const [pvLaborInverterChf, setPvLaborInverterChf] = useState((initialPvLaborInverter / 100).toFixed(2))
  const [pvSalesOverheadPct, setPvSalesOverheadPct] = useState((initialPvOverhead / 100).toFixed(2))
  const [pvProfitApproPct, setPvProfitApproPct] = useState((initialPvProfitAppro / 100).toFixed(2))
  const [pvProfitConstrPct, setPvProfitConstrPct] = useState((initialPvProfitConstr / 100).toFixed(2))

  // PV fixed installation costs
  const [pvRaccMatChf, setPvRaccMatChf] = useState((initialPvRaccMat / 100).toFixed(2))
  const [pvRaccLaborChf, setPvRaccLaborChf] = useState((initialPvRaccLabor / 100).toFixed(2))
  const [pvPmChf, setPvPmChf] = useState((initialPvPm / 100).toFixed(2))
  const [pvAdminChf, setPvAdminChf] = useState((initialPvAdmin / 100).toFixed(2))

  // Battery/EV coefficients
  const [batPmPct, setBatPmPct] = useState((initialBatPm / 100).toFixed(2))
  const [batAdminPct, setBatAdminPct] = useState((initialBatAdmin / 100).toFixed(2))
  const [batProfitPct, setBatProfitPct] = useState((initialBatProfit / 100).toFixed(2))

  // Mounting system
  const [mountTuileChf, setMountTuileChf] = useState((initialMountTuile / 100).toFixed(0))
  const [mountArdoiseChf, setMountArdoiseChf] = useState((initialMountArdoise / 100).toFixed(0))
  const [mountBacAcierChf, setMountBacAcierChf] = useState((initialMountBacAcier / 100).toFixed(0))
  const [mountPlatChf, setMountPlatChf] = useState((initialMountPlat / 100).toFixed(0))
  const [mountSlopeMediumPct, setMountSlopeMediumPct] = useState((initialMountSlopeMedium / 100).toFixed(1))
  const [mountSlopeSteepPct, setMountSlopeSteepPct] = useState((initialMountSlopeSteep / 100).toFixed(1))

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vat_pct_basis_pts: Math.round(parseFloat(vatPct) * 100),
          min_margin_basis_pts: Math.round(parseFloat(minMarginPct) * 100),
          pv_accessories_bps: Math.round(parseFloat(pvAccPct) * 100),
          pv_frais_supp_bps: Math.round(parseFloat(pvFraisSuppPct) * 100),
          pv_transport_bps: Math.round(parseFloat(pvTransportPct) * 100),
          pv_labor_panel_rappen: Math.round(parseFloat(pvLaborPanelChf) * 100),
          pv_labor_inverter_rappen: Math.round(parseFloat(pvLaborInverterChf) * 100),
          pv_raccordement_mat_rappen: Math.round(parseFloat(pvRaccMatChf) * 100),
          pv_raccordement_labor_rappen: Math.round(parseFloat(pvRaccLaborChf) * 100),
          pv_pm_fixed_rappen: Math.round(parseFloat(pvPmChf) * 100),
          pv_admin_fixed_rappen: Math.round(parseFloat(pvAdminChf) * 100),
          pv_sales_overhead_bps: Math.round(parseFloat(pvSalesOverheadPct) * 100),
          pv_profit_appro_bps: Math.round(parseFloat(pvProfitApproPct) * 100),
          pv_profit_constr_bps: Math.round(parseFloat(pvProfitConstrPct) * 100),
          bat_pm_bps: Math.round(parseFloat(batPmPct) * 100),
          bat_admin_bps: Math.round(parseFloat(batAdminPct) * 100),
          bat_profit_bps: Math.round(parseFloat(batProfitPct) * 100),
          mount_tuile_rappen: Math.round(parseFloat(mountTuileChf) * 100),
          mount_ardoise_rappen: Math.round(parseFloat(mountArdoiseChf) * 100),
          mount_bac_acier_rappen: Math.round(parseFloat(mountBacAcierChf) * 100),
          mount_plat_rappen: Math.round(parseFloat(mountPlatChf) * 100),
          mount_slope_medium_bps: Math.round(parseFloat(mountSlopeMediumPct) * 100),
          mount_slope_steep_bps: Math.round(parseFloat(mountSlopeSteepPct) * 100),
        }),
      })

      if (!res.ok) {
        setError('Erreur lors de la sauvegarde des paramètres.')
        return
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* ── General ── */}
      <div className="card-padded space-y-6">
        <div className="section-title">Général</div>

        <div>
          <label className="label">Taux de TVA (%)</label>
          <div className="relative w-40">
            <input
              type="number"
              className="input"
              value={vatPct}
              min={0}
              max={30}
              step={0.1}
              onChange={(e) => setVatPct(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
          </div>
          <p className="field-hint">Taux suisse actuel: 8.1%. Utilisé dans toutes les nouvelles offres.</p>
        </div>

        <div>
          <label className="label">Marge minimum (%)</label>
          <div className="relative w-40">
            <input
              type="number"
              className="input"
              value={minMarginPct}
              min={0}
              max={99}
              step={0.5}
              onChange={(e) => setMinMarginPct(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
          </div>
          <p className="field-hint">Seuil de contrôle minimum (rarement déclenché avec le modèle de coefficients).</p>
        </div>
      </div>

      {/* ── Coefficients Système Solaire ── */}
      <div className="card-padded space-y-6">
        <div className="section-title">Coefficients Système Solaire (PV)</div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Accessoires matériel (%)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={pvAccPct}
                min={0}
                max={50}
                step={0.1}
                onChange={(e) => setPvAccPct(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
            </div>
          </div>

          <div>
            <label className="label">Frais supplémentaires (%)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={pvFraisSuppPct}
                min={0}
                max={50}
                step={0.1}
                onChange={(e) => setPvFraisSuppPct(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
            </div>
          </div>

          <div>
            <label className="label">Transport (%)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={pvTransportPct}
                min={0}
                max={50}
                step={0.1}
                onChange={(e) => setPvTransportPct(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
            </div>
          </div>

          <div>
            <label className="label">Frais généraux Sales (%)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={pvSalesOverheadPct}
                min={0}
                max={50}
                step={0.1}
                onChange={(e) => setPvSalesOverheadPct(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
            </div>
          </div>

          <div>
            <label className="label">Profit Approvision (%)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={pvProfitApproPct}
                min={0}
                max={100}
                step={0.1}
                onChange={(e) => setPvProfitApproPct(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
            </div>
          </div>

          <div>
            <label className="label">Profit Construction (%)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={pvProfitConstrPct}
                min={0}
                max={100}
                step={0.1}
                onChange={(e) => setPvProfitConstrPct(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
            </div>
          </div>

          <div>
            <label className="label">Main-d&apos;œuvre panneaux (CHF/panneau)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={pvLaborPanelChf}
                min={0}
                step={1}
                onChange={(e) => setPvLaborPanelChf(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">CHF</span>
            </div>
          </div>

          <div>
            <label className="label">Main-d&apos;œuvre onduleur (CHF/onduleur)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={pvLaborInverterChf}
                min={0}
                step={1}
                onChange={(e) => setPvLaborInverterChf(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">CHF</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Coûts Fixes d'Installation ── */}
      <div className="card-padded space-y-6">
        <div className="section-title">Coûts Fixes d&apos;Installation</div>
        <p className="field-hint -mt-2">Ces coûts sont automatiquement ajoutés lorsque des produits PV sont présents.</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Raccordement AC — matériel (CHF)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={pvRaccMatChf}
                min={0}
                step={1}
                onChange={(e) => setPvRaccMatChf(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">CHF</span>
            </div>
          </div>

          <div>
            <label className="label">Raccordement AC — main-d&apos;œuvre (CHF)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={pvRaccLaborChf}
                min={0}
                step={1}
                onChange={(e) => setPvRaccLaborChf(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">CHF</span>
            </div>
          </div>

          <div>
            <label className="label">Project Management (CHF fixe)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={pvPmChf}
                min={0}
                step={1}
                onChange={(e) => setPvPmChf(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">CHF</span>
            </div>
          </div>

          <div>
            <label className="label">Frais administratifs (CHF fixe)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={pvAdminChf}
                min={0}
                step={1}
                onChange={(e) => setPvAdminChf(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">CHF</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Système de Montage ── */}
      <div className="card-padded space-y-6">
        <div className="section-title">Système de Montage</div>
        <p className="field-hint -mt-2">Coût matériel par panneau (CHF, avant chaîne d&apos;approvisionnement)</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Coût montage tuile (CHF/panneau)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={mountTuileChf}
                min={0}
                step={1}
                onChange={(e) => setMountTuileChf(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">CHF</span>
            </div>
          </div>

          <div>
            <label className="label">Coût montage ardoise (CHF/panneau)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={mountArdoiseChf}
                min={0}
                step={1}
                onChange={(e) => setMountArdoiseChf(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">CHF</span>
            </div>
          </div>

          <div>
            <label className="label">Coût montage bac acier/métal (CHF/panneau)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={mountBacAcierChf}
                min={0}
                step={1}
                onChange={(e) => setMountBacAcierChf(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">CHF</span>
            </div>
          </div>

          <div>
            <label className="label">Coût montage toiture plate (CHF/panneau)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={mountPlatChf}
                min={0}
                step={1}
                onChange={(e) => setMountPlatChf(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">CHF</span>
            </div>
          </div>

          <div>
            <label className="label">Surcoût pente moyenne 30-45° (%)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={mountSlopeMediumPct}
                min={0}
                max={100}
                step={0.1}
                onChange={(e) => setMountSlopeMediumPct(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
            </div>
          </div>

          <div>
            <label className="label">Surcoût pente complexe &gt;45° (%)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={mountSlopeSteepPct}
                min={0}
                max={100}
                step={0.1}
                onChange={(e) => setMountSlopeSteepPct(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Coefficients Batteries & Bornes de Recharge ── */}
      <div className="card-padded space-y-6">
        <div className="section-title">Coefficients Batteries &amp; Bornes de Recharge</div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Project Management (%)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={batPmPct}
                min={0}
                max={50}
                step={0.1}
                onChange={(e) => setBatPmPct(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
            </div>
          </div>

          <div>
            <label className="label">Frais administratifs (%)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={batAdminPct}
                min={0}
                max={50}
                step={0.1}
                onChange={(e) => setBatAdminPct(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
            </div>
          </div>

          <div>
            <label className="label">Profit (%)</label>
            <div className="relative">
              <input
                type="number"
                className="input"
                value={batProfitPct}
                min={0}
                max={100}
                step={0.1}
                onChange={(e) => setBatProfitPct(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert-error text-sm">{error}</div>}
      {saved && <div className="alert-success text-sm">Paramètres enregistrés.</div>}

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
      </button>
    </form>
  )
}
