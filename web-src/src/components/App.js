import React, { useCallback, useEffect, useState } from 'react'
import {
  Provider, defaultTheme, View, Flex, Heading, Text, Button, InlineAlert, Content,
  Tabs, TabList, TabPanels, Item, Badge
} from '@adobe/react-spectrum'
import Refresh from '@spectrum-icons/workflow/Refresh'
import { ACTION_NAMES, getActionUrl, invokeAction } from './api'
import StatTiles from './StatTiles'
import OrdersTab from './OrdersTab'
import FailuresTab from './FailuresTab'
import SettingsTab from './SettingsTab'

function ExportResultAlert({ result, onDismiss }) {
  if (!result) return null
  const { exported, skipped, failed } = result
  const variant = failed > 0 ? (exported > 0 ? 'notice' : 'negative') : 'positive'
  const heading = failed > 0 ? 'Export finished with errors' : 'Export finished'
  return (
    <InlineAlert variant={variant}>
      <Heading>{heading}</Heading>
      <Content>
        <Flex direction="column" gap="size-100">
          <Text>{exported} exported, {skipped} skipped (already in ERP), {failed} failed.</Text>
          <Button variant="secondary" isQuiet onPress={onDismiss} alignSelf="start">Dismiss</Button>
        </Flex>
      </Content>
    </InlineAlert>
  )
}

export default function App({ runtime, ims }) {
  // Do NOT call runtime.done() here — index.js calls it in the ready handler
  const missingActions = ACTION_NAMES.filter(name => !getActionUrl(name))
  const actionsLive = missingActions.length === 0

  const [status, setStatus] = useState(null)
  const [statusError, setStatusError] = useState(null)
  const [exportError, setExportError] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const loadStatus = useCallback(async () => {
    if (!actionsLive) return
    try {
      setStatusError(null)
      setStatus(await invokeAction(getActionUrl('export-status'), ims))
    } catch (e) {
      setStatusError(e.message)
    }
  }, [actionsLive, ims])

  useEffect(() => { loadStatus() }, [loadStatus, refreshToken])

  // Runs a manual export (specific ids or a full sync), then refreshes every view
  const runExport = useCallback(async body => {
    setExportError(null)
    try {
      const result = await invokeAction(getActionUrl('export-orders'), ims, body)
      setLastResult(result)
      return result
    } catch (e) {
      setExportError(e.message)
      return null
    } finally {
      setRefreshToken(t => t + 1)
    }
  }, [ims])

  const syncNow = async () => {
    setIsSyncing(true)
    await runExport({ mode: 'sync' })
    setIsSyncing(false)
  }

  const failureCount = status?.failures?.length || 0

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <View padding="size-400" maxWidth="1400px" marginX="auto">
        <Flex direction="column" gap="size-300">
          <Flex justifyContent="space-between" alignItems="end" wrap gap="size-200">
            <Flex direction="column" gap="size-50">
              <Heading level={1} margin={0}>ERP Order Export</Heading>
              <Text>Send Adobe Commerce orders to your ERP automatically every 15 minutes, or on demand.</Text>
            </Flex>
            <Flex gap="size-100">
              <Button variant="secondary" isQuiet onPress={() => setRefreshToken(t => t + 1)} isDisabled={!actionsLive}>
                <Refresh />
                <Text>Refresh</Text>
              </Button>
              <Button variant="secondary" onPress={syncNow} isPending={isSyncing} isDisabled={!actionsLive}>
                Sync now
              </Button>
            </Flex>
          </Flex>

          {!actionsLive && (
            <InlineAlert variant="info">
              <Heading>Backend actions are not live yet</Heading>
              <Content>
                To use backend actions in the live preview, select a workspace using 'Set deploy target' below, then click 'Test App'. If a workspace is already selected, click 'Test App' to start the backend.
              </Content>
            </InlineAlert>
          )}

          {statusError && (
            <InlineAlert variant="negative">
              <Heading>Could not load export status</Heading>
              <Content>{statusError}</Content>
            </InlineAlert>
          )}

          {exportError && (
            <InlineAlert variant="negative">
              <Heading>Export request failed</Heading>
              <Content>{exportError}</Content>
            </InlineAlert>
          )}

          <ExportResultAlert result={lastResult} onDismiss={() => setLastResult(null)} />

          <StatTiles status={status} isLive={actionsLive} />

          <Tabs aria-label="ERP export sections">
            <TabList>
              <Item key="orders">Orders</Item>
              <Item key="failures">
                <Text>Failures</Text>
                {failureCount > 0 && <Badge variant="negative" marginStart="size-100">{failureCount}</Badge>}
              </Item>
              <Item key="settings">Settings</Item>
            </TabList>
            <TabPanels>
              <Item key="orders">
                <OrdersTab ims={ims} isLive={actionsLive} refreshToken={refreshToken} onExport={runExport} />
              </Item>
              <Item key="failures">
                <FailuresTab failures={status?.failures || []} isLive={actionsLive} onExport={runExport} />
              </Item>
              <Item key="settings">
                <SettingsTab status={status} isLive={actionsLive} />
              </Item>
            </TabPanels>
          </Tabs>
        </Flex>
      </View>
    </Provider>
  )
}
