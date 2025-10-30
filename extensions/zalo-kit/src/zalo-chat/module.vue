<script setup lang="ts">
import type { Conversation, FileAttachment, Message } from './types'
import { useApi } from '@directus/extensions-sdk'
import { authentication, createDirectus, readItems, readMe, realtime, rest } from '@directus/sdk'
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  ChatHeader,
  ConversationList,
  ConversationSearch,
  EmptyState,
  FileAttachmentPreview,
  ManageAccountsDialog,
  MembersDialog,
  MessageInput,
  MessagesList,
  ProfileDropdown,
  UploadProgress,
} from './components'
import { useFileUpload } from './composables/useFileUpload'
import { useWebSocket } from './composables/useWebSocket'
import { getInitials, getProxiedAvatarUrl, handleImageError } from './utils/avatar'
import { convertEmoticonToEmoji, handleEmojiInsert } from './utils/emoticonConverter'
import { client } from './utils/sdk'
import { highlightSearchText } from './utils/search'
import { formatTime } from './utils/time'

const currentFunction = ref<string | null>(null)
const messageInputRef = ref<HTMLTextAreaElement | null>(null)

function insertEmoji(event: any) {
  const emoji = event?.emoji || event?.data || event?.native || event

  if (!emoji || typeof emoji !== 'string') {
    console.warn('Invalid emoji:', emoji)
    return
  }

  handleEmojiInsert(emoji, messageInputRef, messageText)
}

function openStickerMenu() {
  console.log('Sticker menu opened')
}

function showFunctionA() {
  currentFunction.value = 'A'
}

function showFunctionB() {
  currentFunction.value = 'B'
}

// Reactive data
const api = useApi()
const searchQuery = ref('')
const navSearchQuery = ref('')
const messageSearchQuery = ref('')
const messageText = ref('')
const activeConversationId = ref<string>('')
const messagesContainer = ref<HTMLElement | null>(null)
const conversations = ref<Conversation[]>([])
const messages = ref<Message[]>([])
const loading = ref(false)
const sendingMessage = ref(false)
const currentUserId = ref('system')
const currentUserName = ref('You')
const currentUserAvatar = ref('')
const isAuthenticated = ref(false)
const isLoadingMessages = ref(false)
const isLoadingConversations = ref(false)
const showFilterDropdown = ref(false)
const highlightedMessageId = ref<string | null>(null)
const showMembersDialog = ref(false)
const memberSearchQuery = ref('')
const selectedMembers = ref<string[]>([])
const showManageAccountsDialog = ref(false)

// Mock accounts data - replace with real data from API
const mockAccounts = ref([
  {
    id: '1',
    name: 'Nha Khuyen',
    email: 'nhakhuyen@gmail.com',
    avatar: 'https://i.pravatar.cc/150?img=1',
    isActive: true,
  },
  {
    id: '2',
    name: 'Thien Hoan',
    email: 'thienhoan@gmail.com',
    avatar: 'https://i.pravatar.cc/150?img=2',
    isActive: false,
  },
  {
    id: '3',
    name: 'Giau Le',
    email: 'giaule@gmail.com',
    avatar: 'https://i.pravatar.cc/150?img=3',
    isActive: false,
  },
])
const currentAccountId = ref('1')

const conversationTypeFilter = ref<'all' | 'group' | 'direct'>('all')

// File upload composable
const {
  uploadFiles,
  validateFiles,
  getFileUrl,
  getThumbnailUrl,
  formatFileSize,
  getFileIcon,
  uploadProgress,
  isUploading,
  FILE_CONFIGS,
  MAX_FILES,
} = useFileUpload()
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFiles = ref<File[]>([])
const showFilePreviewDialog = ref(false)
const pendingAttachments = ref<FileAttachment[]>([])

// File upload dialog states
const activeDialog = ref<'upload' | 'url' | 'choose' | null>(null)
const importUrl = ref('')
const importing = ref(false)
const folder = ref<string | null>(null)

