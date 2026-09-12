import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'

const money = value =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })

export default function OrderPartsSelector({
  orderId = null,
  value = [],
  onChange = () => {},
  onTotalChange = () => {}
}) {
  const [inventory, setInventory] = useState([])
  const [existingParts, setExistingParts] = useState([])
  const [orderPhotos, setOrderPhotos] = useState([])
  const [photoError, setPhotoError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')

  async function loadOrderPhotos() {
    if (!orderId) {
      setOrderPhotos([])
      setPhotoError('')
      return
    }

    const { data: photos, error } = await supabase
      .from('order_photos')
      .select('id, order_id, storage_path, file_name, created_at')
      .eq('order_id', orderId)
      .order('created_at')

    if (error) {
      console.error('Erro ao carregar fotos da OS:', error)
      setPhotoError('Não foi possível carregar as fotos desta OS.')
      setOrderPhotos([])
      return
    }

    const signedPhotos = await Promise.all(
      (photos || []).map(async photo => {
        const { data: signed, error: signedError } = await supabase.storage
          .from('order-photos')
          .createSignedUrl(photo.storage_path, 60 * 60 * 24)

        if (signedError) {
          console.error('Erro ao gerar link da foto:', signedError)
          return { ...photo, url: '' }
        }

        return { ...photo, url: signed?.signedUrl || '' }
      })
    )

    setPhotoError('')
    setOrderPhotos(signedPhotos)
  }

  async function loadData() {
    setLoading(true)

    const { data: items, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name')

    if (inventoryError) {
      alert(inventoryError.message)
      setLoading(false)
      return
    }

    setInventory(items || [])

    if (orderId) {
      const { data: parts, error: partsError } = await supabase
        .from('order_parts')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at')

      if (partsError) alert(partsError.message)
      else setExistingParts(parts || [])

      await loadOrderPhotos()
    } else {
      setExistingParts([])
      setOrderPhotos([])
      setPhotoError('')
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [orderId])

  const selectedItem = inventory.find(item => String(item.id) === String(itemId))

  const partsTotal = useMemo(() => {
    const list = orderId ? existingParts.filter(part => part.status !== 'cancelled') : value
    return list.reduce(
      (total, part) => total + Number(part.unit_price || 0) * Number(part.quantity || 0),
      0
    )
  }, [orderId, existingParts, value])

  useEffect(() => {
    onTotalChange(partsTotal)
  }, [partsTotal])

  function chooseItem(id) {
    setItemId(id)
    const item = inventory.find(x => String(x.id) === String(id))
    setUnitPrice(item ? String(item.sale_price || 0) : '')
  }

  async function addPart() {
    if (!selectedItem) {
      alert('Selecione uma peça.')
      return
    }

    const qty = Number(quantity || 0)
    const price = Number(unitPrice || selectedItem.sale_price || 0)

    if (qty <= 0) {
      alert('Informe uma quantidade válida.')
      return
    }

    const available = Number(selectedItem.quantity_on_hand || 0) - Number(selectedItem.quantity_reserved || 0)
    const alreadySelected = orderId
      ? 0
      : value
          .filter(part => String(part.inventory_item_id) === String(selectedItem.id))
          .reduce((total, part) => total + Number(part.quantity || 0), 0)

    if (qty + alreadySelected > available) {
      alert(`Estoque disponível: ${available} unidade(s).`)
      return
    }

    if (orderId) {
      setBusy(true)
      const { error } = await supabase.rpc('reserve_order_part', {
        p_order_id: orderId,
        p_inventory_item_id: selectedItem.id,
        p_quantity: qty,
        p_unit_price: price
      })
      setBusy(false)

      if (error) {
        alert(error.message)
        return
      }

      setItemId('')
      setQuantity('1')
      setUnitPrice('')
      await loadData()
      return
    }

    onChange([
      ...value,
      {
        inventory_item_id: selectedItem.id,
        name: selectedItem.name,
        sku: selectedItem.sku || '',
        quantity: qty,
        unit_price: price,
        unit_cost: Number(selectedItem.cost_price || 0)
      }
    ])

    setItemId('')
    setQuantity('1')
    setUnitPrice('')
  }

  function removePendingPart(index) {
    onChange(value.filter((_, i) => i !== index))
  }

  async function usePart(part) {
    if (!confirm('Confirmar uso desta peça? O estoque físico será baixado.')) return
    setBusy(true)
    const { error } = await supabase.rpc('use_order_part', { p_order_part_id: part.id })
    setBusy(false)
    if (error) return alert(error.message)
    await loadData()
  }

  async function releasePart(part) {
    if (!confirm('Cancelar a reserva desta peça e devolver ao estoque disponível?')) return
    setBusy(true)
    const { error } = await supabase.rpc('release_order_part', { p_order_part_id: part.id })
    setBusy(false)
    if (error) return alert(error.message)
    await loadData()
  }

  const displayedParts = orderId ? existingParts : value

  function itemName(part) {
    if (part.name) return part.name
    const item = inventory.find(x => String(x.id) === String(part.inventory_item_id))
    return item?.name || 'Peça'
  }

  return (
    <div className="space-y-4">
      {orderId && (
        <div className="border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Fotos da OS</p>
              <p className="text-sm text-slate-500">Fotos anexadas no cadastro desta ordem de serviço.</p>
            </div>
            <button type="button" onClick={loadOrderPhotos} className="px-3 py-2 rounded-xl border text-sm font-semibold">
              Atualizar fotos
            </button>
          </div>

          {photoError && <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">{photoError}</div>}
          {!photoError && orderPhotos.length === 0 && <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-500">Nenhuma foto anexada a esta OS.</div>}

          {orderPhotos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {orderPhotos.map((photo, index) => photo.url ? (
                <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="block border rounded-xl overflow-hidden bg-slate-50">
                  <img src={photo.url} alt={photo.file_name || `Foto ${index + 1} da OS`} className="w-full h-36 object-cover" />
                  <p className="text-xs text-slate-500 p-2 truncate">{photo.file_name || `Foto ${index + 1}`}</p>
                </a>
              ) : (
                <div key={photo.id} className="border rounded-xl p-3 text-sm text-slate-500">Foto indisponível</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="border rounded-2xl p-4 space-y-4">
        <div>
          <p className="font-semibold">Peças da OS</p>
          <p className="text-sm text-slate-500">Reserve peças do estoque e controle o custo do serviço.</p>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Carregando estoque...</div>
        ) : (
          <>
            <label className="block">
              <span className="label">Peça / material</span>
              <select value={itemId} onChange={e => chooseItem(e.target.value)} className="input">
                <option value="">Selecionar peça...</option>
                {inventory.map(item => {
                  const available = Number(item.quantity_on_hand || 0) - Number(item.quantity_reserved || 0)
                  return <option key={item.id} value={item.id} disabled={available <= 0}>{item.name} — {available} disponível(is)</option>
                })}
              </select>
            </label>

            {selectedItem && (
              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                <p><b>Estoque físico:</b> {selectedItem.quantity_on_hand || 0}</p>
                <p><b>Reservado:</b> {selectedItem.quantity_reserved || 0}</p>
                <p><b>Preço padrão:</b> {money(selectedItem.sale_price)}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">Quantidade</span>
                <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="input" />
              </label>
              <label className="block">
                <span className="label">Preço unitário</span>
                <input type="number" min="0" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className="input" />
              </label>
            </div>

            <button type="button" onClick={addPart} disabled={busy} className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">
              {orderId ? 'Reservar peça na OS' : 'Adicionar peça à OS'}
            </button>
          </>
        )}
      </div>

      <div className="space-y-3">
        {displayedParts.length === 0 ? (
          <div className="border rounded-2xl p-4 text-sm text-slate-500">Nenhuma peça vinculada a esta OS.</div>
        ) : (
          displayedParts.map((part, index) => (
            <div key={part.id || `${part.inventory_item_id}-${index}`} className="border rounded-2xl p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold">{itemName(part)}</p>
                  <p className="text-sm text-slate-500">{part.quantity} x {money(part.unit_price)}</p>
                </div>
                <b>{money(Number(part.quantity || 0) * Number(part.unit_price || 0))}</b>
              </div>

              {orderId && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {part.status === 'reserved' && (
                    <>
                      <button type="button" onClick={() => usePart(part)} disabled={busy} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">Confirmar uso</button>
                      <button type="button" onClick={() => releasePart(part)} disabled={busy} className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold disabled:opacity-50">Cancelar reserva</button>
                    </>
                  )}
                  {part.status === 'used' && <span className="text-xs font-semibold px-3 py-2 rounded-full bg-emerald-50 text-emerald-700">Peça utilizada</span>}
                  {part.status === 'cancelled' && <span className="text-xs font-semibold px-3 py-2 rounded-full bg-slate-100 text-slate-500">Reserva cancelada</span>}
                </div>
              )}

              {!orderId && (
                <button type="button" onClick={() => removePendingPart(index)} className="mt-3 text-sm font-semibold text-red-600">Remover peça</button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex justify-between items-center gap-3">
        <div>
          <p className="text-sm text-blue-700">Total em peças</p>
          <p className="text-xs text-blue-600">Valor de venda das peças vinculadas</p>
        </div>
        <p className="text-xl font-bold text-blue-700">{money(partsTotal)}</p>
      </div>
    </div>
  )
}
