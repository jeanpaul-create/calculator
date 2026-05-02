'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/cn'

type Lang = 'fr' | 'de'

const T = {
  fr: {
    headline: 'Calculateur solaire & PAC',
    subheadline: 'Outil de vente I.ON Energy',
    cardTitle: 'Connexion',
    email: 'E-mail',
    emailPlaceholder: 'nom@entreprise.ch',
    password: 'Mot de passe',
    submit: 'Se connecter',
    submitting: 'Connexion…',
    invalid: 'E-mail ou mot de passe invalide.',
    footer: 'Tarifs ElCom · Production PVGIS · Subvention Pronovo',
  },
  de: {
    headline: 'Solar- & WP-Rechner',
    subheadline: 'I.ON Energy Vertriebstool',
    cardTitle: 'Anmelden',
    email: 'E-Mail',
    emailPlaceholder: 'name@firma.ch',
    password: 'Passwort',
    submit: 'Anmelden',
    submitting: 'Anmeldung…',
    invalid: 'E-Mail oder Passwort ungültig.',
    footer: 'ElCom-Tarife · PVGIS-Erträge · Pronovo-Förderung',
  },
} as const

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/calculator'

  // Language: default FR, persist via localStorage so the choice survives reloads.
  const [lang, setLang] = useState<Lang>('fr')

  useEffect(() => {
    const stored = (typeof window !== 'undefined'
      ? window.localStorage.getItem('i18n.lang')
      : null) as Lang | null
    if (stored === 'fr' || stored === 'de') setLang(stored)
  }, [])

  const updateLang = (next: Lang) => {
    setLang(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('i18n.lang', next)
    }
  }

  const t = T[lang]

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(t.invalid)
        return
      }

      router.push(callbackUrl)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Language picker — top right corner */}
        <div className="flex justify-end mb-6">
          <div className="inline-flex bg-white rounded border border-gray-200 p-0.5">
            <button
              type="button"
              onClick={() => updateLang('fr')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                lang === 'fr'
                  ? 'bg-red-50 text-red-600'
                  : 'text-gray-500 hover:text-gray-900'
              )}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => updateLang('de')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                lang === 'de'
                  ? 'bg-red-50 text-red-600'
                  : 'text-gray-500 hover:text-gray-900'
              )}
            >
              DE
            </button>
          </div>
        </div>

        {/* Logo + brand statement */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <Image
              src="/logo.png"
              alt="I.ON Energy"
              width={140}
              height={42}
              style={{ objectFit: 'contain' }}
            />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            {t.headline}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{t.subheadline}</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          {/* Thin red rule at the top */}
          <div className="-mt-6 -mx-6 mb-5 h-0.5 bg-red-500 rounded-t-lg" />

          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
            {t.cardTitle}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">{t.email}</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                required
                autoFocus
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">{t.password}</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? t.submitting : t.submit}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-center text-gray-400 mt-6 tracking-wide">
          {t.footer}
        </p>
      </div>
    </div>
  )
}