// Computed property to check if URL is valid
const isValidURL = computed(() => {
  try {
    const url = new URL(importUrl.value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  }
  catch {
    return false
  }
})

// Filter states
const filterOptions = ref({
  status: {
    online: false,
    offline: false,
  },
  messageType: {
    unread: false,
    important: false,
    archived: false,
  },
})

// Directus WebSocket client
const directusClient = createDirectus('http://localhost:8055')
  .with(authentication())
  .with(realtime())
  .with(rest())

// WebSocket composable
const { subscribeToMessages, subscribeToAllConversations, cleanup: cleanupWebSocket, markMessageAsProcessed } = useWebSocket({
  directusClient,
  restClient: client,
  currentUserId,
  activeConversationId,
  messages,
  onNewMessage: updateConversationOnNewMessage,
  scrollToBottom,
})

// Computed properties
const filteredConversations = computed(() => {
  let filtered = conversations.value

  // Apply conversation search filter
  const query = navSearchQuery.value || searchQuery.value
  if (query) {
    filtered = filtered.filter(
      conv =>
        conv.name.toLowerCase().includes(query.toLowerCase())
        || conv.lastMessage.toLowerCase().includes(query.toLowerCase()),
    )
  }

  // Apply status filters
  const { status, messageType } = filterOptions.value

  if (status.online || status.offline) {
    filtered = filtered.filter((conv) => {
      if (status.online && status.offline)
        return true
      if (status.online)
        return conv.online
      if (status.offline)
        return !conv.online
      return true
    })
  }

  // Apply message type filters
  if (messageType.unread || messageType.important || messageType.archived) {
    filtered = filtered.filter((conv) => {
      if (messageType.unread && conv.unreadCount > 0)
        return true
      if (messageType.important)
        return true // Can add important flag to conversations later
      if (messageType.archived)
        return false // Can add archived flag to conversations later
      return (
        !messageType.unread && !messageType.important && !messageType.archived
      )
    })
  }

  return filtered
})

// Search filtered messages
const searchFilteredMessages = computed(() => {
  if (!messageSearchQuery.value.trim()) {
    return []
  }

  const query = messageSearchQuery.value.toLowerCase().trim()

  return messages.value.filter(message =>
    message.text.toLowerCase().includes(query),
  ).map(message => ({
    ...message,
    highlightedText: highlightSearchText(message.text, messageSearchQuery.value),
  }))
})

// Methods
function clearAllFilters() {
  filterOptions.value = {
    status: {
      online: false,
      offline: false,
    },
    messageType: {
      unread: false,
      important: false,
      archived: false,
    },
  }
  showFilterDropdown.value = false
}

function applyFilters() {
  showFilterDropdown.value = false
}

async function sendMessage() {
  if (!messageText.value.trim() && pendingAttachments.value.length === 0)
    return

  sendingMessage.value = true

  // ✅ Tạo client_id duy nhất
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const tempId = `temp_${Date.now()}`

  try {
    // 1. Prepare attachments data
    const attachments = pendingAttachments.value.map(file => ({
      id: file.id,
      filename: file.filename,
      type: file.type,
      size: file.size,
      url: file.url,
      thumbnail: file.thumbnail,
    }))

    // 2. Create temp message with real user info
    const tempMessage: Message = {
      id: tempId,
      direction: 'out',
      text: messageText.value || '',
      senderName: currentUserName.value,
      senderId: currentUserId.value,
      time: formatTime(new Date().toISOString()),
      avatar: currentUserAvatar.value,
      status: 'sent',
      clientId, // ✅ Thêm clientId để track
      files: attachments.length > 0 ? attachments : undefined,
    }

    messages.value.push(tempMessage)
    const messageContent = messageText.value
    messageText.value = ''

    // Clear pending attachments after creating temp message
    const attachmentsToSend = [...pendingAttachments.value]
    pendingAttachments.value = []

    nextTick(scrollToBottom)

    console.log('🔵 [SEND] Sending with clientId:', clientId)
    console.log('📎 [SEND] Attachments:', attachmentsToSend.length)

    // 3. Send via API với clientId and attachments
    const token = await directusClient.getToken()
    const response = await fetch('http://localhost:8055/zalo/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversationId: activeConversationId.value,
        message: messageContent,
        clientId, // ✅ Gửi clientId lên backend
        attachments: attachmentsToSend.map(file => ({
          fileId: file.id,
          filename: file.filename,
          type: file.type,
          size: file.size,
        })),
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`)
    }

    const result = await response.json()
    console.log('✅ [SEND] Success:', result)

    // 3. Update temp message with real data (keep it, don't remove)
    const tempIndex = messages.value.findIndex(m => m.id === tempId)
    if (tempIndex !== -1 && messages.value[tempIndex]) {
      // Mark as sent and add clientId for deduplication
      messages.value[tempIndex].status = 'delivered'
      messages.value[tempIndex].clientId = clientId

      // Add to processed set to prevent duplicate from WebSocket
      const realMessageId = result.data?.messageId || result.data?.id || result.messageId
      if (realMessageId) {
        markMessageAsProcessed(realMessageId)
        console.log('✅ [SEND] Marked message as processed:', realMessageId)
      }

      console.log('✅ [SEND] Message marked as delivered, clientId:', clientId)
    }

    // Update conversation's last message preview
    const conversation = conversations.value.find(c => c.id === activeConversationId.value)
    if (conversation) {
      conversation.lastMessage = messageContent.substring(0, 50)
      conversation.timestamp = formatTime(new Date().toISOString())
      console.log('✅ [SEND] Updated conversation preview:', conversation.name)
    }

    // WebSocket will update with real message ID when it arrives
  }
  catch (error: any) {
    console.error('❌ [SEND] Error:', error)

    // Mark temp message as failed
    const messageIndex = messages.value.findIndex(m => m.id === tempId)
    if (messageIndex !== -1 && messages.value[messageIndex]) {
      messages.value[messageIndex].status = 'failed'
    }
  }
  finally {
    sendingMessage.value = false
  }
}

// Backend integration functions
async function autoLogin() {
  try {
    // 1. Login REST client first to get token
    await client.login({
      email: 'admin@example.com',
      password: 'd1r3ctu5',
    })
    console.log('✅ REST client authenticated')

    // 2. Get the auth token from REST client
    const token = await client.getToken()
    console.log('✅ Token obtained:', token ? 'Yes' : 'No')

    // 3. Set token for WebSocket client BEFORE connecting
    if (token) {
      await directusClient.setToken(token)
      console.log('✅ Token set for WebSocket')
    }

    // 4. Now connect WebSocket (with token already set)
    await directusClient.connect()
    console.log('✅ WebSocket connected and authenticated')

    isAuthenticated.value = true

    // Start global subscription for ALL conversations
    subscribeToAllConversations()

    // 5. Get current Zalo user ID and user info
    try {
      const response = await fetch('http://localhost:8055/zalo/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()
      if (data?.userId) {
        currentUserId.value = data.userId
        console.log('✅ Current Zalo user ID:', currentUserId.value)

        // 6. Fetch Zalo user info (name & avatar)
        try {
          const users = await client.request(
            readItems('zalo_users' as any, {
              fields: ['display_name', 'zalo_name', 'avatar_url'],
              filter: { id: { _eq: data.userId } },
              limit: 1,
            }),
          )

          const currentUser = users[0]
          if (currentUser) {
            currentUserName.value = currentUser.display_name || currentUser.zalo_name || 'You'

            // Proxy Zalo avatar URLs to avoid CORS
            if (currentUser.avatar_url) {
              if (currentUser.avatar_url.startsWith('https://s120-ava-talk.zadn.vn/')
                || currentUser.avatar_url.startsWith('https://ava-grp-talk.zadn.vn/')) {
                currentUserAvatar.value = `http://localhost:8055/zalo/avatar-proxy?url=${encodeURIComponent(currentUser.avatar_url)}`
              }
              else {
                currentUserAvatar.value = currentUser.avatar_url
              }
            }
            else {
              currentUserAvatar.value = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserName.value)}`
            }

            console.log('✅ Current user info:', { name: currentUserName.value, hasAvatar: !!currentUser.avatar_url })
          }
        }
        catch (e) {
          console.warn('⚠️ Could not fetch user info:', e)
        }
      }
    }
    catch (e) {
      console.warn('⚠️ Could not get Zalo User ID:', e)
    }
  }
  catch (error) {
    console.error('❌ Authentication failed:', error)
    isAuthenticated.value = false
  }
}

let isSelectingConversation = false

function selectConversation(id: string) {
  if (isSelectingConversation) {
    console.log('⏭️ Already selecting conversation, skipping')
    return
  }

  if (activeConversationId.value === id) {
    console.log('⏭️ Conversation already active:', id)
    return
  }

  isSelectingConversation = true

  console.log('🔵 Selecting conversation:', id)

  activeConversationId.value = id
  messages.value = []

  // Reset unread count when selecting conversation
  const conversation = conversations.value.find(c => c.id === id)
  if (conversation && conversation.unreadCount > 0) {
    console.log('✅ Clearing', conversation.unreadCount, 'unread messages for', conversation.name)
    conversation.unreadCount = 0
  }

  loadMessages(id).finally(() => {
    if (isAuthenticated.value) {
      subscribeToMessages(id)
    }
    isSelectingConversation = false
  })
}

async function loadConversations() {
  if (!isAuthenticated.value) {
    console.warn('⚠️ Not authenticated')
    return
  }

  if (isLoadingConversations.value) {
    console.log('⏳ Already loading conversations, skipping...')
    return
  }

  try {
    loading.value = true
    isLoadingConversations.value = true

    const data = await client.request(
      readItems('zalo_conversations', {
        fields: ['*'],
        filter: {
          is_hidden: { _eq: false },
        } as any,
        sort: ['-is_pinned', '-last_message_time'],
        limit: 100,
      }),
    )

    console.log(`📥 Loaded ${data.length} conversations`)

    const groupIds = [...new Set(
      data
        .filter((conv: any) => conv.group_id && conv.group_id !== null)
        .map((conv: any) => conv.group_id),
    )]

    const participantIds = [...new Set(
      data
        .filter((conv: any) => conv.participant_id && conv.participant_id !== null)
        .map((conv: any) => String(conv.participant_id)),
    )]

    let groupsMap = new Map()
    let groupMembersMap = new Map() // Map<groupId, userId[]>

    console.log('🔍 Found', groupIds.length, 'groups to load:', groupIds)

    if (groupIds.length > 0) {
      const groups = await client.request(
        readItems('zalo_groups' as any, {
          fields: ['id', 'name', 'avatar_url'],
          filter: { id: { _in: groupIds } },
          limit: -1,
        }),
      )
      groupsMap = new Map(groups.map((g: any) => [g.id, g]))
      console.log('📦 Loaded', groups.length, 'group info')

      // Load group members for multi-avatar display (chỉ lấy active members)
      // ⚠️ Chỉ load members cho groups có ít members để tránh quá tải
      console.log('🔍 Loading members for', groupIds.length, 'groups')

      // Load tất cả members (không filter is_active để test)
      const allActiveMembers = await client.request(
        readItems('zalo_group_members' as any, {
          fields: ['group_id', 'user_id', 'is_active'],
          filter: {},
          limit: -1,
        }),
      )

      // Filter is_active ở client side
      const activeMembers = allActiveMembers.filter((m: any) => m.is_active === true)

      console.warn('📥 Raw members loaded:', allActiveMembers.length, '| Active:', activeMembers.length)

      // Filter chỉ lấy members của groups trong conversations
      const groupIdsSet = new Set(groupIds)
      const groupMembers = activeMembers.filter((m: any) => groupIdsSet.has(m.group_id))

      console.log('✅ Filtered to', groupMembers.length, 'members for conversations groups')

      console.warn('📥 Raw members loaded:', groupMembers.length, groupMembers.slice(0, 5))

      // Group members by group_id
      groupMembers.forEach((gm: any) => {
        if (!groupMembersMap.has(gm.group_id)) {
          groupMembersMap.set(gm.group_id, [])
        }
        groupMembersMap.get(gm.group_id).push(gm.user_id)
      })

      console.warn('🔍 Group 4577988136770414902 has', groupMembersMap.get('4577988136770414902')?.length || 0, 'members')

      console.log('📥 Loaded members for', groupMembersMap.size, 'groups, total active members:', groupMembers.length)
      console.log('📊 Members map:', Object.fromEntries(groupMembersMap))
    }

    // Collect all user IDs: participants + group members
    const allUserIds = new Set([
      ...participantIds,
      ...Array.from(groupMembersMap.values()).flat(),
    ])

    console.log('👥 Loading', allUserIds.size, 'users (participants + members)')

    let usersMap = new Map()
    if (allUserIds.size > 0) {
      const users = await client.request(
        readItems('zalo_users' as any, {
          fields: ['id', 'display_name', 'zalo_name', 'avatar_url'],
          filter: { id: { _in: Array.from(allUserIds) } },
          limit: -1,
        }),
      )
      usersMap = new Map(users.map((u: any) => [u.id, u]))
      console.log('✅ Loaded', users.length, 'user records into usersMap')
      console.log('👤 User IDs in map:', Array.from(usersMap.keys()).slice(0, 5))
    }

    conversations.value = data.map((conv: any) => {
      let name = 'Unknown'
      let avatar = ''
      let type: 'group' | 'direct' = 'group'
      let memberAvatars: any[] = []
      let hasRealAvatar = false // Flag to track if group has real avatar (not fallback)

      if (conv.participant_id && conv.participant_id !== null) {
        type = 'direct'
        const user = usersMap.get(conv.participant_id)
        if (user) {
          name = user.display_name || user.zalo_name || 'Unknown User'

          // Proxy Zalo avatar URLs to avoid CORS
          if (user.avatar_url) {
            if (user.avatar_url.startsWith('https://s120-ava-talk.zadn.vn/')
              || user.avatar_url.startsWith('https://ava-grp-talk.zadn.vn/')) {
              avatar = `http://localhost:8055/zalo/avatar-proxy?url=${encodeURIComponent(user.avatar_url)}`
            }
            else {
              avatar = user.avatar_url
            }
          }
          else {
            avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5`
          }
        }
        else {
          name = `User ${conv.participant_id.substring(0, 8)}`
          avatar = `https://ui-avatars.com/api/?name=U&background=4F46E5`
        }
      }
      else if (conv.group_id && conv.group_id !== null) {
        type = 'group'
        const group = groupsMap.get(conv.group_id)

        // Get members for this group (for multi-avatar display)
        const memberUserIds = groupMembersMap.get(conv.group_id) || []

        console.log('🔍 Group members:', {
          groupId: conv.group_id,
          groupName: group?.name,
          memberCount: memberUserIds.length,
          memberIds: memberUserIds.slice(0, 3),
        })

        // Get avatar for first 3 members (để hiển thị avatar tam giác)
        for (const userId of memberUserIds.slice(0, 3)) {
          const user = usersMap.get(userId)
          if (user) {
            let memberAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name || user.zalo_name || 'U')}&background=10B981&color=fff`

            if (user.avatar_url) {
              // Proxy Zalo avatar URLs to avoid CORS
              if (user.avatar_url.startsWith('https://s120-ava-talk.zadn.vn/')
                || user.avatar_url.startsWith('https://ava-grp-talk.zadn.vn/')) {
                memberAvatar = `http://localhost:8055/zalo/avatar-proxy?url=${encodeURIComponent(user.avatar_url)}`
              }
              else {
                memberAvatar = user.avatar_url
              }
            }

            memberAvatars.push({
              id: userId,
              name: user.display_name || user.zalo_name || 'User',
              avatar: memberAvatar,
            })
          }
          else {
            console.warn('⚠️ User not found in usersMap:', userId)
          }
        }

        console.log(`📥 Group ${conv.group_id} has ${memberAvatars.length} member avatars loaded`)

        if (group) {
          name = group.name || 'Unknown Group'

          // Handle avatar URL
          if (group.avatar_url) {
            hasRealAvatar = true
            // If it's a Zalo CDN URL, proxy it to avoid CORS
            if (group.avatar_url.startsWith('https://ava-grp-talk.zadn.vn/')
              || group.avatar_url.startsWith('https://s120-ava-talk.zadn.vn/')) {
              avatar = `http://localhost:8055/zalo/avatar-proxy?url=${encodeURIComponent(group.avatar_url)}`
            }
            // If it's a Directus file ID (UUID format)
            else if (group.avatar_url.match(/^[a-f0-9-]{36}$/i)) {
              avatar = `http://localhost:8055/assets/${group.avatar_url}`
            }
            // If it's a path starting with /
            else if (group.avatar_url.startsWith('/')) {
              avatar = `http://localhost:8055${group.avatar_url}`
            }
            // If it's another HTTP URL, use as-is
            else if (group.avatar_url.startsWith('http')) {
              avatar = group.avatar_url
            }
            // Otherwise treat as relative path to assets
            else {
              avatar = `http://localhost:8055/assets/${group.avatar_url}`
            }
            console.log('🖼️ Group avatar loaded:', {
              groupId: conv.group_id,
              name,
              originalUrl: group.avatar_url,
              finalUrl: avatar,
            })
          }
          else {
            // Use data URI for group icon (similar to Zalo's default group icon)
            avatar = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjMTBCOTgxIi8+PHBhdGggZD0iTTE1IDEzQzE1IDExLjM0MzEgMTYuMzQzMSAxMCAxOCAxMEMyMC4yMDkxIDEwIDIyIDExLjc5MDkgMjIgMTRDMjIgMTYuMjA5MSAyMC4yMDkxIDE4IDE4IDE4QzE2LjM0MzEgMTggMTUgMTYuNjU2OSAxNSAxNVYxM1oiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTI1IDEzQzI1IDExLjM0MzEgMjYuMzQzMSAxMCAyOCAxMEMyOS42NTY5IDEwIDMxIDExLjM0MzEgMzEgMTNDMzEgMTQuNjU2OSAyOS42NTY5IDE2IDI4IDE2QzI2LjM0MzEgMTYgMjUgMTQuNjU2OSAyNSAxM1oiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTEwIDI2QzEwIDIzLjIzODYgMTIuMjM4NiAyMSAxNSAyMUgyMUMyMy43NjE0IDIxIDI2IDIzLjIzODYgMjYgMjZWMjhDMjYgMjguNTUyMyAyNS41NTIzIDI5IDI1IDI5SDExQzEwLjQ0NzcgMjkgMTAgMjguNTUyMyAxMCAyOFYyNloiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTI0IDI2QzI0IDI0LjM0MzEgMjUuMzQzMSAyMyAyNyAyM0gzMEMzMS42NTY5IDIzIDMzIDI0LjM0MzEgMzMgMjZWMjhDMzMgMjguNTUyMyAzMi41NTIzIDI5IDMyIDI5SDI1QzI0LjQ0NzcgMjkgMjQgMjguNTUyMyAyNCAyOFYyNloiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuNyIvPjwvc3ZnPg=='
            console.log('🖼️ Group using fallback icon:', { groupId: conv.group_id, name })
          }
        }
        else {
          name = `Group ${conv.group_id.substring(0, 8)}`
          avatar = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjMTBCOTgxIi8+PHBhdGggZD0iTTE1IDEzQzE1IDExLjM0MzEgMTYuMzQzMSAxMCAxOCAxMEMyMC4yMDkxIDEwIDIyIDExLjc5MDkgMjIgMTRDMjIgMTYuMjA5MSAyMC4yMDkxIDE4IDE4IDE4QzE2LjM0MzEgMTggMTUgMTYuNjU2OSAxNSAxNVYxM1oiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTI1IDEzQzI1IDExLjM0MzEgMjYuMzQzMSAxMCAyOCAxMEMyOS42NTY5IDEwIDMxIDExLjM0MzEgMzEgMTNDMzEgMTQuNjU2OSAyOS42NTY5IDE2IDI4IDE2QzI2LjM0MzEgMTYgMjUgMTQuNjU2OSAyNSAxM1oiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTEwIDI2QzEwIDIzLjIzODYgMTIuMjM4NiAyMSAxNSAyMUgyMUMyMy43NjE0IDIxIDI2IDIzLjIzODYgMjYgMjZWMjhDMjYgMjguNTUyMyAyNS41NTIzIDI5IDI1IDI5SDExQzEwLjQ0NzcgMjkgMTAgMjguNTUyMyAxMCAyOFYyNloiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTI0IDI2QzI0IDI0LjM0MzEgMjUuMzQzMSAyMyAyNyAyM0gzMEMzMS42NTY5IDIzIDMzIDI0LjM0MzEgMzMgMjZWMjhDMzMgMjguNTUyMyAzMi41NTIzIDI5IDMyIDI5SDI1QzI0LjQ0NzcgMjkgMjQgMjguNTUyMyAyNCAyOFYyNloiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuNyIvPjwvc3ZnPg=='
          console.log('⚠️ Group not found in map:', conv.group_id)
        }
      }

      const result = {
        id: conv.id,
        name,
        avatar,
        lastMessage: '',
        timestamp: formatTime(conv.last_message_time),
        unreadCount: conv.unread_count || 0,
        online: true,
        type,
        members: memberAvatars, // Array of member objects with avatar URLs
        hasRealAvatar, // True only if group has real avatar_url (not fallback)
      }

      if (memberAvatars.length > 0) {
        console.warn(`✨ Conversation ${name} has ${memberAvatars.length} member avatars:`, memberAvatars.map(m => m.name))
      }

      return result
    })

    console.log(`✅ Conversations loaded`)

    if (conversations.value.length > 0 && !activeConversationId.value) {
      conversations.value[0]?.id && selectConversation(conversations.value[0].id)
    }
  }
  catch (error: any) {
    console.error('❌ Error loading conversations:', error)
  }
  finally {
    loading.value = false
    isLoadingConversations.value = false
  }
}

