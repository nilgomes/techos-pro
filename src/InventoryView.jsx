import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'

const money = value =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })

export default function InventoryView() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    sku: '',
    name: '',
    category: '',
    compatible_models: '',
    supplier: '',
    quantity: '',
    minimum_stock: '',
    cost_price: '',
    sale_price: '',
    notes: ''
  })

  async function loadItems() {
    setLoading(true)

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name')

    if (error) {
      alert(error.message)
    } else {
      setItems(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadItems()
  }, [])

  async function saveItem(e) {
    e.preventDefault()

    if (!form.name.trim()) {
      alert('Informe o nome da peça.')
      return
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        sku: form.sku || null,
        name: form.name,
        category: form.category || null,
        compatible_models: form.compatible_models || null,
        supplier: form.supplier || null,
        minimum_stock: Number(form.minimum_stock || 0),
        cost_price: Number(form.cost_price || 0),
        sale_price: Number(form.sale_price || 0),
        notes: form.notes || null
      })
      .select()
      .single()

    if (error) {
      alert(error.message)
      return
    }

    const quantity = Number(form.quantity || 0)

    if (quantity > 0) {
      const { error: stockError } = await supabase.rpc(
        'add_inventory_stock',
        {
          p_inventory_item_id: data.id,
          p_quantity: quantity,
          p_unit_cost: Number(form.cost_price || 0),
          p_notes: 'Estoque inicial'
        }
      )

      if (stockError) {
        alert(stockError.message)
      }
    }    setForm({
      sku: '',
      name: '',
      category: '',
      compatible_models: '',
      supplier: '',
      quantity: '',
      minimum_stock: '',
      cost_price: '',
      sale_price: '',
      notes: ''
    })

    setShowForm(false)
    loadItems()
  }

  async function addStock(item) {
    const quantity = prompt(
      `Quantidade recebida de ${item.name}:`,
      '1'
    )

    if (!quantity) return

    const cost = prompt(
      'Custo unitário:',
      String(item.cost_price || 0)
    )

    if (cost === null) return

    const { error } = await supabase.rpc(
      'add_inventory_stock',
      {
        p_inventory_item_id: item.id,
        p_quantity: Number(quantity),
        p_unit_cost: Number(cost || 0),
        p_notes: 'Entrada manual de estoque'
      }
    )

    if (error) {
      alert(error.message)
      return
    }

    loadItems()
  }

  const totalItems = items.length

  const totalUnits = items.reduce(
    (total, item) =>
      total + Number(item.quantity_on_hand || 0),
    0
  )

  const lowStock = items.filter(item => {
    const available =
      Number(item.quantity_on_hand || 0) -
      Number(item.quantity_reserved || 0)

    return available <= Number(item.minimum_stock || 0)
  }).length

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      <div className="flex justify-between items-center gap-3">
        <div>
          <p className="text-sm text-slate-500">
            Peças e materiais
          </p>

          <h1 className="text-2xl font-bold">
            Estoque
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="btn-primary"
        >
          + Novo item
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">

        <div className="surface p-4">
          <p className="text-sm text-slate-500">
            Itens
          </p>

          <p className="text-2xl font-bold">
            {totalItems}
          </p>
        </div>

        <div className="surface p-4">
          <p className="text-sm text-slate-500">
            Unidades
          </p>

          <p className="text-2xl font-bold">
            {totalUnits}
          </p>
        </div>

        <div className="surface p-4">
          <p className="text-sm text-slate-500">
            Estoque baixo
          </p>

          <p className="text-2xl font-bold text-amber-600">
            {lowStock}
          </p>
        </div>

      </div>
      <div className="space-y-3">

        {loading && (
          <div className="surface p-5">
            Carregando estoque...
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="surface p-8 text-center">
            <p className="font-semibold">
              Nenhum item cadastrado.
            </p>

            <p className="text-sm text-slate-500 mt-1">
              Cadastre sua primeira peça.
            </p>
          </div>
        )}

        {items.map(item => {
          const available =
            Number(item.quantity_on_hand || 0) -
            Number(item.quantity_reserved || 0)

          const low =
            available <=
            Number(item.minimum_stock || 0)

          return (
            <div
              key={item.id}
              className="surface p-4"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="font-bold">
                    {item.name}
                  </h3>

                  <p className="text-sm text-slate-500">
                    {item.sku || 'Sem código'}
                    {item.category
                      ? ` • ${item.category}`
                      : ''}
                  </p>

                  {item.compatible_models && (
                    <p className="text-sm mt-2">
                      Compatível: {item.compatible_models}
                    </p>
                  )}
                </div>

                {low && (
                  <span className="h-fit text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-1">
                    Estoque baixo
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">
                    Físico
                  </p>
                  <b>
                    {item.quantity_on_hand || 0}
                  </b>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">
                    Reservado
                  </p>
                  <b>
                    {item.quantity_reserved || 0}
                  </b>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">
                    Disponível
                  </p>
                  <b>
                    {available}
                  </b>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="border rounded-xl p-3">
                  <p className="text-xs text-slate-500">
                    Custo
                  </p>
                  <b>
                    {money(item.cost_price)}
                  </b>
                </div>

                <div className="border rounded-xl p-3">
                  <p className="text-xs text-slate-500">
                    Venda
                  </p>
                  <b>
                    {money(item.sale_price)}
                  </b>
                </div>
              </div>

              <button
                type="button"
                onClick={() => addStock(item)}
                className="w-full mt-3 py-3 bg-slate-900 text-white rounded-xl font-semibold"
              >
                + Entrada de estoque
              </button>
            </div>
          )
        })}
      </div>

    </div>
  )
}0

