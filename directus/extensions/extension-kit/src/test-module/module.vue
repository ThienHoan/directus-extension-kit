<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useApi } from '@directus/extensions-sdk'
import oliviaAvatar from '../../public/avatars/olivia-avatar.png'
import { useFileUpload } from './composables/useFileUpload'


// State
const activeDialog = ref<'upload' | 'choose' | 'url' | null>(null);
const selectedFile = ref<any>(null);
const importUrl = ref('');
const importing = ref(false);
const folder = ref<string | undefined>();

// Computed
const isValidURL = computed(() => {
  if (!importUrl.value) return false;
  try {
    new URL(importUrl.value);
    return true;
  } catch {
    return false;
  }
});

// Methods
function onUpload(fileData: any) {
  // v-upload returns uploaded file info from Directus
  // Add to pending attachments instead of sending immediately
  if (fileData) {
    const files = Array.isArray(fileData) ? fileData : [fileData];
    
    // Create file attachments from uploaded files
    const fileAttachments: FileAttachment[] = files.map(file => ({
      id: file.id,
      filename: file.filename_download || file.title,
      type: file.type,
      size: file.filesize,
      url: `http://localhost:8055/assets/${file.id}`,
      width: file.width,
      height: file.height
    }));
    
    // Add to pending attachments
    pendingAttachments.value.push(...fileAttachments);
  }
  
  activeDialog.value = null;
}

async function onSelectFromLibrary(fileIds: any) {
  try {
    // Handle Proxy Array - map through to get values
    const ids: string[] = [];
    if (Array.isArray(fileIds) && fileIds.length > 0) {
      // Access elements directly to avoid Proxy issues
      for (let i = 0; i < fileIds.length; i++) {
        const fileId = fileIds[i];
        if (fileId) {
          ids.push(fileId);
        }
      }
    } else if (fileIds) {
      ids.push(fileIds);
    }
    
    if (ids.length === 0) {
      return;
    }
    
    // Fetch file details from Directus
    const filePromises = ids.map(id => api.get(`/files/${id}`));
    const responses = await Promise.all(filePromises);
    const files = responses.map(res => res.data.data);
    
    // Add to pending attachments instead of sending immediately
    const fileAttachments: FileAttachment[] = files.map(file => ({
      id: file.id,
      filename: file.filename_download,
      type: file.type,
      size: file.filesize,
      url: `http://localhost:8055/assets/${file.id}`,
      width: file.width,
      height: file.height
    }));
    
    // Add to pending attachments
    pendingAttachments.value.push(...fileAttachments);
    
    activeDialog.value = null;
  } catch (error) {
    console.error('Error loading files from library:', error);
  }
}

async function importFromURL() {
  if (!isValidURL.value || importing.value) return;
  
  importing.value = true;
  
  try {
    const response = await fetch('/api/files/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: importUrl.value,
        folder: folder.value,
      }),
    });
    
    if (!response.ok) throw new Error('Import failed');
    
    const data = await response.json();
    selectedFile.value = data.data;
    importUrl.value = '';
    activeDialog.value = null;
    
  } catch (error) {
    console.error('Import error:', error);
    alert('Failed to import file from URL');
  } finally {
    importing.value = false;
  }
}
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
  type?: 'individual' | 'group'
  members?: string[] // For groups - array of member IDs
}

interface Group {
  id: string
  name: string
  lastMessage: string
  timestamp: string
  members: string[] // Array of member IDs
  unreadCount: number
  type: 'group'
  createdAt: string
  createdBy: string
}

interface FileAttachment {
  id: string
  filename: string
  type: string
  size: number
  url: string
  thumbnail?: string
  width?: number
  height?: number
}

interface Message {
  id: string
  direction: 'in' | 'out'
  text: string
  senderName: string
  time: string
  avatar?: string
  status?: 'sent' | 'delivered' | 'read'
  type?: 'system' | 'user' | 'file' // For system messages, user messages, and file messages
  files?: FileAttachment[] // For file attachments
}

// Reactive data
const api = useApi()
const messageSearchQuery = ref('') // For searching messages in sidebar
const conversationSearchQuery = ref('') // For searching conversations in navigation
const messageText = ref('')
const activeConversationId = ref<string>('1')
const messagesContainer = ref<HTMLElement | null>(null)
const showFilterDropdown = ref(false)
const highlightedMessageId = ref<string | null>(null) // For highlighting selected message
const showMembersDialog = ref(false) // For showing the members selection dialog
const memberSearchQuery = ref('') // For searching members in the dialog
const selectedMembers = ref<string[]>([]) // For tracking selected member IDs