async function loadMessages(conversationId: string) {
  if (!isAuthenticated.value || !conversationId)
    return

  if (isLoadingMessages.value) {
    console.log('⏭️ Already loading messages')
    return
  }

  console.log('🔵 Loading initial messages for:', conversationId)

  try {
    isLoadingMessages.value = true

    // Get current user ID if needed
    if (currentUserId.value === 'system') {
      try {
        const me = await client.request(readMe({ fields: ['id'] }))
        if (me?.id)
          currentUserId.value = me.id
      }
      catch (e) {
        console.warn('⚠️ Could not get current user ID:', e)
      }
    }

    // Fetch messages from DB
    const data = await client.request(
      readItems('zalo_messages' as any, {
        fields: ['*'],
        filter: {
          conversation_id: { _eq: conversationId },
        },
        sort: ['sent_at'],
        limit: 50,
      }),
    )

    console.log('📥 Loaded', data.length, 'messages from DB')

    // Get unique sender IDs
    const senderIds = [...new Set(data.map((msg: any) => msg.sender_id).filter(Boolean))]

    // Fetch users
    let usersMap = new Map()
    if (senderIds.length > 0) {
      const users = await client.request(
        readItems('zalo_users' as any, {
          fields: ['id', 'display_name', 'zalo_name', 'avatar_url'],
          filter: { id: { _in: senderIds } },
          limit: -1,
        }),
      )
      usersMap = new Map(users.map((u: any) => [u.id, u]))
    }

    // Map messages
    messages.value = data.map((msg: any) => {
      const user = usersMap.get(msg.sender_id)
      const senderName = user?.display_name || user?.zalo_name || 'Unknown'

      // Proxy Zalo avatar URLs to avoid CORS
      let senderAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}`
      if (user?.avatar_url) {
        if (user.avatar_url.startsWith('https://s120-ava-talk.zadn.vn/')
          || user.avatar_url.startsWith('https://ava-grp-talk.zadn.vn/')) {
          senderAvatar = `http://localhost:8055/zalo/avatar-proxy?url=${encodeURIComponent(user.avatar_url)}`
        }
        else {
          senderAvatar = user.avatar_url
        }
      }

      const direction: 'in' | 'out' = msg.sender_id === currentUserId.value ? 'out' : 'in'

      return {
        id: msg.id,
        direction,
        text: msg.content || '',
        senderName,
        senderId: msg.sender_id,
        time: formatTime(msg.sent_at),
        avatar: senderAvatar,
        status: direction === 'out' ? 'read' : undefined,
      }
    })

    console.log('✅ Loaded', messages.value.length, 'messages')

    nextTick(scrollToBottom)
  }
  catch (error: any) {
    console.error('❌ Error loading messages:', error)
  }
  finally {
    isLoadingMessages.value = false
  }
}

