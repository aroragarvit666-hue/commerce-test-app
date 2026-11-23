import React, { useMemo, useState } from 'react'
import {
  Flex, View, Button, Heading, Content, IllustratedMessage,
  TableView, TableHeader, TableBody, Column, Row, Cell
} from '@adobe/react-spectrum'
import NoSearchResults from '@spectrum-icons/illustrations/NoSearchResults'
import { formatDate } from './api'

export default function FailuresTab({ failures, isLive, onExport }) {
  const [selectedKeys, setSelectedKeys] = useState(new Set())
  const [isRetrying, setIsRetrying] = useState(false)

  const selectedIds = useMemo(
    () => (selectedKeys === 'all' ? failures.map(f => f.entityId) : [...selectedKeys]),
    [selectedKeys, failures]
  )

  const retry = async ids => {
    setIsRetrying(true)
    // export-orders accepts at most 50 ids per call
    for (let i = 0; i < ids.length; i += 50) {
      await onExport({ orderIds: ids.slice(i, i + 50), force: true })
    }
    setSelectedKeys(new Set())
    setIsRetrying(false)
  }

  return (
    <View paddingTop="size-200">
      <Flex direction="column" gap="size-200">
        <Flex justifyContent="end" gap="size-100">
          <Button
            variant="secondary"
            onPress={() => retry(failures.map(f => f.entityId))}
            isDisabled={!isLive || failures.length === 0 || isRetrying}
          >
            Retry all
          </Button>
          <Button
            variant="accent"
            onPress={() => retry(selectedIds)}
            isPending={isRetrying}
            isDisabled={!isLive || selectedIds.length === 0}
          >
            Retry selected{selectedIds.length ? ` (${selectedIds.length})` : ''}
          </Button>
        </Flex>

        <TableView
          aria-label="Failed order exports"
          selectionMode={isLive ? 'multiple' : 'none'}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          height="size-5000"
          overflowMode="wrap"
          renderEmptyState={() => (
            <IllustratedMessage>
              <NoSearchResults />
              <Heading>No failed exports</Heading>
              <Content>Orders the ERP rejects show up here so you can fix and retry them.</Content>
            </IllustratedMessage>
          )}
        >
          <TableHeader>
            <Column key="incrementId" width={120}>Order #</Column>
            <Column key="at" width={180}>Last attempt</Column>
            <Column key="attempts" width={100} align="end">Attempts</Column>
            <Column key="error">Error</Column>
          </TableHeader>
          <TableBody items={failures}>
            {f => (
              <Row key={f.entityId}>
                <Cell>{f.incrementId || f.entityId}</Cell>
                <Cell>{formatDate(f.at)}</Cell>
                <Cell>{f.attempts || 1}</Cell>
                <Cell>{f.error}</Cell>
              </Row>
            )}
          </TableBody>
        </TableView>
      </Flex>
    </View>
  )
}
