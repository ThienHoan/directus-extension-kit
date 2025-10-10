<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import oliviaAvatar from '../../public/avatars/olivia-avatar.png'

const currentFunction = ref(null)

function showFunctionA() {
  currentFunction.value = 'A' // Hiển thị nội dung của chức năng A trong sidebar
}

function showFunctionB() {
  currentFunction.value = 'B' // Hiển thị nội dung của chức năng B trong sidebar
}
interface Conversation {
  id: string
  name: string
  lastMessage: string
  timestamp: string
  avatar: string
  online: boolean
  unreadCount: number
}

interface Message {
  id: string
  direction: 'in' | 'out'
  text: string
  senderName: string
  time: string
  avatar?: string
  status?: 'sent' | 'delivered' | 'read'
}

// Reactive data
const searchQuery = ref('')
const navSearchQuery = ref('')
const messageText = ref('')
const activeConversationId = ref<string>('1')
const messagesContainer = ref<HTMLElement | null>(null)
const showFilterDropdown = ref(false)

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

// Mock conversations data - sẽ thay thế bằng Zalo API
const conversations = ref<Conversation[]>([
  {
    id: '1',
    name: 'Olivia Rhye',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar: oliviaAvatar,
    online: true,
    unreadCount: 2,
  },
  {
    id: '2',
    name: 'Adam Levine',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar:
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Adam&backgroundColor=f59e0b',
    online: true,
    unreadCount: 0,
  },
  {
    id: '3',
    name: 'Kadin Botosh',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar:
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Kadin&backgroundColor=10b981',
    online: true,
    unreadCount: 1,
  },
  {
    id: '4',
    name: 'Wilson Press',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFQzQ4OTkiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOS4zMzk3MiAxNCA2LjkyMTc4IDE1LjMzMzUgNS42ODE3OCAxNy42MzUxQzUuMDc3OCAxOC43NDkxIDUuMDc3OCAxOS45ODQ3IDUuNjgxNzggMjEuMDk4N0M2LjkyMTc4IDIzLjQwMDMgOS4zMzk3MiAyNC43MzM4IDEyIDI0LjczMzhDMTQuNjYwMyAyNC43MzM4IDE3LjA3ODIgMjMuNDAwMyAxOC4zMTgyIDIxLjA5ODdDMTguOTIyMiAxOS45ODQ3IDE4LjkyMjIgMTguNzQ5MSAxOC4zMTgyIDE3LjYzNTFDMTcuMDc4MiAxNS4zMzM1IDE0LjY2MDMgMTQgMTIgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+',
    online: true,
    unreadCount: 0,
  },
  {
    id: '5',
    name: 'Erin George',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar:
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Erin&backgroundColor=8b5cf6',
    online: true,
    unreadCount: 0,
  },
  {
    id: '6',
    name: 'Giana Baptista',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMwNkI2RDQiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOS4zMzk3MiAxNCA2LjkyMTc4IDE1LjMzMzUgNS42ODE3OCAxNy42MzUxQzUuMDc3OCAxOC43NDkxIDUuMDc3OCAxOS45ODQ3IDUuNjgxNzggMjEuMDk4N0M2LjkyMTc4IDIzLjQwMDMgOS4zMzk3MiAyNC43MzM4IDEyIDI0LjczMzhDMTQuNjYwMyAyNC43MzM4IDE3LjA3ODIgMjMuNDAwMyAxOC4zMTgyIDIxLjA5ODdDMTguOTIyMiAxOS45ODQ3IDE4LjkyMjIgMTguNzQ5MSAxOC4zMTgyIDE3LjYzNTFDMTcuMDc4MiAxNS4zMzM1IDE0LjY2MDMgMTQgMTIgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+',
    online: true,
    unreadCount: 0,
  },
  {
    id: '7',
    name: 'Jaydon Good',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFRjQ0NDQiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLjIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOS4zMzk3MiAxNCA2LjkyMTc4IDE1LjMzMzUgNS42ODE3OCAxNy42MzUxQzUuMDc3OCAxOC43NDkxIDUuMDc3OCAxOS45ODQ3IDUuNjgxNzggMjEuMDk4N0M2LjkyMTc4IDIzLjQwMDMgOS4zMzk3MiAyNC43MzM4IDEyIDI0LjczMzhDMTQuNjYwMyAyNC43MzM4IDE3LjA3ODIgMjMuNDAwMyAxOC4zMTgyIDIxLjA5ODdDMTguOTIyMiAxOS45ODQ3IDE4LjkyMjIgMTguNzQ5MSAxOC4zMTgyIDE3LjYzNTFDMTcuMDc4MiAxNS4zMzM1IDE0LjY2MDMgMTQgMTIgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+',
    online: true,
    unreadCount: 0,
  },
])