// File upload composable
const {
  uploadFiles,
  getFileUrl,
  getThumbnailUrl,
  formatFileSize,
  getFileIcon,
  uploadProgress,
  isUploading,
  FILE_CONFIGS,
  MAX_FILES
} = useFileUpload()
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFiles = ref<File[]>([])
const showFilePreviewDialog = ref(false) // Dialog to preview selected files before upload
const pendingAttachments = ref<FileAttachment[]>([]) // Files ready to send with message

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

// Mock groups data
const groups = ref<Group[]>([])

// Store messages for groups (in real app, this would be in a centralized store)
const groupMessages = ref<Record<string, Message[]>>({})

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
  {
    id: '8',
    name: 'Jaydon Goodaa',
    lastMessage: 'There are many variations of passagesaaa',
    timestamp: '01:10 AM',
    avatar:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFRjQ0NDQiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLjIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOS4zMzk3MiAxNCA2LjkyMTc4IDE1LjMzMzUgNS42ODE3OCAxNy42MzUxQzUuMDc3OCAxOC43NDkxIDUuMDc3OCAxOS45ODQ3IDUuNjgxNzggMjEuMDk4N0M2LjkyMTc4IDIzLjQwMDMgOS4zMzk3MiAyNC43MzM4IDEyIDI0LjczMzhDMTQuNjYwMyAyNC43MzM4IDE3LjA3ODIgMjMuNDAwMyAxOC4zMTgyIDIxLjA5ODdDMTguOTIyMiAxOS45ODQ3IDE4LjkyMjIgMTguNzQ5MSAxOC4zMTgyIDE3LjYzNTFDMTcuMDc4MiAxNS4zMzM1IDE0LjY2MDMgMTQgMTIgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+',
    online: true,
    unreadCount: 0,
  },
  {
    id: '9',
    name: 'Giana Baptista',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMwNkI2RDQiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOS4zMzk3MiAxNCA2LjkyMTc4IDE1LjMzMzUgNS42ODE3OCAxNy42MzUxQzUuMDc3OCAxOC43NDkxIDUuMDc3OCAxOS45ODQ3IDUuNjgxNzggMjEuMDk4N0M2LjkyMTc4IDIzLjQwMDMgOS4zMzk3MiAyNC43MzM4IDEyIDI0LjczMzhDMTQuNjYwMyAyNC43MzM4IDE3LjA3ODIgMjMuNDAwMyAxOC4zMTgyIDIxLjA5ODdDMTguOTIyMiAxOS45ODQ3IDE4LjkyMjIgMTguNzQ5MSAxOC4zMTgyIDE3LjYzNTFDMTcuMDc4MiAxNS4zMzM1IDE0LjY2MDMgMTQgMTIgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+',
    online: true,
    unreadCount: 0,
  },
  {
    id: '9',
    name: 'Giana Baptista',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMwNkI2RDQiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOS4zMzk3MiAxNCA2LjkyMTc4IDE1LjMzMzUgNS42ODE3OCAxNy42MzUxQzUuMDc3OCAxOC43NDkxIDUuMDc3OCAxOS45ODQ3IDUuNjgxNzggMjEuMDk4N0M2LjkyMTc4IDIzLjQwMDMgOS4zMzk3MiAyNC43MzM4IDEyIDI0LjczMzhDMTQuNjYwMyAyNC43MzM4IDE3LjA3ODIgMjMuNDAwMyAxOC4zMTgyIDIxLjA5ODdDMTguOTIyMiAxOS45ODQ3IDE4LjkyMjIgMTguNzQ5MSAxOC4zMTgyIDE3LjYzNTFDMTcuMDc4MiAxNS4zMzM1IDE0LjY2MDMgMTQgMTIgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+',
    online: true,
    unreadCount: 0,
  },
  {
    id: '9',
    name: 'Giana Baptista',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMwNkI2RDQiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOS4zMzk3MiAxNCA2LjkyMTc4IDE1LjMzMzUgNS42ODE3OCAxNy42MzUxQzUuMDc3OCAxOC43NDkxIDUuMDc3OCAxOS45ODQ3IDUuNjgxNzggMjEuMDk4N0M2LjkyMTc4IDIzLjQwMDMgOS4zMzk3MiAyNC43MzM4IDEyIDI0LjczMzhDMTQuNjYwMyAyNC43MzM4IDE3LjA3ODIgMjMuNDAwMyAxOC4zMTgyIDIxLjA5ODdDMTguOTIyMiAxOS45ODQ3IDE4LjkyMjIgMTguNzQ5MSAxOC4zMTgyIDE3LjYzNTFDMTcuMDc4MiAxNS4zMzM1IDE0LjY2MDMgMTQgMTIgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+',
    online: true,
    unreadCount: 0,
  },
  {
    id: '9',
    name: 'Giana Baptista',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMwNkI2RDQiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOS4zMzk3MiAxNCA2LjkyMTc4IDE1LjMzMzUgNS42ODE3OCAxNy42MzUxQzUuMDc3OCAxOC43NDkxIDUuMDc3OCAxOS45ODQ3IDUuNjgxNzggMjEuMDk4N0M2LjkyMTc4IDIzLjQwMDMgOS4zMzk3MiAyNC43MzM4IDEyIDI0LjczMzhDMTQuNjYwMyAyNC43MzM4IDE3LjA3ODIgMjMuNDAwMyAxOC4zMTgyIDIxLjA5ODdDMTguOTIyMiAxOS45ODQ3IDE4LjkyMjIgMTguNzQ5MSAxOC4zMTgyIDE3LjYzNTFDMTcuMDc4MiAxNS4zMzM1IDE0LjY2MDMgMTQgMTIgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+',
    online: true,
    unreadCount: 0,
  },
  {
    id: '9',
    name: 'Giana Baptista',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMwNkI2RDQiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOS4zMzk3MiAxNCA2LjkyMTc4IDE1LjMzMzUgNS42ODE3OCAxNy42MzUxQzUuMDc3OCAxOC43NDkxIDUuMDc3OCAxOS45ODQ3IDUuNjgxNzggMjEuMDk4N0M2LjkyMTc4IDIzLjQwMDMgOS4zMzk3MiAyNC43MzM4IDEyIDI0LjczMzhDMTQuNjYwMyAyNC43MzM4IDE3LjA3ODIgMjMuNDAwMyAxOC4zMTgyIDIxLjA5ODdDMTguOTIyMiAxOS45ODQ3IDE4LjkyMjIgMTguNzQ5MSAxOC4zMTgyIDE3LjYzNTFDMTcuMDc4MiAxNS4zMzM1IDE0LjY2MDMgMTQgMTIgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+',
    online: true,
    unreadCount: 0,
  },
  {
    id: '9',
    name: 'Giana Baptista',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMwNkI2RDQiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOS4zMzk3MiAxNCA2LjkyMTc4IDE1LjMzMzUgNS42ODE3OCAxNy42MzUxQzUuMDc3OCAxOC43NDkxIDUuMDc3OCAxOS45ODQ3IDUuNjgxNzggMjEuMDk4N0M2LjkyMTc4IDIzLjQwMDMgOS4zMzk3MiAyNC43MzM4IDEyIDI0LjczMzhDMTQuNjYwMyAyNC43MzM4IDE3LjA3ODIgMjMuNDAwMyAxOC4zMTgyIDIxLjA5ODdDMTguOTIyMiAxOS45ODQ3IDE4LjkyMjIgMTguNzQ5MSAxOC4zMTgyIDE3LjYzNTFDMTcuMDc4MiAxNS4zMzM1IDE0LjY2MDMgMTQgMTIgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+',
    online: true,
    unreadCount: 0,
  },
  {
    id: '9',
    name: 'Giana Baptista',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMwNkI2RDQiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOS4zMzk3MiAxNCA2LjkyMTc4IDE1LjMzMzUgNS42ODE3OCAxNy42MzUxQzUuMDc3OCAxOC43NDkxIDUuMDc3OCAxOS45ODQ3IDUuNjgxNzggMjEuMDk4N0M2LjkyMTc4IDIzLjQwMDMgOS4zMzk3MiAyNC43MzM4IDEyIDI0LjczMzhDMTQuNjYwMyAyNC43MzM4IDE3LjA3ODIgMjMuNDAwMyAxOC4zMTgyIDIxLjA5ODdDMTguOTIyMiAxOS45ODQ3IDE4LjkyMjIgMTguNzQ5MSAxOC4zMTgyIDE3LjYzNTFDMTcuMDc4MiAxNS4zMzM1IDE0LjY2MDMgMTQgMTIgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+',
    online: true,
    unreadCount: 0,
  },
  {
    id: '9',
    name: 'Giana Baptista',
    lastMessage: 'There are many variations of passages',
    timestamp: '01:10 PM',
    avatar:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMwNkI2RDQiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOS4zMzk3MiAxNCA2LjkyMTc4IDE1LjMzMzUgNS42ODE3OCAxNy42MzUxQzUuMDc3OCAxOC43NDkxIDUuMDc3OCAxOS45ODQ3IDUuNjgxNzggMjEuMDk4N0M2LjkyMTc4IDIzLjQwMDMgOS4zMzk3MiAyNC43MzM4IDEyIDI0LjczMzhDMTQuNjYwMyAyNC43MzM4IDE3LjA3ODIgMjMuNDAwMyAxOC4zMTgyIDIxLjA5ODdDMTguOTIyMiAxOS45ODQ3IDE4LjkyMjIgMTguNzQ5MSAxOC4zMTgyIDE3LjYzNTFDMTcuMDc4MiAxNS4zMzM1IDE0LjY2MDMgMTQgMTIgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+',
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
  let filtered = allConversations.value

  // Apply conversation search filter
  const query = conversationSearchQuery.value
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

// Helper function to highlight search text
function highlightSearchText(text: string, searchTerm: string): string {
  if (!searchTerm.trim())
    return text

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>')
}

// Get initials for avatar fallback
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const activeConversation = computed(() => {
  return allConversations.value.find(
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

function sendMessage(fileAttachments?: FileAttachment[]) {
  // Use pending attachments if no attachments passed
  const attachments = fileAttachments || (pendingAttachments.value.length > 0 ? [...pendingAttachments.value] : undefined)
  
  // If only sending files without text
  if (attachments && attachments.length > 0 && !messageText.value.trim()) {
    const newMessage: Message = {
      id: Date.now().toString(),
      direction: 'in',
      text: '', // Empty text for file-only messages
      senderName: 'Nha Khuyen',
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'sent',
      type: 'file',
      files: attachments,
    }

    // Add message to appropriate conversation
    const isGroup = activeConversationId.value.startsWith('group_')

    if (isGroup) {
      if (!groupMessages.value[activeConversationId.value]) {
        groupMessages.value[activeConversationId.value] = []
      }
      groupMessages.value[activeConversationId.value].push(newMessage)

      // Update group's last message
      const group = groups.value.find(g => g.id === activeConversationId.value)
      if (group) {
        group.lastMessage = '📎 File'
        group.timestamp = newMessage.time
      }
    }
    else {
      messages.value.push(newMessage)

      // Update conversation's last message
      const conversation = conversations.value.find(c => c.id === activeConversationId.value)
      if (conversation) {
        conversation.lastMessage = '📎 File'
        conversation.timestamp = newMessage.time
      }
    }

    // Clear pending attachments after sending
    pendingAttachments.value = []
    
    // Scroll to bottom after sending
    nextTick(() => {
      scrollToBottom()
    })
    return
  }

  // Original text message logic (can have attachments or not)
  if (!messageText.value.trim() && (!attachments || attachments.length === 0))
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
    files: attachments, // Include attachments if provided
  }

  // Add message to appropriate conversation
  const isGroup = activeConversationId.value.startsWith('group_')

  if (isGroup) {
    if (!groupMessages.value[activeConversationId.value]) {
      groupMessages.value[activeConversationId.value] = []
    }
    groupMessages.value[activeConversationId.value].push(newMessage)

    // Update group's last message
    const group = groups.value.find(g => g.id === activeConversationId.value)
    if (group) {
      group.lastMessage = newMessage.text
      group.timestamp = newMessage.time
    }
  }
  else {
    messages.value.push(newMessage)

    // Update conversation's last message
    const conversation = conversations.value.find(c => c.id === activeConversationId.value)
    if (conversation) {
      conversation.lastMessage = newMessage.text
      conversation.timestamp = newMessage.time
    }
  }

  messageText.value = ''
  pendingAttachments.value = [] // Clear pending attachments after sending

  nextTick(() => {
    scrollToBottom()
  })
}

function autoResize(event: Event) {
  const textarea = event.target as HTMLTextAreaElement
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
}

// File Upload Functions
function triggerFileInput() {
  // Show dialog first instead of directly opening file picker
  activeDialog.value = 'upload'
}

function openFilePicker() {
  // This function will open the actual file picker
  fileInput.value?.click()
}

function removePendingAttachment(index: number) {
  pendingAttachments.value.splice(index, 1)
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const files = Array.from(target.files)
    selectedFiles.value = files
    
    // Close upload dialog and show preview dialog
    activeDialog.value = null
    showFilePreviewDialog.value = true
  }
}

function removeFileFromPreview(index: number) {
  selectedFiles.value.splice(index, 1)
  
  // Close dialog if no files left
  if (selectedFiles.value.length === 0) {
    showFilePreviewDialog.value = false
  }
}

function cancelFileUpload() {
  selectedFiles.value = []
  showFilePreviewDialog.value = false
  
  // Reset file input
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

async function confirmAndUploadFiles() {
  showFilePreviewDialog.value = false
  await uploadSelectedFiles()
}

async function uploadSelectedFiles() {
  if (selectedFiles.value.length === 0) return

  try {
    const conversationId = activeConversationId.value
    
    // Upload files
    const result = await uploadFiles(selectedFiles.value, conversationId)

    // Handle successful uploads
    if (result.success.length > 0) {
      // Create file message for each uploaded file
      result.success.forEach((uploadedFile) => {
        const fileMessage: Message = {
          id: `${Date.now()}_${Math.random()}`,
          direction: 'in',
          text: '', // No text for file-only messages
          senderName: 'Nha Khuyen',
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          status: 'sent',
          type: 'file',
          files: [{
            id: uploadedFile.id,
            filename: uploadedFile.filename_download,
            type: uploadedFile.type,
            size: uploadedFile.filesize,
            url: getFileUrl(uploadedFile.id),
            thumbnail: uploadedFile.type.startsWith('image/') 
              ? getThumbnailUrl(uploadedFile.id, 400, 400)
              : undefined,
            width: uploadedFile.width,
            height: uploadedFile.height
          }]
        }

        // Add message to appropriate conversation
        const isGroup = activeConversationId.value.startsWith('group_')

        if (isGroup) {
          if (!groupMessages.value[activeConversationId.value]) {
            groupMessages.value[activeConversationId.value] = []
          }
          groupMessages.value[activeConversationId.value].push(fileMessage)

          // Update group's last message
          const group = groups.value.find(g => g.id === activeConversationId.value)
          if (group) {
            group.lastMessage = `📎 ${uploadedFile.filename_download}`
            group.timestamp = fileMessage.time
          }
        } else {
          messages.value.push(fileMessage)

          // Update conversation's last message
          const conversation = conversations.value.find(c => c.id === activeConversationId.value)
          if (conversation) {
            conversation.lastMessage = `📎 ${uploadedFile.filename_download}`
            conversation.timestamp = fileMessage.time
          }
        }
      })

      // Scroll to bottom to show new messages
      nextTick(() => {
        scrollToBottom()
      })
    }

    // Handle errors
    if (result.errors.length > 0) {
      console.error('Upload errors:', result.errors)
      // TODO: Show error notification to user
    }

  } catch (error) {
    console.error('Error uploading files:', error)
    // TODO: Show error notification to user
  } finally {
    // Clear selected files
    selectedFiles.value = []
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function navigateToMessage(messageId: string) {
  // Keep the search sidebar open - don't close it
  // currentFunction.value = null (removed this line)

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

// Members dialog functions
function openMembersDialog() {
  showMembersDialog.value = true
}

function closeMembersDialog() {
  showMembersDialog.value = false
  memberSearchQuery.value = ''
  selectedMembers.value = []
}

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

// Combine conversations and groups for display
const allConversations = computed(() => {
  const groupsAsConversations: Conversation[] = groups.value.map(group => ({
    id: group.id,
    name: group.name,
    lastMessage: group.lastMessage,
    timestamp: group.timestamp,
    avatar: '', // Will be handled differently for groups
    online: false, // Groups don't have online status
    unreadCount: group.unreadCount,
    type: 'group' as const,
    members: group.members,
  }))

  return [...groupsAsConversations, ...conversations.value]
})

// Get current messages based on active conversation
const currentMessages = computed(() => {
  // Check if current conversation is a group
  const isGroup = activeConversationId.value.startsWith('group_')

  if (isGroup) {
    return groupMessages.value[activeConversationId.value] || []
  }

  // Return individual conversation messages (default messages for now)
  return messages.value
})

// Get selected member objects
const selectedMemberObjects = computed(() => {
  return conversations.value.filter(member =>
    selectedMembers.value.includes(member.id),
  )
})

function createGroup() {
  if (selectedMembers.value.length === 0) {
    return
  }

  // Get selected member names for group name
  const memberNames = selectedMemberObjects.value.map(member => member.name)
  const currentUserName = 'Nha Khuyen' // In real app, get from auth context

  // Create group
  const newGroupId = `group_${Date.now()}`
  const groupName = memberNames.length <= 2
    ? memberNames.join(', ')
    : `${memberNames.slice(0, 2).join(', ')} and ${memberNames.length - 2} others`

  const now = new Date()
  const timestamp = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  const newGroup: Group = {
    id: newGroupId,
    name: groupName,
    lastMessage: `${memberNames.join(', ')} were added to the group by you`,
    timestamp,
    members: [...selectedMembers.value], // Don't include current user ID for now
    unreadCount: 0,
    type: 'group',
    createdAt: now.toISOString(),
    createdBy: currentUserName,
  }

  // Add group to groups array
  groups.value.unshift(newGroup)

  // Add system message to group
  const systemMessage: Message = {
    id: `msg_${Date.now()}`,
    direction: 'in',
    text: `${memberNames.join(', ')} were added to the group by you`,
    senderName: 'System',
    time: timestamp,
    type: 'system',
  }

  // Store group messages (in real app, this would be in a messages store)
  if (!groupMessages.value[newGroupId]) {
    groupMessages.value[newGroupId] = []
  }
  groupMessages.value[newGroupId].push(systemMessage)

  // Switch to the new group conversation
  activeConversationId.value = newGroupId

  // Close dialog and reset selection
  closeMembersDialog()
  selectedMembers.value = []
}

// Filtered members for search
const filteredMembers = computed(() => {
  if (!memberSearchQuery.value.trim()) {
    return conversations.value
  }

  return conversations.value.filter(member =>
    member.name.toLowerCase().includes(memberSearchQuery.value.toLowerCase()),
  )
})

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
      <!-- Search and Filter Section -->
      <div class="p-3 border-neutral-200 space-y-3">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            v-model="conversationSearchQuery"
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
              <!-- Group Avatar (Tam giác 2 trên - 1 dưới) -->
              <div v-if="conversation.type === 'group'" class="relative w-[32px] h-[32px] inline-block">
                <div
                  v-for="(memberId, index) in conversation.members?.slice(0, 3) || []"
                  :key="memberId"
                  class="absolute w-[16px] h-[16px] rounded-full overflow-hidden bg-neutral-100 border border-white"
                  :class="{
                    'top-0 left-[-1px]': index === 0, // Avatar 1: trên trái
                    'top-0 right-[-1px]': index === 1, // Avatar 2: trên phải
                    'bottom-0 left-1/2 -translate-x-1/2': index === 2, // Avatar 3: dưới giữa
                  }"
                >
                  <img
                    :src="
                      conversations.find(c => c.id === memberId)?.avatar
                        || `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          conversations.find(c => c.id === memberId)?.name || 'User',
                        )}&background=random&size=16`
                    "
                    :alt="conversations.find(c => c.id === memberId)?.name || 'User'"
                    class="w-full h-full object-cover"
                  >
                </div>
              </div>

              <!-- Individual Conversation Avatar -->
              <div v-else class="relative inline-block">
                <div
                  class="w-13 h-13 relative rounded-full overflow-hidden bg-neutral-100 border border-black/8"
                >
                  <img
                    :src="
                      conversation.avatar
                        || `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          conversation.name,
                        )}&background=random`
                    "
                    :alt="conversation.name"
                    class="w-10 h-10 object-cover"
                    @error="handleImageError($event, conversation.name)"
                  >
                </div>
                <div
                  v-if="conversation.online"
                  class="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-success-500 border-white"
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
            <!-- Group Header Avatar -->
            <!-- Group Header Avatar -->
            <div
              v-if="activeConversation.type === 'group'"
              class="relative inline-block w-[36px] h-[36px]"
            >
              <!-- Avatar 1 -->
              <div
                v-for="(memberId, index) in activeConversation.members?.slice(0, 3) || []"
                :key="memberId"
                class="absolute w-[18px] h-[18px] rounded-full overflow-hidden bg-neutral-100 border border-white"
                :class="{
                  'top-0 left-[-1px]': index === 0, // Trên - Trái
                  'top-0 right-[-1px]': index === 1, // Trên - Phải
                  'bottom-0 left-1/2 -translate-x-1/2': index === 2, // Dưới - Giữa
                }"
              >
                <img
                  :src="
                    conversations.find(c => c.id === memberId)?.avatar
                      || `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        conversations.find(c => c.id === memberId)?.name || 'User',
                      )}&background=random&size=18`
                  "
                  :alt="conversations.find(c => c.id === memberId)?.name || 'User'"
                  class="w-full h-full object-cover"
                >
              </div>
            </div>

            <!-- Individual Conversation Header Avatar -->
            <div v-else class="relative inline-block">
              <div
                class="w-14 h-14 relative rounded-full overflow-hidden bg-neutral-100 border border-black/8"
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
              @click="openMembersDialog"
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
        <div
          class="min-h-full flex flex-col justify-end"
          :class="{ 'justify-center': currentMessages.length <= 1 }"
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
                  <div class="w-16 h-16 relative rounded-full overflow-hidden bg-neutral-100 border border-black/8">
                    <img
                      :src="activeConversation?.members?.[0] ? conversations.find(c => c.id === activeConversation.members[0])?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conversations.find(c => c.id === activeConversation.members[0])?.name || 'Group')}&background=random&size=64` : `https://ui-avatars.com/api/?name=Group&background=random&size=64`"
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
                    <p class="whitespace-pre-wrap">
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
                    <p class="text-sm font-medium text-gray-900 truncate">{{ file.name }}</p>
                    <p class="text-xs text-gray-500">{{ formatFileSize(file.size) }}</p>
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
        <div v-if="pendingAttachments.length > 0" class="pending-attachments-container">
          <div 
            v-for="(attachment, index) in pendingAttachments"
            :key="attachment.id"
            class="attachment-preview"
          >
            <!-- File Icon/Preview -->
            <div class="attachment-content">
              <div class="file-icon-wrapper">
                <v-icon 
                  :name="getFileIcon(attachment.type)" 
                  class="text-brand-600"
                  small
                />
              </div>
              
              <!-- File Name -->
              <span class="file-name">{{ attachment.filename }}</span>
            </div>

            <!-- Action Buttons -->
            <div class="attachment-actions">
              <!-- Edit button - Opens library to replace file -->
              <v-button
                icon
                secondary
                x-small
                @click="activeDialog = 'choose'"
              >
                <v-icon name="edit" small />
              </v-button>

              <!-- Remove button -->
              <v-button 
                icon
                secondary
                x-small
                @click="removePendingAttachment(index)"
              >
                <v-icon name="delete" small />
              </v-button>
            </div>
          </div>
        </div>

        <!-- Upload Progress Indicator -->
        <div v-if="isUploading" class="upload-progress-container">
          <div class="flex flex-col gap-2 p-4 bg-white border border-gray-200 rounded-lg shadow-lg max-w-md">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-gray-700">Uploading files...</span>
              <span class="text-xs text-gray-500">{{ uploadProgress.size }} file(s)</span>
            </div>
            <div 
              v-for="[fileId, progress] in Array.from(uploadProgress.entries())"
              :key="fileId"
              class="flex flex-col gap-1"
            >
              <div class="flex items-center justify-between text-xs">
                <span class="truncate max-w-[200px] text-gray-600">{{ progress.fileName }}</span>
                <span 
                  class="font-medium"
                  :class="{
                    'text-blue-600': progress.status === 'uploading',
                    'text-green-600': progress.status === 'success',
                    'text-red-600': progress.status === 'error'
                  }"
                >
                  {{ progress.status === 'success' ? '✓' : progress.status === 'error' ? '✗' : `${progress.progress}%` }}
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  class="h-1.5 rounded-full transition-all duration-300"
                  :class="{
                    'bg-blue-600': progress.status === 'uploading',
                    'bg-green-600': progress.status === 'success',
                    'bg-red-600': progress.status === 'error'
                  }"
                  :style="{ width: `${progress.progress}%` }"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-end gap-3">
          <div class="flex gap-2">
            <Story>
              <!-- Menu với 3 options upload -->
              <v-menu :offset-y="-150" :offset-x="127">
                <template #activator="{ toggle }">
                  <v-icon
                    clickable
                    class="options"
                    name="attach_file"
                    @click="toggle"
                  />
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
              @keydown.enter.exact.prevent="(messageText.trim() || pendingAttachments.length > 0) && sendMessage()"
              @input="autoResize"
            />

            <button
              :disabled="!messageText.trim() && pendingAttachments.length === 0"
              class="w-9 h-9 flex items-center justify-center rounded-md hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed text-black transition-colors"
              @click="sendMessage()"
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

    <!-- Members Selection Dialog -->
    <div
      v-if="showMembersDialog"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]"
      @click.self="closeMembersDialog"
    >
      <div class="bg-[#F0F4F9] rounded-lg shadow-xl w-[500px] max-h-[55vh] flex flex-col overflow-hidden">
        <!-- Dialog Header -->
        <div class="flex items-center justify-between pt-4 px-4 border-gray-200">
          <h2 class="text-xl font-medium text-black">
            Select members
          </h2>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
            @click="closeMembersDialog"
          >
            <svg width="30" height="30" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>

        <!-- Dialog Content -->
        <div class="flex-1 flex flex-col p-3 space-y-3 overflow-hidden">
          <!-- Search Input with Selected Members -->
          <div class="relative border border-gray-200 rounded-lg bg-white">
            <div class="flex flex-wrap gap-1 p-2">
              <!-- Selected Member Chips -->
              <div
                v-for="member in selectedMemberObjects"
                :key="`selected-${member.id}`"
                class="inline-flex items-center gap-1 bg-[#F0F4F9] border border-[#D3DAE4] rounded-md px-2 py-1"
              >
                <!-- Small Avatar -->
                <div class="w-6 h-6 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                  <img
                    :src="member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`"
                    :alt="member.name"
                    class="w-full h-full object-cover"
                    @error="handleImageError($event, member.name)"
                  >
                </div>
                <!-- Member Name -->
                <span class="text-xs font-medium text-[#344054]">{{ member.name }}</span>
                <!-- Remove Button -->
                <button
                  class="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
                  @click="removeMember(member.id)"
                >
                  <svg width="7" height="7" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 3L3 9M3 3L9 9" stroke="#4F5464" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>

              <!-- Search Input -->
              <input
                v-model="memberSearchQuery"
                type="text"
                placeholder="Search a member"
                class="flex-1 min-w-[120px] px-1 py-1 text-sm bg-transparent border-none outline-none"
              >
            </div>
          </div>

          <!-- Description -->
          <p class="text-base text-gray-400">
            You can add unlimited members
          </p>

          <!-- Members List -->
          <div class="flex-1 space-y-2 pr-1 scroll-style overflow-y-auto">
            <div
              v-for="member in filteredMembers"
              :key="member.id"
              class="flex items-center gap-4 p-2 hover:bg-gray-50 rounded-md cursor-pointer"
              @click="toggleMemberSelection(member.id)"
            >
              <!-- Checkbox -->
              <div class="relative">
                <input
                  :id="`member-${member.id}`"
                  type="checkbox"
                  :checked="selectedMembers.includes(member.id)"
                  class="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-"
                  @click.stop
                  @change="toggleMemberSelection(member.id)"
                >
              </div>

              <!-- Avatar and Name -->
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                  <img
                    :src="member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`"
                    :alt="member.name"
                    class="w-full h-full object-cover"
                    @error="handleImageError($event, member.name)"
                  >
                </div>
                <p class="text-sm font-medium text-gray-900">
                  {{ member.name }}
                </p>
              </div>
            </div>
          </div>

          <VDivider />

          <!-- Create Group Button -->
          <div class="pt-2">
            <button
              :disabled="selectedMembers.length === 0"
              class="w-full py-3 text-sm font-medium rounded-md transition-colors"
              :class="selectedMembers.length > 0
                ? 'bg-[#6644FF] text-white hover:bg-[#5533DD]'
                : 'bg-gray-200 text-gray-600 cursor-not-allowed'"
              @click="createGroup"
            >
              Create a group
            </button>
          </div>
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
  padding: 16px 31px;
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
  padding: 12px 0px;
  background: var(--background-page, white);
  scroll-behavior: smooth;
}

/* Pending Attachments Preview */
.pending-attachments-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.attachment-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px;
  background: white;
  border: 2px solid #D3DAE4;
  border-radius: 6px;
  transition: border-color 0.2s;
}

.attachment-preview:hover {
  border-color: #B8C5D6;
}

.attachment-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.file-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: #F0ECFF;
  border-radius: 6px;
  flex-shrink: 0;
}

.file-name {
  font-family: Inter;
  font-weight: 500;
  font-size: 14px;
  line-height: 1.21;
  color: #0461cc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.attachment-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background: #F3F4F6;
}

.remove-btn:hover svg path {
  stroke: #EF4444;
}

.upload-progress-container {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.message-input {
  position: relative;
  flex-shrink: 0;
  min-height: 50px;
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
/* Scroll style dùng chung cho toàn app */
.scroll-style::-webkit-scrollbar {
  width: 6px;
}
.scroll-style::-webkit-scrollbar-track {
  background: transparent;
}
.scroll-style::-webkit-scrollbar-thumb {
  background: var(--border-normal, #d3dae4);
  border-radius: 3px;
}
.scroll-style::-webkit-scrollbar-thumb:hover {
  background: var(--border-subdued, #a2b5cd);
}
</style>
