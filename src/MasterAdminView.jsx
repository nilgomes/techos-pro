import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import {
  Search,
  Building2,
  Users,
  Clock,
  CheckCircle,
  Ban,
  Save,
  ExternalLink,
  MessageCircle,
  RefreshCw
} from 'lucide-react'

const dateBR = value =>
  value ? new Date(value).toLocaleDateString('pt-BR') : '-'

const toDateInput = value =>
  value ? new Date(value).toISOString().slice(0, 10) : ''

const toTimestamp = value =>
  value ? `${value}T23:59:59-03:00` : null

const statusLabels = {
  trial: 'Em teste',
  active: 'Ativo',
  past_due: 'Pagamento pendente',
  expired: 'Expirado',
  cancelled: 'Cancelado',
  suspended: 'Bloqueado'
}

export default function MasterAdminView({
  onEnterSupport
}) {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [users, setUsers] = useState([])
  const [audit, setAudit] = useState([])
  const [payments, setPayments] = useState([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'pix',
    reference: '',
    days: 30
  })

  const [form, setForm] = useState({
    plan: 'starter',
    max_users: 3,
    subscription_status: 'trial',
    trial_ends_at: '',
    subscription_ends_at: '',
    billing_contact_name: '',
    billing_email: '',
    billing_phone: '',
    admin_notes: ''
  })

  useEffect(() => {
    loadCompanies()
  }, [])

  async function loadCompanies() {
    setLoading(true)

    const { data, error } =
      await supabase.rpc('admin_list_companies')

    if (error) {
      alert(error.message)
      setCompanies([])
    } else {
      setCompanies(data || [])
    }

    setLoading(false)
  }

  async function openCompany(company) {
    setSelected(company)

    setForm({
      plan: company.plan || 'starter',
      max_users: Number(company.max_users || 1),
      subscription_status:
        company.subscription_status || 'trial',
      trial_ends_at:
        toDateInput(company.trial_ends_at),
      subscription_ends_at:
        toDateInput(company.subscription_ends_at),
      billing_contact_name:
        company.billing_contact_name || '',
      billing_email:
        company.billing_email || '',
      billing_phone:
        company.billing_phone || '',
      admin_notes:
        company.admin_notes || ''
    })

    const [u, a, pay] = await Promise.all([
      supabase.rpc(
        'admin_list_company_users',
        { p_company_id: company.company_id }
      ),
      supabase.rpc(
        'admin_list_audit',
        { p_company_id: company.company_id }
      ),
      supabase.rpc(
        'admin_list_subscription_payments',
        { p_company_id: company.company_id }
      )
    ])

    if (u.error) alert(u.error.message)
    if (a.error) alert(a.error.message)
    if (pay.error) alert(pay.error.message)

    setUsers(u.data || [])
    setAudit(a.data || [])
    setPayments(pay.data || [])
  }

  async function saveCompany(
    overrides = {}
  ) {
    if (!selected) return false

    setSaving(true)
    setMessage('')

    const next = {
      ...form,
      ...overrides
    }

    const { error } = await supabase.rpc(
      'admin_update_company',
      {
        p_company_id: selected.company_id,
        p_plan: next.plan,
        p_max_users:
          Number(next.max_users || 1),
        p_subscription_status:
          next.subscription_status,
        p_trial_ends_at:
          toTimestamp(next.trial_ends_at),
        p_subscription_ends_at:
          toTimestamp(next.subscription_ends_at),
        p_billing_contact_name:
          next.billing_contact_name || null,
        p_billing_email:
          next.billing_email || null,
        p_billing_phone:
          next.billing_phone || null,
        p_admin_notes:
          next.admin_notes || null
      }
    )

    setSaving(false)

    if (error) {
      alert(error.message)
      return false
    }

    setForm(next)
    setMessage('Alterações salvas com sucesso.')

    await loadCompanies()

    const { data: updated } =
      await supabase.rpc(
        'admin_list_companies'
      )

    const refreshed =
      (updated || []).find(
        item =>
          item.company_id ===
          selected.company_id
      )

    if (refreshed) {
      setSelected(refreshed)
    }

    return true
  }

  async function activate30Days() {
    const end = new Date()
    end.setDate(end.getDate() + 30)

    await saveCompany({
      subscription_status: 'active',
      subscription_ends_at:
        end.toISOString().slice(0, 10)
    })
  }

  async function registerPayment() {
    if (!selected) return

    const amount = Number(paymentForm.amount || 0)

    if (amount <= 0) {
      alert('Informe o valor recebido.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase.rpc(
      'admin_register_subscription_payment',
      {
        p_company_id: selected.company_id,
        p_amount: amount,
        p_method: paymentForm.method,
        p_reference: paymentForm.reference || null,
        p_notes: 'Pagamento registrado pelo Painel Master',
        p_days: Number(paymentForm.days || 30)
      }
    )

    setSaving(false)

    if (error) {
      alert(error.message)
      return
    }

    setMessage(
      `Pagamento registrado. Acesso liberado por ${paymentForm.days} dias.`
    )

    setPaymentForm(prev => ({
      ...prev,
      amount: '',
      reference: ''
    }))

    await loadCompanies()

    const { data } = await supabase.rpc(
      'admin_list_companies'
    )

    const refreshed = (data || []).find(
      item => item.company_id === selected.company_id
    )

    if (refreshed) {
      await openCompany(refreshed)
    }
  }

  async function blockCompany() {
    if (
      !confirm(
        `Bloquear ${selected?.company_name}?`
      )
    ) return

    await saveCompany({
      subscription_status: 'suspended'
    })
  }

  async function sendBilling() {
    if (!selected) return

    const phone =
      String(
        form.billing_phone ||
        ''
      ).replace(/\D/g, '')

    if (!phone) {
      alert(
        'Cadastre o WhatsApp de cobrança desta assistência.'
      )
      return
    }

    const due =
      selected.effective_ends_at
        ? dateBR(
            selected.effective_ends_at
          )
        : '-'

    const text =
`Olá! Tudo bem?

Estamos entrando em contato sobre a assinatura do TechOS Pro da assistência ${selected.company_name}.

Plano: ${form.plan}
Situação: ${statusLabels[form.subscription_status] || form.subscription_status}
Vencimento: ${due}

Para evitar interrupção no acesso, pedimos a regularização da assinatura.

Equipe TechOS Pro`

    await supabase.rpc(
      'admin_log_billing_contact',
      {
        p_company_id:
          selected.company_id,
        p_channel: 'whatsapp',
        p_note:
          'Cobrança enviada pelo Painel Master'
      }
    )

    window.open(
      `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`,
      '_blank'
    )
  }

  const filtered = useMemo(() => {
    const q =
      search.trim().toLowerCase()

    if (!q) return companies

    return companies.filter(c =>
      [
        c.company_name,
        c.system_name,
        c.supervisor_name,
        c.supervisor_email,
        c.plan,
        c.subscription_status,
        c.billing_contact_name,
        c.billing_email,
        c.billing_phone
      ]
        .filter(Boolean)
        .some(value =>
          String(value)
            .toLowerCase()
            .includes(q)
        )
    )
  }, [companies, search])

  const metrics = useMemo(() => ({
    total: companies.length,

    active: companies.filter(
      c => c.access_active
    ).length,

    expiring: companies.filter(
      c =>
        c.access_active &&
        c.days_remaining !== null &&
        c.days_remaining >= 0 &&
        c.days_remaining <= 7
    ).length,

    blocked: companies.filter(
      c => !c.access_active
    ).length
  }), [companies])

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            Administração da plataforma
          </p>

          <h1 className="text-2xl font-bold">
            Painel Master TechOS Pro
          </h1>
        </div>

        <button
          onClick={loadCompanies}
          className="px-4 py-3 border rounded-xl font-semibold flex items-center gap-2"
        >
          <RefreshCw size={18}/>
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        <Metric
          title="Assistências"
          value={metrics.total}
          icon={<Building2/>}
        />

        <Metric
          title="Acessos ativos"
          value={metrics.active}
          icon={<CheckCircle/>}
        />

        <Metric
          title="Vencem em 7 dias"
          value={metrics.expiring}
          icon={<Clock/>}
        />

        <Metric
          title="Bloqueadas"
          value={metrics.blocked}
          icon={<Ban/>}
        />

      </div>

      <div className="surface p-4">

        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-3.5 text-slate-400"
          />

          <input
            className="input pl-10"
            placeholder="Buscar assistência, responsável, e-mail, plano ou status..."
            value={search}
            onChange={
              e => setSearch(e.target.value)
            }
          />
        </div>

      </div>

      {loading ? (
        <div className="surface p-8 text-center">
          Carregando assistências...
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">

          {filtered.map(company => {

            const status =
              statusLabels[
                company.subscription_status
              ] ||
              company.subscription_status

            return (
              <div
                key={company.company_id}
                className="surface p-5 space-y-4"
              >

                <div className="flex justify-between gap-3">

                  <div>
                    <h2 className="font-bold text-lg">
                      {company.company_name}
                    </h2>

                    <p className="text-sm text-slate-500">
                      {company.system_name ||
                        'TechOS Pro'}
                    </p>
                  </div>

                  <span
                    className={
                      company.access_active
                        ? 'h-fit px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700'
                        : 'h-fit px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700'
                    }
                  >
                    {status}
                  </span>

                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">

                  <Info
                    label="Plano"
                    value={company.plan}
                  />

                  <Info
                    label="Usuários"
                    value={`${company.user_count}/${company.max_users}`}
                  />

                  <Info
                    label="Responsável"
                    value={
                      company.supervisor_name ||
                      '-'
                    }
                  />

                  <Info
                    label="Vencimento"
                    value={
                      dateBR(
                        company.effective_ends_at
                      )
                    }
                  />

                </div>

                {company.days_remaining !== null && (
                  <p
                    className={
                      company.days_remaining <= 7
                        ? 'text-sm font-semibold text-amber-600'
                        : 'text-sm text-slate-500'
                    }
                  >
                    {company.days_remaining >= 0
                      ? `${company.days_remaining} dia(s) restante(s)`
                      : `Vencido há ${Math.abs(company.days_remaining)} dia(s)`}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() =>
                    openCompany(company)
                  }
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold"
                >
                  Gerenciar assistência
                </button>

              </div>
            )
          })}

        </div>
      )}

      {selected && (
        <div className="surface p-5 md:p-7 space-y-6">

          <div className="flex justify-between gap-3">

            <div>
              <p className="text-sm text-slate-500">
                Gerenciamento
              </p>

              <h2 className="text-2xl font-bold">
                {selected.company_name}
              </h2>
            </div>

            <button
              onClick={() =>
                setSelected(null)
              }
              className="px-4 py-2 border rounded-xl"
            >
              Fechar
            </button>

          </div>

          {message && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3">
              {message}
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">

            <Field
              label="Plano"
              value={form.plan}
              onChange={
                value =>
                  setForm(p => ({
                    ...p,
                    plan: value
                  }))
              }
            />

            <Field
              label="Limite de usuários"
              type="number"
              value={form.max_users}
              onChange={
                value =>
                  setForm(p => ({
                    ...p,
                    max_users: value
                  }))
              }
            />

            <label>
              <span className="label">
                Status
              </span>

              <select
                className="input"
                value={
                  form.subscription_status
                }
                onChange={
                  e =>
                    setForm(p => ({
                      ...p,
                      subscription_status:
                        e.target.value
                    }))
                }
              >
                <option value="trial">
                  Período de teste
                </option>

                <option value="active">
                  Ativo
                </option>

                <option value="past_due">
                  Pagamento pendente
                </option>

                <option value="expired">
                  Expirado
                </option>

                <option value="suspended">
                  Bloqueado
                </option>

                <option value="cancelled">
                  Cancelado
                </option>
              </select>
            </label>

            <Field
              label="Fim do teste"
              type="date"
              value={
                form.trial_ends_at
              }
              onChange={
                value =>
                  setForm(p => ({
                    ...p,
                    trial_ends_at: value
                  }))
              }
            />

            <Field
              label="Vencimento da assinatura"
              type="date"
              value={
                form.subscription_ends_at
              }
              onChange={
                value =>
                  setForm(p => ({
                    ...p,
                    subscription_ends_at:
                      value
                  }))
              }
            />

            <Field
              label="Responsável cobrança"
              value={
                form.billing_contact_name
              }
              onChange={
                value =>
                  setForm(p => ({
                    ...p,
                    billing_contact_name:
                      value
                  }))
              }
            />

            <Field
              label="E-mail cobrança"
              value={
                form.billing_email
              }
              onChange={
                value =>
                  setForm(p => ({
                    ...p,
                    billing_email: value
                  }))
              }
            />

            <Field
              label="WhatsApp cobrança"
              value={
                form.billing_phone
              }
              onChange={
                value =>
                  setForm(p => ({
                    ...p,
                    billing_phone: value
                  }))
              }
            />

          </div>

          <label className="block">
            <span className="label">
              Observações administrativas
            </span>

            <textarea
              className="input min-h-24"
              value={form.admin_notes}
              onChange={
                e =>
                  setForm(p => ({
                    ...p,
                    admin_notes:
                      e.target.value
                  }))
              }
            />
          </label>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">

            <button
              type="button"
              disabled={saving}
              onClick={() =>
                saveCompany()
              }
              className="btn-primary justify-center"
            >
              <Save size={18}/>
              Salvar
            </button>

            <button
              type="button"
              onClick={activate30Days}
              className="py-3 rounded-xl bg-emerald-600 text-white font-semibold"
            >
              Cortesia +30 dias
            </button>

            <button
              type="button"
              onClick={blockCompany}
              className="py-3 rounded-xl bg-red-600 text-white font-semibold"
            >
              Bloquear
            </button>

            <button
              type="button"
              onClick={() =>
                onEnterSupport?.(selected)
              }
              className="py-3 rounded-xl bg-slate-900 text-white font-semibold flex items-center justify-center gap-2"
            >
              <ExternalLink size={18}/>
              Abrir assistência
            </button>

          </div>

          <div className="border rounded-2xl p-5 space-y-4">

            <div>
              <h3 className="font-bold text-lg">
                Registrar pagamento
              </h3>
              <p className="text-sm text-slate-500">
                Ao registrar, a assinatura é renovada automaticamente.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-3">

              <Field
                label="Valor recebido"
                type="number"
                value={paymentForm.amount}
                onChange={value =>
                  setPaymentForm(p => ({
                    ...p,
                    amount: value
                  }))
                }
              />

              <label>
                <span className="label">Forma de pagamento</span>
                <select
                  className="input"
                  value={paymentForm.method}
                  onChange={e =>
                    setPaymentForm(p => ({
                      ...p,
                      method: e.target.value
                    }))
                  }
                >
                  <option value="pix">Pix</option>
                  <option value="cash">Dinheiro</option>
                  <option value="credit_card">Cartão crédito</option>
                  <option value="debit_card">Cartão débito</option>
                  <option value="bank_transfer">Transferência</option>
                  <option value="other">Outro</option>
                </select>
              </label>

              <Field
                label="Referência"
                value={paymentForm.reference}
                onChange={value =>
                  setPaymentForm(p => ({
                    ...p,
                    reference: value
                  }))
                }
              />

            </div>

            <div>
              <p className="label">Período de acesso</p>

              <div className="grid grid-cols-3 gap-2">
                {[30, 90, 365].map(days => (
                  <button
                    key={days}
                    type="button"
                    onClick={() =>
                      setPaymentForm(p => ({
                        ...p,
                        days
                      }))
                    }
                    className={
                      paymentForm.days === days
                        ? 'py-3 rounded-xl bg-slate-900 text-white font-semibold'
                        : 'py-3 rounded-xl border font-semibold'
                    }
                  >
                    {days === 365 ? '1 ano' : `${days} dias`}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={registerPayment}
              className="btn-primary w-full justify-center"
            >
              <Save size={18}/>
              Registrar pagamento e liberar
            </button>

          </div>

          {payments.length > 0 && (
            <div className="border rounded-2xl overflow-hidden">

              <div className="p-4 border-b bg-slate-50">
                <h3 className="font-bold">
                  Histórico de pagamentos
                </h3>
              </div>

              {payments.map(payment => (
                <div
                  key={payment.id}
                  className="p-4 border-b last:border-0"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {Number(payment.amount || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL'
                          }
                        )}
                      </p>

                      <p className="text-xs text-slate-500">
                        {dateBR(payment.paid_at)}
                        {' • '}
                        {payment.coverage_days} dias
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        Até {dateBR(payment.period_end)}
                      </p>

                      <p className="text-xs text-slate-500">
                        {payment.method || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

            </div>
          )}

          <button
            type="button"
            onClick={sendBilling}
            className="w-full py-3 border border-emerald-300 text-emerald-700 rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            <MessageCircle size={18}/>
            Enviar cobrança por WhatsApp
          </button>

          <div className="grid lg:grid-cols-2 gap-5">

            <div className="border rounded-2xl overflow-hidden">

              <div className="p-4 border-b bg-slate-50">
                <h3 className="font-bold flex items-center gap-2">
                  <Users size={18}/>
                  Usuários
                </h3>
              </div>

              {users.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">
                  Nenhum usuário encontrado.
                </p>
              ) : (
                users.map(user => (
                  <div
                    key={user.user_id}
                    className="p-4 border-b last:border-0"
                  >
                    <p className="font-semibold">
                      {user.full_name}
                    </p>

                    <p className="text-sm text-slate-500">
                      {user.email || '-'}
                    </p>

                    <p className="text-xs mt-1 capitalize">
                      {user.role}
                    </p>
                  </div>
                ))
              )}

            </div>

            <div className="border rounded-2xl overflow-hidden">

              <div className="p-4 border-b bg-slate-50">
                <h3 className="font-bold">
                  Histórico administrativo
                </h3>
              </div>

              {audit.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">
                  Nenhuma ação registrada.
                </p>
              ) : (
                audit.slice(0, 20).map(item => (
                  <div
                    key={item.id}
                    className="p-4 border-b last:border-0"
                  >
                    <p className="font-semibold">
                      {item.action}
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      {dateBR(item.created_at)}
                      {' • '}
                      {item.admin_name}
                    </p>
                  </div>
                ))
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  )
}

function Metric({
  title,
  value,
  icon
}) {
  return (
    <div className="surface p-4">
      <div className="text-slate-500 mb-2">
        {icon}
      </div>

      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className="text-2xl font-bold mt-1">
        {value}
      </p>
    </div>
  )
}

function Info({
  label,
  value
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="font-semibold capitalize">
        {value || '-'}
      </p>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text'
}) {
  return (
    <label>
      <span className="label">
        {label}
      </span>

      <input
        className="input"
        type={type}
        value={value ?? ''}
        onChange={
          e => onChange(e.target.value)
        }
      />
    </label>
  )
}
