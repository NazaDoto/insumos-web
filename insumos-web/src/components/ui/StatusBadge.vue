<script>
const MAP = {
  active: { label: 'Activo', color: 'green' },
  inactive: { label: 'Inactivo', color: 'gray' },
  // pedidos
  pending: { label: 'Pendiente', color: 'amber' },
  accepted: { label: 'Aceptado', color: 'blue' },
  rejected: { label: 'Rechazado', color: 'red' },
  preparing: { label: 'En preparacion', color: 'cyan' },
  sent: { label: 'Enviado', color: 'blue' },
  delivered: { label: 'Entregado', color: 'green' },
  cancelled: { label: 'Cancelado', color: 'gray' },
  partial: { label: 'Parcial', color: 'amber' },
  // estado fisico insumo
  available: { label: 'Disponible', color: 'green' },
  in_use: { label: 'En uso', color: 'blue' },
  repair: { label: 'En reparacion', color: 'amber' },
  damaged: { label: 'Danado', color: 'red' },
  retired: { label: 'Dado de baja', color: 'gray' },
  reserved: { label: 'Reservado', color: 'cyan' },
  lost: { label: 'Extraviado', color: 'red' },
  // movimientos
  income: { label: 'Ingreso', color: 'green' },
  outcome: { label: 'Egreso', color: 'red' },
  transfer: { label: 'Transferencia', color: 'cyan' },
  usage: { label: 'Uso', color: 'amber' },
  adjustment: { label: 'Ajuste', color: 'gray' },
  order_received: { label: 'Pedido recibido', color: 'green' },
  order_sent: { label: 'Pedido enviado', color: 'blue' },
  return: { label: 'Devolucion', color: 'cyan' },
  correction: { label: 'Correccion', color: 'gray' },
}

export default {
  name: 'StatusBadge',
  props: { status: { type: String, default: '' } },
  computed: {
    cfg() { return MAP[this.status] || { label: this.status, color: 'gray' } },
  },
}
</script>

<template>
  <span :class="['badge', cfg.color]">{{ cfg.label }}</span>
</template>
