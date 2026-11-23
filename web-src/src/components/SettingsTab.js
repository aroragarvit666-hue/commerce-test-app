import React from 'react'
import { Flex, View, Text, Heading, StatusLight, Divider } from '@adobe/react-spectrum'
import { formatDate } from './api'

function Field({ label, children }) {
  return (
    <Flex direction="column" gap="size-50">
      <Text UNSAFE_style={{ color: 'var(--spectrum-global-color-gray-700)', fontSize: 12 }}>{label}</Text>
      <View>{children}</View>
    </Flex>
  )
}

export default function SettingsTab({ status, isLive }) {
  const config = status?.config
  const lastRun = status?.lastRun

  return (
    <View paddingTop="size-200" maxWidth="size-6000">
      <Flex direction="column" gap="size-250">
        <Heading level={3} margin={0}>Connections</Heading>
        <Field label="Adobe Commerce">
          <StatusLight variant={!isLive || !config ? 'neutral' : config.commerceConfigured ? 'positive' : 'negative'}>
            {!isLive || !config ? 'Unknown' : config.commerceConfigured ? 'Configured' : 'COMMERCE_SANDBOX_ADMIN_URL not set'}
          </StatusLight>
        </Field>
        <Field label="ERP endpoint">
          <StatusLight variant={!isLive || !config ? 'neutral' : config.erpConfigured ? 'positive' : 'negative'}>
            {!isLive || !config ? 'Unknown' : config.erpEndpoint || 'ERP_BASE_URL not set'}
          </StatusLight>
        </Field>

        <Divider size="S" />
        <Heading level={3} margin={0}>Export rules</Heading>
        <Field label="Order statuses exported">
          <Text>{config ? config.orderStatuses.join(', ') : '—'}</Text>
        </Field>
        <Field label="Schedule">
          <Text>{config ? `Every ${config.scheduleMinutes} minutes` : '—'}</Text>
        </Field>
        <Field label="Sync cursor (orders updated after)">
          <Text>{status?.cursor ? formatDate(status.cursor) : 'Not started — first run exports the last 24 hours (or SYNC_START_DATE)'}</Text>
        </Field>
        {lastRun && (
          <Field label="Last run">
            <Text>
              {formatDate(lastRun.startedAt)} → {formatDate(lastRun.finishedAt)} ({lastRun.trigger}): {lastRun.exported} exported, {lastRun.skipped} skipped, {lastRun.failed} failed, {lastRun.retried} retried
            </Text>
          </Field>
        )}
        <Text UNSAFE_style={{ color: 'var(--spectrum-global-color-gray-700)' }}>
          These values come from the app's environment (.env). Change them there and redeploy.
        </Text>
      </Flex>
    </View>
  )
}