function updateConversationOnNewMessage(conversationId: string, message: any) {
  const convIndex = conversations.value.findIndex(c => c.id === conversationId)

  if (convIndex === -1) {
    console.warn('⚠️ Conversation not found:', conversationId)
    return
  }

  const conversation = conversations.value[convIndex]
  if (!conversation)
    return

  // Update last message preview
  conversation.lastMessage = message.text?.substring(0, 50) || ''
  conversation.timestamp = message.time

  // If not the active conversation, increment unread count
  if (conversationId !== activeConversationId.value) {
    conversation.unreadCount = (conversation.unreadCount || 0) + 1
    console.log('📬 Updated unread count for', conversation.name, ':', conversation.unreadCount)
  }

  // Move conversation to top of list
  if (convIndex > 0) {
    conversations.value.splice(convIndex, 1)
    conversations.value.unshift(conversation)
    console.log('⬆️ Moved conversation to top:', conversation.name)
  }
}

// File Upload Functions
function triggerFileInput() {
  activeDialog.value = 'upload'
  if (fileInput.value) {
    fileInput.value.click()
  }
}

function removePendingAttachment(index: number) {
  pendingAttachments.value.splice(index, 1)
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const files = Array.from(target.files)
    selectedFiles.value = files
    activeDialog.value = null
    showFilePreviewDialog.value = true
  }
}

function removeFileFromPreview(index: number) {
  selectedFiles.value.splice(index, 1)
  if (selectedFiles.value.length === 0) {
    showFilePreviewDialog.value = false
  }
}

function cancelFileUpload() {
  selectedFiles.value = []
  showFilePreviewDialog.value = false
}

async function confirmAndUploadFiles() {
  showFilePreviewDialog.value = false
  await uploadSelectedFiles()
}

async function uploadSelectedFiles() {
  if (selectedFiles.value.length === 0)
    return

  try {
    const result = await uploadFiles(selectedFiles.value, activeConversationId.value)
    if (result.success && result.success.length > 0) {
      const attachments: FileAttachment[] = result.success.map((file: any) => ({
        id: file.id,
        filename: file.filename_download || file.title || 'Unknown',
        type: file.type || 'application/octet-stream',
        size: file.filesize || 0,
        url: getFileUrl(file.id),
        thumbnail: file.type?.startsWith('image/') ? getThumbnailUrl(file.id) : undefined,
        width: file.width,
        height: file.height,
      }))
      pendingAttachments.value.push(...attachments)
    }
    selectedFiles.value = []
  }
  catch (error) {
    console.error('Failed to upload files:', error)
  }
}

async function onUpload(value: any) {
  console.log('Files uploaded from device:', value)

  if (!value) {
    activeDialog.value = null
    return
  }

  try {
    // v-upload returns file IDs directly
    const fileIds = Array.isArray(value) ? value : [value]

    // Fetch file details from Directus
    const fileDetails = await Promise.all(
      fileIds.map(async (id: string) => {
        try {
          const response = await api.get(`/files/${id}`)
          const file = response.data.data
          return {
            id: file.id,
            filename: file.filename_download || file.title || 'Unknown',
            type: file.type || 'application/octet-stream',
            size: file.filesize || 0,
            url: getFileUrl(file.id),
            thumbnail: file.type?.startsWith('image/') ? getThumbnailUrl(file.id) : undefined,
            width: file.width,
            height: file.height,
          }
        }
        catch (error) {
          console.error('Failed to fetch file details:', error)
          return null
        }
      }),
    )

    // Filter out null values and add to pending attachments
    const validFiles = fileDetails.filter(Boolean) as FileAttachment[]
    pendingAttachments.value.push(...validFiles)

    console.log('✅ Added files to pending attachments:', validFiles.length)
  }
  catch (error) {
    console.error('Failed to process uploaded files:', error)
  }
  finally {
    activeDialog.value = null
  }
}

