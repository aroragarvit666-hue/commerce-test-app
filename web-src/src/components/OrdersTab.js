import React, { useEffect, useMemo, useState } from 'react'
import {
  Flex, View, Text, Button, Picker, Item, Checkbox, InlineAlert, Heading, Content,
  TableView, TableHeader, TableBody, Column, Row, Cell, StatusLight, IllustratedMessage
} from '@adobe/react-spectrum'
import NotFound from '@spectrum-icons/illustrations/NotFound'
import { getActionUrl, invokeAction, formatDate, formatMoney } from './api'

const PAGE_SIZE = 20

const EXPORT_STATUS = {
  exported: { variant: 'positive', label: 'Exported' },
  failed: { variant: 'negative', label: 'Failed' },
  pending: { variant: 'notice', label: 'Pending' }
}

const STATUS_FILTERS = [
  { key: 'eligible', label: 'Eligible for export' },
  { key: 'all', label: 'All statuses' },
  { key: 'pending', label: 'Pending' },
  { key: 'processing', label: 'Processing' },
  { key: 'complete', label: 'Complete' },
  { key: 'canceled', label: 'Canceled' }
]

export default function OrdersTab({ ims, isLive, refreshToken, onExport }) {
  const [statusFilter, setStatusFilter] = useState('eligible')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], totalCount: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedKeys, setSelectedKeys] = useState(new Set())
  const [force, setForce] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (!isLive) return
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await invokeAction(getActionUrl('list-orders'), ims, { page, pageSize: PAGE_SIZE, status: statusFilter })
        if (!cancelled) setData(res || { items: [], totalCount: 0 })
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isLive, ims, page, statusFilter, refreshToken])

  const selectedIds = useMemo(
    () => (selectedKeys === 'all' ? data.items.map(o => o.entityId) : [...selectedKeys]),
    [selectedKeys, data.items]
  )
  const totalPages = Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE))

  const exportSelected = async () => {
    setIsExporting(true)
    const result = await onExport({ orderIds: selectedIds, force })
    if (result) setSelectedKeys(new Set())
    setIsExporting(false)
  }

  return (
    <View paddingTop="size-200">
      <Flex direction="column" gap="size-200">
        <Flex justifyContent="space-between" alignItems="end" wrap gap="size-200">
          <Picker
            label="Commerce order status"
            selectedKey={statusFilter}
            onSelectionChange={key => { setStatusFilter(key); setPage(1); setSelectedKeys(new Set()) }}
            isDisabled={!isLive}
            width="size-3000"
          >
            {STATUS_FILTERS.map(f => <Item key={f.key}>{f.label}</Item>)}
          </Picker>
          <Flex gap="size-200" alignItems="center">
            <Checkbox isSelected={force} onChange={setForce} isDisabled={!isLive}>
              Re-export already exported orders
            </Checkbox>
            <Button
              variant="accent"
              onPress={exportSelected}
              isPending={isExporting}
              isDisabled={!isLive || selectedIds.length === 0}
            >
              Export selected{selectedIds.length ? ` (${selectedIds.length})` : ''}
            </Button>
          </Flex>
        </Flex>

        {error && (
          <InlineAlert variant="negative">
            <Heading>Could not load orders from Commerce</Heading>
            <Content>{error}</Content>
          </InlineAlert>
        )}

        <TableView
          aria-label="Commerce orders"
          selectionMode={isLive ? 'multiple' : 'none'}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          height="size-6000"
          loadingState={isLoading ? 'loading' : 'idle'}
          renderEmptyState={() => (
            <IllustratedMessage>
              <NotFound />
              <Heading>No orders found</Heading>
              <Content>
                {isLive ? 'No Commerce orders match this status filter.' : 'Orders appear here once the backend actions are live.'}
              </Content>
            </IllustratedMessage>
          )}
        >
          <TableHeader>
            <Column key="incrementId" width={120}>Order #</Column>
            <Column key="createdAt" width={180}>Placed</Column>
            <Column key="customer">Customer</Column>
            <Column key="grandTotal" width={120} align="end">Total</Column>
            <Column key="status" width={120}>Commerce status</Column>
            <Column key="exportStatus" width={130}>ERP export</Column>
            <Column key="erpReference" width={150}>ERP reference</Column>
          </TableHeader>
          <TableBody items={isLive ? data.items : []}>
            {order => {
              const s = EXPORT_STATUS[order.exportStatus] || EXPORT_STATUS.pending
              return (
                <Row key={order.entityId}>
                  <Cell>{order.incrementId}</Cell>
                  <Cell>{formatDate(order.createdAt)}</Cell>
                  <Cell>{order.customerName ? `${order.customerName} · ${order.customerEmail}` : order.customerEmail}</Cell>
                  <Cell>{formatMoney(order.grandTotal, order.currency)}</Cell>
                  <Cell>{order.status}</Cell>
                  <Cell><StatusLight variant={s.variant}>{s.label}</StatusLight></Cell>
                  <Cell>{order.erpReference || (order.exportError ? 'See Failures tab' : '—')}</Cell>
                </Row>
              )
            }}
          </TableBody>
        </TableView>

        <Flex justifyContent="space-between" alignItems="center">
          <Text>{isLive ? `${data.totalCount} orders` : ''}</Text>
          <Flex gap="size-100" alignItems="center">
            <Button variant="secondary" isQuiet onPress={() => setPage(p => p - 1)} isDisabled={!isLive || page <= 1 || isLoading}>
              Previous
            </Button>
            <Text>Page {page} of {totalPages}</Text>
            <Button variant="secondary" isQuiet onPress={() => setPage(p => p + 1)} isDisabled={!isLive || page >= totalPages || isLoading}>
              Next
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </View>
  )
}
