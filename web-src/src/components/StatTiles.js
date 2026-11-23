import React from 'react'
import { Flex, View, Text, Heading, StatusLight } from '@adobe/react-spectrum'
import { formatDate } from './api'

function Tile({ label, value, children }) {
  return (
    <View
      borderWidth="thin"
      borderColor="gray-300"
      borderRadius="medium"
      padding="size-250"
      backgroundColor="gray-50"
      flex="1 1 220px"
    >
      <Flex direction="column" gap="size-75">
        <Text UNSAFE_style={{ color: 'var(--spectrum-global-color-gray-700)' }}>{label}</Text>
        <Heading level={2} margin={0} UNSAFE_style={{ fontSize: 28 }}>{value}</Heading>
        {children}
      </Flex>
    </View>
  )
}

export default function StatTiles({ status, isLive }) {
  const exported = isLive && status ? status.stats?.exported ?? 0 : '—'
  const failures = isLive && status ? status.failures?.length ?? 0 : '—'
  const lastRun = status?.lastRun

  return (
    <Flex gap="size-200" wrap>
      <Tile label="Orders exported (all time)" value={exported} />
      <Tile label="Open failures" value={failures}>
        {typeof failures === 'number' && (
          <StatusLight variant={failures > 0 ? 'negative' : 'positive'} marginStart="-size-100">
            {failures > 0 ? 'Needs attention' : 'All healthy'}
          </StatusLight>
        )}
      </Tile>
      <Tile label="Last sync" value={lastRun ? formatDate(lastRun.finishedAt) : '—'}>
        {lastRun && (
          <Text>
            {lastRun.trigger === 'manual' ? 'Manual' : 'Scheduled'} · {lastRun.exported} exported · {lastRun.failed} failed
          </Text>
        )}
      </Tile>
    </Flex>
  )
}