async function onSelectFromLibrary(value: any) {
  console.log('Files selected from library:', value)

  if (!value) {
    activeDialog.value = null
    return
  }

  try {
    // drawer-files returns file IDs
    const fileIds = Array.isArray(value) ? value : [value]

    // Fetch file details from Directus
    const fileDetails = await Promise.all(
      fileIds.map(async (id: string) => {
        try {
          const response = await api.get(`/files/${id}`)
          const file = response.data.data
          return {
            id: file.id,
            filename: file.filename_download || file.title || 'Unknown',
            type: file.type || 'application/octet-stream',
            size: file.filesize || 0,
            url: getFileUrl(file.id),
            thumbnail: file.type?.startsWith('image/') ? getThumbnailUrl(file.id) : undefined,
            width: file.width,
            height: file.height,
          }
        }
        catch (error) {
          console.error('Failed to fetch file details:', error)
          return null
        }
      }),
    )

    // Filter out null values and add to pending attachments
    const validFiles = fileDetails.filter(Boolean) as FileAttachment[]
    pendingAttachments.value.push(...validFiles)

    console.log('✅ Added files from library:', validFiles.length)
  }
  catch (error) {
    console.error('Failed to process selected files:', error)
  }
  finally {
    activeDialog.value = null
  }
}

async function importFromURL() {
  if (!isValidURL.value || !importUrl.value)
    return

  importing.value = true
  try {
    console.log('Importing from URL:', importUrl.value)

    // Fetch file from URL
    const response = await fetch(importUrl.value)

    if (!response.ok)
      throw new Error(`Failed to fetch file: ${response.statusText}`)

    // Get blob data
    const blob = await response.blob()

    // Extract filename from URL or content-disposition header
    let filename = 'imported-file'
    const contentDisposition = response.headers.get('content-disposition')
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (filenameMatch && filenameMatch[1])
        filename = filenameMatch[1].replace(/['"]/g, '')
    }
    else {
      // Extract from URL
      const urlPath = new URL(importUrl.value).pathname
      const urlFilename = urlPath.substring(urlPath.lastIndexOf('/') + 1)
      if (urlFilename)
        filename = urlFilename
    }

    // Get content type
    const contentType = response.headers.get('content-type') || blob.type || 'application/octet-stream'

    // Create File object
    const file = new File([blob], filename, { type: contentType })

    // Validate file
    const validation = validateFiles([file])
    if (!validation.valid)
      throw new Error(validation.errors[0] || 'Invalid file')

    // Upload file to Directus
    const result = await uploadFiles([file], activeConversationId.value)

    if (result.success.length > 0) {
      // Map uploaded file to FileAttachment
      const uploadedFile = result.success[0]
      if (!uploadedFile)
        throw new Error('Upload succeeded but no file data returned')

      const attachment: FileAttachment = {
        id: uploadedFile.id,
        filename: uploadedFile.filename_download,
        type: uploadedFile.type,
        size: uploadedFile.filesize,
        url: getFileUrl(uploadedFile.id),
        thumbnail: uploadedFile.type.startsWith('image/') ? getThumbnailUrl(uploadedFile.id) : undefined,
        width: uploadedFile.width,
        height: uploadedFile.height,
      }

      pendingAttachments.value.push(attachment)
      console.log('✅ File imported and uploaded:', attachment.filename)

      // Reset form
      activeDialog.value = null
      importUrl.value = ''
    }
    else if (result.errors.length > 0) {
      const firstError = result.errors[0]
      throw new Error(firstError?.error || 'Upload failed')
    }
  }
  catch (error) {
    console.error('Failed to import from URL:', error)
    // TODO: Show error notification to user
    alert(`Failed to import file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  finally {
    importing.value = false
  }
}

// Members dialog functions
function toggleMemberSelection(memberId: string) {
  const index = selectedMembers.value.indexOf(memberId)
  if (index > -1) {
    selectedMembers.value.splice(index, 1)
  }
  else {
    selectedMembers.value.push(memberId)
  }
}

function removeMember(memberId: string) {
  const index = selectedMembers.value.indexOf(memberId)
  if (index > -1) {
    selectedMembers.value.splice(index, 1)
  }
}

// Get active conversation object
const activeConversation = computed(() => {
  const conv = conversations.value.find(
    conv => conv.id === activeConversationId.value,
  )

  if (conv) {
    console.log('📋 Active Conversation:', {
      id: conv.id,
      name: conv.name,
      type: conv.type,
      hasAvatar: !!conv.avatar,
      avatarPreview: conv.avatar?.substring(0, 50),
      memberCount: conv.members?.length || 0,
    })
  }

  return conv
})

// Conversation stats by type
const conversationStats = computed(() => {
  const all = conversations.value.length
  const group = conversations.value.filter(c => c.type === 'group').length
  const direct = conversations.value.filter(c => c.type === 'direct').length

  return { all, group, direct }
})

// Get current messages (all messages are in messages.value now)
const currentMessages = computed(() => {
  return messages.value
})

// Get selected member objects
const selectedMemberObjects = computed(() => {
  return conversations.value.filter(member =>
    selectedMembers.value.includes(member.id),
  )
})

// Create group function (commented out - not implemented in BE yet)
function createGroup() {
  if (selectedMembers.value.length === 0) {
    return
  }
  // Group creation logic not implemented
  console.log('Create group with members:', selectedMembers.value)
}

// Manage accounts handlers
function handleManageAccounts() {
  showManageAccountsDialog.value = true
}

function handleSwitchAccount(accountId: string) {
  console.log('Switching to account:', accountId)
  currentAccountId.value = accountId
  // Update mock data
  mockAccounts.value = mockAccounts.value.map(acc => ({
    ...acc,
    isActive: acc.id === accountId,
  }))
  // TODO: Implement actual account switching logic
  // - Clear current data
  // - Re-authenticate with new account
  // - Reload conversations
  showManageAccountsDialog.value = false
}

function handleAddAccount() {
  console.log('Add new account clicked')
  // TODO: Implement add account flow
  // - Navigate to account setup
  // - Or show account connection dialog
  showManageAccountsDialog.value = false
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function navigateToMessage(messageId: string) {
  // Highlight the message
  highlightedMessageId.value = messageId

  // Wait for next tick to ensure DOM is updated
  nextTick(() => {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`)
    if (messageElement && messagesContainer.value) {
      // Scroll to the message
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })

      // Remove highlight after 3 seconds
      setTimeout(() => {
        highlightedMessageId.value = null
      }, 3000)
    }
  })
}

function handleFilter() {
  showFilterDropdown.value = !showFilterDropdown.value
}

function handleAddUser() {
  showMembersDialog.value = true
}

function openMembersDialog() {
  showMembersDialog.value = true
}

function closeMembersDialog() {
  showMembersDialog.value = false
  memberSearchQuery.value = ''
  selectedMembers.value = []
}

function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement
  const filterButton = target.closest('.filter-dropdown-container')
  if (!filterButton && showFilterDropdown.value) {
    showFilterDropdown.value = false
  }
}