// Mock messages data - sẽ thay thế bằng Zalo API
const messages = ref<Message[]>([
  {
    id: '1',
    direction: 'in',
    text: 'Hi Khuyen, do you have a moment to talk about the new project?',
    senderName: 'Olivia Rhye',
    time: '00:00',
    avatar: oliviaAvatar,
  },
  {
    id: '2',
    direction: 'in',
    text: 'Sure, Olivia. What\'s on your mind?',
    senderName: 'Nha Khuyen',
    time: '00:00',
    status: 'read',
  },
  {
    id: '3',
    direction: 'in',
    text: 'I\'ve just reviewed the client\'s requirements, and we need to adjust our timeline. How far along are you with the initial draft?',
    senderName: 'Olivia Rhye',
    time: '00:00',
    avatar: oliviaAvatar,
  },
  {
    id: '4',
    direction: 'in',
    text: 'I\'m about 70% done. Most of the structure is complete, but I still need to polish the details and add the visuals.',
    senderName: 'Nha Khuyen',
    time: '00:00',
    status: 'read',
  },
  {
    id: '5',
    direction: 'in',
    text: 'That\'s good progress. The client is asking for a preview by Friday. Do you think you can send me a version before then, maybe by Thursday afternoon?',
    senderName: 'Olivia Rhye',
    time: '00:00',
    avatar: oliviaAvatar,
  },
  {
    id: '6',
    direction: 'in',
    text: 'Yes, I can manage that. I\'ll stay late today and tomorrow if necessary.',
    senderName: 'Nha Khuyen',
    time: '00:00',
    status: 'read',
  },
  {
    id: '7',
    direction: 'in',
    text: 'Great. Also, make sure to highlight the key features—they\'re very focused on functionality this time.',
    senderName: 'Olivia Rhye',
    time: '00:00',
    avatar: oliviaAvatar,
  },
  {
    id: '8',
    direction: 'in',
    text: 'Got it. Should I also prepare a short presentation, or just send the draft?',
    senderName: 'Nha Khuyen',
    time: '00:00',
    status: 'read',
  },
  {
    id: '9',
    direction: 'in',
    text: 'Great. Also, make sure to highlight the key features—they\'re very focused on functionality this time.',
    senderName: 'Olivia Rhye',
    time: '00:00',
    avatar: oliviaAvatar,
  },
  {
    id: '10',
    direction: 'in',
    text: 'Great. Also, make sure to highlight the key features—they\'re very focused on functionality this time.',
    senderName: 'Olivia Rhye',
    time: '00:00',
    avatar: oliviaAvatar,
  },
  {
    id: '11',
    direction: 'in',
    text: 'Great. Also, make sure to highlight the key features—they\'re very focused on functionality this time.',
    senderName: 'Olivia Rhye',
    time: '00:00',
    avatar: oliviaAvatar,
  },
  {
    id: '12',
    direction: 'in',
    text: 'Great. Also, make sure to highlight the key features—they\'re very focused on functionality this time.',
    senderName: 'Olivia Rhye',
    time: '00:00',
    avatar: oliviaAvatar,
  },
  {
    id: '13',
    direction: 'in',
    text: 'Great. Also, make sure to highlight the key features—they\'re very focused on functionality this time.',
    senderName: 'Olivia Rhye',
    time: '00:00',
    avatar: oliviaAvatar,
  },
  {
    id: '14',
    direction: 'in',
    text: 'Great. Also, make sure to highlight the key features—they\'re very focused on functionality this time.',
    senderName: 'Olivia Rhye',
    time: '00:00',
    avatar: oliviaAvatar,
  },
  {
    id: '15',
    direction: 'in',
    text: 'Great. Also, make sure to highlight the key features—they\'re very focused on functionality this time.',
    senderName: 'Olivia Rhye',
    time: '00:00',
    avatar: oliviaAvatar,
  },
  {
    id: '16',
    direction: 'in',
    text: 'Great. Also, make sure to highlight the key features—they\'re very focused on functionality this time.',
    senderName: 'Olivia Rhye',
    time: '00:00',
    avatar: oliviaAvatar,
  },
  {
    id: '17',
    direction: 'in',
    text: 'Great. Also, make sure to highlight the key features—they\'re very focused on functionality this time.',
    senderName: 'Olivia Rhye',
    time: '00:00',
    avatar: oliviaAvatar,
  },
  {
    id: '18',
    direction: 'in',
    text: 'Great. Also, make sure to highlight the key features—they\'re very focused on functionality this time.',
    senderName: 'Olivia Rhye',
    time: '00:00',
    avatar: oliviaAvatar,
  },
])

