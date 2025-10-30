import type { DirectusClient } from '@directus/sdk'
import type { Ref } from 'vue'
import type { Message } from '../types'
import { readItems } from '@directus/sdk'
import { nextTick } from 'vue'
import { formatTime } from '../utils/time'

export interface UseWebSocketOptions {
  directusClient: DirectusClient<any>
  restClient: DirectusClient<any>
  currentUserId: Ref<string>
  activeConversationId: Ref<string>
  messages: Ref<Message[]>
  onNewMessage?: (conversationId: string, message: any) => void
  scrollToBottom?: () => void
}

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    directusClient,
    restClient,
    currentUserId,
    activeConversationId,
    messages,
    onNewMessage,
    scrollToBottom,
  } = options

  let subscriptionCleanup: (() => void) | null = null
  let globalSubscriptionCleanup: (() => void) | null = null
  // Share processedMessageIds between both subscriptions
  const processedMessageIds = new Set<string>()

  /**
   * Subscribe to ALL conversations messages (global subscription)
   * Updates conversation list for messages NOT in active conversation
   */
  async function subscribeToAllConversations() {
    if (globalSubscriptionCleanup) {
      console.log('🔴 Cleaning up previous global subscription')
      globalSubscriptionCleanup()
      globalSubscriptionCleanup = null
    }

    console.log('🌐 [GLOBAL] Starting global message subscription')

    try {
      const { subscription, unsubscribe } = await directusClient.subscribe('zalo_messages', {
        event: 'create',
        query: {
          fields: ['*'],
          // No filter - subscribe to ALL messages
          sort: ['sent_at'],
        },
        uid: 'messages-global',
      })

      globalSubscriptionCleanup = unsubscribe
      console.log('✅ [GLOBAL] Global subscription active')

      // Handle messages
      ;(async () => {
        for await (const item of subscription) {
          if (item.type === 'subscription' && item.event === 'init') {
            console.log('✅ [GLOBAL] Global subscription initialized')
          }
          else if (item.type === 'subscription' && item.event === 'create') {
            if (!item.data || item.data.length === 0)
              continue

            const newMsg = item.data[0]
            if (!newMsg?.id || !newMsg?.conversation_id)
              continue

            console.log('📨 [GLOBAL] New message in conversation:', newMsg.conversation_id)

            // If message is NOT for active conversation, update conversation list
            if (newMsg.conversation_id !== activeConversationId.value) {
              // Fetch sender info for preview
              let senderName = 'Unknown'
              if (newMsg.sender_id) {
                try {
                  const users = await restClient.request(
                    readItems('zalo_users' as any, {
                      fields: ['display_name', 'zalo_name'],
                      filter: { id: { _eq: newMsg.sender_id } },
                      limit: 1,
                    }),
                  )
                  const user = users[0]
                  if (user) {
                    senderName = user.display_name || user.zalo_name || 'Unknown'
                  }
                }
                catch (e) {
                  console.warn('Could not fetch sender info:', e)
                }
              }

              const messagePreview = {
                text: newMsg.content || '',
                time: formatTime(newMsg.sent_at),
                senderName,
              }

              onNewMessage?.(newMsg.conversation_id, messagePreview)
            }
            // If message IS for active conversation, it's already handled by subscribeToMessages
          }
        }
      })()
    }
    catch (error) {
      console.error('❌ [GLOBAL] Failed to subscribe:', error)
    }
  }

  /**
   * Subscribe to messages for a specific conversation
   * Handles deduplication and temp message updates
   */
  async function subscribeToMessages(conversationId: string) {
    if (subscriptionCleanup) {
      console.log('🔴 Unsubscribing from previous conversation')
      subscriptionCleanup()
      subscriptionCleanup = null
    }

    if (!conversationId)
      return

    console.log('🔵 [SUBSCRIBE] Starting subscription for:', conversationId)
    console.log('🔵 [SUBSCRIBE] Current messages count:', messages.value.length)
    console.log('🔵 [SUBSCRIBE] Current user ID:', currentUserId.value)
    processedMessageIds.clear()

    try {
      const { subscription, unsubscribe } = await directusClient.subscribe('zalo_messages', {
        event: 'create',
        query: {
          fields: ['*'],
          filter: {
            conversation_id: { _eq: conversationId },
          },
          sort: ['sent_at'],
        },
        uid: `messages-${conversationId}`,
      })

      subscriptionCleanup = unsubscribe
      console.log('✅ [SUBSCRIBE] Subscribed with UID:', `messages-${conversationId}`)
      console.log('✅ [SUBSCRIBE] Listening for new messages in conversation:', conversationId)

      // Handle messages
      ;(async () => {
        for await (const item of subscription) {
          console.log('📩 [WEBSOCKET] Event received:', { type: item.type, event: item.event, hasData: !!(item as any).data })

          if (item.type === 'subscription' && item.event === 'init') {
            console.log('✅ [SUBSCRIBE] Subscription initialized for:', conversationId)
          }
          else if (item.type === 'subscription' && item.event === 'create') {
            const data = (item as any).data
            if (!data || data.length === 0) {
              console.warn('⚠️ [WEBSOCKET] Empty data received')
              continue
            }

            const newMsg = data[0]

            if (!newMsg?.id) {
              console.warn('⚠️ [WEBSOCKET] Invalid message structure:', newMsg)
              continue
            }

            console.log('📥 [WEBSOCKET] New message received:', {
              id: newMsg.id,
              conversationId: newMsg.conversation_id,
              senderId: newMsg.sender_id,
              clientId: newMsg.client_id,
              content: `${newMsg.content?.substring(0, 20)}...`,
              hasAttachments: !!newMsg.attachments,
            })

            // Check if already processed
            if (processedMessageIds.has(newMsg.id)) {
              console.log('⏭️ [DEDUPE] Already processed message:', newMsg.id)
              continue
            }

            // Check if this is an update to our temp message (by clientId)
            if (newMsg.client_id) {
              console.log('🔍 [WEBSOCKET] Searching for temp message with clientId:', newMsg.client_id)
              console.log('🔍 [WEBSOCKET] Current messages:', messages.value.map(m => ({ id: m.id, clientId: m.clientId })))

              const tempMessageIndex = messages.value.findIndex(m =>
                m.clientId === newMsg.client_id && m.id.startsWith('temp_'),
              )

              if (tempMessageIndex !== -1) {
                console.log('🔄 [WEBSOCKET] Updating temp message with real ID:', {
                  tempId: messages.value[tempMessageIndex]?.id,
                  realId: newMsg.id,
                  clientId: newMsg.client_id,
                })

                // Update temp message with real data
                if (messages.value[tempMessageIndex]) {
                  messages.value[tempMessageIndex].id = newMsg.id
                  messages.value[tempMessageIndex].status = 'delivered'

                  // Parse attachments if present
                  if (newMsg.attachments) {
                    try {
                      const attachments = typeof newMsg.attachments === 'string'
                        ? JSON.parse(newMsg.attachments)
                        : newMsg.attachments
                      messages.value[tempMessageIndex].files = attachments
                    }
                    catch (e) {
                      console.warn('Failed to parse attachments:', e)
                    }
                  }
                }

                processedMessageIds.add(newMsg.id)
                console.log('✅ [WEBSOCKET] Temp message updated successfully')
                continue
              }
              else {
                console.warn('⚠️ [WEBSOCKET] Temp message NOT FOUND for clientId:', newMsg.client_id)
              }
            }

            // Check duplicate by ID
            const exists = messages.value.some(m => m.id === newMsg.id)

            if (exists) {
              console.log('⏭️ [DEDUPE] Message already exists by ID:', newMsg.id)
              continue
            }

            processedMessageIds.add(newMsg.id)

            // Fetch sender info
            let senderName = 'Unknown'
            let senderAvatar = ''

            if (newMsg.sender_id) {
              try {
                const users = await restClient.request(
                  readItems('zalo_users' as any, {
                    fields: ['display_name', 'zalo_name', 'avatar_url'],
                    filter: { id: { _eq: newMsg.sender_id } },
                    limit: 1,
                  }),
                )

                const user = users[0]

                if (user) {
                  senderName = user.display_name || user.zalo_name || 'Unknown'

                  // Proxy Zalo avatar URLs to avoid CORS
                  if (user.avatar_url) {
                    if (user.avatar_url.startsWith('https://s120-ava-talk.zadn.vn/')
                      || user.avatar_url.startsWith('https://ava-grp-talk.zadn.vn/')) {
                      senderAvatar = `http://localhost:8055/zalo/avatar-proxy?url=${encodeURIComponent(user.avatar_url)}`
                    }
                    else {
                      senderAvatar = user.avatar_url
                    }
                  }
                  else {
                    senderAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}`
                  }
                }
              }
              catch (e) {
                console.warn('Could not fetch sender info:', e)
              }
            }

            const direction: 'in' | 'out' = newMsg.sender_id === currentUserId.value ? 'out' : 'in'

            // Parse attachments if present
            let parsedAttachments
            if (newMsg.attachments) {
              try {
                parsedAttachments = typeof newMsg.attachments === 'string'
                  ? JSON.parse(newMsg.attachments)
                  : newMsg.attachments
              }
              catch (e) {
                console.warn('Failed to parse attachments:', e)
              }
            }

            const messageToAdd: Message = {
              id: newMsg.id,
              direction,
              text: newMsg.content || '',
              senderName,
              senderId: newMsg.sender_id,
              time: formatTime(newMsg.sent_at),
              avatar: senderAvatar,
              status: direction === 'out' ? 'delivered' : undefined,
              clientId: newMsg.client_id,
              files: parsedAttachments,
            }

            messages.value.push(messageToAdd)

            console.log('✅ [WEBSOCKET] Message added to UI:', {
              id: messageToAdd.id,
              direction: messageToAdd.direction,
              from: messageToAdd.senderName,
              text: messageToAdd.text.substring(0, 30),
              totalMessages: messages.value.length,
            })

            // Update conversation list: move to top and update unread count
            onNewMessage?.(newMsg.conversation_id, messageToAdd)

            if (scrollToBottom) {
              nextTick(scrollToBottom)
            }
          }
        }
      })()
    }
    catch (error) {
      console.error('❌ [SUBSCRIBE] Failed to subscribe:', error)
    }
  }

  /**
   * Cleanup all subscriptions
   */
  function cleanup() {
    if (subscriptionCleanup) {
      subscriptionCleanup()
      subscriptionCleanup = null
    }
    if (globalSubscriptionCleanup) {
      globalSubscriptionCleanup()
      globalSubscriptionCleanup = null
    }
    processedMessageIds.clear()
  }

  /**
   * Add a message ID to processed set (for deduplication)
   */
  function markMessageAsProcessed(messageId: string) {
    processedMessageIds.add(messageId)
  }

  return {
    subscribeToMessages,
    subscribeToAllConversations,
    cleanup,
    markMessageAsProcessed,
  }
}