// Lifecycle hooks
onMounted(async () => {
  console.log('🔵 Component mounted')

  await autoLogin()
  await loadConversations()

  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  console.log('🧹 Cleaning up WebSocket')
  cleanupWebSocket()
  directusClient.disconnect()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

watch(activeConversationId, (newId) => {
  if (newId && isAuthenticated.value) {
    subscribeToMessages(newId)
    nextTick(scrollToBottom)
  }
})

// Filtered members for search
const filteredMembers = computed(() => {
  if (!memberSearchQuery.value.trim()) {
    return conversations.value
  }

  return conversations.value.filter(member =>
    member.name.toLowerCase().includes(memberSearchQuery.value.toLowerCase()),
  )
})

// End of script
</script>

<template>
  <private-view title="Messages">
    <template #title-outer:prepend>
      <v-button class="header-icon" rounded disabled icon secondary>
        <v-icon name="inbox" />
      </v-button>
    </template>

    <!-- Sidebar tùy biến theo trạng thái -->
    <template #sidebar>
      <sidebar-detail v-if="currentFunction === 'A'" icon="search" class="my-sidebar-detail" title="Search for messages" close>
        <!-- Search and Filter Section -->

        <div class="search-container space-y-4">
          <!-- Search Input với style mới -->
          <div class="search-input-section">
            <div class="relative border rounded-xl shadow-sm">
              <input
                v-model="messageSearchQuery"
                type="text"
                placeholder="Search in conversation"
                class="w-full pl-9 pr-3 py-4 text-sm bg-gray-50 rounded-xl focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
              >
            </div>
          </div>

          <div class="flex items-center justify-between">
            <h1 class="text-lg text-gray-900">
              Filter:
            </h1>

            <div
              v-if="showFilterDropdown"
              class="fixed top-13 left-100 w-56 mt-2 bg-white border-neutral-200 rounded-lg shadow-xl z-[9999]"
            />
            <div class="relative filter-dropdown-container">
              <button
                class="flex items-center gap-1 px-2 py-1 text-[14px] font-medium leading-normal not-italic rounded-[var(--Button-Radius-button,6px)] !border !border-solid !border-[var(--border-normal,#D3DAE4)] text-[var(--foreground-normal,#4F5464)] font-[Inter] transition-colors"
                :class="{ 'bg-neutral-100': showFilterDropdown }"
                @click="handleFilter"
              >
                <span>Sender</span>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  :class="{ 'rotate-180': showFilterDropdown }"
                  class="transition-transform duration-200"
                >
                  <path
                    d="M19.92 8.94995L13.4 15.47C12.63 16.24 11.37 16.24 10.6 15.47L4.07996 8.94995"
                    stroke="#4F5464"
                    stroke-width="2"
                    stroke-miterlimit="10"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div class="relative filter-dropdown-container">
              <button
                class="flex items-center gap-1 px-4 py-1 text-[14px] font-medium leading-normal not-italic rounded-[var(--Button-Radius-button,6px)] !border !border-solid !border-[var(--border-normal,#D3DAE4)] text-[var(--foreground-normal,#4F5464)] font-[Inter] transition-colors"
                :class="{ 'bg-neutral-100': showFilterDropdown }"
                @click="handleFilter"
              >
                <span>Date</span>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  :class="{ 'rotate-180': showFilterDropdown }"
                  class="transition-transform duration-200"
                >
                  <path
                    d="M19.92 8.94995L13.4 15.47C12.63 16.24 11.37 16.24 10.6 15.47L4.07996 8.94995"
                    stroke="#4F5464"
                    stroke-width="2"
                    stroke-miterlimit="10"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <!-- Search Results Summary -->
          <div class="search-results-summary py-3 border-gray-200">
            <div class="flex items-center justify-between">
              <label class="text-xl font-semibold text-gray-900">Messages</label>
              <span v-if="messageSearchQuery.trim()" class="text-sm text-gray-500">
                {{ searchFilteredMessages.length }} {{ searchFilteredMessages.length === 1 ? 'message' : 'messages' }} found
              </span>
            </div>
          </div>

          <!-- No Search Query State -->
          <div v-if="!messageSearchQuery.trim()" class="text-center py-8">
            <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p class="text-gray-500 text-sm">
              Enter a search term to find messages
            </p>
          </div>

          <!-- No Results State -->
          <div v-else-if="searchFilteredMessages.length === 0" class="text-center py-8">
            <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 515.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.291.974-5.709 2.291" />
            </svg>
            <p class="text-gray-500 text-sm">
              No messages found for "{{ messageSearchQuery }}"
            </p>
          </div>

          <!-- Search Results -->
          <div v-else class="search-results space-y-3">
            <div
              v-for="message in searchFilteredMessages"
              :key="message.id"
              class="result-item cursor-pointer transition-all"
              title="Click to navigate to this message"
              @click="navigateToMessage(message.id)"
            >
              <div class="flex items-start gap-3">
                <div
                  class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white"
                  :class="message.senderName === 'Olivia Rhye' ? 'bg-pink-500' : 'bg-gray-500'"
                >
                  {{ getInitials(message.senderName) }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1 justify-between">
                    <span class="text-sm font-semibold text-gray-900">{{ message.senderName }}</span>
                    <span class="text-xs text-gray-500">{{ message.time }}</span>
                  </div>
                  <p class="text-sm text-gray-600 leading-relaxed" v-html="message.highlightedText" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </sidebar-detail>
      <sidebar-detail v-if="currentFunction === 'B'" class="my-sidebar-detail" icon="info" title="Conversation information" close />
      <sidebar-detail v-if="currentFunction === 'B'" class="my-sidebar-detail" icon="swap_vert" title="Image/video" />
      <sidebar-detail v-if="currentFunction === 'B'" class="my-sidebar-detail" icon="layers" title="Link" />
      <sidebar-detail v-if="currentFunction === 'B'" class="my-sidebar-detail" icon="sync_disabled" title="File" />
    </template>

    <template #navigation>
      <!-- User Profile Component -->
      <ProfileDropdown
        :user-name="currentUserName"
        :user-id="currentUserId"
        :user-avatar="currentUserAvatar"
        @manage-accounts="handleManageAccounts"
      />

      <!-- Separator -->
      <div class="nav-separator" />

      <!-- Conversation Panel -->
      <div class="conversation-panel">
        <!-- Search Component -->
        <ConversationSearch
          v-model:search-query="navSearchQuery"
          v-model:show-filter-dropdown="showFilterDropdown"
          @add-user="handleAddUser"
          @filter="handleFilter"
        />

        <!-- Conversation List -->
        <ConversationList
          :conversations="filteredConversations"
          :active-conversation-id="activeConversationId"
          @select-conversation="selectConversation"
        />
      </div>
    </template>

    <!-- Main Chat Area với absolute positioning -->
    <div class="chat-container">
      <!-- Chat Header - Fixed tại top -->
      <ChatHeader
        v-if="activeConversation"
        :conversation="activeConversation"
        @open-members="openMembersDialog"
        @open-search="showFunctionA"
        @open-info="showFunctionB"
      />

      <!-- Messages area - Scrollable với padding cho header và input -->
      <div
        v-if="activeConversation"
        ref="messagesContainer"
        class="messages-area"
      >
        <div
          class="min-h-full flex flex-col justify-end"
        >
          <div class="space-y-1">
            <div
              v-for="message in currentMessages"
              :key="message.id"
              :data-message-id="message.id"
              class="flex gap-4 px-8 py-3 transition-all duration-300"
              :class="[
                {
                  'justify-center': message.type === 'system',
                  'justify-start': message.type !== 'system',
                  'bg-gray-200': highlightedMessageId === message.id,
                },
              ]"
            >
              <!-- System Message (Group creation, etc.) -->
              <div v-if="message.type === 'system'" class="flex flex-col items-center w-full gap-8">
                <!-- Group Avatar and Names Section -->
                <div class="flex flex-col items-center gap-1.5">
                  <!-- Large Group Avatar (64x64) -->
                  <!-- Priority 1: Group has real avatar -->
                  <div v-if="activeConversation?.avatar && !activeConversation?.avatar?.startsWith('data:')" class="w-16 h-16 relative rounded-full overflow-hidden bg-neutral-100 border border-black/8">
                    <img
                      :src="activeConversation.avatar"
                      :alt="activeConversation?.name || 'Group'"
                      class="w-full h-full object-cover"
                    >
                  </div>

                  <!-- Priority 2: Group has no avatar, show 3 member avatars composite -->
                  <div v-else-if="activeConversation?.members && activeConversation.members.length > 0" class="relative w-16 h-16 inline-block">
                    <div
                      v-for="(member, index) in activeConversation.members.slice(0, 3)"
                      :key="member.id"
                      class="absolute w-8 h-8 rounded-full overflow-hidden bg-neutral-100 border-2 border-white"
                      :class="{
                        'top-0 left-0': index === 0,
                        'top-0 right-0': index === 1,
                        'bottom-0 left-1/2 -translate-x-1/2': index === 2,
                      }"
                    >
                      <img
                        :src="member.avatar"
                        :alt="member.name"
                        class="w-full h-full object-cover"
                      >
                    </div>
                  </div>

                  <!-- Priority 3: Fallback icon -->
                  <div v-else class="w-16 h-16 relative rounded-full overflow-hidden bg-neutral-100 border border-black/8">
                    <img
                      :src="activeConversation?.avatar || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjMTBCOTgxIi8+PHBhdGggZD0iTTE1IDEzQzE1IDExLjM0MzEgMTYuMzQzMSAxMCAxOCAxMEMyMC4yMDkxIDEwIDIyIDExLjc5MDkgMjIgMTRDMjIgMTYuMjA5MSAyMC4yMDkxIDE4IDE4IDE4QzE2LjM0MzEgMTggMTUgMTYuNjU2OSAxNSAxNVYxM1oiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTI1IDEzQzI1IDExLjM0MzEgMjYuMzQzMSAxMCAyOCAxMEMyOS42NTY5IDEwIDMxIDExLjM0MzEgMzEgMTNDMzEgMTQuNjU2OSAyOS42NTY5IDE2IDI4IDE2QzI2LjM0MzEgMTYgMjUgMTQuNjU2OSAyNSAxM1oiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTEwIDI2QzEwIDIzLjIzODYgMTIuMjM4NiAyMSAxNSAyMUgyMUMyMy43NjE0IDIxIDI2IDIzLjIzODYgMjYgMjZWMjhDMjYgMjguNTUyMyAyNS41NTIzIDI5IDI1IDI5SDExQzEwLjQ0NzcgMjkgMTAgMjguNTUyMyAxMCAyOFYyNloiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTI0IDI2QzI0IDI0LjM0MzEgMjUuMzQzMSAyMyAyNyAyM0gzMEMzMS42NTY5IDIzIDMzIDI0LjM0MzEgMzMgMjZWMjhDMzMgMjguNTUyMyAzMi41NTIzIDI5IDMyIDI5SDI1QzI0LjQ0NzcgMjkgMjQgMjguNTUyMyAyNCAyOFYyNloiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuNyIvPjwvc3ZnPg=='"
                      :alt="activeConversation?.name || 'Group'"
                      class="w-full h-full object-cover"
                    >
                  </div>

                  <!-- Group Member Names -->
                  <h3 class="text-3xl font-semibold text-black">
                    {{ activeConversation?.name || 'Group' }}
                  </h3>
                </div>

                <!-- Today chip - Figma specs: #E4EAF1 bg, #D3DAE4 border, #344054 text -->
                <div
                  class="inline-flex items-center h-6 px-1.5 rounded border"
                  style="background-color: #E4EAF1; border-color: #D3DAE4;"
                >
                  <span class="text-sm font-medium" style="color: #344054;">Today</span>
                </div>

                <!-- System message chip - Figma specs: #F8FAFC bg, #E4E7EC border, #4F5464 text -->
                <div
                  class="inline-flex items-center h-6 px-1.5 rounded border"
                  style="background-color: #F8FAFC; border-color: #E4E7EC;"
                >
                  <span class="text-sm" style="color: #4F5464;">{{ message.text }}</span>
                </div>
              </div>

              <!-- Regular Messages -->
              <template v-else>
                <!-- Avatar -->
                <div class="w-14 h-14 relative rounded-full overflow-hidden bg-neutral-100 border border-black/8 flex-shrink-0">
                  <img
                    :src="
                      message.avatar
                        || `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          message.senderName,
                        )}&background=random`
                    "
                    :alt="message.senderName"
                    class="w-full h-full object-cover"
                    @error="handleImageError($event, message.senderName)"
                  >
                </div>

                <div class="flex flex-col max-w-[70%]">
                  <!-- Message header with name and time -->
                  <div class="flex items-center gap-2 mb-2">
                    <span class="font-semibold text-sm text-text-secondary">
                      {{ message.senderName }}
                    </span>
                    <span class="text-xs text-text-muted">
                      {{ message.time }}
                    </span>
                  </div>

                  <!-- File Attachments -->
                  <div v-if="message.files && message.files.length > 0" class="flex flex-col gap-2 mb-2">
                    <div
                      v-for="file in message.files"
                      :key="file.id"
                      class="rounded-lg overflow-hidden bg-neutral-50 border border-neutral-200"
                    >
                      <!-- Image Preview -->
                      <div v-if="file.type && file.type.startsWith('image/')" class="relative group">
                        <img
                          :src="file.thumbnail || file.url"
                          :alt="file.filename"
                          class="max-w-full h-auto max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          @click="window.open(file.url, '_blank')"
                        >
                        <div class="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                          {{ formatFileSize(Number(file.size)) }}
                        </div>
                      </div>

                      <!-- Document/File Card -->
                      <div v-else class="flex items-center gap-3 p-3">
                        <div class="w-12 h-12 flex items-center justify-center rounded-lg bg-neutral-100">
                          <v-icon
                            :name="getFileIcon(file.type)"
                            class="text-neutral-600"
                          />
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="font-medium text-sm truncate  text-blue-500">
                            {{ file.filename }}
                          </div>
                          <div class="text-xs text-text-muted">
                            {{ formatFileSize(file.size) }}
                          </div>
                        </div>
                        <button
                          class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/10 transition-colors"
                          @click="window.open(file.url, '_blank')"
                        >
                          <v-icon
                            name="download"
                            class="text-neutral-600"
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Message content (text) -->
                  <div
                    v-if="message.text"
                    class="rounded-lg max-w-full break-words text-sm text-text-secondary leading-relaxed border-neutral-200"
                  >
                    <p class="">
                      {{ message.text }}
                    </p>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Message input - Fixed tại bottom -->
      <div v-if="activeConversation" class="message-input">
        <!-- Hidden file input -->
        <input
          ref="fileInput"
          type="file"
          multiple
          :accept="`${FILE_CONFIGS.images.accept},${FILE_CONFIGS.documents.accept}`"
          :max="MAX_FILES"
          class="hidden"
          @change="handleFileSelect"
        >

        <!-- File Preview Dialog - Show before upload -->
        <v-dialog
          :model-value="showFilePreviewDialog"
          @update:model-value="showFilePreviewDialog = false"
          @esc="cancelFileUpload"
        >
          <v-card>
            <v-card-title>
              Selected Files ({{ selectedFiles.length }})
            </v-card-title>

            <v-card-text>
              <div class="space-y-3">
                <div
                  v-for="(file, index) in selectedFiles"
                  :key="index"
                  class="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <!-- File Icon/Preview -->
                  <div class="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-purple-50 rounded-lg">
                    <svg v-if="file.type.startsWith('image/')" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z" fill="#6644FF" />
                    </svg>
                    <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z" fill="#6644FF" />
                    </svg>
                  </div>

                  <!-- File Info -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">
                      {{ file.name }}
                    </p>
                    <p class="text-xs text-gray-500">
                      {{ formatFileSize(file.size) }}
                    </p>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex items-center gap-2">
                    <!-- Edit button (placeholder for now) -->
                    <button
                      class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.5 2.5L15.5 5.5L5.5 15.5H2.5V12.5L12.5 2.5Z" stroke="#8196B1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>

                    <!-- Remove button -->
                    <button
                      class="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                      title="Remove"
                      @click="removeFileFromPreview(index)"
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:stroke-red-600" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </v-card-text>

            <v-card-actions>
              <v-button secondary @click="cancelFileUpload">
                Cancel
              </v-button>
              <v-button
                :disabled="selectedFiles.length === 0"
                @click="confirmAndUploadFiles"
              >
                Upload {{ selectedFiles.length }} file{{ selectedFiles.length > 1 ? 's' : '' }}
              </v-button>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <!-- Pending Attachments Preview (above message input) -->
        <FileAttachmentPreview
          :attachments="pendingAttachments"
          :get-file-icon="getFileIcon"
          @edit="activeDialog = 'choose'"
          @remove="removePendingAttachment"
        />

        <!-- Upload Progress Indicator -->
        <UploadProgress
          :is-uploading="isUploading"
          :upload-progress="uploadProgress"
        />

        <!-- Message Input -->
        <MessageInput
          ref="messageInputRef"
          v-model:message-text="messageText"
          :sending-message="sendingMessage"
          :pending-attachments-count="pendingAttachments.length"
          @send="sendMessage"
          @open-sticker="openStickerMenu"
        >
          <!-- File Upload Menu Slot -->
          <template #attach-menu>
            <v-menu :offset-y="-150" :offset-x="127">
              <template #activator="{ toggle }">
                <button
                  class="input-action-btn"
                  title="attach_file"
                  @click="toggle"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M18 15.75C18 17.4833 17.3917 18.9583 16.175 20.175C14.9583 21.3917 13.4833 22 11.75 22C10.0167 22 8.54167 21.3917 7.325 20.175C6.10833 18.9583 5.5 17.4833 5.5 15.75V6.5C5.5 5.25 5.9375 4.1875 6.8125 3.3125C7.6875 2.4375 8.75 2 10 2C11.25 2 12.3125 2.4375 13.1875 3.3125C14.0625 4.1875 14.5 5.25 14.5 6.5V15.25C14.5 16.0167 14.2333 16.6667 13.7 17.2C13.1667 17.7333 12.5167 18 11.75 18C10.9833 18 10.3333 17.7333 9.8 17.2C9.26667 16.6667 9 16.0167 9 15.25V6H11V15.25C11 15.4667 11.0708 15.6458 11.2125 15.7875C11.3542 15.9292 11.5333 16 11.75 16C11.9667 16 12.1458 15.9292 12.2875 15.7875C12.4292 15.6458 12.5 15.4667 12.5 15.25V6.5C12.4833 5.8 12.2375 5.20833 11.7625 4.725C11.2875 4.24167 10.7 4 10 4C9.3 4 8.70833 4.24167 8.225 4.725C7.74167 5.20833 7.5 5.8 7.5 6.5V15.75C7.48333 16.9333 7.89167 17.9375 8.725 18.7625C9.55833 19.5875 10.5667 20 11.75 20C12.9167 20 13.9083 19.5875 14.725 18.7625C15.5417 17.9375 15.9667 16.9333 16 15.75V6H18V15.75Z" fill="#1F1F1F" />
                  </svg>
                </button>
              </template>

              <v-list>
                <!-- Option 1: Upload from Device -->
                <v-list-item clickable @click="triggerFileInput">
                  <v-list-item-icon>
                    <v-icon name="phonelink" />
                  </v-list-item-icon>
                  <v-list-item-content>
                    Upload File from Device
                  </v-list-item-content>
                </v-list-item>

                <!-- Option 2: Choose from Library -->
                <v-list-item clickable @click="activeDialog = 'choose'">
                  <v-list-item-icon>
                    <v-icon name="folder_open" />
                  </v-list-item-icon>
                  <v-list-item-content>
                    Choose File from Library
                  </v-list-item-content>
                </v-list-item>

                <!-- Option 3: Import from URL -->
                <v-list-item clickable @click="activeDialog = 'url'">
                  <v-list-item-icon>
                    <v-icon name="link" />
                  </v-list-item-icon>
                  <v-list-item-content>
                    Import File from URL
                  </v-list-item-content>
                </v-list-item>
              </v-list>
            </v-menu>

            <!-- Dialog 1: Upload from Device -->
            <v-dialog
              :model-value="activeDialog === 'upload'"
              @update:model-value="activeDialog = null"
              @esc="activeDialog = null"
            >
              <v-card>
                <v-card-title>Upload File from Device</v-card-title>

                <v-card-text>
                  <v-upload
                    :multiple="true"
                    @input="onUpload"
                  />
                </v-card-text>

                <v-card-actions>
                  <v-button secondary @click="activeDialog = null">
                    Cancel
                  </v-button>
                </v-card-actions>
              </v-card>
            </v-dialog>

            <!-- Dialog 2: Import from URL -->
            <v-dialog
              :model-value="activeDialog === 'url'"
              @update:model-value="activeDialog = null"
              @esc="activeDialog = null"
            >
              <v-card>
                <v-card-title>Import File from URL</v-card-title>

                <v-card-text>
                  <v-input
                    v-model="importUrl"
                    placeholder="https://example.com/file.pdf"
                    :nullable="false"
                  />
                </v-card-text>

                <v-card-actions>
                  <v-button secondary @click="activeDialog = null">
                    Cancel
                  </v-button>
                  <v-button
                    :disabled="!isValidURL"
                    :loading="importing"
                    @click="importFromURL"
                  >
                    Import
                  </v-button>
                </v-card-actions>
              </v-card>
            </v-dialog>

            <!-- Drawer: Choose from Library -->
            <drawer-files
              v-if="activeDialog === 'choose'"
              :active="activeDialog === 'choose'"
              :folder="folder"
              @update:active="activeDialog = null"
              @input="onSelectFromLibrary"
            />
          </template>

          <!-- Emoji Picker Slot -->
          <template #emoji-picker>
            <VEmojiPicker
              @select="insertEmoji($event)"
              @emoji-click="insertEmoji($event)"
              @emoji-selected="insertEmoji($event)"
              @input="insertEmoji($event)"
              @change="insertEmoji($event)"
            />
          </template>
        </MessageInput>
      </div>

      <!-- Empty state -->
      <EmptyState v-else />
    </div>

    <!-- Members Selection Dialog -->
    <MembersDialog
      :show="showMembersDialog"
      :search-query="memberSearchQuery"
      :selected-members="selectedMembers"
      :filtered-members="filteredMembers"
      :selected-member-objects="selectedMemberObjects"
      @close="closeMembersDialog"
      @update:search-query="memberSearchQuery = $event"
      @toggle-member="toggleMemberSelection"
      @remove-member="removeMember"
      @create-group="createGroup"
    />

    <!-- Manage Accounts Dialog -->
    <ManageAccountsDialog
      :show="showManageAccountsDialog"
      :accounts="mockAccounts"
      :current-account-id="currentAccountId"
      @close="showManageAccountsDialog = false"
      @switch-account="handleSwitchAccount"
      @add-account="handleAddAccount"
    />
  </private-view>
</template>

<style scoped>
@import "../styles/tailwind.css";

.chat-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: calc(100vh - 109px); /* Trừ đi header của Directus */
  background: white;
  overflow: hidden;
  position: relative;
}

.messages-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 4px;
  background: var(--background-page, white);
  scroll-behavior: smooth;
}

.chat-container * {
  box-sizing: border-box;
}

/* Scrollbar styles - dùng chung cho messages area và dialogs */
.messages-area::-webkit-scrollbar,
.scroll-style::-webkit-scrollbar {
  width: 6px;
}

.messages-area::-webkit-scrollbar-track,
.scroll-style::-webkit-scrollbar-track {
  background: transparent;
}

.messages-area::-webkit-scrollbar-thumb,
.scroll-style::-webkit-scrollbar-thumb {
  background: var(--border-normal, #d3dae4);
  border-radius: 3px;
}

.messages-area::-webkit-scrollbar-thumb:hover,
.scroll-style::-webkit-scrollbar-thumb:hover {
  background: var(--border-subdued, #a2b5cd);
}

/* Navigation Panel Styles */
.nav-separator {
  height: 2px;
  background: #D3DAE4;
  margin: 6px 12px;
}

.conversation-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
  background: #F0F4F9;
}
</style>
