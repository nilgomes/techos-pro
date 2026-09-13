import React, { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle,
  CreditCard,
  Crown,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import { supabase } from './lib/supabaseClient'

const money = value =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })

const appPlan = value => {
  const plan = String(value || '').toLowerCase()

  return plan === 'pro' || plan === 'pro_sandbox'
    ? 'pro'
    : 'starter'
}

const sandboxBilling =
  window.location.hostname.includes('onrender.com') ||
  window.location.hostname === 'teste.automatizeos.com.br'

const billingCodeFor = planKey =>
  sandboxBilling
    ? `${planKey}_sandbox`
    : planKey

const planDefinitions = {
  starter: {
    title: 'Starter',
    subtitle: 'Organize sua assistência',
    highlight: false,
    features: [
      'Ordens de Serviço completas',
      'Cadastro de clientes',
      'Catálogo de serviços',
      'Fotos na OS',
      'Impressão da OS',
      'Equipe e acessos',
      'Dashboard operacional'
    ],
    unavailable: [
      'Estoque e peças',
      'Caixa e fluxo financeiro',
      'Lucro, margem e relatórios'
    ]
  },

  pro: {
    title: 'Pro',
    subtitle: 'Gerencie toda a operação',
    highlight: true,
    features: [
      'Tudo do Plano Starter',
      'Controle de estoque',
      'Peças vinculadas às OS',
      'Custo e preço das peças',
      'Caixa e movimentações',
      'Controle financeiro',
      'Lucro e margem bruta',
      'Relatórios financeiros',
      'Dashboard gerencial'
    ],
    unavailable: []
  }
}