// Computed properties
const filteredConversations = computed(() => {
  let filtered = conversations.value

  // Apply search filter
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

const activeConversation = computed(() => {
  return conversations.value.find(
    conv => conv.id === activeConversationId.value,
  )
})

// Methods
function selectConversation(id: string) {
  activeConversationId.value = id
  scrollToBottom()
}

function handleAddUser() {
  console.warn('Add user clicked')
}

function handleFilter() {
  showFilterDropdown.value = !showFilterDropdown.value
}

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

function sendMessage() {
  if (!messageText.value.trim())
    return

  const newMessage: Message = {
    id: Date.now().toString(),
    direction: 'in',
    text: messageText.value.trim(),
    senderName: 'Nha Khuyen',
    time: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    status: 'sent',
  }

  messages.value.push(newMessage)
  messageText.value = ''

  nextTick(() => {
    scrollToBottom()
  })
}

function autoResize(event: Event) {
  const textarea = event.target as HTMLTextAreaElement
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function handleImageError(event: Event, conversationName: string) {
  const img = event.target as HTMLImageElement

  // Check if we've already tried the fallback to avoid infinite loop
  if (img.src.includes('ui-avatars.com')) {
    console.error(
      `Both original and fallback avatar failed for ${conversationName}`,
    )
    // Remove the error handler to prevent further loops
    img.onerror = null
    // Set a simple data URL as last resort
    img.src
      = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFNUU3RUIiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSIjOUM5Q0EwIi8+CjxwYXRoIGQ9Ik0xMiAxNEM5LjMzOTcyIDE0IDYuOTIxNzggMTUuMzMzNSA1LjY4MTc4IDE3LjYzNTFDNS4wNzc4IDE4Ljc0OTEgNS4wNzc4IDE5Ljk4NDcgNS42ODE3OCAyMS4wOTg3QzYuOTIxNzggMjMuNDAwMyA5LjMzOTcyIDI0LjczMzggMTIgMjQuNzMzOEMxNC42NjAzIDI0LjczMzggMTcuMDc4MiAyMy40MDAzIDE4LjMxODIgMjEuMDk4N0MxOC45MjIyIDE5Ljk4NDcgMTguOTIyMiAxOC43NDkxIDE4LjMxODIgMTcuNjM1MUMxNy4wNzgyIDE1LjMzMzUgMTQuNjYwMyAxNCAxMiAxNFoiIGZpbGw9IiM5QzlDQTAiLz4KPC9zdmc+Cjwvc3ZnPgo='
    return
  }

  console.error(`Failed to load avatar for ${conversationName}`, event)
  // Set fallback avatar
  img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    conversationName,
  )}&background=random`
}

// Future: Load conversations from Zalo API
async function _loadZaloConversations() {
  console.warn('Zalo API integration pending')
}

// Future: Load messages from Zalo API
async function _loadZaloMessages(_conversationId: string) {
  console.warn('Zalo API integration pending')
}

// Click outside handler to close dropdown
function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement
  const filterButton = target.closest('.filter-dropdown-container')
  if (!filterButton && showFilterDropdown.value) {
    showFilterDropdown.value = false
  }
}

// Lifecycle
onMounted(() => {
  scrollToBottom()
  document.addEventListener('click', handleClickOutside)
  // loadZaloConversations() // Sẽ enable sau khi có Zalo API
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <private-view title="Messages aLO">
    <template #title-outer:prepend>
      <v-button class="header-icon" rounded disabled icon secondary>
        <v-icon name="inbox" />
      </v-button>
    </template>

    <!-- Sidebar tùy biến theo trạng thái -->
    <template #sidebar>
      <sidebar-detail v-if="currentFunction === 'A'" icon="search" class="my-sidebar-detail" title="Search for messages" close />
      <sidebar-detail v-if="currentFunction === 'B'" class="my-sidebar-detail" icon="info" title="Conversation information" close />
      <sidebar-detail v-if="currentFunction === 'B'" class="my-sidebar-detail" icon="swap_vert" title="Image/video" />
      <sidebar-detail v-if="currentFunction === 'B'" class="my-sidebar-detail" icon="layers" title="Link" />
      <sidebar-detail v-if="currentFunction === 'B'" class="my-sidebar-detail" icon="sync_disabled" title="File" />
    </template>

    <template #navigation>
      <!-- Search and Filter Section -->
      <div class="p-3 border-neutral-200 space-y-3">
        <div class="relative">
          <input
            v-model="navSearchQuery"
            placeholder="Search conversation"
            class="w-full pl-10 pr-3 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          >
        </div>

        <VDivider />

        <div class="flex items-center justify-between">
          <button
            class="w-8 h-8 flex items-center justify-center rounded-md bg-transparent hover:bg-neutral-100 text-text-muted hover:text-text-secondary transition-colors"
            @click="handleAddUser"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 25V23C20 21.9391 19.5786 20.9217 18.8284 20.1716C18.0783 19.4214 17.0609 19 16 19H10C8.93913 19 7.92172 19.4214 7.17157 20.1716C6.42143 20.9217 6 21.9391 6 23V25M23 12V18M26 15H20M17 11C17 13.2091 15.2091 15 13 15C10.7909 15 9 13.2091 9 11C9 8.79086 10.7909 7 13 7C15.2091 7 17 8.79086 17 11Z"
                stroke="black"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <div class="relative filter-dropdown-container">
            <button
              class="flex items-center gap-1 px-3 py-1 text-[14px] font-medium leading-normal not-italic rounded-[var(--Button-Radius-button,6px)] !border !border-solid !border-[var(--border-normal,#D3DAE4)] text-[var(--foreground-normal,#4F5464)] font-[Inter] transition-colors"
              :class="{ 'bg-neutral-100': showFilterDropdown }"
              @click="handleFilter"
            >
              <span>Filter</span>
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

            <!-- Filter Dropdown -->
            <div
              v-if="showFilterDropdown"
              class="fixed top-13 left-100 w-56 mt-2 bg-white border-neutral-200 rounded-lg shadow-xl z-[9999]"
            >
              <div class="p-4">
                <!-- Theo trạng thái -->
                <div class="mb-4">
                  <h4 class="text-sm font-medium text-gray-700 mb-3">
                    Theo trạng thái
                  </h4>
                  <div class="space-y-2">
                    <label class="flex items-center cursor-pointer">
                      <input
                        v-model="filterOptions.status.online"
                        type="checkbox"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      >
                      <span class="ml-2 text-sm text-gray-700">Tất cả</span>
                    </label>
                    <label class="flex items-center cursor-pointer">
                      <input
                        v-model="filterOptions.status.offline"
                        type="checkbox"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      >
                      <span class="ml-2 text-sm text-gray-700">Chưa đọc</span>
                    </label>
                    <VDivider />
                  </div>
                </div>

                <!-- Theo thể phân loại -->
                <div class="mb-4">
                  <h4 class="text-sm font-medium text-gray-700 mb-3">
                    Theo thể phân loại
                  </h4>
                  <div class="space-y-2">
                    <label
                      type="checkbox"
                      class="flex items-center cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      >
                      <div
                        class="ml-2 w-3 h-3 rounded-full bg-red-500 mr-3"
                      />
                      <span class="text-sm text-gray-700">Khách hàng</span>
                    </label>
                    <label class="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      >
                      <div
                        class="ml-2 w-3 h-3 rounded-full bg-green-500 mr-3"
                      />
                      <span class="text-sm text-gray-700">Đồng nghiệp</span>
                    </label>
                    <label class="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      >
                      <div
                        class="ml-2 w-3 h-3 rounded-full bg-orange-500 mr-3"
                      />
                      <span class="text-sm text-gray-700">Công việc</span>
                    </label>
                    <label class="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      >
                      <div
                        class="ml-2 w-3 h-3 rounded-full bg-blue-500 mr-3"
                      />
                      <span class="text-sm text-gray-700">Trả lời sau</span>
                    </label>
                    <label class="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      >
                      <div
                        class="ml-2 w-3 h-3 rounded-full bg-gray-800 mr-3"
                      />
                      <span class="text-sm text-gray-700">Tin nhắn từ người lạ</span>
                    </label>
                  </div>
                </div>

                <!-- Quản lý thể phân loại -->
                <div class="pt-3 border-t border-gray-200">
                  <button
                    class="flex items-center text-sm text-blue-600 hover:text-blue-700"
                  >
                    <svg
                      class="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Quản lý thể phân loại
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Conversation List -->
      <div class="flex-1 overflow-y-auto">
        <div class="p-2 space-y-1">
          <div
            v-for="conversation in filteredConversations"
            :key="conversation.id"
            class="flex items-center p-2 rounded-lg cursor-pointer transition-colors duration-200 hover:bg-neutral-50"
            :class="[
              {
                'bg-brand-100': conversation.id === activeConversationId,
                'bg-transparent': conversation.id !== activeConversationId,
              },
            ]"
            @click="selectConversation(conversation.id)"
          >
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <div class="relative inline-block">
                <div
                  class="w-8 h-8 relative rounded-full overflow-hidden bg-neutral-100 border border-black/8"
                >
                  <img
                    :src="
                      conversation.avatar
                        || `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          conversation.name,
                        )}&background=random`
                    "
                    :alt="conversation.name"
                    class="w-full h-full object-cover"
                    @error="handleImageError($event, conversation.name)"
                  >
                </div>
                <div
                  v-if="conversation.online"
                  class="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-success-500 border-2 border-white"
                />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <h4
                    class="font-medium text-sm truncate"
                    :class="[
                      {
                        'text-text-primary':
                          conversation.id === activeConversationId,
                        'text-text-secondary':
                          conversation.id !== activeConversationId,
                      },
                    ]"
                  >
                    {{ conversation.name }}
                  </h4>
                  <span class="text-xs ml-2 flex-shrink-0 text-text-muted">
                    {{ conversation.timestamp }}
                  </span>
                </div>

                <p class="text-xs mt-0.5 truncate text-text-tertiary">
                  {{ conversation.lastMessage }}
                </p>
              </div>
            </div>

            <!-- Unread badge -->
            <div
              v-if="conversation.unreadCount > 0"
              class="ml-2 flex-shrink-0 min-w-[20px] h-5 bg-brand-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1.5"
            >
              {{
                conversation.unreadCount > 99 ? "99+" : conversation.unreadCount
              }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Main Chat Area với absolute positioning -->
    <div class="chat-container">
      <!-- Chat Header - Fixed tại top -->
      <div v-if="activeConversation" class="chat-header">
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-4">
            <div class="relative inline-block">
              <div
                class="w-10 h-10 relative rounded-full overflow-hidden bg-neutral-100 border border-black/8"
              >
                <img
                  :src="
                    activeConversation.avatar
                      || `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        activeConversation.name,
                      )}&background=random`
                  "
                  :alt="activeConversation.name"
                  class="w-full h-full object-cover"
                  @error="handleImageError($event, activeConversation.name)"
                >
              </div>
              <div
                v-if="activeConversation.online"
                class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success-500 border-2 border-white"
              />
            </div>

            <h3 class="font-semibold text-text-secondary">
              {{ activeConversation.name }}
            </h3>
          </div>

          <div class="flex items-center gap-2">
            <button
              class="w-10 h-10 flex items-center justify-center rounded-lg bg-transparent hover:bg-neutral-100 text-text-muted hover:text-text-secondary transition-colors"
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M20.5 19.95C20.9833 19.4167 21.3542 18.8083 21.6125 18.125C21.8708 17.4417 22 16.7333 22 16C22 15.2667 21.8708 14.5583 21.6125 13.875C21.3542 13.1917 20.9833 12.5833 20.5 12.05C21.5 12.1833 22.3333 12.625 23 13.375C23.6667 14.125 24 15 24 16C24 17 23.6667 17.875 23 18.625C22.3333 19.375 21.5 19.8167 20.5 19.95ZM26 28V25C26 24.4 25.8667 23.8292 25.6 23.2875C25.3333 22.7458 24.9833 22.2667 24.55 21.85C25.4 22.15 26.1875 22.5375 26.9125 23.0125C27.6375 23.4875 28 24.15 28 25V28H26ZM28 21V19H26V17H28V15H30V17H32V19H30V21H28ZM16 20C14.9 20 13.9583 19.6083 13.175 18.825C12.3917 18.0417 12 17.1 12 16C12 14.9 12.3917 13.9583 13.175 13.175C13.9583 12.3917 14.9 12 16 12C17.1 12 18.0417 12.3917 18.825 13.175C19.6083 13.9583 20 14.9 20 16C20 17.1 19.6083 18.0417 18.825 18.825C18.0417 19.6083 17.1 20 16 20ZM8 28V25.2C8 24.6333 8.14583 24.1125 8.4375 23.6375C8.72917 23.1625 9.11667 22.8 9.6 22.55C10.6333 22.0333 11.6833 21.6458 12.75 21.3875C13.8167 21.1292 14.9 21 16 21C17.1 21 18.1833 21.1292 19.25 21.3875C20.3167 21.6458 21.3667 22.0333 22.4 22.55C22.8833 22.8 23.2708 23.1625 23.5625 23.6375C23.8542 24.1125 24 24.6333 24 25.2V28H8ZM16 18C16.55 18 17.0208 17.8042 17.4125 17.4125C17.8042 17.0208 18 16.55 18 16C18 15.45 17.8042 14.9792 17.4125 14.5875C17.0208 14.1958 16.55 14 16 14C15.45 14 14.9792 14.1958 14.5875 14.5875C14.1958 14.9792 14 15.45 14 16C14 16.55 14.1958 17.0208 14.5875 17.4125C14.9792 17.8042 15.45 18 16 18ZM10 26H22V25.2C22 25.0167 21.9542 24.85 21.8625 24.7C21.7708 24.55 21.65 24.4333 21.5 24.35C20.6 23.9 19.6917 23.5625 18.775 23.3375C17.8583 23.1125 16.9333 23 16 23C15.0667 23 14.1417 23.1125 13.225 23.3375C12.3083 23.5625 11.4 23.9 10.5 24.35C10.35 24.4333 10.2292 24.55 10.1375 24.7C10.0458 24.85 10 25.0167 10 25.2V26Z"
                  fill="#1F1F1F"
                />
              </svg>
            </button>
            <button
              class="w-10 h-10 flex items-center justify-center rounded-lg bg-transparent hover:bg-neutral-100 text-text-muted hover:text-text-secondary transition-colors"
              @click="showFunctionA"
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M29 28.9999L24.66 24.6599M27 19C27 23.4183 23.4183 27 19 27C14.5817 27 11 23.4183 11 19C11 14.5817 14.5817 11 19 11C23.4183 11 27 14.5817 27 19Z"
                  stroke="black"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>

            <button
              class="w-10 h-10 flex items-center justify-center rounded-lg bg-transparent hover:bg-neutral-100 text-text-muted hover:text-text-secondary transition-colors"
              @click="showFunctionB"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M12 6C12.5523 6 13 5.55228 13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6Z" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M12 20C12.5523 20 13 19.5523 13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20Z" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Messages area - Scrollable với padding cho header và input -->
      <div
        v-if="activeConversation"
        ref="messagesContainer"
        class="messages-area"
      >
        <div class="space-y-1">
          <div
            v-for="message in messages"
            :key="message.id"
            class="flex gap-4 px-8 py-3"
            :class="[
              {
                'justify-start': message.direction === 'in',
                'justify-end': message.direction === 'out',
              },
            ]"
          >
            <!-- Avatar for incoming messages -->
            <div
              v-if="message.direction === 'in'"
              class="w-13 h-13 relative rounded-full overflow-hidden bg-neutral-100 border border-black/8 flex-shrink-0"
            >
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

            <div
              class="flex flex-col max-w-[70%]"
              :class="[
                {
                  'items-start': message.direction === 'in',
                  'items-end': message.direction === 'out',
                },
              ]"
            >
              <!-- Message header with name and time -->
              <div
                class="flex items-center gap-2 mb-2"
                :class="[
                  {
                    'flex-row ': message.direction === 'in',
                    'flex-row-reverse': message.direction === 'out',
                  },
                ]"
              >
                <span class="font-semibold text-sm text-text-secondary">
                  {{ message.senderName }}
                </span>
                <span class="text-xs text-text-muted">
                  {{ message.time }}
                </span>
              </div>

              <!-- Message content -->
              <div
                class="rounded-lg max-w-full break-words text-sm text-text-secondary leading-relaxed"
                :class="[
                  {
                    '  border-neutral-200': message.direction === 'in',
                    'bg-brand-500 text-white': message.direction === 'out',
                  },
                ]"
              >
                <p class="whitespace-pre-wrap">
                  {{ message.text }}
                </p>
              </div>

              <!-- Message status for outgoing messages -->
              <div
                v-if="message.direction === 'out' && message.status"
                class="flex items-center gap-1 mt-1 text-xs text-text-muted"
              >
                <span v-if="message.status === 'sent'">Sent</span>
                <span v-else-if="message.status === 'delivered'">Delivered</span>
                <span
                  v-else-if="message.status === 'read'"
                  class="text-brand-500"
                >Read</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Message input - Fixed tại bottom -->
      <div v-if="activeConversation" class="message-input">
        <div class="flex items-end gap-3">
          <div class="flex gap-2">
            <Story title="VMenu">
              <v-menu>
                <template #activator="{ toggle }">
                  <v-icon
                    clickable
                    class="options"
                    name="attach_file"
                    @click="toggle"
                  />
                </template>
                <v-list>
                  <v-list-item clickable>
                    <v-list-item-icon>
                      <v-icon name="folder_open" />
                    </v-list-item-icon>
                    <v-list-item-content>
                      Choose from Library
                    </v-list-item-content>
                  </v-list-item>

                  <v-list-item clickable>
                    <v-list-item-icon><v-icon name="link" /></v-list-item-icon>
                    <v-list-item-content>Choose from Url</v-list-item-content>
                  </v-list-item>
                </v-list>
              </v-menu>
            </Story>
            <VEmojiPicker @emoji-selected="logEvent('emoji-selected', $event)">
              My Button
            </VEmojiPicker>
            <button
              class="w-8 h-8 flex items-center justify-center rounded-md bg-transparent hover:bg-neutral-100 text-text-muted hover:text-text-secondary transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10.7778 1V4.55556C10.7778 5.02705 10.9651 5.47924 11.2985 5.81263C11.6319 6.14603 12.0841 6.33333 12.5556 6.33333H16.1111M5.44444 9.88889H5.45333M12.5556 9.88889H12.5644M7.22222 12.5556C7.22222 12.5556 7.93333 13.4444 9 13.4444C10.1556 13.4444 10.7778 12.5556 10.7778 12.5556M12.1111 1H2.77778C2.30628 1 1.8541 1.1873 1.5207 1.5207C1.1873 1.8541 1 2.30628 1 2.77778V15.2222C1 16.2 1.8 17 2.77778 17H15.2222C15.6937 17 16.1459 16.8127 16.4793 16.4793C16.8127 16.1459 17 15.6937 17 15.2222V5.88889L12.1111 1Z"
                  stroke="black"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>

          <div class="flex-1 flex items-end gap-2">
            <textarea
              v-model="messageText"
              placeholder="Type your message here..."
              rows="1"
              class="flex-1 resize-none px-3 py-2 rounded-lg focus:outline-none focus:ring-0 focus:border-0 font-inter text-base text-text-secondary placeholder-text-muted"
              @keydown.enter.exact.prevent="sendMessage"
              @input="autoResize"
            />

            <button
              :disabled="!messageText.trim()"
              class="w-9 h-9 flex items-center justify-center rounded-md hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed text-black transition-colors"
              @click="sendMessage"
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 21 21"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M20.0003 10.5C20.0003 10.5948 19.9734 10.6875 19.9227 10.7675C19.872 10.8476 19.7996 10.9115 19.714 10.952L1.71402 19.452C1.62412 19.4956 1.52318 19.5112 1.42434 19.4966C1.32549 19.4821 1.2333 19.4381 1.15974 19.3705C1.08619 19.3029 1.03468 19.2147 1.0119 19.1174C0.989126 19.0202 0.996137 18.9183 1.03202 18.825L3.87402 11.198C4.0417 10.7478 4.0417 10.2523 3.87402 9.80204L1.03102 2.17504C0.994955 2.08168 0.987852 1.97962 1.01064 1.88216C1.03343 1.78471 1.08505 1.69638 1.15878 1.6287C1.23251 1.56102 1.32492 1.51712 1.42396 1.50273C1.523 1.48834 1.62409 1.50413 1.71402 1.54804L19.714 10.048C19.7996 10.0885 19.872 10.1525 19.9227 10.2325C19.9734 10.3126 20.0003 10.4053 20.0003 10.5ZM20.0003 10.5L4.00003 10.5"
                  stroke="#6644FF"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="flex-1 flex items-center justify-center bg-neutral-50">
        <div class="text-center">
          <h3 class="text-lg font-medium text-text-secondary mb-2">
            Select a conversation
          </h3>
          <p class="text-text-muted">
            Choose a conversation from the sidebar to start messaging
          </p>
        </div>
      </div>
    </div>
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
.chat-header {
  flex-shrink: 0;
  height: 80px;
  padding: 16px 40px;
  border-top: 1px solid var(--border-normal, #d3dae4);
  border-bottom: 1px solid var(--border-normal, #d3dae4);
  background: var(--background-page, white);
  z-index: 10;
  display: flex;
  align-items: center;
}
.messages-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 16px;
  background: var(--background-page, white);
}
.message-input {
  flex-shrink: 0;
  min-height: 80px;
  padding: 16px;
  border-top: 1px solid var(--border-normal, #d3dae4);
  background: var(--background-page, white);
  z-index: 10;
}
.chat-container * {
  box-sizing: border-box;
}
.messages-area::-webkit-scrollbar {
  width: 6px;
}
.messages-area::-webkit-scrollbar-track {
  background: transparent;
}
.messages-area::-webkit-scrollbar-thumb {
  background: var(--border-normal, #d3dae4);
  border-radius: 3px;
}
.messages-area::-webkit-scrollbar-thumb:hover {
  background: var(--border-subdued, #a2b5cd);
}
.private-view aside .notifications-preview {
  display: none !important;
}
.my-sidebar-detail {
  background: #f7f7f7   !important;
  border-radius: 12px !important;
  padding: 16px !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07) !important;
}

.page-description {
  color: #333;
  font-size: 15px;
  margin: 8px 0 0 0;
}

.sidebar-detail[icon="info"] {
  border-left: 3px solid #0076ff !important;
}
</style>
a