export default function PlansView({
  company,
  onRefresh
}) {
  const [billingPlans, setBillingPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [billingBusy, setBillingBusy] = useState('')
  const [billingError, setBillingError] = useState('')
  const [message, setMessage] = useState('')

  const currentPlan = appPlan(company?.plan)

  const callbackStatus = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('billing') || ''
  }, [])

  useEffect(() => {
    loadPlans()

    if (!callbackStatus) return

    const url = new URL(window.location.href)
    url.searchParams.delete('billing')

    window.history.replaceState(
      {},
      document.title,
      `${url.pathname}${url.search}${url.hash}`
    )

    const timers = []

    if (callbackStatus === 'success') {
      setMessage(
        'Pagamento concluído no Asaas. Atualizando seu plano automaticamente...'
      )

      timers.push(
        setTimeout(() => onRefresh?.(), 1500),
        setTimeout(() => onRefresh?.(), 4000)
      )
    } else if (callbackStatus === 'cancelled') {
      setBillingError(
        'O checkout foi cancelado antes da conclusão.'
      )
    } else if (callbackStatus === 'expired') {
      setBillingError(
        'O checkout expirou. Gere uma nova cobrança.'
      )
    }

    return () =>
      timers.forEach(timer => clearTimeout(timer))
  }, [callbackStatus])

  async function loadPlans() {
    setLoading(true)

    const { data, error } = await supabase
      .from('billing_plans')
      .select(
        'code,name,amount,regular_amount,coverage_days,is_active'
      )
      .in(
        'code',
        [
          'starter',
          'pro',
          'starter_sandbox',
          'pro_sandbox'
        ]
      )
      .eq('is_active', true)

    if (error) {
      console.error(error)

      setBillingError(
        'Não foi possível consultar os preços dos planos.'
      )

      setBillingPlans([])
    } else {
      setBillingPlans(data || [])
    }

    setLoading(false)
  }

  function planFor(code) {
    return billingPlans.find(
      plan => plan.code === code
    ) || null
  }

  function priceFor(code) {
    return Number(
      planFor(code)?.amount || 0
    )
  }

  async function openCheckout(planCode, mode) {
    const key = `${planCode}:${mode}`

    setBillingBusy(key)
    setBillingError('')
    setMessage('')

    try {
      const {
        data: sessionData,
        error: sessionError
      } = await supabase.auth.getSession()

      if (
        sessionError ||
        !sessionData?.session?.access_token
      ) {
        throw new Error(
          'Sua sessão expirou. Saia e entre novamente no Automatize OS.'
        )
      }

      const supabaseUrl =
        import.meta.env.VITE_SUPABASE_URL

      const publishableKey =
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

      const response = await fetch(
        `${supabaseUrl}/functions/v1/asaas-create-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:
              `Bearer ${sessionData.session.access_token}`,
            apikey: publishableKey
          },
          body: JSON.stringify({
            mode,
            planCode
          })
        }
      )

      let data = {}

      try {
        data = await response.json()
      } catch {
        data = {}
      }

      if (!response.ok) {
        const detail = [
          data?.error,
          data?.details
        ]
          .filter(Boolean)
          .join(' — ')

        throw new Error(
          detail ||
          `Falha ao iniciar pagamento (HTTP ${response.status}).`
        )
      }

      if (!data?.url) {
        throw new Error(
          'O pagamento foi criado, mas o link do checkout não foi retornado.'
        )
      }

      window.location.assign(data.url)

    } catch (error) {
      console.error(error)

      setBillingError(
        error.message ||
        'Não foi possível iniciar o pagamento.'
      )
    } finally {
      setBillingBusy('')
    }
  }

  async function refreshAccess() {
    setMessage('Atualizando plano e acesso...')

    await onRefresh?.()

    setMessage('Acesso atualizado.')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">

        <div>
          <p className="text-sm text-slate-500">
            Assinatura
          </p>

          <h1 className="text-2xl font-bold">
            Planos Automatize OS
          </h1>

          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Escolha o nível de recursos da sua assistência
            e a forma de pagamento mensal.
          </p>
        </div>

        <div className="px-4 py-3 bg-slate-900 text-white rounded-2xl">
          <p className="text-xs text-slate-300">
            Plano atual
          </p>

          <p className="font-bold text-lg capitalize">
            {currentPlan}
          </p>
        </div>

      </div>

      {sandboxBilling ? (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
          <ShieldCheck
            className="text-blue-600 shrink-0"
            size={22}
          />

          <div>
            <p className="font-bold text-blue-900">
              Homologação — Asaas Sandbox
            </p>

            <p className="text-sm text-blue-700 mt-1">
              Os preços comerciais já estão definidos. Durante a homologação,
              os botões abrem checkouts Sandbox de R$ 5,00.
              Nenhum dinheiro real será movimentado.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-3">
          <ShieldCheck
            className="text-emerald-600 shrink-0"
            size={22}
          />

          <div>
            <p className="font-bold text-emerald-900">
              Ambiente de produção — Asaas
            </p>

            <p className="text-sm text-emerald-700 mt-1">
              Os valores abaixo são os valores reais dos planos.
              PIX e cartão serão processados no ambiente de produção do Asaas.
            </p>
          </div>
        </div>
      )}

      {billingError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4">
          {billingError}
        </div>
      )}

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl p-4">
          {message}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">

        {Object.entries(
          planDefinitions
        ).map(([planKey, plan]) => {

          const billingCode =
            billingCodeFor(planKey)

          const checkoutAmount =
            priceFor(billingCode)

          const commercialPlan =
            planFor(planKey)

          const launchAmount =
            Number(commercialPlan?.amount || 0)

          const regularAmount =
            Number(
              commercialPlan?.regular_amount ||
              launchAmount ||
              0
            )

          const isCurrent =
            currentPlan === planKey

          const pixBusy =
            billingBusy ===
            `${billingCode}:pix`

          const cardBusy =
            billingBusy ===
            `${billingCode}:card`

          return (
            <div
              key={planKey}
              className={
                plan.highlight
                  ? 'surface p-6 border-2 border-blue-500 relative overflow-hidden'
                  : 'surface p-6 border-2 border-transparent relative overflow-hidden'
              }
            >

              {plan.highlight && (
                <div className="absolute right-0 top-0 bg-blue-600 text-white px-4 py-1.5 text-xs font-bold rounded-bl-xl flex items-center gap-1">
                  <Sparkles size={14}/>
                  MAIS ESCOLHIDO
                </div>
              )}

              <div className="flex items-start justify-between gap-3 pr-2">

                <div>
                  <div className="flex items-center gap-2">

                    {planKey === 'pro' ? (
                      <Crown
                        size={22}
                        className="text-blue-600"
                      />
                    ) : (
                      <CheckCircle
                        size={22}
                        className="text-emerald-600"
                      />
                    )}

                    <h2 className="text-2xl font-bold">
                      {plan.title}
                    </h2>

                  </div>

                  <p className="text-slate-500 mt-1">
                    {plan.subtitle}
                  </p>
                </div>

                {isCurrent && (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold whitespace-nowrap">
                    PLANO ATUAL
                  </span>
                )}

              </div>

              <div className="mt-5">

                <p className="text-xs uppercase tracking-wide text-emerald-600 font-bold">
                  Preço especial de lançamento
                </p>

                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-slate-400 line-through">
                    {loading
                      ? '...'
                      : money(regularAmount)}
                  </span>

                  <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full font-bold">
                    LANÇAMENTO
                  </span>
                </div>

                <div className="flex items-end gap-2 mt-1">

                  <p className="text-3xl font-bold">
                    {loading
                      ? '...'
                      : money(launchAmount)}
                  </p>

                  <span className="text-slate-500 mb-1">
                    / mês
                  </span>

                </div>

                {sandboxBilling && (
                  <p className="text-xs text-blue-600 mt-2 font-semibold">
                    Sandbox: checkout de teste por {loading ? '...' : money(checkoutAmount)}
                  </p>
                )}

              </div>

              <div className="mt-6 space-y-2">

                {plan.features.map(
                  feature => (
                    <div
                      key={feature}
                      className="flex gap-2 text-sm"
                    >
                      <CheckCircle
                        size={17}
                        className="text-emerald-600 shrink-0 mt-0.5"
                      />

                      <span>
                        {feature}
                      </span>
                    </div>
                  )
                )}

                {plan.unavailable.map(
                  feature => (
                    <div
                      key={feature}
                      className="flex gap-2 text-sm text-slate-400"
                    >
                      <span className="w-[17px] text-center shrink-0">
                        —
                      </span>

                      <span>
                        {feature} — disponível no Pro
                      </span>
                    </div>
                  )
                )}

              </div>

              <div className="grid sm:grid-cols-2 gap-3 mt-7">

                <button
                  type="button"
                  disabled={
                    Boolean(billingBusy) ||
                    loading ||
                    !checkoutAmount
                  }
                  onClick={() =>
                    openCheckout(
                      billingCode,
                      'pix'
                    )
                  }
                  className="py-3.5 px-3 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <QrCode size={18}/>

                  {pixBusy
                    ? 'Abrindo...'
                    : 'PIX mensal'}
                </button>

                <button
                  type="button"
                  disabled={
                    Boolean(billingBusy) ||
                    loading ||
                    !checkoutAmount
                  }
                  onClick={() =>
                    openCheckout(
                      billingCode,
                      'card'
                    )
                  }
                  className="py-3.5 px-3 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CreditCard size={18}/>

                  {cardBusy
                    ? 'Abrindo...'
                    : 'Cartão recorrente'}
                </button>

              </div>

              <div className="grid sm:grid-cols-2 gap-2 mt-3 text-xs text-slate-500">

                <p>
                  <b>PIX:</b> libera 30 dias
                  após cada pagamento.
                </p>

                <p>
                  <b>Cartão:</b> renovação
                  mensal automática.
                </p>

              </div>

            </div>
          )
        })}

      </div>

      <button
        type="button"
        onClick={refreshAccess}
        className="w-full sm:w-auto px-5 py-3 border rounded-xl bg-white font-semibold flex items-center justify-center gap-2"
      >
        <RefreshCw size={18}/>
        Atualizar acesso
      </button>

    </div>
  )
}
